import { FC, PropsWithChildren } from 'react'
import { InputFieldControls } from './useInputField'
import classes from './index.module.css'

export const WithLabelAndDescription: FC<
  PropsWithChildren<{ field: Pick<InputFieldControls<any>, 'label' | 'description' | 'compact'> }>
> = props => {
  const { field, children } = props
  const { label, description, compact } = field

  if (compact) {
    return description ? (
      <label className={classes.fieldLabelTag}>
        <div className={classes.fieldDescription}>{description}</div>
        {children}
      </label>
    ) : (
      children
    )
  } else {
    return !!label || !!description ? (
      <label className={classes.fieldLabelTag}>
        <div className={classes.fieldLabel}>{label}</div>
        <div className={classes.fieldDescription}>{description}</div>
        {children}
      </label>
    ) : (
      children
    )
  }
}
