import React, { FC, useCallback } from 'react'
import { OneOfFieldControls } from './useOneOfField'
import { getReasonForDenial, getVerdict } from './util'
import { WithVisibility } from './WithVisibility'
import { WithLabelAndDescription } from './WithLabelAndDescription'
import { WithValidation } from './WithValidation'
import classes from './index.module.css'

export const SelectInput: FC<OneOfFieldControls<any>> = props => {
  const { choices, allMessages, value, setValue, enabled } = props

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setValue(e.target.value),
    [setValue],
  )

  return (
    <WithVisibility field={props}>
      <WithLabelAndDescription field={props}>
        <WithValidation field={props} messages={allMessages.root} fieldClasses={[classes.selectValue]}>
          <select value={value} onChange={handleChange} disabled={!enabled}>
            {choices
              .filter(c => !c.hidden)
              .map(choice => {
                const disabled = !getVerdict(choice.enabled, true)
                return (
                  <option
                    key={choice.value}
                    value={choice.value}
                    disabled={disabled}
                    // TODO: we can't display HTML reason here, so display the markdown test.
                    // The proper solution is to use a custom select component.
                    title={(getReasonForDenial(choice.enabled) as string) ?? choice.description}
                  >
                    {choice.label} {disabled || choice.description ? '🛈' : ''}
                  </option>
                )
              })}
          </select>
        </WithValidation>
      </WithLabelAndDescription>
    </WithVisibility>
  )
}
