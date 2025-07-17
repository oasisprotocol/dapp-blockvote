import { FC, PropsWithChildren } from 'react'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'
import { PoweredByLogo } from '../icons/PoweredByLogo'
import { VITE_APP_LOGO_FILE, mainAppUrl } from '../../constants/config'

export const LayoutBase: FC<PropsWithChildren & { extraClasses?: string }> = ({ children, extraClasses }) => {
  return (
    <div className={StringUtils.clsx(classes.layout, extraClasses)}>
      <main className={StringUtils.clsx(classes.main, 'flex-1')}>{children}</main>
      {VITE_APP_LOGO_FILE && (
        <footer className={classes.footer}>
          <a href={mainAppUrl} target={'_blank'}>
            <PoweredByLogo />
          </a>
        </footer>
      )}
    </div>
  )
}
