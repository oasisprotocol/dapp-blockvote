import { FC } from 'react'
import { useAppState } from '../../hooks/useAppState'

export const PoweredByLogo: FC = () => {
  const {
    state: { isDesktopScreen },
  } = useAppState()

  return (
    <img
      alt={'Blockvote - Powered by Oasis'}
      src={'powered_by_logo.svg'}
      width={isDesktopScreen ? 120 : 100}
    />
  )
}
