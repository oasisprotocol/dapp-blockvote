import { FC, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { useDashboardData } from './useDashboardData'
import { Alert } from '../../components/Alert'
import { PollCard } from '../../components/PollCard'
import { Layout } from '../../components/Layout'
import classes from './index.module.css'
import { Button } from '../../components/Button'
import { useNavigate } from 'react-router-dom'
import { InputFieldGroup } from '../../components/InputFields'
import { NoPolls } from './NoPolls'
import { useAppState } from '../../hooks/useAppState'
import { Card } from '../../components/Card'

export const LoadingIndicator: FC = () => (
  <Alert
    headerText="Please wait"
    type="loading"
    className={classes.waitingIndicators}
    actions={<span>Fetching polls...</span>}
  />
)

export const Dashboard: FC = () => {
  const {
    state: { isMobileScreen },
  } = useAppState()
  const navigate = useNavigate()
  const {
    isLoadingPolls,
    allProposals,
    reportVisibility,
    shouldShowInaccessiblePolls,
    leftFilterInputs,
    rightFilterInputs,
    searchPatterns,
    wantedStatus,
    myVisibleCount,
    otherVisibleCount,
    hasFilters,
    clearFilters,
  } = useDashboardData()
  const handleCreate = useCallback(() => navigate('/create'), [navigate])

  const createButton = (
    <Button
      className={classes.createButton}
      onClick={handleCreate}
      size={isMobileScreen ? 'small' : 'medium'}
    >
      Create New
    </Button>
  )

  const myPollsColumn = (
    <>
      {allProposals.map(proposal => (
        <PollCard
          column={'mine'}
          key={proposal.id}
          proposal={proposal}
          wantedStatus={wantedStatus}
          showInaccessible={shouldShowInaccessiblePolls}
          reportVisibility={reportVisibility}
          searchPatterns={searchPatterns}
        />
      ))}
      {!myVisibleCount && <NoPolls hasFilters={hasFilters} clearFilters={clearFilters} />}
      {isMobileScreen && createButton}
    </>
  )

  const explorePollsColumn = (
    <>
      {allProposals.map(proposal => (
        <PollCard
          column={'others'}
          key={proposal.id}
          proposal={proposal}
          wantedStatus={wantedStatus}
          showInaccessible={shouldShowInaccessiblePolls}
          searchPatterns={searchPatterns}
          reportVisibility={reportVisibility}
        />
      ))}
      {!otherVisibleCount && <NoPolls hasFilters={hasFilters} clearFilters={clearFilters} />}
    </>
  )

  return isMobileScreen ? (
    <Layout variation="dashboard">
      <Card className={classes.mobileDashboardCard}>
        <InputFieldGroup
          fields={[...leftFilterInputs, ...rightFilterInputs]}
          className={classes.mobileDashboardTop}
        />
        <Tabs.Root defaultValue={'my-polls'} className={classes.tabRoot}>
          <Tabs.List className={classes.tabList}>
            <Tabs.Trigger value={'my-polls'} className={classes.tabTrigger}>
              My polls
            </Tabs.Trigger>
            <Tabs.Trigger value={'explore-polls'} className={classes.tabTrigger}>
              Explore polls
            </Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value={'my-polls'} className={classes.tabContent}>
            {isLoadingPolls ? <LoadingIndicator /> : myPollsColumn}
          </Tabs.Content>
          <Tabs.Content value={'explore-polls'} className={classes.tabContent}>
            {isLoadingPolls ? <LoadingIndicator /> : explorePollsColumn}
          </Tabs.Content>
        </Tabs.Root>
      </Card>
    </Layout>
  ) : (
    <Layout variation="dashboard" extraWidget={createButton}>
      <div className="flex flex-1 justify-center w-full gap-8">
        <div className="flex flex-grow w-[60%] flex-col gap-[16px]">
          <InputFieldGroup fields={[leftFilterInputs]} />
          <div className={classes.dashboardLabel}>Polls created by me</div>
          {isLoadingPolls ? <LoadingIndicator /> : myPollsColumn}
        </div>
        <div className="flex flex-grow w-[30%] flex-col gap-[16px]">
          <InputFieldGroup fields={[rightFilterInputs]} alignRight />
          <div className={classes.dashboardLabel}>Explore polls</div>
          {isLoadingPolls ? <LoadingIndicator /> : explorePollsColumn}
        </div>
      </div>
    </Layout>
  )
}
