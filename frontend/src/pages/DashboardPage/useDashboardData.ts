import { useContracts } from '../../hooks/useContracts'
import { useEffect, useMemo, useState } from 'react'
import { isPollActive, PollManager, Proposal } from '../../types'
import { useEthereum } from '../../hooks/useEthereum'
import { useBooleanField, useOneOfField, useTextField } from '../../components/InputFields'
import { useNavigate } from 'react-router-dom'
import { dashboard, designDecisions } from '../../constants/config'
import classes from './index.module.css'
import { proposalIdToSlug } from '../../utils/slug'

const FETCH_BATCH_SIZE = 100

type RawProposal = PollManager.ProposalWithIdStructOutput

interface FetchProposalResult {
  out_count: bigint
  out_proposals: RawProposal[]
}

export type Column = 'mine' | 'others'
export type WantedStatus = 'active' | 'completed' | 'all'

export const isPollStatusAcceptable = (proposal: Proposal, wantedStatus: WantedStatus): boolean => {
  switch (wantedStatus) {
    case 'active':
      return isPollActive(proposal.params)
    case 'completed':
      return !isPollActive(proposal.params)
    case 'all':
      return true
  }
}

export type Circumstances = {
  wantedStatus: WantedStatus
  searchPatterns: string[]
  showInaccessible: boolean
  userAddress: string
}

const circumstancesToKey = (circumstances: Circumstances) => JSON.stringify(circumstances)

export type VisibilityReport = {
  circumstances: Circumstances
  column: Column
  pollId: string
  visible: boolean
}

export type VisibilityReporter = (report: VisibilityReport) => void

type VisibilityInCircumstances = Record<Column, Set<string>>

/**
 * Explanation about filtering on the dashboard
 *
 * The poll cards on the dashboard are filtered according to three criteria:
 * 1. Poll status: active or completed
 * 2. Text search (in name and description)
 * 3. Poll accessibility (i.e. permissions)
 *
 * After filtering, the polls are distributed into two columns: my polls and other polls.
 *
 * Now the problem is, the input data for the 2. and the 3. criteria (and the distribution)
 * is loaded dynamically _within the cards themselves_, so it is not
 * available at the dashboard, so the filtering can not happen here.
 *
 * To solve this, we are doing the filtering within the poll cards themselves;
 * the dashboard will just display all the card, and then
 * they will hide themselves when appropriate, based on the data they loaded.
 *
 * For the distribution in two columns, likewise: we will just display everything everywhere,
 * and the cards will hide themselves in the correct column.
 *
 * One challenge is that the dashboard _needs_ to know about which cards are visible,
 * in order to do some other stuff. To achieve this, the individual cards will feed information back
 * to the dashboard via a callback. The data gathered this way will be used to determine the number of
 * visible cards.
 *
 * So we will have a singleton (abstract) class, DashboardData that will collect this data.
 * Inside the useDashboardData() hook we will access this repository to access the info we need.
 */

abstract class DashboardData {
  static #visibilityInfo = new Map<string, VisibilityInCircumstances>()

  static export() {
    ;(window as any).wtfCache = this.#visibilityInfo
  }

  static reportVisibility = (report: VisibilityReport) => {
    let hasChanged = false
    const { circumstances, column, pollId, visible } = report
    const key = circumstancesToKey(circumstances)
    let info = DashboardData.#visibilityInfo.get(key)
    if (!info) {
      info = {
        mine: new Set<string>(),
        others: new Set<string>(),
      }
      DashboardData.#visibilityInfo.set(key, info)
    }
    const columnInfo = info[column]
    if (visible) {
      if (!columnInfo.has(pollId)) {
        columnInfo.add(pollId)
        hasChanged = true
      }
    } else {
      if (columnInfo.has(pollId)) {
        columnInfo.delete(pollId)
        hasChanged = true
      }
    }
    return hasChanged
  }

  static getVisibleCards = (circumstances: Circumstances, column: Column): string[] => {
    const key = circumstancesToKey(circumstances)
    const info = DashboardData.#visibilityInfo.get(key)
    const columnInfo = info ? info[column] : undefined
    return columnInfo ? Array.from(columnInfo.values()) : []
  }
}

async function fetchProposals(
  fetcher: (offset: number, batchSize: number) => Promise<FetchProposalResult>,
): Promise<Proposal[]> {
  const proposalList: Proposal[] = []

  for (let offset = 0; ; offset += FETCH_BATCH_SIZE) {
    let result: FetchProposalResult
    try {
      result = await fetcher(offset, FETCH_BATCH_SIZE)
    } catch (e: any) {
      console.error('failed to fetch proposals', e)
      break
    }

    result.out_proposals.forEach(({ id, owner, proposal }) => {
      const [topChoice, params] = proposal
      proposalList.push({ id, owner, topChoice, params })
    })

    if (result.out_proposals.length < FETCH_BATCH_SIZE) {
      return proposalList
    }
  }

  return proposalList
}

DashboardData.export()

