import { isPollActive, Proposal } from '../../types'
import { FC, MouseEventHandler, useEffect } from 'react'
import { Link } from 'react-router-dom'
import classes from './index.module.css'
import { GasRequiredIcon } from '../icons/GasRequiredIcon'
import { NoGasRequiredIcon } from '../icons/NoGasRequiredIcon'
import { SpinnerIcon } from '../icons/SpinnerIcon'
import { HourGlassIcon } from '../icons/HourGlassIcon'
import { StringUtils } from '../../utils/string.utils'
import { useExtendedPoll } from '../../hooks/useExtendedPoll'
import { PollAccessIndicatorWrapper } from './PollAccessIndicator'
import { getReason, getVerdict } from '../InputFields'
import { findTextMatches } from '../HighlightedText/text-matching'
import { getHighlightedTextHtml, HighlightedText } from '../HighlightedText'
import { dashboard, designDecisions } from '../../constants/config'
import { WarningCircleIcon } from '../icons/WarningCircleIcon'
import {
  Circumstances,
  Column,
  isPollStatusAcceptable,
  VisibilityReporter,
  WantedStatus,
} from '../../pages/DashboardPage/useDashboardData'
import { useEthereum } from '../../hooks/useEthereum'
import { NOT_CHECKED } from '../../hooks/usePollPermissions'
import { AnimatePresence } from 'framer-motion'
import { Button } from '../Button'
import { MotionDiv } from '../Animations'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'
import { proposalIdToSlug } from '../../utils/slug'

const Arrow: FC<{ className: string }> = ({ className }) => (
  <svg
    width="20"
    height="15"
    viewBox="0 0 20 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M13 0.119751L11.59 1.52975L16.17 6.11975H0V8.11975H16.17L11.58 12.7098L13 14.1198L20 7.11975L13 0.119751Z"
      fill="#0500E1"
    />
  </svg>
)

const PollStatusIndicator: FC<{ active: boolean; isPastDue: boolean }> = ({ active, isPastDue }) => {
  return active ? (
    <MaybeWithTooltip overlay={isPastDue ? 'Voting has already finished.' : 'Voting is currently active.'}>
      <div className={StringUtils.clsx(classes.pollStatusActive, 'niceLine')}>
        Active {isPastDue && <HourGlassIcon size={'small'} />}
      </div>
    </MaybeWithTooltip>
  ) : (
    <MaybeWithTooltip overlay={'Poll is completed, results are available.'}>
      <div className={classes.pollStatusCompleted}>Completed</div>
    </MaybeWithTooltip>
  )
}

const GaslessStatusIndicator: FC<{ possible: boolean | undefined }> = ({ possible }) =>
  possible === undefined ? (
    <SpinnerIcon size={'medium'} spinning />
  ) : possible ? (
    designDecisions.hideGaslessIndicator ? undefined : (
      <NoGasRequiredIcon />
    )
  ) : (
    <GasRequiredIcon />
  )

export const PollCard: FC<{
  column: Column
  proposal: Proposal
  reportVisibility: VisibilityReporter
  showInaccessible: boolean
  searchPatterns: string[]
  wantedStatus: WantedStatus
}> = ({ proposal, reportVisibility, column, showInaccessible, searchPatterns, wantedStatus }) => {
  const { userAddress } = useEthereum()
  const { closeTimestamp } = proposal.params
  const {
    poll,
    proposalId,
    gaslessPossible,
    isMine,
    permissions,
    checkPermissions,
    isLoading,
    error,
    correctiveAction,
  } = useExtendedPoll(proposal, {
    onDashboard: true,
  })

  const slug = proposalIdToSlug(proposalId!);

  const {
    id: pollId,
    proposal: { params },
    ipfsParams: { name, description },
  } = poll ?? {
    id: proposalId?.substring(2),
    proposal,
    ipfsParams: {
      name: '',
      description: '',
      options: {},
    },
  }

  const active = isPollActive(params)

  const renderedDescription = description

  const textMatches = searchPatterns.length
    ? findTextMatches(`${name} ${renderedDescription}`, searchPatterns)
    : []
  const hasAllMatches = textMatches.length === searchPatterns.length

  const highlightedDescription =
    getHighlightedTextHtml({
      text: renderedDescription,
      patterns: searchPatterns,
    }) ?? ''

  const knownToBeInaccessible =
    !permissions.error &&
    !getVerdict(permissions.canVote, true) &&
    getReason(permissions.canVote) !== NOT_CHECKED
  const hiddenByPermissionIssues = !isMine && !showInaccessible && knownToBeInaccessible
  const correctColumn = (isMine && column === 'mine') || (!isMine && column === 'others')
  const correctStatus = isPollStatusAcceptable(proposal, wantedStatus)

  const visible =
    correctColumn &&
    correctStatus &&
    !hiddenByPermissionIssues &&
    hasAllMatches &&
    !(!!error && designDecisions.hidePollCardsWithErrors)

  useEffect(() => {
    // console.log('Will report visibility change')
    const circumstances: Circumstances = {
      wantedStatus,
      searchPatterns,
      showInaccessible,
      userAddress,
    }
    reportVisibility({
      circumstances,
      column,
      pollId: pollId!,
      visible,
    })
  }, [wantedStatus, searchPatterns, showInaccessible, userAddress, column, pollId, visible])

  const isPastDue = !!closeTimestamp && new Date().getTime() / 1000 > closeTimestamp

  const handleRetryClick: MouseEventHandler<any> = event => {
    event.preventDefault()
    if (correctiveAction) correctiveAction()
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <MotionDiv
          reason={'dashboardPollCards'}
          layout
          // key={pollId}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link to={`/${slug}`} style={{ textDecoration: 'none' }}>
            <div className={classes.pollCard}>
              <div className={classes.pollCardTop}>
                {error && (
                  <div className={'niceLine'}>
                    <WarningCircleIcon size={'large'} />
                    {error}
                    {correctiveAction && (
                      <Button size={'small'} color={'secondary'} variant={'text'} onClick={handleRetryClick}>
                        Retry
                      </Button>
                    )}
                  </div>
                )}
                {isLoading && (
                  <div className={'niceLine'}>
                    <SpinnerIcon size={'medium'} spinning />
                    <h4>Loading poll details...</h4>
                  </div>
                )}
                {!isLoading && !error && (
                  <h4 className={active ? classes.activePollTitle : undefined}>
                    <span>
                      <HighlightedText text={name} patterns={searchPatterns} />
                    </span>
                    {dashboard.showPermissions && (
                      <PollAccessIndicatorWrapper
                        isMine={isMine}
                        permissions={permissions}
                        isActive={active}
                        retest={checkPermissions}
                      />
                    )}
                  </h4>
                )}
                <Arrow className={active ? classes.activePollArrow : classes.passivePollArrow} />
              </div>
              <div dangerouslySetInnerHTML={{ __html: highlightedDescription }} />
              <div className={classes.pollCardBottom}>
                <PollStatusIndicator active={active} isPastDue={isPastDue} />
                {dashboard.showGasless && <GaslessStatusIndicator possible={gaslessPossible} />}
              </div>
            </div>
          </Link>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}
