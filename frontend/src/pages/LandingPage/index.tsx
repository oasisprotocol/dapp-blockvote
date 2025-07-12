import { FC, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { ConnectWallet } from '../../components/ConnectWallet'
import classes from './index.module.css'
import { Button } from '../../components/Button'
import { Link, useNavigate } from 'react-router-dom'
import {
  VITE_APP_LANDING_TITLE1,
  VITE_APP_LANDING_TITLE2,
  VITE_APP_TITLE,
  VITE_TUTORIAL_URL,
} from '../../constants/config'
import { getPollPath } from '../../utils/path.utils'
import { StringUtils } from '../../utils/string.utils'
import { useAppState } from '../../hooks/useAppState'

export const LandingPage: FC = () => {
  const {
    state: { isMobileScreen },
  } = useAppState()
  const navigate = useNavigate()
  const openDemo = useCallback(() => navigate(getPollPath('demo')), [])

  return (
    <Layout variation={'landing'}>
      <div className={StringUtils.clsx('flex justify-center flex-1', classes.landing)}>
        <div className={'flex flex-col items-center justify-center text-center gap-5'}>
          <h2>
            Welcome to <span className={'noWrap'}>{VITE_APP_TITLE}</span>
            {VITE_APP_LANDING_TITLE1 ?? ', a poll creation tool for your DAO.'}
          </h2>
          {VITE_APP_LANDING_TITLE2 ??
            'To participate in a poll or create one, please connect your wallet. This ensures secure and verified interaction with the polling system.'}
          <div className={StringUtils.clsx('flex', isMobileScreen ? 'flex-col gap-3' : 'noWrap gap-8')}>
            <Button color={'secondary'} variant={'outline'} size={'small'} onClick={openDemo}>
              Use Demo
            </Button>
            {VITE_TUTORIAL_URL && (
              <Link to={VITE_TUTORIAL_URL} target={'_blank'}>
                <Button color={'secondary'} variant={'outline'} size={'small'}>
                  Watch Tutorial
                </Button>
              </Link>
            )}
            <ConnectWallet mobileSticky={false} avoidButtonClasses={true} />
          </div>
        </div>
      </div>
    </Layout>
  )
}