export const useDashboardData = () => {
  const eth = useEthereum()
  const { pollManager, pollManagerAddress: daoAddress, pollManagerACL } = useContracts()

  const { userAddress } = eth

  const [activeProposals, setActiveProposals] = useState<Proposal[]>([])
  const [pastProposals, setPastProposals] = useState<Proposal[]>([])
  const [canCreatePoll, setCanCreatePoll] = useState(false)
  const [isLoadingActive, setIsLoadingActive] = useState(true)
  const [isLoadingPast, setIsLoadingPast] = useState(true)

  useEffect(() => {
    if (!pollManager) {
      setActiveProposals([])
      setPastProposals([])
      return
    }
    void fetchAllProposals()
  }, [pollManager])

  useEffect(() => {
    if (!pollManagerACL || !userAddress || !daoAddress) {
      setCanCreatePoll(false)
      return
    }
    pollManagerACL.canCreatePoll(daoAddress, userAddress).then(canCreate => {
      setCanCreatePoll(canCreate)
    })
  }, [pollManagerACL, userAddress, daoAddress])

  const fetchAllProposals = async () => {
    if (!pollManager) {
      console.log('No pollManager, no fetching...')
    }

    const { number: blockTag } = (await eth.state.provider.getBlock('latest'))!

    await Promise.all([
      fetchProposals((offset, batchSize) => pollManager!.getActiveProposals(offset, batchSize)).then(
        proposals => {
          setActiveProposals(proposals)
          setIsLoadingActive(false)
        },
      ),
      fetchProposals((offset, batchSize) =>
        pollManager!.getPastProposals(offset, batchSize, { blockTag }),
      ).then(proposals => {
        setPastProposals(proposals)
        setIsLoadingPast(false)
      }),
    ])
  }

  const allProposals = useMemo(
    () => [...activeProposals, ...pastProposals],
    [activeProposals, pastProposals, userAddress],
  )

  const [visibilityInfoVersion, setVisibilityInfoVersion] = useState(0)

  const showInaccessible = useBooleanField({
    name: 'showInaccessible',
    label: "Show polls I don't have access to",
    visible: dashboard.showPermissions && designDecisions.showInaccessiblePollCheckbox,
    initialValue: dashboard.showPermissions && designDecisions.showInaccessiblePollCheckbox,
    containerClassName: classes.showInaccessible,
  })

  const wantedPollStatus = useOneOfField({
    name: 'wantedPollStatus',
    choices: [
      { value: 'all', label: 'All polls' },
      { value: 'active', label: 'Active polls' },
      { value: 'completed', label: 'Completed polls' },
    ],
    containerClassName: classes.openCompletePolls,
  } as const)

  const navigate = useNavigate()

  const pollSearchPatternInput = useTextField({
    name: 'pollSearchPattern',
    placeholder: 'Start typing here to search for poll',
    autoFocus: true,
    containerClassName: classes.search,
    onEnter: () => {
      const cards = allVisiblePollIds
      if (cards.length !== 1) return // We can only do this is there is exactly one matching card
      const slug = proposalIdToSlug(Array.from(cards.values())[0]);
      navigate(`/${slug}`)
    },
  })

  const searchPatterns = useMemo(() => {
    const patterns = pollSearchPatternInput.value
      .trim()
      .split(' ')
      .filter(p => p.length)
    if (patterns.length === 1 && patterns[0].length < 2) {
      return []
    } else {
      return patterns
    }
  }, [pollSearchPatternInput.value])

  const currentCircumstances: Circumstances = useMemo(() => {
    return {
      wantedStatus: wantedPollStatus.value,
      searchPatterns,
      showInaccessible: showInaccessible.value,
      userAddress,
    }
  }, [wantedPollStatus.value, searchPatterns, showInaccessible.value, userAddress])

  const reportVisibility = (report: VisibilityReport) => {
    const hasChanged = DashboardData.reportVisibility(report)
    if (hasChanged) setVisibilityInfoVersion(visibilityInfoVersion + 1)
  }

  const myVisiblePollIds = useMemo(
    () => DashboardData.getVisibleCards(currentCircumstances, 'mine'),
    [visibilityInfoVersion, currentCircumstances],
  )

  const otherVisiblePollIds = useMemo(
    () => DashboardData.getVisibleCards(currentCircumstances, 'others'),
    [visibilityInfoVersion, currentCircumstances],
  )

  const allVisiblePollIds = useMemo(
    () => [...myVisiblePollIds, ...otherVisiblePollIds],
    [myVisiblePollIds, otherVisiblePollIds],
  )

  const hasFilters =
    wantedPollStatus.value !== 'all' ||
    !!searchPatterns.length ||
    (showInaccessible.visible && !showInaccessible.value)

  const clearFilters = () => {
    wantedPollStatus.setValue('all')
    pollSearchPatternInput.setValue('')
    if (showInaccessible.visible) {
      showInaccessible.setValue(true)
    }
  }

  return {
    userAddress,
    canCreatePoll,
    isLoadingPolls: isLoadingActive || isLoadingPast,
    allProposals,
    leftFilterInputs: [pollSearchPatternInput, showInaccessible],
    rightFilterInputs: [wantedPollStatus],
    shouldShowInaccessiblePolls: showInaccessible.value,
    reportVisibility,
    myVisibleCount: myVisiblePollIds.length,
    otherVisibleCount: otherVisiblePollIds.length,
    allVisibleCount: allVisiblePollIds.length,
    searchPatterns,
    wantedStatus: wantedPollStatus.value,
    hasFilters,
    clearFilters,
  }
}
