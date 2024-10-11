import { FC } from 'react'
import { InputFieldControls } from './useInputField'
import { TextInput } from './TextInput'
import { TextFieldControls } from './useTextField'
import { TextArrayInput } from './TextArrayInput'
import { TextArrayControls } from './useTextArrayField'
import { BooleanInput } from './BooleanInput'
import { BooleanFieldControls } from './useBoolField'
import { SelectInput } from './SelectInput'
import { OneOfFieldControls } from './useOneOfField'
import { LabelControls } from './useLabel'
import { Label } from './Label'
import { DateInput } from './DateInput'
import { DateFieldControls } from './useDateField'
import { ActionButton } from './ActionButton'
import { ActionControls } from './useAction'

export const InputField: FC<{ controls: Pick<InputFieldControls<any>, 'type' | 'name'> }> = ({
  controls,
}) => {
  switch (controls.type) {
    case 'text':
      return <TextInput {...(controls as TextFieldControls)} />
    case 'text-array':
      return <TextArrayInput {...(controls as TextArrayControls)} />
    case 'boolean':
      return <BooleanInput {...(controls as BooleanFieldControls)} />
    case 'oneOf':
      return <SelectInput {...(controls as OneOfFieldControls<any>)} />
    case 'label':
      return <Label {...(controls as unknown as LabelControls<any>)} />
    case 'date':
      return <DateInput {...(controls as DateFieldControls)} />
    case 'action':
      return <ActionButton {...(controls as ActionControls<any>)} />
    default:
      console.log("Don't know how to edit field type", controls.type)
      return (
        <div>
          Missing {controls.type} field for {controls.name}
        </div>
      )
  }
}
