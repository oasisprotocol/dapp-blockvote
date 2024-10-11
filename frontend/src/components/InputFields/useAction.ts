import { InputFieldControls, InputFieldProps, noType, useInputField } from './useInputField'
import { ButtonColor, ButtonSize, ButtonVariant } from '../Button'
import { useState } from 'react'
import { FieldLike } from './validation'
import { MarkdownCode } from '../../types'

type ActionContext = {
  setPendingMessage: (message: MarkdownCode) => void
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
    isPending: boolean
    statusMessage: MarkdownCode | undefined
    execute: () => Promise<ReturnData>
  }

export function useAction<ReturnType>(props: ActionProps<ReturnType>): ActionControls<ReturnType> {
  const { color, variant, size, action } = props
  const controls = useInputField('action', { ...props, initialValue: undefined }, noType)

  const [isPending, setIsPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState<MarkdownCode>('')

  const execute = async (): Promise<ReturnType> => {
    setIsPending(true)
    const result = await action({
      setPendingMessage: message => setStatusMessage(message),
      addMessage: _message => 'x',
      removeMessage: _signature => {},
    })
    setIsPending(false)
    return result
  }

  return {
    ...controls,
    color,
    variant,
    size,
    isPending,
    statusMessage,
    execute,
  }
}
