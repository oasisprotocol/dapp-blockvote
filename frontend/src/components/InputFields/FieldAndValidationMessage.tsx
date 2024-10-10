import { AnimatePresence } from 'framer-motion'
import { FC } from 'react'
import { FieldMessageList } from './FieldMessageDisplay'
import { FieldMessage } from './util'
import { InputFieldControls } from './useInputField'
import { MotionDiv } from '../Animations'

export const FieldAndValidationMessage: FC<
  Pick<InputFieldControls<any>, 'validationPending' | 'validationStatusMessage' | 'clearMessage'> & {
    messages: FieldMessage[]
  }
> = props => {
  const { validationPending, validationStatusMessage, messages, clearMessage } = props

  return (
    <>
      <FieldMessageList messages={messages} onRemove={clearMessage} />
      <AnimatePresence mode={'wait'}>
        {!!validationStatusMessage && validationPending && (
          <MotionDiv
            reason={'fieldValidationErrors'}
            layout
            key={'problems-and-validation-messages'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, delay: 0 }}
          >
            {validationStatusMessage}
          </MotionDiv>
        )}
      </AnimatePresence>
    </>
  )
}
