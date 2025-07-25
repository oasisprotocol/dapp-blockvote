import { CheckPermissionResults, defineACL } from './common'
import {
  basicExecutionContext,
  Choice,
  DecisionWithReason,
  denyWithReason,
  SingleOrArray,
  useOneOfField,
  useTextField,
  ValidatorOutput,
} from '../InputFields'
import {
  abiEncode,
  chainsForXchain,
  checkXchainTokenHolder,
  getChainDefinition,
  getContractDetails,
  getLatestBlock,
  isToken,
  isValidAddress,
  RPC_ERROR,
} from '../../utils/poll.utils'
import {
  AclOptionsXchain,
  fetchAccountProof,
  fetchMiniMeAccountProof,
  fetchStorageProof,
  fetchStorageValue,
  getBlockHeaderRLP,
  getMiniMeAccountBalance,
  getMiniMeBlockHeaderRLP,
  xchainRPC,
} from '@oasisprotocol/blockvote-contracts'
import type { TokenInfo, NFTInfo } from '@oasisprotocol/blockvote-contracts'
import {
  designDecisions,
  VITE_APP_HARDWIRED_NETWORK,
  VITE_APP_HARDWIRED_TOKEN_ADDRESS,
  VITE_APP_HARDWIRED_TOKEN_HOLDER,
  VITE_APP_HARDWIRED_VOTE_WEIGHTING,
  VITE_CONTRACT_ACL_STORAGEPROOF,
  VITE_CONTRACT_ACL_MINIME_STORAGE,
} from '../../constants/config'
import { BytesLike, getBytes, getUint, hexlify, keccak256 } from 'ethers'
import { useMemo, useState } from 'react'
import { StringUtils } from '../../utils/string.utils'
import { FLAG_WEIGHT_LOG10, FLAG_WEIGHT_ONE } from '../../types'
import { getLink } from '../../utils/markdown.utils'

const RPC_ERROR_MESSAGE = 'Error while communicating with blockchain! Click to try again.'

type ConfigValues = {
  chainId: number
  contractAddress: string
  contractDetails: TokenInfo | NFTInfo
  slotNumber: number
  blockHash: string
  flags: bigint
}

