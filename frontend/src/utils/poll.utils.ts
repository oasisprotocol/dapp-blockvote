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
import { DecisionWithReason, denyWithReason } from '../components/InputFields'
import { FetcherFetchOptions } from './StoredLRUCache'
import { findACLForOptions } from '../components/ACLs'
import { VITE_NETWORK_NUMBER } from '../constants/config'

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

export const getERC20TokenDetails = async (
  chainId: number,
  address: string,
): Promise<TokenInfo | undefined> => {
  const rpc = xchainRPC(chainId)
  try {
    return await erc20TokenDetailsFromProvider(getAddress(address), rpc)
  } catch {
    return undefined
  }
}

export const getNftDetails = async (chainId: number, address: string): Promise<NFTInfo | undefined> => {
  const rpc = xchainRPC(chainId)
  try {
    return await nftDetailsFromProvider(getAddress(address), rpc)
  } catch {
    return undefined
  }
}

export const getContractDetails = async (
  chainId: number,
  address: string,
): Promise<TokenInfo | NFTInfo | undefined> =>
  (await getERC20TokenDetails(chainId, address)) ?? (await getNftDetails(chainId, address))

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
  } catch (_) {
    return undefined
  }
}

export const getNftType = async (chainId: number, address: string): Promise<string | undefined> => {
  const rpc = xchainRPC(chainId)
  return getNftContractType(address, rpc)
}

export const getLatestBlock = async (chainId: number) => await xchainRPC(chainId).getBlock('latest')

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
  updateStatus: (message: string) => void,
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
  } = props

  updateStatus('Compiling data')
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

  updateStatus('Waiting for signer...')
  const createProposalTx = await pollManager.create(proposalParams, aclData, {
    value: subsidizeAmount ?? 0n,
  })

  console.log('TX created.', createProposalTx)

  console.log('doCreatePoll: creating proposal tx', createProposalTx.hash)

  updateStatus('Sending transaction')

  const receipt = (await createProposalTx.wait())!
  if (receipt.status !== 1) {
    console.log('Receipt is', receipt)
    throw new Error('createProposal tx receipt reported failure.')
  }
  updateStatus('Created poll')
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

export const completePoll = async (eth: EthereumContext, pollManager: PollManager, proposalId: string) => {
  await eth.switchNetwork() // ensure we're on the correct network first!
  const tx = await pollManager.close(proposalId)
  const receipt = await tx.wait()
  if (!receipt || receipt!.status != 1) throw new Error('Complete ballot tx failed')
  await detectGasRefundOnCompletion(receipt, pollManager)
}

// Destroying the poll will automatically close it first
export const destroyPoll = async (eth: EthereumContext, pollManager: PollManager, proposalId: string) => {
  await eth.switchNetwork() // ensure we're on the correct network first!
  const tx = await pollManager.destroy(proposalId)
  const receipt = await tx.wait()
  if (!receipt || receipt!.status != 1) throw new Error('Destroy poll tx failed')
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
