import { FC } from 'react'
import classes from './index.module.css'
import { PollData } from './hook'
import { BigCountdown } from './BigCountdown'
import { Card } from '../../components/Card'
import { SocialShares } from '../../components/SocialShares'
import { PollAccessIndicatorWrapper } from '../../components/PollCard/PollAccessIndicator'
import { MotionDiv } from '../../components/Animations'
import { InputFieldGroup } from '../../components/InputFields'

const VoteIcon: FC = () => {
  return (
    <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.49 0.5C4.97 0.5 0.5 4.98 0.5 10.5C0.5 16.02 4.97 20.5 10.49 20.5C16.02 20.5 20.5 16.02 20.5 10.5C20.5 4.98 16.02 0.5 10.49 0.5ZM10.5 18.5C6.08 18.5 2.5 14.92 2.5 10.5C2.5 6.08 6.08 2.5 10.5 2.5C14.92 2.5 18.5 6.08 18.5 10.5C18.5 14.92 14.92 18.5 10.5 18.5ZM14 9.5C14.83 9.5 15.5 8.83 15.5 8C15.5 7.17 14.83 6.5 14 6.5C13.17 6.5 12.5 7.17 12.5 8C12.5 8.83 13.17 9.5 14 9.5ZM7 9.5C7.83 9.5 8.5 8.83 8.5 8C8.5 7.17 7.83 6.5 7 6.5C6.17 6.5 5.5 7.17 5.5 8C5.5 8.83 6.17 9.5 7 9.5ZM10.5 16C12.83 16 14.81 14.54 15.61 12.5H5.39C6.19 14.54 8.17 16 10.5 16Z"
        fill="#010038"
      />
    </svg>
  )
}

export const ThanksForVote: FC<PollData> = ({
  poll,
  existingVote: myVote,
  remainingTime,
  remainingTimeLabel,
  isMine,
  permissions,
  checkPermissions,
  completePoll,
  destroyPoll,
  resultsLabel,
}) => {
  const { name, choices } = poll!.ipfsParams
  return (
    <Card>
      <h2>Thanks for voting!</h2>
      <h4>
        <div className={'niceLine'}>
          {name}
          <PollAccessIndicatorWrapper
            isMine={isMine}
            permissions={permissions}
            isActive={false}
            retest={checkPermissions}
          />
        </div>
      </h4>
      <MotionDiv
        reason={'voteSubmitted'}
        layout
        className={`${classes.choice} ${classes.submitted}`}
        initial={{ opacity: 0, height: 0, width: '50%' }}
        animate={{ opacity: 1, height: 48, width: '100%' }}
      >
        <VoteIcon />
        {choices[Number(myVote)]}
      </MotionDiv>
      <SocialShares
        label={'Share vote on'}
        name={name}
        introText={'I just voted on this poll:'}
        pageTitle={name}
      />
      {remainingTime && !remainingTime.isPastDue ? (
        <>
          <h4>Poll completes in:</h4>
          <BigCountdown remainingTime={remainingTime} />
          <InputFieldGroup fields={[[destroyPoll]]} expandHorizontally={false} />
        </>
      ) : (
        <InputFieldGroup
          fields={[remainingTimeLabel, resultsLabel, [completePoll, destroyPoll]]}
          expandHorizontally={false}
        />
      )}
    </Card>
  )
}