export const xchain = defineACL({
  value: 'acl_xchain',
  label: 'Token Snapshot voting',
  costEstimation: 0.2,
  description: 'take a snapshot of token or NFT balances from another chain',
  useConfiguration: active => {
    const chainChoices: Choice<number>[] = useMemo(
      () =>
        chainsForXchain.map(([id, name]) => ({
          value: id,
          label: `${name} (${id})`,
        })),
      [],
    )

    const chain = useOneOfField({
      name: 'chainId',
      label: 'Chain',
      visible: active && (!designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_NETWORK),
      enabled: !VITE_APP_HARDWIRED_NETWORK,
      choices: chainChoices,
      initialValue: VITE_APP_HARDWIRED_NETWORK,
      onValueChange: (_, isStillFresh) => {
        if (contractAddress.isValidated) {
          void contractAddress.validate({ forceChange: true, reason: 'change', isStillFresh })
        }
      },
    })

    const explorer = (getChainDefinition(chain.value)?.explorers ?? [])[0]
    const explorerUrl = explorer?.url
    const [contractDetails, setContractDetails] = useState<TokenInfo | NFTInfo>()

    const contractAddress = useTextField({
      name: 'contractAddress',
      label: 'Contract Address',
      visible: active && (!designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_TOKEN_ADDRESS),
      enabled: !VITE_APP_HARDWIRED_TOKEN_ADDRESS,
      placeholder: 'Contract address on chain. (Token or NFT)',
      initialValue: VITE_APP_HARDWIRED_TOKEN_ADDRESS,
      required: [true, 'Please specify the address on the other chain that is the key to this poll!'],
      validators: [
        value => (isValidAddress(value) ? undefined : "This doesn't seem to be a valid address."),
        async (value, controls): Promise<SingleOrArray<ValidatorOutput>> => {
          controls.updateStatus({ message: 'Checking out contract...' })
          const tokenUrl = explorerUrl ? StringUtils.getAccountUrl(explorerUrl, value) : undefined
          const details = await getContractDetails(chain.value, value)
          if (details === RPC_ERROR) return RPC_ERROR_MESSAGE
          if (details) {
            setContractDetails(details)
            const output: ValidatorOutput[] = []
            output.push(
              { type: 'info', text: `**Type:** ${details.type}` },
              {
                type: 'info',
                text: `**${isToken(details.type) ? 'Token' : 'NFT'}:** ${getLink({
                  label: details.name ?? StringUtils.truncateAddress(details.addr),
                  href: tokenUrl,
                })}`,
              },
            )
            if (details.symbol) output.push({ type: 'info', text: `**Symbol:** ${details.symbol}` })

            switch (details.type) {
              case 'MiniMe':
                break
              case 'ERC-20':
                break
              case 'ERC-721':
                break
              case 'ERC-1155':
                output.push(
                  'Unfortunately, ERC-1155 NFTs are Not supported at the moment. Please use another token of NFT.',
                )
                break
              default:
                output.push(
                  "We can't recognize this as a supported contract. Please use another token or NFT.",
                )
            }
            return output
          } else {
            return 'Failed to load token details!'
          }
        },
      ],
      validateOnChange: true,
      validateEvenIfHidden: active,
      showValidationSuccess: true,
      onValueChange: (_, isStillFresh) => {
        if (walletAddress.isValidated) {
          void walletAddress.validate({ forceChange: true, reason: 'change', isStillFresh })
        }
      },
    })

    const hasValidTokenAddress = active && contractAddress.isValidated && !contractAddress.hasProblems

    const [slotNumber, setSlotNumber] = useState(0)
    const [blockHash, setBlockHash] = useState('')

    const walletAddress = useTextField({
      name: 'walletAddress',
      label: 'Wallet Address',
      visible:
        hasValidTokenAddress && (!designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_TOKEN_HOLDER),
      placeholder: 'Wallet address of a token holder on chain',
      required: [true, 'Please specify the address of a token holder!'],
      initialValue: VITE_APP_HARDWIRED_TOKEN_HOLDER,
      enabled: !VITE_APP_HARDWIRED_TOKEN_HOLDER,
      validators: [
        value => (isValidAddress(value) ? undefined : "This doesn't seem to be a valid address."),
        async (value, controls) => {
          if (!hasValidTokenAddress) return `Please set ${contractAddress.label} first!`
          if (!contractDetails) return "Can't find token details!"
          const slot = await checkXchainTokenHolder(
            chain.value,
            contractAddress.value,
            contractDetails.type,
            isToken(contractDetails.type) ? (contractDetails as TokenInfo).decimals : 0n,
            value,
            controls.isStillFresh,
            progress => {
              controls.updateStatus({ message: progress })
            },
          )
          if (slot === RPC_ERROR) return RPC_ERROR_MESSAGE
          if (!slot) {
            const walletUrl = explorerUrl ? StringUtils.getAccountUrl(explorerUrl, value) : undefined
            if (contractDetails.type === 'ERC-721') {
              return `Can't find this NFT in ${getLink({ href: walletUrl, label: 'this wallet' })}. Please note the not all ERC-721 NFTs are supported. This one might not be. If this is important, please open an issue.`
            } else {
              return `Can't confirm this token in ${getLink({ href: walletUrl, label: 'this wallet' })}.`
            }
          }
          setSlotNumber(slot.index)
          const output: ValidatorOutput[] = []
          output.push({
            type: 'info',
            text: `**Balance:** confirmed ${slot.balanceDecimal} ${contractDetails.symbol} (at slot #${slot.index})`,
          })
          controls.updateStatus({ message: 'Looking up reference block ...' })
          const block = await getLatestBlock(chain.value)
          if (block === RPC_ERROR) return RPC_ERROR_MESSAGE
          if (!block?.hash) return 'Failed to fetch latest block.'
          setBlockHash(block.hash)
          // blockHash.setValue(block.hash)
          // blockHeight.setValue(block.number.toString())
          const blockUrl = StringUtils.getBlockUrl(explorerUrl, block.number)
          output.push({
            type: 'info',
            text: `Taking snapshot of block ${getLink({ label: block.number.toString(), href: blockUrl })}.`,
          })
          return output
        },
      ],
      validateOnChange: hasValidTokenAddress,
      validateEvenIfHidden: active,
      showValidationSuccess: true,
    })

    const voteWeighting = useOneOfField({
      name: 'voteWeighting',
      label: 'Vote weight',
      visible: active && (!designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_VOTE_WEIGHTING),
      enabled: !VITE_APP_HARDWIRED_VOTE_WEIGHTING,
      initialValue: VITE_APP_HARDWIRED_VOTE_WEIGHTING,
      choices: [
        {
          value: 'weight_perWallet',
          label: '1 vote per wallet',
        },
        {
          value: 'weight_perToken',
          label: 'According to token distribution',
        },
        {
          value: 'weight_perLog10Token',
          label: 'According to log10(token distribution)',
        },
      ] as const,
      hideDisabledChoices: designDecisions.hideDisabledSelectOptions,
      disableIfOnlyOneVisibleChoice: designDecisions.disableSelectsWithOnlyOneVisibleOption,
    } as const)

    const weightToFlags = (selection: typeof voteWeighting.value): bigint => {
      switch (selection) {
        case 'weight_perWallet':
          return FLAG_WEIGHT_ONE
        case 'weight_perToken':
          return 0n
        case 'weight_perLog10Token':
          return FLAG_WEIGHT_LOG10
        default:
          throw new Error(`Unknown vote weight mapping "${selection}"!`)
      }
    }

    const values: ConfigValues = {
      chainId: chain.value,
      contractAddress: contractAddress.value,
      contractDetails: contractDetails!,
      slotNumber,
      blockHash,
      flags: weightToFlags(voteWeighting.value),
    }

    return {
      fields: [chain, contractAddress, walletAddress, voteWeighting],
      values,
    }
  },

  getAclOptions: async (
    { chainId, contractAddress, contractDetails, slotNumber, blockHash, flags }: ConfigValues,
    context = basicExecutionContext,
  ) => {
    const rpc = xchainRPC(chainId)
    const isMiniMe = contractDetails.type === 'MiniMe'
    context.setStatus('Getting block header RLP')
    const headerRlpBytes = isMiniMe
      ? await getMiniMeBlockHeaderRLP(rpc, { hash: blockHash })
      : await getBlockHeaderRLP(rpc, blockHash)
    // console.log('headerRlpBytes', headerRlpBytes);
    context.setStatus('Fetching account proof')
    const rlpAccountProof = isMiniMe
      ? await fetchMiniMeAccountProof(rpc, { hash: blockHash }, contractAddress)
      : await fetchAccountProof(rpc, blockHash, contractAddress)
    // console.log('rlpAccountProof', rlpAccountProof);

    const options: AclOptionsXchain = {
      xchain: {
        c: chainId,
        b: getBytes(blockHash),
        a: getBytes(contractAddress),
        s: slotNumber,
      },
    }

    return isMiniMe
      ? {
          aclAddress: VITE_CONTRACT_ACL_MINIME_STORAGE,
          data: abiEncode(
            ['tuple(tuple(bytes32,address,uint256,bool),bytes,bytes)'],
            [
              [
                [keccak256(headerRlpBytes), contractAddress, slotNumber, true], // PollConfig
                headerRlpBytes, // Block header for caching
                rlpAccountProof, // Account proof for caching
              ],
            ],
          ),
          options,
          flags,
        }
      : {
          aclAddress: VITE_CONTRACT_ACL_STORAGEPROOF,
          data: abiEncode(
            ['tuple(tuple(bytes32,address,uint256),bytes,bytes)'],
            [[[blockHash, contractAddress, slotNumber], headerRlpBytes, rlpAccountProof]],
          ),
          options,
          flags,
        }
  },

  isThisMine: options => 'xchain' in options,

  checkPermission: async (
    pollACL,
    daoAddress,
    proposalId,
    userAddress,
    options,
  ): Promise<CheckPermissionResults> => {
    const { xchain } = options
    const chainId = xchain.c
    const blockHash = hexlify(Uint8Array.from(Object.values(xchain.b)))
    const tokenAddress = hexlify(Uint8Array.from(Object.values(xchain.a)))
    const slot = xchain.s

    let explanation = ''
    let error = ''
    let proof: BytesLike = ''
    let tokenInfo: TokenInfo | NFTInfo | typeof RPC_ERROR | undefined
    let canVote: DecisionWithReason = true
    const provider = xchainRPC(chainId)
    const chainDefinition = getChainDefinition(chainId)

    if (!chainDefinition) {
      return {
        canVote: denyWithReason('this poll references an unknown chain'),
        explanation: 'This poll is invalid, since it references and unknown chain.',
        error,
        proof,
      }
    }

    const explorer = (chainDefinition.explorers ?? [])[0]
    const explorerUrl = explorer?.url

    const tokenUrl = explorerUrl ? StringUtils.getAccountUrl(explorerUrl, tokenAddress) : undefined
    try {
      tokenInfo = await getContractDetails(chainId, tokenAddress)
      if (tokenInfo === RPC_ERROR) throw new Error(RPC_ERROR_MESSAGE)
      if (!tokenInfo) throw new Error("Can't load token details")
      explanation = `This poll is only for those who have hold ${getLink({ label: tokenInfo?.name ?? StringUtils.truncateAddress(tokenInfo.addr), href: tokenUrl })} on ${getLink({ label: chainDefinition.name, href: explorerUrl })} when the poll was created.`
      let isBalancePositive = false

      if (tokenInfo.type === 'MiniMe') {
        const {
          balance: holderBalance,
          balanceString,
          voteData,
        } = await getMiniMeAccountBalance(
          provider,
          tokenAddress,
          userAddress,
          slot,
          {
            hash: blockHash,
          },
          true,
        )

        if (holderBalance > 0n) {
          console.log('Holder balance seems to be', balanceString)
          const result = await pollACL.canVoteOnPoll(daoAddress, proposalId, userAddress, voteData!)
          if (result > 0) {
            isBalancePositive = true
            canVote = true
            proof = voteData!
          }
        }
      } else {
        const holderBalance = getUint(
          await fetchStorageValue(provider, blockHash, tokenAddress, slot, userAddress),
        )
        if (holderBalance > BigInt(0)) {
          // Only attempt to get a proof if the balance is non-zero
          proof = await fetchStorageProof(provider, blockHash, tokenAddress, slot, userAddress)
          const result = await pollACL.canVoteOnPoll(daoAddress, proposalId, userAddress, proof)
          if (0n !== result) {
            isBalancePositive = true
            canVote = true
          }
        }
      }
      if (!isBalancePositive) {
        canVote = denyWithReason(
          `you don't hold any ${getLink({ label: tokenInfo.name ?? StringUtils.truncateAddress(tokenAddress), href: tokenUrl })} on ${getLink({ label: chainDefinition.name, href: explorerUrl })}`,
        )
      }
    } catch (e) {
      const problem = e as any
      error = problem.error?.message ?? problem.reason ?? problem.code ?? problem
      console.error('Error when testing permission to vote on', proposalId, ':', error)
      console.error('proof:', proof)
      canVote = denyWithReason(`there was a technical problem verifying your permissions`)
    }
    return { canVote, explanation, error, proof }
  },
} as const)
