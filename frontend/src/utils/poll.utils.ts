import {
  AbiCoder,
  BytesLike,
  ContractTransactionReceipt,
  getAddress,
  getBytes,
  JsonRpcProvider,
  ParamType,
} from 'ethers'

// XXX: cborg module types can cause error:
//    There are types at './dapp-sidedao/frontend/node_modules/cborg/types/cborg.d.ts',
//    but this result could not be resolved when respecting package.json "exports".
//    The 'cborg' library may need to update its package.json or typings.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { decode as cborDecode, encode as cborEncode } from 'cborg'

import {
  chain_info,
  erc20TokenDetailsFromProvider,
  xchainRPC,
  AclOptions,
  guessStorageSlot,
  getNftContractType,
  ChainDefinition,
  IPollACL__factory,
  TokenInfo,
  NFTInfo,
  nftDetailsFromProvider,
  ContractType,
  GaslessVoting__factory,
} from '@oasisprotocol/blockvote-contracts'
export type { ContractType, NftType } from '@oasisprotocol/blockvote-contracts'
export { isToken } from '@oasisprotocol/blockvote-contracts'
import {
  FLAG_ACTIVE,
  FLAG_HIDDEN,
  FLAG_PUBLISH_VOTERS,
  FLAG_PUBLISH_VOTES,
  MarkdownCode,
  Poll,
  PollManager,
  StoredPoll,
} from '../types'
import { EthereumContext } from '../providers/EthereumContext'
import {
  DecisionWithReason,
  denyWithReason,
  basicExecutionContext,
  ExecutionContext,
} from '../components/InputFields'
import { FetcherFetchOptions } from './StoredLRUCache'
import { findACLForOptions } from '../components/ACLs'
import { VITE_NETWORK_NUMBER } from '../constants/config'
import { getLink } from './markdown.utils'
import { StringUtils } from './string.utils'

export { parseEther } from 'ethers'

export const chainsForXchain: [number, string][] = Object.keys(chain_info)
  .map(id => parseInt(id))
  .filter(chainId => !chain_info[chainId].cannotMakeStorageProofs)
  .map(chainId => [chainId, chain_info[chainId].name])

// Check if an address is valid
export const isValidAddress = (address: string) => {
  try {
    getAddress(address)
  } catch (e: any) {
    if (e.code == 'INVALID_ARGUMENT') {
      return false
    } else {
      console.log('Unknown problem:', e)
      return true
    }
  }
  return true
}

export const getLocalContractDetails = async (address: string) =>
  getContractDetails(VITE_NETWORK_NUMBER, address)

/**
 *  Encode the %%values%% as the %%types%% into ABI data.
 *
 *  @returns DataHexstring
 */
export const abiEncode = (types: ReadonlyArray<string | ParamType>, values: ReadonlyArray<any>): string => {
  const abi = AbiCoder.defaultAbiCoder()
  return abi.encode(types, values)
}

export const RPC_ERROR = 'rpc-error'

export const getERC20TokenDetails = async (
  chainId: number,
  address: string,
): Promise<TokenInfo | typeof RPC_ERROR | undefined> => {
  const rpc = xchainRPC(chainId)
  try {
    return await erc20TokenDetailsFromProvider(getAddress(address), rpc)
  } catch (e) {
    if (typeof e === 'object' && ((e as any).value?.[0] as any)?.code === -32005) return RPC_ERROR
    return undefined
  }
}

export const getNftDetails = async (
  chainId: number,
  address: string,
): Promise<NFTInfo | typeof RPC_ERROR | undefined> => {
  const rpc = xchainRPC(chainId)
  try {
    return await nftDetailsFromProvider(getAddress(address), rpc)
  } catch (e) {
    if (typeof e === 'object' && ((e as any).value?.[0] as any)?.code === -32005) return RPC_ERROR
    return undefined
  }
}

const tokenInfoCache: Map<string, TokenInfo | NFTInfo> = new Map([
  [
    '1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    {
      addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      chainId: 1n,
      decimals: 6n,
      name: 'USD Coin',
      symbol: 'USDC',
      totalSupply: 41377134270643937n,
      type: 'ERC-20',
    },
  ],
])

export const getContractDetails = async (
  chainId: number,
  address: string,
): Promise<TokenInfo | NFTInfo | typeof RPC_ERROR | undefined> => {
  console.log('poll.utils.ts getContractDetails()')
  const key = `${chainId}:${address.toLowerCase()}`
  if (tokenInfoCache.has(key)) {
    return tokenInfoCache.get(key)
  } else {
    const result = (await getERC20TokenDetails(chainId, address)) ?? (await getNftDetails(chainId, address))
    if (!!result && result !== RPC_ERROR) {
      tokenInfoCache.set(key, result)
    }
    return result
  }
}

