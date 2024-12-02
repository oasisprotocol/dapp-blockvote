import { FC, useCallback } from 'react'
import { Layout } from '../../components/Layout'
import { ConnectWallet } from '../../components/ConnectWallet'
import classes from './index.module.css'
import { Button } from '../../components/Button'
import { Link, useNavigate } from 'react-router-dom'
import { appName, VITE_TUTORIAL_URL } from '../../constants/config'
import { getPollPath } from '../../utils/path.utils'

export const LandingPage: FC = () => {
  const navigate = useNavigate()
  const openDemo = useCallback(() => navigate(getPollPath('demo')), [])
  const openTutorial = () => {
    console.log('Should open tutorial')
  }

  return (
    <Layout variation={'landing'}>
      <div className={classes.landing}>
        <h2>
          Welcome to <span className={'noWrap'}>{appName}</span>, a poll creation tool for your DAO.
        </h2>
        To participate in a poll or create one, please connect your wallet. This ensures secure and verified
        interaction with the polling system.
        <div className={'niceLineWide noWrap'}>
          <Button color={'secondary'} variant={'outline'} size={'small'} onClick={openDemo}>
            Use Demo
          </Button>
          {VITE_TUTORIAL_URL && (
            <Link to={VITE_TUTORIAL_URL} target={'_blank'}>
              <Button color={'secondary'} variant={'outline'} size={'small'} onClick={openTutorial}>
                Watch Tutorial
              </Button>
            </Link>
          )}
          <ConnectWallet mobileSticky={false} avoidButtonClasses={true} />
        </div>
      </div>
    </Layout>
  )
}
