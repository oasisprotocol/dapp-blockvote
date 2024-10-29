import { ListOfVoters } from '../../types'
import { FieldConfiguration, useTextField } from '../InputFields'
import { useMemo, useState } from 'react'
import { findTextMatches } from '../HighlightedText/text-matching'
import { useAllAccountsMetadata } from '../../hooks/namedAccounts'
import { VITE_NETWORK_NUMBER } from '../../constants/config'

export const useVoterBrowserData = (voters: ListOfVoters, pageSize: number) => {
  const [pageNumber, setPageNumber] = useState(1)
  const goToFirstPage = () => setPageNumber(1)

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

  const allVoters = voters.out_voters.map(voter => ({
    address: voter,
    name: chainAccountsMetadata?.map.get(voter)?.name,
  }))

  const filteredVoters = useMemo(
    () =>
      allVoters.filter(voter => {
        const corpus = `${voter.address} ||| ${voter.name?.toLowerCase() ?? ''}`
        const textMatches = searchPatterns.length ? findTextMatches(corpus, searchPatterns) : []
        const hasAllMatches = textMatches.length === searchPatterns.length
        if (!hasAllMatches) return false

        return true
      }),
    [allVoters, searchPatterns],
  )

  const numberOfPages = Math.ceil(filteredVoters.length / pageSize)

  const hasFilters = searchPatterns.length > 0 || pageNumber > 1

  const clearFilters = () => {
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

  const displayedVoters = filteredVoters.slice(startIndex - 1, endIndex)

  const inputFields: FieldConfiguration = [addressSearchPatternInput]

  return {
    inputFields,
    searchPatterns,
    pageNumber,
    numberOfPages,
    pageWindow,
    hasPrevPage,
    hasNextPage,
    goToFirstPage,
    goToPrevPage,
    goToNextPage,
    goToLastPage,
    displayedVoters,
    hasFilters,
    clearFilters,
  }
}
