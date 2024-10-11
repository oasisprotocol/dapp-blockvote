import { LabelControls } from './useLabel'
import { FC } from 'react'
import classes from './index.module.css'

import { WithVisibility } from './WithVisibility'
import { WithLabelAndDescription } from './WithLabelAndDescription'
import { WithValidation } from './WithValidation'

export const Label: FC<LabelControls<any>> = props => {
  const { allMessages, classnames, renderedContent } = props

  return (
    <WithVisibility field={props}>
      <WithLabelAndDescription field={props}>
        <WithValidation
          field={props}
          messages={allMessages.root}
          fieldClasses={[classes.label, ...classnames]}
        >
          {renderedContent}
        </WithValidation>
      </WithLabelAndDescription>
    </WithVisibility>
  )
}
