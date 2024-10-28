import { FC, MouseEventHandler } from 'react'
import { ActionControls } from './useAction'
import { WithVisibility } from './WithVisibility'
import { WithValidation } from './WithValidation'
import { Button } from '../Button'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'

export const ActionButton: FC<ActionControls<any>> = props => {
  const {
    name,
    allMessages,
    size,
    color,
    variant,
    label,
    pendingLabel,
    execute,
    enabled,
    whyDisabled,
    description,
    validationPending,
  } = props
  const handleClick: MouseEventHandler = event => {
    event.stopPropagation()
    execute().then(
      result => {
        console.log('Result on action button', name, ':', typeof result, result)
      },
      error => {
        if (error.message === 'User canceled action') {
          // User didn't confirm, not an issue
        } else {
          console.log('Error on action button', name, ':', error)
        }
      },
    )
  }
  return (
    <WithVisibility field={props}>
      <WithValidation field={props} messages={allMessages.root}>
        <MaybeWithTooltip overlay={whyDisabled ?? description} placement={'top'}>
          <Button
            variant={variant}
            size={size}
            color={color}
            onClick={handleClick}
            pending={validationPending}
            disabled={!enabled || validationPending}
          >
            {validationPending ? (pendingLabel ?? label) : label}
          </Button>
        </MaybeWithTooltip>
      </WithValidation>
    </WithVisibility>
  )
}
