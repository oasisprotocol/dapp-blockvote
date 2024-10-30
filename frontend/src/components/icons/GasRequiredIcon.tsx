import { FC } from 'react'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'
import { designDecisions, faucetUrl } from '../../constants/config'
import { NoGasRequiredIcon } from './NoGasRequiredIcon'

const GasRequiredIcon: FC<{ linkAllowed: boolean }> = ({ linkAllowed }) => {
  const useLink = !!faucetUrl && linkAllowed
  const icon = (
    <MaybeWithTooltip
      overlay={`Voting requires paying for some gas.${useLink ? ' Click here to get some gas.' : ''}`}
    >
      <svg width="17" height="19" viewBox="0 0 17 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15.77 4.34975L15.78 4.33975L12.06 0.619751L11 1.67975L13.11 3.78975C12.17 4.14975 11.5 5.04975 11.5 6.11975C11.5 7.49975 12.62 8.61975 14 8.61975C14.36 8.61975 14.69 8.53975 15 8.40975V15.6198C15 16.1698 14.55 16.6198 14 16.6198C13.45 16.6198 13 16.1698 13 15.6198V11.1198C13 10.0198 12.1 9.11975 11 9.11975H10V2.11975C10 1.01975 9.1 0.119751 8 0.119751H2C0.9 0.119751 0 1.01975 0 2.11975V18.1198H10V10.6198H11.5V15.6198C11.5 16.9998 12.62 18.1198 14 18.1198C15.38 18.1198 16.5 16.9998 16.5 15.6198V6.11975C16.5 5.42975 16.22 4.79975 15.77 4.34975ZM8 7.11975H2V2.11975H8V7.11975ZM14 7.11975C13.45 7.11975 13 6.66975 13 6.11975C13 5.56975 13.45 5.11975 14 5.11975C14.55 5.11975 15 5.56975 15 6.11975C15 6.66975 14.55 7.11975 14 7.11975Z"
          fill="#ED6C02"
        />
      </svg>
    </MaybeWithTooltip>
  )

  return useLink ? (
    <a href={faucetUrl} target={'_blank'}>
      {icon}
    </a>
  ) : (
    icon
  )
}

export const showGaslessPossible = (gaslessPossible: boolean | undefined, linkAllowed = false) =>
  gaslessPossible === undefined ? undefined : gaslessPossible ? (
    designDecisions.hideGaslessIndicator ? undefined : (
      <NoGasRequiredIcon />
    )
  ) : (
    <GasRequiredIcon linkAllowed={linkAllowed} />
  )
