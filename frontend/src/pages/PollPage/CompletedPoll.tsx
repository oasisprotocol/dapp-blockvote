import { FC } from 'react'
import { PollData } from './hook'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'
import { Card } from '../../components/Card'
import { SocialShares } from '../../components/SocialShares'
import { PollAccessIndicatorWrapper } from '../../components/PollCard/PollAccessIndicator'
import { getVerdict, InputField } from '../../components/InputFields'
import { MotionDiv } from '../../components/Animations'
import { VoteBrowser } from '../../components/VoteBrowser/VoteBrowser'
import { VoterBrowser } from '../../components/VoterBrowser/VoterBrowser'
import { MarkdownBlock } from '../../components/Markdown'

export const CompletedPoll: FC<
  Pick<
    PollData,
    'poll' | 'pollResults' | 'isMine' | 'permissions' | 'checkPermissions' | 'hasWallet' | 'destroyPoll'
  >
> = ({ poll, pollResults, isMine, permissions, checkPermissions, hasWallet, destroyPoll }) => {
  const { name, description } = poll!.ipfsParams!
  const { choices, votes, voters, totalVotes } = pollResults!
  const { explanation: aclExplanation, canVote: aclCanVote } = permissions

  return (
    <Card>
      <h2>Results are in!</h2>
      <h4 className={'niceLine'}>
        <div className={'niceLine'}>
          {name}
          {hasWallet && (
            <PollAccessIndicatorWrapper
              isMine={isMine}
              permissions={permissions}
              isActive={false}
              retest={checkPermissions}
              hideRestrictedNoAccess={true}
            />
          )}
        </div>
      </h4>
      {!!description && <h4>{description}</h4>}
      <>
        {Object.entries(choices).map(([index, entry]) => (
          <MotionDiv
            reason={'resultsDisplay'}
            layout
            className={StringUtils.clsx(
              classes.choice,
              classes.choiceWithResults,
              entry.winner ? classes.winner : '',
            )}
            key={`choice-${index}`}
            initial={{
              height: 48,
              width: '100%',
            }}
            animate={{
              borderColor:
                // [
                '#a2a0ffff',
              // '#a2a0ff00', '#a2a0ffff'],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              repeatDelay: 2,
            }}
          >
            <MotionDiv
              reason={'resultsDisplay'}
              layout
              className={classes.sizeBar}
              initial={{ width: '0%' }}
              animate={{ width: `${entry.rate}%` }}
              transition={{ delay: 0.5, duration: 0.5, ease: 'easeOut' }}
            />
            <div className={classes.above}>{entry.choice}</div>
            <MotionDiv
              reason={'resultsDisplay'}
              className={`${classes.percentage} ${classes.above}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              {entry.rate}%
            </MotionDiv>
          </MotionDiv>
        ))}
      </>
      {aclExplanation && (
        <>
          <MarkdownBlock mainTag={'h4'} code={aclExplanation} />
          {getVerdict(aclCanVote, false) ? <h4>You had access.</h4> : <h4>You didn&apos;t have access.</h4>}
        </>
      )}
      {!!votes?.out_count && <VoteBrowser choices={choices} votes={votes} totalVotes={totalVotes} />}
      {!!voters?.out_count && <VoterBrowser voters={voters} />}
      <SocialShares
        label={'Share results on'}
        name={name}
        introText={'See the results here:'}
        pageTitle={name}
      />
      <InputField controls={{ ...destroyPoll, expandHorizontally: false }} />
    </Card>
  )
}
