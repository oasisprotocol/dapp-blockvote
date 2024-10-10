import { LabelControls } from './useLabel'
import { FC } from 'react'
import classes from './index.module.css'

import { WithVisibility } from './WithVisibility'
import { WithLabelAndDescription } from './WithLabelAndDescription'
import { WithValidation } from './WithValidation'

export const Label: FC<LabelControls<any>> = props => {
  const { value, allMessages, formatter, renderer, classnames } = props

  const formattedValue = formatter ? formatter(value) : value
  const renderedValue = renderer ? renderer(formattedValue) : formattedValue

  return (
    <WithVisibility field={props}>
      <WithLabelAndDescription field={props}>
        <WithValidation
          field={props}
          messages={allMessages.root}
          fieldClasses={[classes.label, ...classnames]}
        >
          <span>{renderedValue}</span>
        </WithValidation>
      </WithLabelAndDescription>
    </WithVisibility>
  )
}
