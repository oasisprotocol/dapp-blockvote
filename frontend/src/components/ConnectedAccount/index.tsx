import { FC, useCallback, useMemo, useState } from 'react'
import { JazzIcon } from '../JazzIcon'
import { useEthereum } from '../../hooks/useEthereum'
import { StringUtils } from '../../utils/string.utils'
import classes from './index.module.css'
import { useAppState } from '../../hooks/useAppState'
import { AddressShower } from '../Addresses'
import { getChainDefinition } from '../../utils/poll.utils'
import { getChainIconUrl } from '../../utils/crypto.demo'
import { MotionDiv, shouldAnimate } from '../Animations'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../Dialog/dialog'
import { Button } from '../Button'
import CopyIcon from '@phosphor-icons/core/assets/regular/copy.svg?react'
import SignOutIcon from '@phosphor-icons/core/assets/regular/sign-out.svg?react'
import ExploreIcon from '@phosphor-icons/core/assets/regular/magnifying-glass.svg?react'

interface Props {
  className?: string
  address: string
  chainId: number
}

export const ConnectedAccount: FC<Props> = ({ className, address, chainId }) => {
  const [open, setOpen] = useState(false)
  const handleClick = useCallback(() => setOpen(true), [])
  const { explorerBaseUrl, disconnectWallet } = useEthereum()
  const {
    state: { isDesktopScreen },
  } = useAppState()

  const chainDefinition = useMemo(() => getChainDefinition(chainId)!, [chainId])

  const url = useMemo(
    () => (explorerBaseUrl ? StringUtils.getAccountUrl(explorerBaseUrl, address) : undefined),
    [explorerBaseUrl, address],
  )
  const imageUrl = getChainIconUrl(chainDefinition.icon)

  const copyAddress = useCallback(() => void window.navigator.clipboard.writeText(address), [address])

  const viewInExplorer = useCallback(() => {
    if (url) window.open(url, '_blank')
  }, [url])

  const button = (
    <a className={StringUtils.clsx(className, classes.connectedAccount)} onClick={handleClick}>
      {isDesktopScreen ? (
        <div className={classes.connectedAccountDetails}>
          {shouldAnimate('walletExtend') ? (
            <MotionDiv
              reason={'walletExtend'}
              layout
              className={classes.network}
              whileHover={{ width: 'auto' }}
              transition={{ ease: 'easeInOut' }}
            >
              <img src={imageUrl} width={30} height={30} alt={'chain logo'} />
              {chainDefinition.name}
            </MotionDiv>
          ) : (
            <MaybeWithTooltip overlay={chainDefinition.name} placement={'top'}>
              <img src={imageUrl} width={30} height={30} alt={'chain logo'} />
            </MaybeWithTooltip>
          )}

          <JazzIcon size={30} address={address} />
          <AddressShower address={address} className={classes.connectedAccountAddress} />
        </div>
      ) : (
        <JazzIcon size={20} address={address} />
      )}
    </a>
  )

  return (
    <>
      {button}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className={'text-center'}>
              <JazzIcon size={60} address={address} />
            </DialogTitle>
            <DialogDescription className={'text-center'}>
              <AddressShower address={address} className={classes.connectedAccountAddress} />
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size={'small'} color={'secondary'} variant={'outline'} onClick={copyAddress}>
              <div className={'flex flex-col items-center'}>
                <CopyIcon fontSize={'1.5em'} />
                Copy Address
              </div>
            </Button>
            <Button size={'small'} color={'secondary'} variant={'outline'} onClick={viewInExplorer}>
              <div className={'flex flex-col items-center'}>
                <ExploreIcon fontSize={'1.5em'} />
                View in Explorer
              </div>
            </Button>
            <Button size={'small'} color={'secondary'} variant={'outline'} onClick={disconnectWallet}>
              <div className={'flex flex-col items-center'}>
                <SignOutIcon fontSize={'1.5em'} />
                Disconnect
              </div>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