export const getChainDefinition = (chainId: number): ChainDefinition | undefined => chain_info[chainId]

export const checkXchainTokenHolder = async (
  chainId: number,
  tokenAddress: string,
  contractType: ContractType,
  holderAddress: string,
  isStillFresh: () => boolean = () => true,
  progressCallback?: (progress: string) => void,
) => {
  const rpc = xchainRPC(chainId)
  try {
    return await guessStorageSlot(
      rpc,
      tokenAddress,
      contractType,
      holderAddress,
      'latest',
      isStillFresh,
      progressCallback,
    )
  } catch (e) {
    if (typeof e === 'object' && ((e as any).value?.[0] as any)?.code === -32005) return RPC_ERROR
    return undefined
  }
}

export const getNftType = async (chainId: number, address: string): Promise<string | undefined> => {
  const rpc = xchainRPC(chainId)
  return getNftContractType(address, rpc)
}

export const getLatestBlock = async (chainId: number) => {
  try {
    return await xchainRPC(chainId).getBlock('latest')
  } catch (e) {
    return RPC_ERROR
  }
}

export type CreatePollProps = {
  question: string
  description: string
  answers: string[]
  isHidden: boolean
  aclData: string
  aclAddress: string
  aclOptions: AclOptions
  pollFlags: bigint
  subsidizeAmount: bigint | undefined
  publishVotes: boolean
  publishVoters: boolean
  completionTime: Date | undefined
  explorerBaseUrl: string | undefined
}

const CURRENT_ENCODING_VERSION = 0

const encodePollMetadata = (poll: Poll): Uint8Array => {
  const storedPoll: StoredPoll = {
    n: poll.name,
    d: poll.description,
    o: poll.choices,
    a: poll.acl,
  }

  const encoded = cborEncode([CURRENT_ENCODING_VERSION, storedPoll])
  // console.log('Encoded poll data', encoded)
  return encoded
}

export const decodePollMetadata = (metadata: string): Poll => {
  const [v, storedPoll] = cborDecode(getBytes(metadata))

  if (typeof v !== 'number') throw new Error('Unknown poll data format')

  let poll: Poll | undefined

  switch (v as number) {
    case CURRENT_ENCODING_VERSION:
      poll = {
        name: storedPoll.n,
        description: storedPoll.d,
        choices: storedPoll.o,
        acl: storedPoll.a,
      }
      return poll
    default:
      throw new Error(`Unrecognized poll data format version: ${v}`)
  }
}

export const createPoll = async (
  pollManager: PollManager,
  creator: string,
  props: CreatePollProps,
  context: ExecutionContext = basicExecutionContext,
) => {
  const {
    question,
    description,
    answers,
    aclAddress,
    aclData,
    aclOptions,
    pollFlags: extraFlags,
    isHidden,
    subsidizeAmount,
    publishVotes,
    publishVoters,
    completionTime,
    explorerBaseUrl,
  } = props

  context.setStatus('Compiling data')
  const poll: Poll = {
    name: question,
    description,
    choices: answers,
    acl: aclOptions,
  }

  // console.log('Compiling poll', poll)

  let pollFlags: bigint = FLAG_ACTIVE | extraFlags

  if (publishVoters) pollFlags |= FLAG_PUBLISH_VOTERS
  if (publishVotes) pollFlags |= FLAG_PUBLISH_VOTES
  if (isHidden) pollFlags |= FLAG_HIDDEN

  const proposalParams: PollManager.ProposalParamsStruct = {
    metadata: encodePollMetadata(poll),
    numChoices: answers.length,
    closeTimestamp: completionTime ? Math.round(completionTime.getTime() / 1000) : 0,
    acl: aclAddress,
    flags: pollFlags,
  }

  console.log('params are', proposalParams)
  console.log('ACL data is', aclData)

  context.setStatus('Waiting for signer...')
  const createProposalTx = await pollManager.create(proposalParams, aclData, {
    value: subsidizeAmount ?? 0n,
  })

  console.log('TX created.', createProposalTx)

  const url = explorerBaseUrl
    ? StringUtils.getTransactionUrl(explorerBaseUrl, createProposalTx.hash)
    : undefined

  const txLink = getLink({
    href: url,
    label: 'transaction',
  })

  console.log('doCreatePoll: creating proposal tx', createProposalTx.hash)

  context.setStatus(`Sending ${txLink} ...`, 10) // TODO: measure this

  const receipt = (await createProposalTx.wait())!
  if (receipt.status !== 1) {
    console.log('Receipt is', receipt)
    throw new Error(`createProposal ${txLink} receipt reported failure.`)
  }
  context.log('Created poll')
  if (isHidden) {
    const proposalId = await pollManager.getProposalId(proposalParams, aclData, creator)
    console.log('Created poll with hidden (predicted) proposal id is:', proposalId)
    return proposalId
  } else {
    const proposalId = receipt.logs[0].data
    console.log('doCreatePoll: Proposal ID is', proposalId)
    return proposalId
  }
}

