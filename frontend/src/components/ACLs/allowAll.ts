import { CheckPermissionResults, defineACL } from './common'
import {
  designDecisions,
  VITE_APP_HARDWIRED_VOTE_WEIGHTING,
  VITE_CONTRACT_ACL_ALLOWALL,
} from '../../constants/config'
import { denyWithReason, useOneOfField } from '../InputFields'

export const allowAll = defineACL({
  value: 'acl_allowAll',
  label: 'Everybody',
  costEstimation: 0.1,
  useConfiguration: active => {
    const voteWeighting = useOneOfField({
      name: 'voteWeighting',
      label: 'Vote weight',
      visible: active && (!designDecisions.hideHardwiredSettings || !VITE_APP_HARDWIRED_VOTE_WEIGHTING),
      initialValue: VITE_APP_HARDWIRED_VOTE_WEIGHTING,
      enabled: !VITE_APP_HARDWIRED_VOTE_WEIGHTING,
      choices: [
        {
          value: 'weight_perWallet',
          label: '1 vote per wallet',
        },
      ],
      disableIfOnlyOneVisibleChoice: designDecisions.disableSelectsWithOnlyOneVisibleOption,
    } as const)

    return {
      fields: [voteWeighting],
      values: undefined,
    }
  },

  getAclOptions: () => ({
    aclAddress: VITE_CONTRACT_ACL_ALLOWALL,
    data: '0x', // Empty bytes is passed
    options: { allowAll: true },
    flags: 0n,
  }),
  isThisMine: options => 'allowAll' in options,

  checkPermission: async (pollACL, daoAddress, proposalId, userAddress): Promise<CheckPermissionResults> => {
    const proof = new Uint8Array()
    const result = 0n !== (await pollACL.canVoteOnPoll(daoAddress, proposalId, userAddress, proof))
    const canVote = result ? true : denyWithReason('some unknown reason')
    return { canVote, proof }
  },
} as const)
