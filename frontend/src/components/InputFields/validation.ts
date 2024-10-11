import { InputFieldControls, ValidationReason } from './useInputField'
import { AsyncValidatorFunction, getAsArray, SingleOrArray } from './util'
import { LabelProps } from './useLabel'

export type FieldLike = Pick<
  InputFieldControls<any>,
  'name' | 'type' | 'visible' | 'validate' | 'hasProblems'
>

export type FieldConfiguration = SingleOrArray<FieldLike>[]

/**
 * Go through a group of fields, and do full validation.
 *
 * Returns true if there was an error.
 */
export const validateFields = async (
  fields: FieldConfiguration,
  /**
   * Why are we doing this?
   *
   * Behavior will be different depending on the reason.
   * For example, we will clean values on form submission, but not when validating on change.
   */
  reason: ValidationReason,

  /**
   * Tester for value freshness.
   *
   * Validation will be interrupted if the returned value changes to false.
   */
  isStillFresh: () => boolean,
): Promise<boolean> => {
  // Get a flattened list of fields
  const allFields = fields.flatMap(config => getAsArray(config))
  let hasError = false
  for (const field of allFields) {
    const isFieldProblematic = await field.validate({ reason, isStillFresh })
    hasError = hasError || isFieldProblematic
  }
  return hasError
}

/**
 * Check whether any of these fields has an error
 */
export const doFieldsHaveAnError = (fields: FieldConfiguration): boolean =>
  fields
    .flatMap(config => getAsArray(config))
    .filter(field => field.visible)
    .some(field => field.hasProblems)

const sleep = (time: number) => new Promise<string>(resolve => setTimeout(() => resolve(''), time))

const mockValidator: AsyncValidatorFunction<any> = async (_value, controls) => {
  if (!controls.isStillFresh()) return undefined
  await sleep(500)
  return undefined
}

export const addMockValidation: Partial<LabelProps> = {
  showValidationSuccess: true,
  validators: mockValidator,
  validateOnChange: true,
}
