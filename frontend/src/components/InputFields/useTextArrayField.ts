import { InputFieldControls, InputFieldProps, useInputField } from './useInputField'
import {
  atLeastXItems,
  expandCoupledData,
  getAsArray,
  getNumberMessage,
  NumberMessageTemplate,
  CoupledData,
  thereIsOnly,
  findDuplicates,
  SingleOrArray,
  ValidatorFunction,
  wrapProblem,
  ProblemAtLocation,
  flatten,
} from './util'
import { useState } from 'react'

/**
 * Parameters for defining an input field that accepts a list of strings
 */
type TextArrayProps = Omit<InputFieldProps<string[]>, 'initialValue'> & {
  // Initial values for all items
  initialValue?: string[]

  // Initial number of items
  initialItemCount?: number

  // Placeholders for all items
  placeholders?: string[]

  /**
   * Function to generate placeholders.
   *
   * Placeholders can be specified directly, or they
   * can be generated using this template function.
   */
  placeholderTemplate?: (index: number) => string

  /**
   *  Do we accept empty items?
   *
   *  You can specify this as a boolean, or as an array,
   *  the boolean first and then the error message.
   *
   *  Examples:
   *     tru
   *     false
   *     [false, 'Please specify phone number']
   */
  allowEmptyItems?: CoupledData<boolean, string>

  /**
   * Minimum number of items
   *
   * You can specify this as a number, or as an array,
   * the number first and then the error message,
   * which you can provide a string, or a function that
   * returns a string, including the specified minimum amount.
   *
   * Examples:
   *    2
   *    [3, "We want at least 3"]
   *    [3, amount => `We want at least ${amount}`]
   *
   */
  minItems?: CoupledData<number, NumberMessageTemplate>

  /**
   * Maximum number of items
   *
   * You can specify this as a number, or as an array,
   * the number first and then the error message,
   * which You can provide a string, or a function that
   * returns a string, including the specified maximum amount.
   *
   * Examples:
   *    10
   *    [10, "No more than ten, please!"]
   *    [12, amount => `Please use at most ${amount} values!`]
   */
  maxItem?: CoupledData<number, NumberMessageTemplate>

  /**
   * Minimum length of each item
   *
   * You can specify this as a number, or as an array,
   * the number first and then the error message,
   * which you can provide a string, or a function that
   * returns a string, including the specified minimum length.
   *
   * Examples:
   *      5
   *      [5, "This is too short"]
   *      [10, l => `Please use at least %{l} characters!`]
   */
  minItemLength?: CoupledData<number, NumberMessageTemplate>

  /**
   * Maximum length of each item
   *
   * You can specify this as a number, or as an array,
   * the number first and then the error message,
   * which you can provide a string, or a function that
   * returns a string, including the specified maximum length.
   *
   * Examples:
   *      100
   *      [40, "This is too long"]
   *      [50, l => `Please use at most %{l} characters!`]*
   */
  maxItemLength?: CoupledData<number, NumberMessageTemplate>

  /**
   * Is it allowed to specify the same item more than once?
   */
  allowDuplicates?: CoupledData<boolean, [string, string]>

  itemValidator?: SingleOrArray<undefined | ValidatorFunction<string>>

  // Label for adding more items
  addItemLabel?: string

  // Label for removing items
  removeItemLabel?: string

  // Logic to determine whether an item can be removed
  canRemoveItem?: (index: number, me: TextArrayControls) => boolean

  // Effects to run after an item has been edited
  onItemEdited?: (index: number, value: string, me: TextArrayControls) => void
}

export type TextArrayControls = InputFieldControls<string[]> & {
  numberOfItems: number

  setItem: (index: number, value: string) => void
  placeholders: string[]

  canAddItem: boolean
  addItemLabel: string
  addItem: () => void

  canRemoveItem: (index: number) => boolean
  removeItemLabel: string
  removeItem: (index: number) => void

  pendingValidationIndex: number | undefined
}

