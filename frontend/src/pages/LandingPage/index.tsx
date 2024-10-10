import { FC, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { ConnectWallet } from '../../components/ConnectWallet'
import classes from './index.module.css'
import { Button, ButtonSize } from '../../components/Button'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '../../hooks/useAppState'
import { appName } from '../../constants/config'

export const LandingPage: FC = () => {
  const navigate = useNavigate()
  const {
    state: { isMobileScreen },
  } = useAppState()
  const openDemo = useCallback(() => navigate('/demo'), [])
  const buttonSize: ButtonSize = isMobileScreen ? 'small' : 'medium'

  return (
    <Layout variation={'landing'}>
      <div className={classes.landing}>
        <h2>
          Welcome to <span className={'noWrap'}>{appName}</span>, a poll creation tool for your DAO.
        </h2>
        To participate in a poll or create one, please connect your wallet above. This ensures secure and
        verified interaction with the polling system.
        <div className={'niceLineWide noWrap'}>
          <Button color={'secondary'} variant={'outline'} size={buttonSize} onClick={openDemo}>
            View Demo
          </Button>
          <ConnectWallet mobileSticky={false} avoidButtonClasses={true} buttonSize={buttonSize} />
        </div>
      </div>
    </Layout>
  )
}
