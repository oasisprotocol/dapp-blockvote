import { Layout } from '../../components/Layout'
import { FC } from 'react'
import { PollData, usePollData } from './hook'
import { useParams } from 'react-router-dom'
import { Alert } from '../../components/Alert'
import { CompletedPoll } from './CompletedPoll'
import { ActivePoll } from './ActivePoll'
import { ThanksForVote } from './ThanksForVoting'
import { Helmet } from 'react-helmet-async'
import { appName, appNameAndTagline, appRootUrl } from '../../constants/config'
import { slugToProposalId } from '../../utils/slug'

const PollLoading: FC = () => {
  return (
    <Layout variation="light">
      <Alert headerText="Please wait" type="loading" actions={<span>Fetching poll...</span>} />
    </Layout>
  )
}

const WaitingForResults: FC = () => {
  return (
    <Layout variation="light">
      <Alert
        headerText="Poll completed, please wait"
        type="loading"
        actions={<span>Waiting for results to land...</span>}
      />
    </Layout>
  )
}

export const PollUI: FC<PollData> = props => {
  const { isLoading, error, poll, active, hasVoted, existingVote, hasCompleted, pollResults } = props
  if (error) {
    return (
      <Layout variation={'landing'}>
        <Alert type="error" headerText={error} />
      </Layout>
    )
  }

  // Completed poll, now waiting for results
  if (hasCompleted) return <WaitingForResults />

  // Currently loading stuff
  if (isLoading || !poll?.ipfsParams) return <PollLoading />

  // You have voted. Thanks!
  if (hasVoted && active) {
    if (existingVote !== undefined) {
      return (
        <Layout variation={'dark'}>
          <ThanksForVote {...props} />
        </Layout>
      )
    } else {
      console.log('Inconsistent state: hasVoted, but no existingVote')
      return (
        <Layout variation={'landing'}>
          <Alert type="error" headerText={'Internal error'} />
        </Layout>
      )
    }
  }

  // Active vote
  if (active) {
    return (
      <Layout variation="light">
        <ActivePoll {...props} />
      </Layout>
    )
  } else {
    // Completed vote
    if (!pollResults) return <PollLoading />
    return (
      <Layout variation="dark">
        <CompletedPoll {...props} />
      </Layout>
    )
  }
}

export const PollPage: FC = () => {
  const { pollId: slug } = useParams()
  const pollData = usePollData(slugToProposalId(slug!))
  const { poll } = pollData
  const params = poll?.ipfsParams
  if (params) {
    const title = `${params!.name} - ${appName}`
    const description = params!.description
    return (
      <>
        <Helmet>
          <title>{title}</title>
          <meta name="twitter:title" content={title} />
          <meta property="og:title" content={title} />,
          <meta property="og:url" content={`${appRootUrl}/#${slug}`} />
          {description && (
            <>
              <meta name="twitter:description" content={description} />
              <meta property="og:description" content={description} />,
            </>
          )}
        </Helmet>
        <PollUI {...pollData} />
      </>
    )
  } else {
    return (
      <>
        <Helmet>
          <title>{appNameAndTagline}</title>
          <meta name="twitter:title" content={appNameAndTagline} />
          <meta property="og:title" content={appNameAndTagline} />
          <meta property="og:url" content={appRootUrl} />
        </Helmet>
        <PollUI {...pollData} />
      </>
    )
  }
}
