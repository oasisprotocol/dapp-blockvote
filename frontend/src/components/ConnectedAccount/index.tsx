import { FC } from 'react'
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

interface Props {
  className?: string
  address: string
  chainId: number
}

export const ConnectedAccount: FC<Props> = ({ className, address, chainId }) => {
  const { explorerBaseUrl } = useEthereum()
  const {
    state: { isDesktopScreen },
  } = useAppState()

  const chainDefinition = getChainDefinition(chainId)!

  const url = explorerBaseUrl ? StringUtils.getAccountUrl(explorerBaseUrl, address) : undefined
  const imageUrl = getChainIconUrl(chainDefinition.icon)

  return (
    <a
      href={url}
      className={StringUtils.clsx(className, classes.connectedAccount)}
      target="_blank"
      rel="nofollow noreferrer"
    >
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
}
