import { FC, PropsWithChildren, ReactNode } from 'react'
import { StringUtils } from '../../utils/string.utils'
import classes from './index.module.css'
import { InputFieldControls } from './useInputField'
import { checkMessagesForProblems, FieldMessage } from './util'
import { FieldAndValidationMessage } from './FieldAndValidationMessage'
import { FieldStatusIndicators } from './FieldStatusIndicator'

export const WithValidation: FC<
  PropsWithChildren<{
    field: Pick<
      InputFieldControls<any>,
      | 'indicateValidationPending'
      | 'indicateValidationSuccess'
      | 'validationPending'
      | 'isValidated'
      | 'validationStatusMessage'
      | 'clearMessage'
      | 'compact'
      | 'label'
    >
    fieldClasses?: string[]
    messages: FieldMessage[] | undefined
    extraWidget?: ReactNode | undefined
  }>
> = props => {
  const { field, fieldClasses = [], messages = [], children, extraWidget } = props
  const { hasWarning, hasError } = checkMessagesForProblems(messages)
  const { compact, label } = field
  return (
    <div
      className={StringUtils.clsx(
        ...fieldClasses,
        classes.textValue,
        hasError ? classes.fieldWithError : hasWarning ? classes.fieldWithWarning : '',
      )}
    >
      <div key="field-and-status" className="niceLine">
        {compact && <div className={classes.fieldLabel}>{label}</div>}
        {children}
        <FieldStatusIndicators key={'status'} {...field} messages={messages} />
        {extraWidget}
      </div>
      <FieldAndValidationMessage key="problems-and-status" messages={messages} {...field} />
    </div>
  )
}
