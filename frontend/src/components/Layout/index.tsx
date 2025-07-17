import { FC, PropsWithChildren, ReactNode } from 'react'
import classes from './index.module.css'
import { LogoIcon } from '../icons/LogoIcon'
import { ConnectWallet } from '../ConnectWallet'
import { useAppState } from '../../hooks/useAppState'
import { StringUtils } from '../../utils/string.utils'
import { useInView } from 'react-intersection-observer'
import { LayoutBase } from '../LayoutBase'
import { Button } from '../Button'
import { Alert } from '../Alert'
import { Link, useLocation } from 'react-router-dom'

type LayoutVariation = 'landing' | 'dashboard' | 'light' | 'dark'

const layoutClasses: Partial<Record<LayoutVariation, string>> = {
  landing: classes.landingLayout,
  dashboard: classes.dashboardLayout,
  dark: classes.darkLayout,
  light: classes.lightLayout,
}

export const Layout: FC<
  PropsWithChildren & {
    variation: LayoutVariation
    extraWidget?: ReactNode | undefined
  }
> = ({ variation, children, extraWidget }) => {
  const {
    state: {
      // isInitialLoading,
      appError,
      isMobileScreen,
      // isUpcomingVote
    },
    clearAppError,
  } = useAppState()

  const { ref, inView } = useInView({
    threshold: 1,
    initialInView: true,
  })

  const isDemo = useLocation().pathname.endsWith('/demo')
  const connectButton = isDemo ? undefined : <ConnectWallet mobileSticky={isMobileScreen && !inView} />

  return (
    <>
      {isMobileScreen && <div className={classes.inViewPlaceholder} ref={ref} />}
      <LayoutBase extraClasses={layoutClasses[variation]}>
        <header
          className={StringUtils.clsx(
            classes.header,
            isMobileScreen && !inView ? classes.headerSticky : undefined,
          )}
        >
          <Link to={'/'}>
            <LogoIcon />
          </Link>
          {extraWidget ? (
            <div className={'niceLineWide'}>
              {extraWidget}
              {connectButton}
            </div>
          ) : (
            connectButton
          )}
        </header>
        <section className={'flex flex-1 flex-col'}>
          {appError && (
            <Alert
              type="error"
              actions={
                <Button variant="text" onClick={clearAppError}>
                  &lt; Go back&nbsp;
                </Button>
              }
            >
              {StringUtils.truncate(appError)}
            </Alert>
          )}
          {/*{isInitialLoading && (*/}
          {/*  <Alert headerText="Please wait" type="loading" actions={<span>Fetching poll...</span>} />*/}
          {/*)}*/}
          {!appError && children}
          {/*{!isInitialLoading && !appError && isUpcomingVote && <UpcomingVotePage />}*/}
        </section>
      </LayoutBase>
    </>
  )
}
