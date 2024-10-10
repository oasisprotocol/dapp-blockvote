import { useEffect, useMemo, useState } from 'react'
import {
  AllMessages,
  ValidatorControls,
  CoupledData,
  Decision,
  expandCoupledData,
  getAsArray,
  getReason,
  getVerdict,
  invertDecision,
  MessageAtLocation,
  SingleOrArray,
  ValidatorFunction,
  wrapValidatorOutput,
  checkMessagesForProblems,
} from './util'
import { MarkdownCode } from '../../types'

type ValidatorBundle<DataType> = SingleOrArray<undefined | ValidatorFunction<DataType>>

/**
 * Data type for describing a field
 */
export type InputFieldProps<DataType> = {
  /**
   * The name of this field.
   *
   * Only used for debugging.
   */
  name: string

  /**
   * Optional description of this field.
   */
  description?: string

  /**
   * Optional label to use for this field.
   */
  label?: string

  /**
   * Do we normally want to have the label on the same line as the value?
   */
  compact?: boolean

  placeholder?: string
  initialValue: DataType

  /**
   * Optional function to normalize the value
   */
  cleanUp?: (value: DataType) => DataType

  /**
   * Is this field required?
   *
   * Optionally, you can also specify the corresponding error message.
   */
  required?: CoupledData

  validatorsGenerator?: (values: DataType) => ValidatorBundle<DataType>

  /**
   * Validators to apply to values
   */
  validators?: ValidatorBundle<DataType>

  /**
   * Should this field be shown?
   *
   * Default is true.
   *
   * You can also use the "hidden" field for the same effect,
   * just avoid contradictory values.
   */
  visible?: boolean

  /**
   * Should this field be hidden?
   *
   * Default is false.
   *
   * You can also use the "visible" field for the same effect,
   * just avoid contradictory values.
   */
  hidden?: boolean

  /**
   * Is this field enabled, that is, editable?
   *
   * Default is true.
   *
   * Optionally, you can also specify why it's currently disabled.
   *
   * You can also use the "disabled" field for the same effect,
   * just avoid contradictory values.
   */
  enabled?: Decision

  /**
   * Is this field disabled, that is, read only?
   *
   * Default is false.
   *
   * Optionally, you can also specify why is it disabled.
   *
   * You can also use the "enabled" field for the same effect,
   * just avoid contradictory values.
   */
  disabled?: Decision

  /**
   * Extra classes to apply to the container div
   */
  containerClassName?: string

  /**
   * Should this field be validated after every change?
   *
   * Default is false.
   */
  validateOnChange?: boolean

  /**
   * Should we indicate when validation is running?
   *
   * Default is true.
   */
  showValidationPending?: boolean

  /**
   * Besides errors, should we also indicate successful validation status?
   *
   * Default is false.
   */
  showValidationSuccess?: boolean

  /**
   * Effects to run after the value changed
   */
  onValueChange?: (value: DataType, isStillFresh: () => boolean) => void
}

export type ValidationReason = 'change' | 'submit'
export type ValidationParams = {
  forceChange?: boolean
  reason: ValidationReason
  // A way to check if this validation request is still valid, or is it now stale (because of changed value)
  isStillFresh: () => boolean
}

/**
 * Data type passed from the field controller to the field UI widget
 */
export type InputFieldControls<DataType> = Pick<
  InputFieldProps<DataType>,
  'label' | 'compact' | 'description' | 'placeholder' | 'name'
> & {
  type: string
  visible: boolean
  enabled: boolean
  whyDisabled?: MarkdownCode
  containerClassName?: string
  value: DataType
  setValue: (value: DataType) => void
  reset: () => void
  allMessages: AllMessages
  hasProblems: boolean
  isValidated: boolean
  validate: (params: ValidationParams) => Promise<boolean>
  validationPending: boolean
  validationStatusMessage: string | undefined
  validatorProgress: number | undefined
  indicateValidationPending: boolean
  indicateValidationSuccess: boolean
  clearMessage: (id: string) => void
  clearMessagesAt: (location: string) => void
  clearAllMessages: () => void
}

type DataTypeTools<DataType> = {
  isEmpty: (data: DataType) => boolean
  isEqual: (data1: DataType, data2: DataType) => boolean
}

const calculateVisible = (controls: Pick<InputFieldProps<any>, 'name' | 'hidden' | 'visible'>): boolean => {
  const { name, hidden, visible } = controls
  if (visible === undefined) {
    if (hidden === undefined) {
      return true
    } else {
      return !hidden
    }
  } else {
    if (hidden === undefined) {
      return visible
    } else {
      if (visible !== hidden) {
        return visible
      } else {
        throw new Error(
          `On field ${name}, props "hidden" and "visible" have been set to contradictory values!`,
        )
      }
    }
  }
}

export const calculateEnabled = (
  controls: Pick<InputFieldProps<any>, 'name' | 'enabled' | 'disabled'>,
): Decision => {
  const { name, enabled, disabled } = controls
  if (enabled === undefined) {
    if (disabled === undefined) {
      return true
    } else {
      return invertDecision(disabled)
    }
  } else {
    if (disabled === undefined) {
      return enabled
    } else {
      if (getVerdict(enabled, false) !== getVerdict(disabled, false)) {
        return {
          verdict: getVerdict(enabled, false),
          reason: getReason(disabled) ?? getReason(enabled),
        }
      } else {
        throw new Error(
          `On field ${name}, props "enabled" and "disabled" have been set to contradictory values!`,
        )
      }
    }
  }
}

