import { Choice, DecisionWithReason, ExecutionContext, FieldConfiguration } from '../InputFields'
import { AclOptions, IPollACL } from '@oasisprotocol/blockvote-contracts'
import { BytesLike } from 'ethers'
import { MarkdownCode } from '../../types'

export type CheckPermissionResults = {
  canVote: DecisionWithReason
  explanation?: MarkdownCode
  proof: BytesLike
  error?: string
}

/**
 * This data structure describes an ACL
 */
export type ACL<Name, ConfigInputValues, Options extends AclOptions> = Choice<Name> & {
  /**
   * Estimated cost per vote
   *
   * This is used for setting up gasless voting.
   */
  costEstimation: number

  /**
   * Specify the fields and values needed for configuring the ACL when creating a poll
   */
  useConfiguration: (selected: boolean) => { fields: FieldConfiguration; values: ConfigInputValues }

  /**
   * The address of the ACL contract to use
   */
  address: string

  /**
   * Compose the ACL options when creating a poll
   */
  getAclOptions:
    | ((
        config: ConfigInputValues,
        context?: ExecutionContext,
      ) => { data: string; options: Options; flags: bigint })
    | ((
        config: ConfigInputValues,
        context?: ExecutionContext,
      ) => Promise<{ data: string; options: Options; flags: bigint }>)

  /**
   * Attempt to recognize if this ACL is managing a given poll, based on ACL options
   * @param options
   */
  isThisMine: (options: AclOptions) => boolean

  /**
   * Determine if we can vote on this poll
   *
   * The actual contract is made available, this function just needs to interpret the result
   * and compose the required messages.
   */
  checkPermission: (
    pollACL: IPollACL,
    daoAddress: string,
    proposalId: string,
    userAddress: string,
    options: Options,
  ) => Promise<CheckPermissionResults>
}

export function defineACL<Name, ConfigInputValues, Options extends AclOptions>(
  acl: ACL<Name, ConfigInputValues, Options>,
): ACL<Name, ConfigInputValues, Options> {
  return acl
}
