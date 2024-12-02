import { FC, useState } from 'react'
import { METAMASK_HOME_PAGE_URL } from '../../constants/config'
import { Button } from '../Button'
import { UnknownNetworkError } from '../../utils/errors'
import { ConnectedAccount } from '../ConnectedAccount'

import classes from './index.module.css'
import { useEthereum } from '../../hooks/useEthereum'

interface Props {
  mobileSticky: boolean
  avoidButtonClasses?: boolean
}

export const ConnectWallet: FC<Props> = ({ mobileSticky, avoidButtonClasses = false }) => {
  const [isLoading, setIsLoading] = useState(false)

  const {
    isConnected,
    isProviderAvailable,
    userAddress,
    isHomeChain,
    state: { chainId },
    connectWallet,
    switchNetwork,
  } = useEthereum()

  // const { switchNetwork } = useWeb3()

  const handleConnectWallet = async () => {
    setIsLoading(true)
    try {
      await connectWallet()
    } catch (ex: any) {
      if (ex instanceof UnknownNetworkError || ex.code === 4001) {
        // Already handled by provider layer
      } else {
        console.log(Object.keys(ex), ex)
        alert((ex as Error).message ?? 'Failed to connect')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSwitchNetwork = async () => {
    setIsLoading(true)
    try {
      await switchNetwork()
      await handleConnectWallet()
    } catch (ex: any) {
      console.log('Error on switch')
      if (ex.code === 'ACTION_REJECTED') {
        // User rejection, nothing to do
      } else {
        console.log(ex)
        alert((ex as Error).message ?? 'Failed to switch network')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {!isConnected && !isProviderAvailable && (
        <a href={METAMASK_HOME_PAGE_URL} target={'_blank'} rel={'noopener noreferrer'}>
          <Button
            className={avoidButtonClasses ? undefined : classes.connectWalletBtn}
            color={'primary'}
            disabled={isLoading}
            size={'small'}
          >
            Install MetaMask
          </Button>
        </a>
      )}
      {isConnected && isProviderAvailable && !isHomeChain && (
        <Button
          className={avoidButtonClasses ? undefined : classes.connectWalletBtn}
          color={'primary'}
          size={'small'}
          disabled={isLoading}
          onClick={handleSwitchNetwork}
        >
          Switch Network
        </Button>
      )}
      {!isConnected && isProviderAvailable && (
        <Button
          className={avoidButtonClasses ? undefined : classes.connectWalletBtn}
          color={'primary'}
          size={'small'}
          disabled={isLoading}
          onClick={handleConnectWallet}
        >
          <label className={classes.connectWalletBtnLabel}>Connect Wallet</label>
        </Button>
      )}
      {isConnected && userAddress && chainId && isHomeChain && (
        <ConnectedAccount
          className={mobileSticky ? classes.stickyConnectedAccount : undefined}
          address={userAddress}
          chainId={chainId}
        />
      )}
    </>
  )
}