export function useInputField<DataType>(
  type: string,
  props: InputFieldProps<DataType>,
  dataTypeControl: DataTypeTools<DataType>,
): InputFieldControls<DataType> {
  const {
    name,
    label,
    compact,
    placeholder,
    description,
    initialValue,
    cleanUp,
    validators = [],
    validatorsGenerator,
    containerClassName,
    validateOnChange,
    showValidationPending = true,
    showValidationSuccess = false,
    onValueChange,
  } = props

  const [required, requiredMessage] = expandCoupledData(props.required, [false, 'This field is required'])

  const [value, setValue] = useState<DataType>(initialValue)
  const cleanValue = cleanUp ? cleanUp(value) : value
  const [messages, setMessages] = useState<MessageAtLocation[]>([])
  const allMessages = useMemo(() => {
    const messageTree: AllMessages = {}
    messages.forEach(message => {
      const { location } = message
      let bucket = messageTree[location]
      if (!bucket) bucket = messageTree[location] = []
      const localMessage: MessageAtLocation = { ...message }
      delete (localMessage as any).location
      bucket.push(localMessage)
    })
    return messageTree
  }, [messages])
  const hasProblems = Object.keys(allMessages).some(
    key => checkMessagesForProblems(allMessages[key]).hasError,
  )
  const [isValidated, setIsValidated] = useState(false)
  const [lastValidatedData, setLastValidatedData] = useState<DataType | undefined>()
  const [validationPending, setValidationPending] = useState(false)

  const { isEmpty, isEqual } = dataTypeControl

  const visible = calculateVisible(props)
  const enabled = calculateEnabled(props)

  const isEnabled = getVerdict(enabled, true)

  const [validatorProgress, setValidatorProgress] = useState<number>()
  const [validationStatusMessage, setValidationStatusMessage] = useState<string | undefined>()

  const validatorControls: Pick<ValidatorControls, 'updateStatus'> = {
    updateStatus: ({ progress, message }) => {
      if (progress) setValidatorProgress(progress)
      if (message) setValidationStatusMessage(message)
    },
  }

  const validate = async (params: ValidationParams): Promise<boolean> => {
    const { forceChange = false, reason, isStillFresh } = params
    const wasOK = isValidated && !hasProblems

    setValidationPending(true)
    setIsValidated(false)
    setValidationStatusMessage(undefined)
    setValidatorProgress(undefined)

    // Clean up the value
    const different = !isEqual(cleanValue, value)
    if (different && reason !== 'change') {
      setValue(cleanValue)
    }

    // Let's start to collect the new messages
    const currentMessages: MessageAtLocation[] = []
    let hasError = false

    // If it's required but empty, that's already an error
    if (required && isEmpty(cleanValue) && reason !== 'change') {
      currentMessages.push(wrapValidatorOutput(requiredMessage, 'root', 'error')!)
      hasError = true
    }

    // Identify the user-configured validators to use
    const realValidators = getAsArray(
      validatorsGenerator ? validatorsGenerator(cleanValue) : validators,
    ).filter((v): v is ValidatorFunction<DataType> => !!v)

    // Go through all the validators
    for (const validator of realValidators) {
      // Do we have anything to worry about from this validator?
      try {
        const validatorReport =
          hasError || !isStillFresh() || (!forceChange && wasOK && lastValidatedData === cleanValue)
            ? [] // If we already have an error, don't even bother with any more validators
            : await validator(cleanValue, { ...validatorControls, isStillFresh }, params.reason) // Execute the current validators

        getAsArray(validatorReport) // Maybe we have a single report, maybe an array. Receive it as an array.
          .map(report => wrapValidatorOutput(report, 'root', 'error')) // Wrap single strings to proper reports
          .forEach(message => {
            // Go through all the reports
            if (!message) return
            if (message.type === 'error') hasError = true
            currentMessages.push(message)
          })
      } catch (validatorError) {
        console.log('Error while running validator', validatorError)
        currentMessages.push(wrapValidatorOutput(`Error while checking: ${validatorError}`, 'root', 'error')!)
      }
    }

    if (isStillFresh()) {
      setMessages(currentMessages)
      setValidationPending(false)
      setIsValidated(true)
      setLastValidatedData(cleanValue)

      // Do we have any actual errors?
      return !currentMessages.some(message => message.type === 'error')
    } else {
      return false
    }
  }

  const clearMessage = (message: string) => {
    const oldLength = messages.length
    setMessages(messages.filter(p => p.text !== message || p.type === 'info'))
    if (messages.length !== oldLength) setIsValidated(false)
  }

  const clearMessagesAt = (location: string): void => {
    setMessages(messages.filter(p => p.location !== location))
    setIsValidated(false)
  }

  const clearAllMessages = () => {
    setMessages([])
    setIsValidated(false)
  }

  useEffect(() => {
    let fresh = true
    if (onValueChange) {
      onValueChange(value, () => fresh)
    }
    if (visible) {
      if (validateOnChange && !isEmpty(cleanValue)) {
        void validate({ reason: 'change', isStillFresh: () => fresh })
      } else {
        clearAllMessages()
        setIsValidated(false)
      }
    }
    return () => {
      fresh = false
      return
    }
  }, [visible, JSON.stringify(cleanValue), validateOnChange])

  const reset = () => setValue(initialValue)

  return {
    type,
    name,
    description,
    label,
    compact,
    placeholder,
    value,
    setValue,
    reset,
    allMessages: allMessages,
    hasProblems,
    isValidated,
    clearMessage,
    clearMessagesAt,
    clearAllMessages,
    indicateValidationSuccess: showValidationSuccess,
    indicateValidationPending: showValidationPending,
    validate,
    validationPending: showValidationPending && validationPending,
    validationStatusMessage,
    validatorProgress,
    visible,
    enabled: isEnabled,
    whyDisabled: isEnabled ? undefined : getReason(enabled),
    containerClassName,
  }
}
