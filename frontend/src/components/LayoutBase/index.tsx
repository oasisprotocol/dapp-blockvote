import { FC, PropsWithChildren } from 'react'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'
import { PoweredByLogo } from '../icons/PoweredByLogo'
import { VITE_APP_LOGO_FILE } from '../../constants/config'

export const LayoutBase: FC<PropsWithChildren & { extraClasses?: string }> = ({ children, extraClasses }) => {
  return (
    <div className={StringUtils.clsx(classes.layout, extraClasses)}>
      <main className={classes.main}>{children}</main>
      <footer className={classes.footer}>{VITE_APP_LOGO_FILE && <PoweredByLogo />}</footer>
    </div>
  )
}
