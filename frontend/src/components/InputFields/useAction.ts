import { InputFieldControls, InputFieldProps, noType, useInputFieldInternal } from './useInputField'
import { ButtonColor, ButtonSize, ButtonVariant } from '../Button'
import { useState } from 'react'
import { FieldLike } from './validation'
import { MarkdownCode } from '../../types'

type ActionContext = {
  setPendingMessage: (message: MarkdownCode | undefined) => void
  log: (message: MarkdownCode, ...optionalParams: any[]) => void
  warn: (message: MarkdownCode, ...optionalParams: any[]) => void
  error: (message: MarkdownCode, ...optionalParams: any[]) => void
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
  action: (action: ActionContext) => ReturnData
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
  const { color, variant, size, action, pendingLabel } = props
  const controls = useInputFieldInternal(
    'action',
    { ...props, initialValue: undefined, showValidationPending: false },
    noType,
  )

  const [isPending, setIsPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState<MarkdownCode | undefined>()

  const execute = async (): Promise<ReturnType> => {
    setIsPending(true)
    const context: ActionContext = {
      setPendingMessage: message => setStatusMessage(message),
      log: (message, optionalParams) =>
        controls.addMessage({
          text: [message, ...(optionalParams || [])].join(' '),
          type: 'info',
          location: 'root',
        }),
      warn: (message, optionalParams) =>
        controls.addMessage({
          text: [message, ...(optionalParams || [])].join(' '),
          type: 'warning',
          location: 'root',
        }),
      error: (message, optionalParams) =>
        controls.addMessage({
          text: [message, ...(optionalParams || [])].join(' '),
          type: 'error',
          location: 'root',
        }),
    }
    try {
      controls.clearAllMessages()
      return await action(context)
    } catch (error: any) {
      context.error(error)
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