export function useTextArrayField(props: TextArrayProps): TextArrayControls {
  const {
    addItemLabel = 'Add',
    removeItemLabel = 'Remove',
    initialItemCount,
    placeholderTemplate,
    validators = [],
    validatorsGenerator,
    itemValidator = [],
    onItemEdited,
  } = props

  const [pendingValidationIndex, setPendingValidationIndex] = useState<number | undefined>()

  const [allowEmptyItems, emptyItemMessage] = expandCoupledData(props.allowEmptyItems, [
    false,
    'Please either fill this in, or remove this option.',
  ])

  const [minItemCount, tooFewItemsMessage] = expandCoupledData(props.minItems, [
    3,
    amount => `Please specify ${atLeastXItems(amount)}!`,
  ])

  const [maxItemCount, tooManyItemsMessage] = expandCoupledData(props.maxItem, [
    1000,
    amount => `Please specify at most ${amount} items.`,
  ])

  const [minLength, tooShortItemMessage] = expandCoupledData(props.minItemLength, [
    1,
    minLength => `Please specify at least ${minLength} characters.`,
  ])

  const [maxLength, tooLongItemMessage] = expandCoupledData(props.maxItemLength, [
    1000,
    maxLength => `Please don't use more than ${maxLength} characters.`,
  ])

  const [allowDuplicates, duplicatesErrorMessages] = expandCoupledData(props.allowDuplicates, [
    false,
    ['This item is repeated below.', 'This item is already listed above!'],
  ])

  const {
    initialValue = [...Array(initialItemCount ?? minItemCount).keys()].map((_, _index) => ''),
    placeholders,
  } = props

  const wrapItemValidatorFunction = (
    itemValidator: ValidatorFunction<string>,
    values: string[],
  ): ValidatorFunction<string[]>[] =>
    values.map(
      (value, index): ValidatorFunction<string[]> =>
        async (_, changed, controls) => {
          setPendingValidationIndex(index)
          const reports = getAsArray(await itemValidator(value, changed, controls))
            .map(rep => wrapProblem(rep, `value-${index}`, 'error'))
            .filter((p): p is ProblemAtLocation => !!p)
          setPendingValidationIndex(undefined)
          return reports
        },
    )

  const controls = useInputField<string[]>(
    'text-array',
    {
      ...props,
      initialValue,
      cleanUp: values => values.map(s => s.trim()),
      validators: undefined,
      validatorsGenerator: values => [
        // No empty elements, please
        allowEmptyItems
          ? undefined
          : values =>
              values.map((value, index) =>
                value
                  ? undefined
                  : {
                      message: emptyItemMessage,
                      location: `value-${index}`,
                    },
              ),

        // Do we have enough elements?
        minItemCount
          ? values => {
              const currentCount = values.filter(v => !!v).length
              return currentCount < minItemCount
                ? `${getNumberMessage(tooFewItemsMessage, minItemCount)} (Currently, ${thereIsOnly(currentCount)}.)`
                : undefined
            }
          : undefined,

        // Do we have too many elements?
        maxItemCount
          ? values => {
              const currentCount = values.filter(v => !!v).length
              return currentCount > maxItemCount
                ? `${getNumberMessage(tooManyItemsMessage, maxItemCount)} (Currently, there are ${currentCount}.)`
                : undefined
            }
          : undefined,

        // Check minimum length on all items
        minLength
          ? values =>
              values.map((value, index) =>
                !!value && value.length < minLength
                  ? {
                      message: `${getNumberMessage(tooShortItemMessage, minLength)} (Currently: ${value.length})`,
                      location: `value-${index}`,
                    }
                  : undefined,
              )
          : undefined,

        // Check maximum length on all items
        maxLength
          ? values =>
              values.map((value, index) =>
                !!value && value.length > maxLength
                  ? {
                      message: `${getNumberMessage(tooLongItemMessage, maxLength)} (Currently: ${value.length})`,
                      location: `value-${index}`,
                    }
                  : undefined,
              )
          : undefined,

        // Check for duplicates
        allowDuplicates
          ? undefined
          : values =>
              findDuplicates(values).flatMap((list, listIndex) => {
                const realList = list.filter(index => !!values[index])
                return realList.map(index => ({
                  message: duplicatesErrorMessages[listIndex],
                  location: `value-${index}`,
                  level: ['warning', 'error'][listIndex],
                }))
              }),

        // Specified custom per-item validators
        ...flatten(
          (getAsArray(itemValidator).filter(v => !!v) as ValidatorFunction<string>[]).map(validator =>
            wrapItemValidatorFunction(validator, values),
          ),
        ),

        // Specified custom global validators
        ...getAsArray(validatorsGenerator ? validatorsGenerator(values) : validators),
      ],
    },
    {
      isEmpty: value => !value.length,
      isEqual: (a, b) => a.join('-') === b.join('-'),
    },
  )

  const newControls: TextArrayControls = {
    ...controls,
    placeholders:
      placeholders ??
      [...Array(controls.value.length).keys()].map((_, index) =>
        placeholderTemplate ? placeholderTemplate(index) : '',
      ),
    numberOfItems: controls.value.length,
    canAddItem: !maxItemCount || controls.value.length < maxItemCount,
    setItem: () => {}, // This will be overwritten in the next step

    addItemLabel: addItemLabel,
    addItem: () => {
      controls.clearAllProblems()
      controls.setValue([...controls.value, ''])
    },
    canRemoveItem: () => false, // This will be overwritten
    removeItemLabel: removeItemLabel,
    removeItem: index => {
      controls.clearAllProblems()
      controls.setValue(controls.value.filter((_oldValue, oldIndex) => oldIndex !== index))
    },

    pendingValidationIndex,
  }

  newControls.canRemoveItem = (index: number) => {
    return (
      controls.value.length > minItemCount &&
      (props.canRemoveItem === undefined ? true : props.canRemoveItem(index, newControls))
    )
  }

  newControls.setItem = (index, value) => {
    controls.clearProblemsAt(`value-${index}`)
    controls.setValue(controls.value.map((oldValue, oldIndex) => (oldIndex === index ? value : oldValue)))
    if (onItemEdited) {
      onItemEdited(index, value, newControls)
    }
  }

  return newControls
}
