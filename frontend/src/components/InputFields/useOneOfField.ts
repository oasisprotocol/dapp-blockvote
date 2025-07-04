import { calculateEnabled, InputFieldControls, InputFieldProps, useInputField } from './useInputField'
import { andDecisions, Decision, deny, getVerdict } from './util'

export type Choice<DataType = string> = {
  value: DataType
  label: string
  description?: string
  enabled?: Decision
  hidden?: boolean
}

type OneOfFieldProps<DataType = string> = Omit<
  InputFieldProps<DataType>,
  'initialValue' | 'required' | 'placeholder'
> & {
  initialValue?: DataType
  readonly choices: readonly Choice<DataType>[]
  requiredMessage?: string
  hideDisabledChoices?: boolean
  disableIfOnlyOneVisibleChoice?: boolean
  hideIfDisabled?: boolean
}

export type OneOfFieldControls<DataType> = InputFieldControls<DataType> & {
  choices: readonly Choice<DataType>[]
}

export function useOneOfField<DataType>(props: OneOfFieldProps<DataType>): OneOfFieldControls<DataType> {
  const {
    choices,
    requiredMessage = 'Please select an option!',
    hideDisabledChoices,
    disableIfOnlyOneVisibleChoice,
    hideIfDisabled,
  } = props
  const visibleChoices = choices.filter(
    choice => !choice.hidden && (!hideDisabledChoices || getVerdict(choice.enabled, true)),
  )
  const enabledChoices = visibleChoices.filter(choice => getVerdict(choice.enabled, true))
  const initialValue = props.initialValue ?? (enabledChoices[0] ?? visibleChoices[0]).value

  const originallyEnabled = calculateEnabled(props)
  const canSeeAlternatives =
    disableIfOnlyOneVisibleChoice && visibleChoices.length <= 1
      ? deny('Currently no other choice is available.')
      : true

  const controls = useInputField<DataType>(
    'oneOf',
    {
      ...props,
      enabled: andDecisions(originallyEnabled, canSeeAlternatives),
      disabled: undefined,
      initialValue,
      required: [true, requiredMessage],
      cleanUp: v => v,
    },
    {
      isEmpty: () => false,
      isEqual: (a, b) => a === b,
    },
  )

  return {
    ...controls,
    visible: controls.visible && (controls.enabled || !hideIfDisabled),
    choices,
  }
}
