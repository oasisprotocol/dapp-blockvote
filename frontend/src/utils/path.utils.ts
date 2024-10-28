import { proposalIdToSlug, slugToProposalId } from './slug'
import { Params } from 'react-router-dom'

/**
 * Get the poll path from a poll or proposal id.
 */
export const getPollPath = (pollId: string): string =>
  `/${pollId == 'demo' ? 'demo' : proposalIdToSlug(pollId!)}`

/**
 * Get the poll ID from the parameters found in the URL, coming from the router.
 */
export const getPollIdFromRouter = (params: Params): string => {
  const { slug } = params
  if (!slug) throw new Error("Slug should be among router parameters, but it isn't!")
  return slugToProposalId(slug)
}
