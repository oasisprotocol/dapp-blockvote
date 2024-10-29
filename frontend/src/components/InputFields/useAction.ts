import { InputFieldControls, InputFieldProps, noType, useInputFieldInternal } from './useInputField'
import { ButtonColor, ButtonSize, ButtonVariant } from '../Button'
import { useState } from 'react'
import { FieldLike } from './validation'
import { MarkdownCode } from '../../types'
import { ExecutionContext } from './ExecutionContext'

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
  confirmQuestion?: string | undefined
  action: (context: ExecutionContext) => ReturnData
}

export type ActionControls<ReturnData> = FieldLike &
  Omit<
    InputFieldControls<void>,
    'value' | 'setValue' | 'reset' | 'hasProblems' | 'validate' | 'validatorProgress'
  > &
  Pick<ActionProps, 'color' | 'variant' | 'size'> & {
    pendingLabel: string | undefined
    isPending: boolean
    execute: () => Promise<ReturnData>
  }

export function useAction<ReturnType>(props: ActionProps<ReturnType>): ActionControls<ReturnType> {
  const { color, variant, size, action, pendingLabel, confirmQuestion } = props
  const controls = useInputFieldInternal(
    'action',
    { ...props, initialValue: undefined, showValidationPending: false },
    noType,
  )

  const [isPending, setIsPending] = useState(false)
  const [statusMessage, setStatusMessage] = useState<MarkdownCode | undefined>()

  const doExecute = async (): Promise<ReturnType> => {
    setIsPending(true)
    const context: ExecutionContext = {
      setStatus: (message, seconds) => {
        setStatusMessage(message)
        if (seconds) {
          console.log('This phase should take', seconds, 'seconds.') // TODO
        }
      },
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

  const execute = async (): Promise<ReturnType> => {
    if (isPending) {
      throw new Error(`Action ${props.name} is already running!`)
    }
    if (confirmQuestion) {
      if (confirm(confirmQuestion)) {
        return await doExecute()
      } else {
        throw new Error('User canceled action')
      }
    } else {
      return await doExecute()
    }
  }

  return {
    ...controls,
    color,
    variant,
    size,
    pendingLabel,
    isPending,
    validationPending: isPending,
    validationStatusMessage: statusMessage,
    execute,
  }
}
