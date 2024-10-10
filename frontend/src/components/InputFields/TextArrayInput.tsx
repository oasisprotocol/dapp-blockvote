import React, { FC, useCallback } from 'react'
import { TextArrayControls } from './useTextArrayField'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'
import { FieldMessageList } from './FieldMessageDisplay'
import { checkMessagesForProblems } from './util'
import { SpinnerIcon } from '../icons/SpinnerIcon'
import { AnimatePresence } from 'framer-motion'
import { WithVisibility } from './WithVisibility'
import { WithLabelAndDescription } from './WithLabelAndDescription'
import { WithValidation } from './WithValidation'
import { MotionDiv } from '../Animations'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'
import { MarkdownCode } from '../../types'
import { MarkdownBlock } from '../Markdown'

const TrashIcon: FC<{
  label: MarkdownCode | undefined
  remove: () => void
  enabled?: boolean
}> = ({ label, remove, enabled }) => {
  const handleClick = useCallback(() => {
    if (enabled) remove()
  }, [remove])
  return (
    <MaybeWithTooltip overlay={label}>
      <div className={classes.removeIcon} onClick={handleClick}>
        <svg width="14" height="19" viewBox="0 0 14 19" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M1 16.5C1 17.6 1.9 18.5 3 18.5H11C12.1 18.5 13 17.6 13 16.5V4.5H1V16.5ZM14 1.5H10.5L9.5 0.5H4.5L3.5 1.5H0V3.5H14V1.5Z"
            fill="#323232"
          />
        </svg>
      </div>
    </MaybeWithTooltip>
  )
}

const AddIcon: FC<{
  label: MarkdownCode
  add: () => void
  enabled?: boolean
  overlay?: MarkdownCode | undefined
}> = ({ label, add, enabled, overlay }) => {
  const handleClick = useCallback(() => {
    if (enabled) add()
  }, [add])
  return (
    <MaybeWithTooltip overlay={overlay}>
      <div className={StringUtils.clsx('niceLine', classes.addIcon)} onClick={handleClick}>
        <svg width="28" height="25" viewBox="0 0 28 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#clip0_2028_18630)">
            <path
              d="M12 2.5C6.48 2.5 2 6.98 2 12.5C2 18.02 6.48 22.5 12 22.5C17.52 22.5 22 18.02 22 12.5C22 6.98 17.52 2.5 12 2.5ZM17 13.5L13 13.5L13 17.5H11L11 13.5L7 13.5L7 11.5H11L11 7.5H13L13 11.5H17V13.5Z"
              fill="#130FFF"
            />
          </g>
          <defs>
            <clipPath id="clip0_2028_18630">
              <rect width="24" height="24" fill="white" transform="translate(0 0.5)" />
            </clipPath>
          </defs>
        </svg>
        <MarkdownBlock code={label} />
      </div>
    </MaybeWithTooltip>
  )
}

export const TextArrayInput: FC<TextArrayControls> = props => {
  const {
    name,
    value,
    placeholders,
    setItem,
    canAddItem,
    canRemoveItem,
    addItemLabel,
    addItem,
    removeItemLabel,
    removeItem,
    allMessages,
    clearMessage,
    enabled,
    whyDisabled,
    validationPending,
    validationStatusMessage,
    pendingValidationIndex,
    indicateValidationPending,
    indicateValidationSuccess,
    isValidated,
    hasProblems,
  } = props

  const handleChange = useCallback(
    (index: number, event: React.ChangeEvent<HTMLInputElement>) => setItem(index, event.target.value),
    [setItem],
  )

  return (
    <WithVisibility field={props}>
      <WithLabelAndDescription field={props}>
        <div className={classes.textArrayValue}>
          <FieldMessageList messages={allMessages.root} onRemove={clearMessage} />
          {validationPending && pendingValidationIndex === undefined && (
            <div className={'niceLine'}>
              {validationStatusMessage}
              <SpinnerIcon width={24} height={24} spinning={true} />
            </div>
          )}
          <AnimatePresence initial={false}>
            {value.map((value, index) => {
              const itemMessages = allMessages[`value-${index}`] || []
              const { hasError, hasWarning } = checkMessagesForProblems(itemMessages)

              return (
                // <WithVisibility
                //   key={`item-${index}`}
                //   field={{ visible: true, name: `item-${index}` }}
                //   padding={false}
                // >
                <MotionDiv
                  reason={'conditionalField'}
                  layout
                  key={`edit-${index}`}
                  className={StringUtils.clsx(
                    classes.textValue,
                    hasError ? classes.fieldWithError : hasWarning ? classes.fieldWithWarning : '',
                  )}
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                >
                  <WithValidation
                    field={{
                      indicateValidationPending,
                      indicateValidationSuccess,
                      validationPending: pendingValidationIndex === index,
                      isValidated:
                        // Determine if we can be sure that this item is fully OK

                        // The difficulty here is that when finding an error,
                        // we stop executing the validators, so this means that
                        // having no problems reported locally can also be the result of
                        // not all validators being executed.
                        // For now, the best we can do is look at _all_ errors, not only local errors.
                        // This way, we can only checkmark items when all items are OK.
                        //
                        // Improving this would entitle:
                        // - Extending the validator type with meta-info about which items
                        //   will a validator check
                        // - Executing the validators in a sorted order, so that we
                        //   can completely check some fields before going into others
                        // - Pass info as part of the controls about which fields have been
                        //   completely validated
                        isValidated && !hasProblems,
                      validationStatusMessage:
                        pendingValidationIndex === index ? validationStatusMessage : undefined,
                      clearMessage,
                    }}
                    messages={itemMessages}
                    extraWidget={
                      canRemoveItem(index) ? (
                        <TrashIcon
                          enabled={enabled}
                          label={whyDisabled ?? removeItemLabel}
                          remove={() => removeItem(index)}
                        />
                      ) : undefined
                    }
                  >
                    <MaybeWithTooltip overlay={whyDisabled}>
                      <input
                        name={name}
                        key={`edit-${index}`}
                        placeholder={placeholders[index]}
                        value={value}
                        onChange={event => handleChange(index, event)}
                        className={classes.textValue}
                        disabled={!enabled}
                      />
                    </MaybeWithTooltip>
                  </WithValidation>
                </MotionDiv>
                // </WithVisibility>
              )
            })}
          </AnimatePresence>
          {canAddItem && (
            <MaybeWithTooltip overlay={whyDisabled}>
              <AddIcon label={addItemLabel} add={addItem} enabled={enabled} />
            </MaybeWithTooltip>
          )}
        </div>
      </WithLabelAndDescription>
    </WithVisibility>
  )
}
