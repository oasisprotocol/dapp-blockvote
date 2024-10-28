import classes from './index.module.css'
import { forwardRef, MouseEventHandler, PropsWithChildren } from 'react'
import { StringUtils } from '../../utils/string.utils'
import { SpinnerIcon } from '../icons/SpinnerIcon'
import { TooltipBase } from '../Tooltip/MaybeWithTooltip'

export type ButtonSize = 'small' | 'medium'
export type ButtonColor = 'primary' | 'secondary' | 'success'
export type ButtonVariant = 'solid' | 'outline' | 'text'

type Props = PropsWithChildren &
  TooltipBase & {
    disabled?: boolean
    color?: ButtonColor
    size?: ButtonSize
    variant?: ButtonVariant
    fullWidth?: boolean
    onClick?: MouseEventHandler<HTMLButtonElement>
    className?: string
    type?: 'submit' | 'reset' | 'button'
    pending?: boolean
  }

const sizeMap: Record<ButtonSize, string> = {
  small: classes.buttonSmall,
  medium: classes.buttonMedium,
}

const colorMap: Record<ButtonColor, string> = {
  primary: classes.buttonPrimary,
  secondary: classes.buttonSecondary,
  success: classes.buttonSuccess,
}

const variantMap: Record<ButtonVariant, string> = {
  solid: classes.buttonSolid,
  outline: classes.buttonOutline,
  text: classes.buttonText,
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  (
    {
      className,
      children,
      disabled,
      color = 'primary',
      size = 'medium',
      variant = 'solid',
      fullWidth,
      onClick,
      type,
      pending,
      onMouseEnter,
      onMouseLeave,
      onFocus,
    },
    ref,
  ) => {
    const active = !(disabled || pending)
    const handleClick: MouseEventHandler<HTMLButtonElement> = _event => {
      if (active && onClick) {
        onClick(_event)
      }
    }
    return (
      <>
        <button
          ref={ref}
          className={StringUtils.clsx(
            className,
            classes.button,
            disabled ? classes.buttonDisabled : undefined,
            fullWidth ? classes.fullWidth : undefined,
            colorMap[color],
            sizeMap[size],
            variantMap[variant],
          )}
          onClick={handleClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          // disabled={disabled || pending} // We can't use real disabled, because that also kills mouse events. We will drop unwanted clicks in handleClick instead.
          type={type}
        >
          <label className={classes.buttonLabel}>
            {children}
            {pending && <SpinnerIcon width={24} height={24} spinning={true} />}
          </label>
        </button>
      </>
    )
  },
)
