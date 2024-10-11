import { FC, MouseEventHandler } from 'react'
import { ActionControls } from './useAction'
import { WithVisibility } from './WithVisibility'
import { WithValidation } from './WithValidation'
import { Button } from '../Button'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'

export const ActionButton: FC<ActionControls<any>> = props => {
  const { allMessages, size, color, variant, label, execute, isPending, enabled, whyDisabled, description } =
    props
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
            pending={isPending}
            disabled={!enabled}
          >
            {label}
          </Button>
        </MaybeWithTooltip>
      </WithValidation>
    </WithVisibility>
  )
}
