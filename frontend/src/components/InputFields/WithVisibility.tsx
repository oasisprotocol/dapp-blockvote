import { FC, PropsWithChildren } from 'react'
import { AnimatePresence } from 'framer-motion'
import { InputFieldControls } from './useInputField'
import { StringUtils } from '../../utils/string.utils'
import classes from './index.module.css'
import { MotionDiv } from '../Animations'

export const WithVisibility: FC<
  PropsWithChildren<{
    field: Pick<InputFieldControls<any>, 'visible' | 'containerClassName' | 'expandHorizontally' | 'name'>
    padding?: boolean
  }>
> = props => {
  const { field, children, padding = true } = props
  const { visible, containerClassName, expandHorizontally } = field

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <MotionDiv
          reason={'conditionalField'}
          layout
          key={field.name}
          className={StringUtils.clsx(
            classes.fieldContainer,
            expandHorizontally ? classes.fieldContainerExpand : undefined,
            containerClassName,
          )}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{
            // duration: 2,
            ease: 'easeInOut',
          }}
        >
          {children}
          {padding && <div key="padding" className={classes.fieldPadding} />}
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}
