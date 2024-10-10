import { AnimatePresence } from 'framer-motion'
import { FC } from 'react'
import { CheckCircleIcon } from '../icons/CheckCircleIcon'
import { SpinnerIcon } from '../icons/SpinnerIcon'
import { checkMessagesForProblems, FieldMessage } from './util'
import { InputFieldControls } from './useInputField'
import { WarningCircleIcon } from '../icons/WarningCircleIcon'
import { MotionDiv } from '../Animations'

export const FieldStatusIndicators: FC<
  Pick<
    InputFieldControls<any>,
    'indicateValidationPending' | 'indicateValidationSuccess' | 'validationPending' | 'isValidated'
  > & { messages: FieldMessage[] }
> = props => {
  const { indicateValidationPending, indicateValidationSuccess, validationPending, isValidated, messages } =
    props
  const { hasError, hasWarning } = checkMessagesForProblems(messages)
  const hasNoProblems = !hasError && !hasWarning
  const showSuccess = isValidated && indicateValidationSuccess && hasNoProblems
  const showPending = validationPending && indicateValidationPending
  const showError = hasError && !validationPending

  return (
    <AnimatePresence>
      {(showPending || showSuccess || showError) && (
        <MotionDiv
          reason={'fieldStatus'}
          layout
          key="field-status"
          initial={{ width: 0 }}
          animate={{ width: 'auto' }}
          exit={{ width: 0 }}
          // transition={{ duration: 2 }}
        >
          {showPending && (
            <MotionDiv
              reason={'fieldStatus'}
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <SpinnerIcon width={24} height={24} spinning={true} />
            </MotionDiv>
          )}
          {showSuccess && (
            <MotionDiv
              reason={'fieldStatus'}
              key={'success'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <CheckCircleIcon />
            </MotionDiv>
          )}
          {showError && (
            <MotionDiv
              reason={'fieldStatus'}
              key={'error'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <WarningCircleIcon />
            </MotionDiv>
          )}
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}