/**
 * When a poll is closed or destroyed, it may emit signed transactions in events
 * to return the gas subsidy to the poll owner. These must be broadcast back to
 * the network for the refunds to be processed.
 *
 * @param receipt Receipt of the `close` or `destroy` transaction
 * @param pollManager Instance of the poll manager
 */
async function detectGasRefundOnCompletion(receipt: ContractTransactionReceipt, pollManager: PollManager) {
  const iface = GaslessVoting__factory.createInterface()
  const gvAddr = await pollManager.GASLESS_VOTER()
  for (const log of receipt.logs) {
    if (log.address !== gvAddr) {
      continue
    }
    const result = iface.parseLog({
      topics: log.topics as string[],
      data: log.data,
    })
    if (result && result.name === 'GasWithdrawTransaction') {
      const refundTx = await pollManager.runner?.provider?.broadcastTransaction(result.args[0])
      console.log('refundTx', refundTx)
      refundTx?.wait().then(receipt => {
        console.log('Refund tx completed, receipt:', receipt)
      })
    }
  }
}

export const completePoll = async (
  eth: EthereumContext,
  pollManager: PollManager,
  proposalId: string,
  context: ExecutionContext = basicExecutionContext,
) => {
  await eth.switchNetwork() // ensure we're on the correct network first!
  context.setStatus('Waiting for signer...')
  const tx = await pollManager.close(proposalId)
  const txLink = getLink({
    href: eth.explorerBaseUrl ? StringUtils.getTransactionUrl(eth.explorerBaseUrl, tx.hash) : undefined,
    label: 'transaction',
  })
  context.setStatus(`Sending ${txLink}...`, 10)
  const receipt = await tx.wait()
  if (!receipt || receipt!.status != 1) throw new Error(`Complete ballot ${txLink} failed`)
  context.setStatus('Waiting for gas to be refunded...')
  await detectGasRefundOnCompletion(receipt, pollManager)
}

// Destroying the poll will automatically close it first
export const destroyPoll = async (
  eth: EthereumContext,
  pollManager: PollManager,
  proposalId: string,
  context: ExecutionContext = basicExecutionContext,
) => {
  await eth.switchNetwork() // ensure we're on the correct network first!
  context.setStatus('Waiting for signer...')
  const tx = await pollManager.destroy(proposalId)
  const txLink = getLink({
    href: eth.explorerBaseUrl ? StringUtils.getTransactionUrl(eth.explorerBaseUrl, tx.hash) : undefined,
    label: 'transaction',
  })
  context.setStatus(`Sending ${txLink}...`, 10)
  const receipt = await tx.wait()
  if (!receipt || receipt!.status != 1) throw new Error(`Destroy poll ${txLink} failed`)
  context.setStatus('Waiting for gas to be refunded...')
  await detectGasRefundOnCompletion(receipt, pollManager)
}

export type PollPermissions = {
  proof: BytesLike
  explanation: MarkdownCode | undefined
  canVote: DecisionWithReason
  error: string
}

export type CheckPermissionInputs = {
  userAddress: string
  proposalId: string
  aclAddress: string
  options: AclOptions
}

export type CheckPermissionContext = {
  daoAddress: string
  provider: JsonRpcProvider
}

export const checkPollPermission = async (
  input: CheckPermissionInputs,
  context: CheckPermissionContext,
  fetchOptions?: FetcherFetchOptions<PollPermissions, CheckPermissionContext>,
): Promise<PollPermissions | undefined> => {
  const { daoAddress, provider } = context
  const { userAddress, proposalId, aclAddress, options } = input

  const pollACL = IPollACL__factory.connect(aclAddress, provider)
  const acl = findACLForOptions(options)

  if (!acl) {
    return {
      proof: '',
      explanation: '',
      canVote: denyWithReason(
        'this poll has some unknown access control settings. (Poll created by newer version of software?)',
      ),
      error: '',
    }
  }

  const {
    canVote,
    explanation = '',
    proof,
    error = '',
    ...extra
  } = await acl.checkPermission(pollACL, daoAddress, proposalId, userAddress, options as any)

  if (error && fetchOptions) fetchOptions.ttl = 1000

  return {
    proof,
    explanation,
    error,
    ...extra,
    canVote,
  }
}
