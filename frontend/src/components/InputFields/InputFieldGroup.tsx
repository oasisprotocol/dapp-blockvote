import { FieldConfiguration } from './validation'
import { FC } from 'react'
import { InputField } from './InputField'
import { InputFieldControls } from './useInputField'
import classes from './index.module.css'
import { WithVisibility } from './WithVisibility'

type InputFieldGroupProps = {
  fields: FieldConfiguration
  alignRight?: boolean
}

export const InputFieldGroup: FC<InputFieldGroupProps> = ({ fields, alignRight }) => (
  <div className={classes.fieldGroup}>
    {fields.map((row, index) =>
      Array.isArray(row) ? (
        <WithVisibility
          key={`field-${index}`}
          field={{
            visible: row.some(controls => controls.visible),
            name: `group-${index}`,
            containerClassName: alignRight ? classes.fieldRowRight : classes.fieldRow,
          }}
          padding={false}
        >
          {row.map(field => (
            <InputField key={field.name} controls={field as any} />
          ))}
        </WithVisibility>
      ) : (
        <InputField key={row.name} controls={row as InputFieldControls<any>} />
      ),
    )}
  </div>
)
