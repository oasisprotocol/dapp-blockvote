import { InputFieldControls, InputFieldProps, noType, useInputField } from './useInputField'
import { ButtonColor, ButtonSize, ButtonVariant } from '../Button'
import { useState } from 'react'
import { FieldLike } from './validation'
import { MarkdownCode } from '../../types'

type ActionContext = {
  setPendingMessage: (message: MarkdownCode | undefined) => void
  addMessage: (message: MarkdownCode) => string
  removeMessage: (signature: string) => void
}

export type ActionProps<ReturnData = void> = Omit<
  InputFieldProps<void>,
  | 'compact'
  | 'placeholder'
  | 'initialValue'
  | 'cleanUp'
  | 'required'
  | 'validatorsGenerator'
  | 'validators'
  | 'validateOnChange'
  | 'showValidationPending'
  | 'showValidationSuccess'
  | 'onValueChange'
> & {
  pendingLabel?: string
  size?: ButtonSize
  color?: ButtonColor
  variant?: ButtonVariant
  action: (context: ActionContext) => ReturnData
}

export type ActionControls<ReturnData> = FieldLike &
  Omit<
    InputFieldControls<void>,
    'value' | 'setValue' | 'reset' | 'hasProblems' | 'validate' | 'validatorProgress'
  > &
  Pick<ActionProps, 'color' | 'variant' | 'size'> & {
    pendingLabel: string | undefined
    execute: () => Promise<ReturnData>
  }

export function useAction<ReturnType>(props: ActionProps<ReturnType>): ActionControls<ReturnType> {
  const { color, variant, size, action, pendingLabel, name } = props
  const controls = useInputField(
    'action',
    { ...props, initialValue: undefined, showValidationPending: false },
    noType,
  )

  const [isPending, setIsPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState<MarkdownCode | undefined>()

  const execute = async (): Promise<ReturnType> => {
    setIsPending(true)
    try {
      const result = await action({
        setPendingMessage: message => setStatusMessage(message),
        addMessage: _message => 'x',
        removeMessage: _signature => {},
      })
      return result
    } catch (error) {
      console.log('Error while executing action', name, ':', error)
      throw error
    } finally {
      setIsPending(false)
    }
  }

  return {
    ...controls,
    color,
    variant,
    size,
    pendingLabel,
    validationPending: isPending,
    validationStatusMessage: statusMessage,
    execute,
  }
}
