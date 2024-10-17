import { FC, MouseEventHandler } from 'react'
import { MarkdownCode } from '../../types'
import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { JSX } from 'react/jsx-runtime'
import IntrinsicElements = JSX.IntrinsicElements

export const renderComponents: Components = {
  // Always links so that they open on a new tab
  a: ({ children, href }) => {
    const handleClick: MouseEventHandler = event => event.stopPropagation()

    return (
      <a href={href} target={'_blank'} onClick={handleClick}>
        {children}
      </a>
    )
  },
}

export type TagName = keyof IntrinsicElements

type MarkdownBlockProps = {
  code: MarkdownCode | undefined
  mainTag?: TagName
}

export const MarkdownBlock: FC<MarkdownBlockProps> = ({ code, mainTag }) => {
  if (!code) return undefined
  return (
    <Markdown components={{ ...renderComponents, ...(mainTag ? { p: mainTag } : {}) }}>
      {code as string}
    </Markdown>
  )
}

export const renderMarkdown = (markdown: MarkdownCode | undefined, tagName: TagName = 'span') => (
  <MarkdownBlock code={markdown} mainTag={tagName} />
)
