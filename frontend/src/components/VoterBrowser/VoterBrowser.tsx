import { FC } from 'react'
import { ListOfVoters } from '../../types'
import { useVoterBrowserData } from './useVoterBrowserData'
import { InputFieldGroup } from '../InputFields'
import classes from './index.module.css'
import { useEthereum } from '../../hooks/useEthereum'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'
import { AccountName } from '../VoteBrowser/VoteBrowser'

const VOTES_ON_PAGE = 10

export const VoterBrowser: FC<{ voters: ListOfVoters }> = ({ voters }) => {
  const { userAddress } = useEthereum()
  const {
    inputFields,
    searchPatterns,
    pageNumber,
    numberOfPages,
    displayedVoters,
    goToPrevPage,
    goToNextPage,
    goToFirstPage,
    goToLastPage,
    hasFilters,
    clearFilters,
  } = useVoterBrowserData(voters, VOTES_ON_PAGE)

  return (
    <div className={classes.voterBrowser}>
      <h4>Voters:</h4>
      <InputFieldGroup fields={inputFields} />

      <div className={classes.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {displayedVoters.map(voter => {
              const { address, name } = voter
              const mine = voter.address.toLowerCase() === userAddress.toLowerCase()
              return (
                <tr key={voter.address}>
                  <td className={mine && displayedVoters.length > 1 ? classes.myVote : undefined}>
                    <MaybeWithTooltip overlay={mine ? 'This is my vote' : undefined}>
                      <span>
                        <AccountName address={address} name={name} searchPatterns={searchPatterns} />
                        {mine && ' 🛈'}
                      </span>
                    </MaybeWithTooltip>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!displayedVoters.length && (
          <div className={classes.noDataFound}>
            <span>No voters found.</span>
            {hasFilters && <a onClick={clearFilters}>Clear filters</a>}
          </div>
        )}
        {numberOfPages > 1 && (
          <div className={classes.pagination}>
            <MaybeWithTooltip overlay={'Fo to first page'}>
              <a onClick={goToFirstPage}>&lt;&lt;</a>
            </MaybeWithTooltip>
            <MaybeWithTooltip overlay={'Go to previous page'}>
              <a onClick={goToPrevPage}>&lt;</a>
            </MaybeWithTooltip>
            <span>
              {pageNumber} of {numberOfPages}
            </span>
            <MaybeWithTooltip overlay={'Go to next page'}>
              <a onClick={goToNextPage}>&gt;</a>
            </MaybeWithTooltip>
            <MaybeWithTooltip overlay={'Go to last page'}>
              <a onClick={goToLastPage}>&gt;&gt;</a>
            </MaybeWithTooltip>
          </div>
        )}
      </div>
    </div>
  )
}
