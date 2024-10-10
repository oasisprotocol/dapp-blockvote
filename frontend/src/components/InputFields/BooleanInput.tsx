import { ChangeEvent, FC, useCallback } from 'react'
import { BooleanFieldControls } from './useBoolField'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'

import { WithVisibility } from './WithVisibility'
import { WithValidation } from './WithValidation'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'

export const BooleanInput: FC<BooleanFieldControls> = props => {
  const { name, description, label, value, setValue, allMessages, enabled, whyDisabled } = props

  // Clicking on the checkbox itself
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.checked),
    [setValue],
  )

  // Clicking on the label
  const handleLabelClick = useCallback(() => {
    console.log('label click')
    if (enabled) setValue(!value)
  }, [enabled, setValue, value])

  return (
    <WithVisibility field={props}>
      <WithValidation field={props} messages={allMessages.root}>
        <MaybeWithTooltip overlay={whyDisabled ?? description}>
          <div
            className={StringUtils.clsx('niceLine', enabled ? classes.pointer : classes.disabled)}
            onClick={handleLabelClick}
          >
            <input
              type={'checkbox'}
              name={name}
              checked={value}
              onChange={handleChange}
              size={32}
              disabled={!enabled}
            />
            {label}
            {(description || !enabled) && <span>🛈</span>}
          </div>
        </MaybeWithTooltip>
      </WithValidation>
    </WithVisibility>
  )
}
