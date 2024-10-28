import { InputFieldControls, InputFieldProps, useInputField } from './useInputField'
import { getAsArray, SingleOrArray } from './util'
import { ReactNode } from 'react'
import { renderMarkdown, TagName } from '../Markdown'
import { MarkdownCode } from '../../types'

export type FormatterFunction<DataType> = (rawValue: DataType) => string

export type RendererFunction<DataType> = (value: DataType | string, tagName: string) => ReactNode

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
   * Optional string transformation to ally to the content before rendering
   */
  formatter?: FormatterFunction<DataType>

  /**
   * Optional render function to use to get the HTML content from the (formatted) string.
   *
   * My default, de render as MarkDown
   */
  renderer?: RendererFunction<string>

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

export function useLabel<DataType extends string = string>(
  props: LabelProps<DataType>,
): LabelControls<DataType> {
  const { classnames = [], formatter, tagName = 'span', value } = props
  const { renderer = (value, tagName: TagName) => renderMarkdown(value, tagName) } = props

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

  const formattedValue = formatter ? formatter(value) : value
  const renderedContent = renderer(formattedValue, tagName)

  return {
    ...controls,
    value,
    classnames: getAsArray(classnames),
    renderedContent,
  }
}
