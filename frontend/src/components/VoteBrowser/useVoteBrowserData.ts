import { ListOfChoices, ListOfVotes } from '../../types'
import { Choice, FieldConfiguration, useOneOfField, useTextField } from '../InputFields'
import { useMemo, useState } from 'react'
import { findTextMatches } from '../HighlightedText/text-matching'
import { StringUtils } from '../../utils/string.utils'
import { useAllAccountsMetadata } from '../../hooks/namedAccounts'
import { VITE_NETWORK_NUMBER } from '../../constants/config'

type Vote = {
  address: string
  name: string | undefined
  weight: bigint
  choiceIndex: string
  choiceString: string
}

export const useVoteBrowserData = (
  choices: ListOfChoices,
  votes: ListOfVotes,
  totalVotes: bigint,
  pageSize: number,
) => {
  const [pageNumber, setPageNumber] = useState(1)
  const goToFirstPage = () => setPageNumber(1)

  const choiceSelector = useOneOfField({
    name: 'choiceSelector',
    choices: useMemo(
      () => [
        {
          value: 'all',
          label: `All ${totalVotes} votes`,
        },
        ...Object.keys(choices).map(
          (c): Choice => ({
            value: c,
            label: `${StringUtils.maybePlural(Number(choices[c].votes), 'vote', 'votes')} for "${choices[c].choice}"`,
            enabled: choices[c].votes > 0n,
          }),
        ),
      ],
      [choices, totalVotes],
    ),
    onValueChange: goToFirstPage,
  })

  const addressSearchPatternInput = useTextField({
    name: 'addressSearchPattern',
    placeholder: 'Search for voter',
    autoFocus: true,
    onValueChange: goToFirstPage,
  })

  const chainAccountsMetadata = useAllAccountsMetadata(VITE_NETWORK_NUMBER, true)

  const searchPatterns = useMemo(() => {
    const patterns = addressSearchPatternInput.value
      .trim()
      .split(' ')
      .filter(p => p.length)
    if (patterns.length === 1 && patterns[0].length < 1) {
      return []
    } else {
      return patterns
    }
  }, [addressSearchPatternInput.value])

  const allVotes = useMemo(
    () =>
      votes.out_voters.map((voter, index): Vote => {
        const [weight, choice] = votes.out_choices[index]
        return {
          address: voter,
          name: chainAccountsMetadata?.map.get(voter)?.name,
          weight,
          choiceIndex: choice.toString(),
          choiceString: choices[choice.toString()].choice,
        }
      }),
    [votes, chainAccountsMetadata],
  )

  const filteredVotes = useMemo(
    () =>
      allVotes.filter(vote => {
        if (choiceSelector.value !== 'all' && vote.choiceIndex !== choiceSelector.value) return false

        const corpus = `${vote.address} ||| ${vote.name?.toLowerCase() ?? ''}`
        const textMatches = searchPatterns.length ? findTextMatches(corpus, searchPatterns) : []
        const hasAllMatches = textMatches.length === searchPatterns.length
        if (!hasAllMatches) return false

        return true
      }),
    [allVotes, choiceSelector.value, searchPatterns],
  )

  const numberOfPages = Math.ceil(filteredVotes.length / pageSize)

  const hasFilters = choiceSelector.value !== 'all' || searchPatterns.length > 0 || pageNumber > 1

  const clearFilters = () => {
    choiceSelector.reset()
    addressSearchPatternInput.reset()
    goToFirstPage()
  }

  const startIndex = (pageNumber - 1) * pageSize + 1
  const endIndex = pageNumber * pageSize
  const pageWindow = `${startIndex}-${endIndex}`
  const hasNextPage = pageNumber < numberOfPages
  const hasPrevPage = pageNumber > 1
  const goToNextPage = () => {
    if (hasNextPage) setPageNumber(pageNumber + 1)
  }
  const goToPrevPage = () => {
    if (hasPrevPage) setPageNumber(pageNumber - 1)
  }

  const goToLastPage = () => setPageNumber(numberOfPages)

  const displayedVotes = filteredVotes.slice(startIndex - 1, endIndex)

  const inputFields: FieldConfiguration = [[addressSearchPatternInput, choiceSelector]]

  return {
    inputFields,
    searchPatterns,
    // filteredVotes,
    pageNumber,
    numberOfPages,
    pageWindow,
    hasPrevPage,
    hasNextPage,
    goToFirstPage,
    goToPrevPage,
    goToNextPage,
    goToLastPage,
    displayedVotes,
    hasFilters,
    clearFilters,
  }
}
