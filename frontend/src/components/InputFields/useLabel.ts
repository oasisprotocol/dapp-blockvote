import { InputFieldControls, InputFieldProps, useInputField } from './useInputField'
import { getAsArray, SingleOrArray } from './util'
import { ReactNode } from 'react'
import { renderMarkdown, TagName } from '../Markdown'
import { MarkdownCode } from '../../types'

export type RendererFunction<DataType> = (value: DataType, tagName: string) => ReactNode

export type LabelProps<DataType = MarkdownCode> = Pick<
  InputFieldProps<DataType>,
  | 'name'
  | 'label'
  | 'compact'
  | 'description'
  | 'visible'
  | 'hidden'
  | 'containerClassName'
  | 'expandHorizontally'
  | 'validators'
  | 'validateOnChange'
  | 'showValidationSuccess'
> & {
  /**
   * Which HTML tag should contain this label?
   *
   * The default is <snap>
   */
  tagName?: TagName

  /**
   * What extra classes should we apply to the field's div?
   */
  classnames?: SingleOrArray<string>

  /**
   * Optional render function to use to get the HTML content from the (formatted) string.
   *
   * My default, we render as MarkDown. If markdown rendering is not appropriate
   * (for example. you want images) please provide a render function.
   */
  renderer?: RendererFunction<DataType>

  /**
   * The current value to display
   */
  value: DataType
}

export type LabelControls<DataType> = Omit<
  InputFieldControls<DataType>,
  'placeholder' | 'enabled' | 'whyDisabled' | 'setValue' | 'initialValue'
> & {
  classnames: string[]
  renderedContent: ReactNode
}

export function useLabel<DataType = MarkdownCode>(props: LabelProps<DataType>): LabelControls<DataType> {
  const {
    classnames = [],
    // formatter,
    tagName = 'span',
    value,
  } = props
  const { renderer = (value, tagName: TagName) => renderMarkdown(value as any, tagName) } = props

  const controls = useInputField(
    'label',
    {
      ...props,
      initialValue: value,
    },
    {
      isEmpty: value => !value,
      isEqual: (a, b) => a === b,
    },
  )

  const renderedContent = renderer(value, tagName)
  const visible = controls.visible && controls.value !== ''

  return {
    ...controls,
    value,
    classnames: getAsArray(classnames),
    renderedContent,
    visible,
  }
}
