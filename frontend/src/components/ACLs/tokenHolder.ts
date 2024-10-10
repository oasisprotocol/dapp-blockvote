import { CheckPermissionResults, defineACL } from './common'
import { DecisionWithReason, denyWithReason, useOneOfField, useTextField } from '../InputFields'
import { abiEncode, getLocalContractDetails, isValidAddress } from '../../utils/poll.utils'
import {
  configuredExplorerUrl,
  configuredNetworkName,
  designDecisions,
  VITE_CONTRACT_ACL_TOKENHOLDER,
} from '../../constants/config'
import { StringUtils } from '../../utils/string.utils'
import { FLAG_WEIGHT_LOG10, FLAG_WEIGHT_ONE } from '../../types'
import { getLink } from '../../utils/markdown.utils'

export const tokenHolder = defineACL({
  value: 'acl_tokenHolder',
  address: VITE_CONTRACT_ACL_TOKENHOLDER,
  costEstimation: 0.2,
  label: `Active Token or NFT balance on ${configuredNetworkName}`,
  description:
    "Please note that this options doesn't take a snapshot of the balances, so if someone votes, and then the tokens are moved to another account, that other account will be able to vote, too. If this is not what you want, then consider using the snapshot option.",
  hidden: false,
  useConfiguration: active => {
    const contractAddress = useTextField({
      name: 'contractAddress',
      label: 'Contract Address',
      visible: active,
      required: [true, 'Please specify the address of the token or NFT that is the key to this poll!'],
      validators: [
        value => (!isValidAddress(value) ? "This doesn't seem to be a valid address." : undefined),
        async (value, controls) => {
          controls.updateStatus({ message: 'Fetching token details...' })
          const details = await getLocalContractDetails(value)
          if (!details) {
            return "Can't find token details!"
          }
          const tokenUrl = configuredExplorerUrl
            ? StringUtils.getAccountUrl(configuredExplorerUrl, contractAddress.value)
            : undefined
          return [
            {
              type: 'info',
              text: `**Selected token:** ${getLink({ label: details.name ?? StringUtils.truncateAddress(value), href: tokenUrl })}`,
            },
            { type: 'info', text: `**Symbol:** ${details.symbol ?? '(none)'}` },
          ]
        },
      ],
      validateOnChange: true,
      showValidationSuccess: true,
    })

    const voteWeighting = useOneOfField({
      name: 'voteWeighting',
      label: 'Vote weight',
      visible: active,
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
      ],
      initialValue: 'weight_perToken',
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
      }
    }

    return {
      fields: [contractAddress, voteWeighting],
      values: {
        tokenAddress: contractAddress.value,
        flags: weightToFlags(voteWeighting.value),
      },
    }
  },

  getAclOptions: props => {
    if (!props.tokenAddress) throw new Error('Internal errors: parameter mismatch, addresses missing.')
    return {
      data: abiEncode(['address'], [props.tokenAddress]),
      options: { token: props.tokenAddress },
      flags: props.flags,
    }
  },

  isThisMine: options => 'token' in options,

  checkPermission: async (
    pollACL,
    daoAddress,
    proposalId,
    userAddress,
    options,
  ): Promise<CheckPermissionResults> => {
    const tokenAddress = options.token
    const tokenInfo = await getLocalContractDetails(tokenAddress)
    const url = configuredExplorerUrl
      ? StringUtils.getAccountUrl(configuredExplorerUrl, tokenAddress)
      : undefined
    const explanation = `You need to hold some ${getLink({ label: tokenInfo?.name ?? StringUtils.truncateAddress(tokenAddress), href: url })} on ${getLink({ label: configuredNetworkName, href: configuredExplorerUrl })} to vote.`
    const proof = new Uint8Array()
    let canVote: DecisionWithReason
    try {
      const result = 0n !== (await pollACL.canVoteOnPoll(daoAddress, proposalId, userAddress, proof))
      // console.log("tokenHolderAcl check:", result)
      if (result) {
        canVote = true
      } else {
        canVote = denyWithReason(
          `you don't hold any ${getLink({ label: tokenInfo?.name ?? StringUtils.truncateAddress(tokenAddress), href: url })}`,
        )
      }
    } catch {
      canVote = denyWithReason(`you don't hold any ${tokenInfo?.name ?? tokenAddress}`)
    }
    return { canVote, explanation, proof }
  },
} as const)
