import { FC, MouseEventHandler } from 'react'
import { ActionControls } from './useAction'
import { WithVisibility } from './WithVisibility'
import { WithValidation } from './WithValidation'
import { Button } from '../Button'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'

export const ActionButton: FC<ActionControls<any>> = props => {
  const {
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
    void execute()
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
