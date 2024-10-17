import Tooltip from 'rc-tooltip'
import { FC, FocusEventHandler, forwardRef, MouseEventHandler, ReactNode } from 'react'
import { MarkdownCode } from '../../types'
import { MarkdownBlock } from '../Markdown'

/**
 * These are the props that must be implemented on children on MaybeWithTooltip
 *
 * Note that you also need to use forwardRef.
 */
export type TooltipBase = {
  onMouseEnter?: MouseEventHandler
  onMouseLeave?: MouseEventHandler
  onFocus?: FocusEventHandler
}

type Content = Exclude<ReactNode, undefined | null | string | number | boolean | Iterable<ReactNode>>

type TooltipProps = Omit<Parameters<typeof Tooltip>[0], 'overlay' | 'children'> & {
  overlay: MarkdownCode | undefined
  children: Content
}

/**
 * The difficulty here is that rc-tooltip (the widget we use) only works if the underlying
 * component can properly react to mouse events. Simple HTML elements (div, span, stc) are OK,
 * but custom components, something needs to be done. There are two ways to go:
 *
 * 1. Wrap the content in to a span (this is simple, always works, but might change layout
 * 2. Enhance the child component to forward the required props to the underlying components.
 *    This can avoid introducing extra tags into the DOM, and therefore changing the layout,
 *    but requires a bit of work.
 *
 * In order to know which option to chose in a given situation, we will be using
 * whitelists and blacklists of known good and bad components.
 */

const knownGoodSimple = ['div', 'span', 'svg', 'input', 'a', 'abbr', 'h1', 'h2', 'h3', 'h4', 'img', 'select']
const knownGoodFunctions = ['Button']
const knownWrappedFunctions = ['MarkdownBlock', 'OpenLockIcon', 'ClosedLockIcon', 'Icon']
const knownGoodObjects = [forwardRef(() => undefined).$$typeof]

const needsWrapping = (content: Content): boolean => {
  let result: boolean
  let subType: any
  if (typeof content === 'object') {
    switch (typeof content.type) {
      case 'string':
        subType = content.type
        result = !knownGoodSimple.includes(subType)
        if (result) {
          console.log('Do I really need to wrap simple tag', subType, '?')
        }
        return result
      case 'function':
        subType = content.type.name
        result = !knownGoodFunctions.includes(subType)
        if (result && !knownWrappedFunctions.includes(subType)) {
          console.log('Do I really need to wrap function', subType, '?')
        } else {
          console.log('Not wrapping function', subType)
        }
        return result
      case 'object':
        subType = (content.type as any).$$typeof
        result = !knownGoodObjects.includes(subType)
        if (result) {
          console.log('Do I really need to wrap object', subType, '?')
          // } else {
          //   console.log('Not wrapping object', subType)
        }
        return result
      default:
        console.log('How do I handle', content)
        return true
    }
  } else {
    console.log(
      "OOOps, we don't know if wrapping",
      content,
      'needs a wrapper, so we will go with YES, just to be sure',
    )
    return true
  }
}

export const MaybeWithTooltip: FC<TooltipProps> = forwardRef((props, ref) => {
  const { overlay, ...rest } = props

  return overlay ? (
    <Tooltip {...rest} ref={ref} overlay={<MarkdownBlock code={overlay} />}>
      {needsWrapping(props.children) ? <span>{props.children}</span> : props.children}
    </Tooltip>
  ) : (
    props.children
  )
})
