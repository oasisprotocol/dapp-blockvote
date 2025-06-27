import { FC, useCallback, useMemo } from 'react'
import classes from './index.module.css'
import { StringUtils } from '../../utils/string.utils'
import { LinkedinShareButton, TwitterShareButton } from 'react-share'
import { VITE_APP_TITLE } from '../../constants/config'
import { MaybeWithTooltip } from '../Tooltip/MaybeWithTooltip'

const Twitter: FC<{ classname?: string }> = ({ classname }) => (
  <MaybeWithTooltip overlay={'Share on X'} placement={'top'}>
    <div className={StringUtils.clsx(classes.socialIcon, classname)}>
      <svg width="20" height="19" viewBox="0 0 20 19" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M15.7512 0.461029H18.818L12.1179 8.11875L20 18.5392H13.8284L8.99458 12.2192L3.46359 18.5392H0.394938L7.5613 10.3484L0 0.461029H6.32828L10.6976 6.23769L15.7512 0.461029ZM14.6748 16.7036H16.3742L5.4049 2.20024H3.58133L14.6748 16.7036Z"
          fill="#010038"
        />
      </svg>
    </div>
  </MaybeWithTooltip>
)

const LinkedIn: FC<{ classname?: string }> = ({ classname }) => (
  <MaybeWithTooltip overlay={'Share on LinkedIn'} placement={'top'}>
    <div className={StringUtils.clsx(classes.socialIcon, classname)}>
      <svg width="22" height="23" viewBox="0 0 22 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20.3715 0.5H1.62422C0.726172 0.5 0 1.20898 0 2.08555V20.9102C0 21.7867 0.726172 22.5 1.62422 22.5H20.3715C21.2695 22.5 22 21.7867 22 20.9145V2.08555C22 1.20898 21.2695 0.5 20.3715 0.5ZM6.52695 19.2473H3.26133V8.7457H6.52695V19.2473ZM4.89414 7.31484C3.8457 7.31484 2.99922 6.46836 2.99922 5.42422C2.99922 4.38008 3.8457 3.53359 4.89414 3.53359C5.93828 3.53359 6.78477 4.38008 6.78477 5.42422C6.78477 6.46406 5.93828 7.31484 4.89414 7.31484ZM18.7473 19.2473H15.4859V14.1426C15.4859 12.9266 15.4645 11.3582 13.7887 11.3582C12.0914 11.3582 11.8336 12.6859 11.8336 14.0566V19.2473H8.57656V8.7457H11.7047V10.1809H11.7477C12.1816 9.35586 13.2473 8.48359 14.8328 8.48359C18.1371 8.48359 18.7473 10.6578 18.7473 13.4852V19.2473Z"
          fill="#010038"
        />
      </svg>
    </div>
  </MaybeWithTooltip>
)

const AsLink: FC<{ classname?: string; url: string }> = ({ classname, url }) => {
  const handleCopyLink = useCallback(async () => {
    await window.navigator.clipboard.writeText(url)
    alert('Link copied.')
  }, [url])
  return (
    <MaybeWithTooltip overlay={'Copy link'} placement={'top'}>
      <div className={StringUtils.clsx(classes.socialIcon, classname)} onClick={handleCopyLink}>
        <svg width="20" height="11" viewBox="0 0 20 11" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M1.9 5.5C1.9 3.79 3.29 2.4 5 2.4H9V0.5H5C2.24 0.5 0 2.74 0 5.5C0 8.26 2.24 10.5 5 10.5H9V8.6H5C3.29 8.6 1.9 7.21 1.9 5.5ZM6 6.5H14V4.5H6V6.5ZM15 0.5H11V2.4H15C16.71 2.4 18.1 3.79 18.1 5.5C18.1 7.21 16.71 8.6 15 8.6H11V10.5H15C17.76 10.5 20 8.26 20 5.5C20 2.74 17.76 0.5 15 0.5Z"
            fill="#010038"
          />
        </svg>
      </div>
    </MaybeWithTooltip>
  )
}

const AsEmbed: FC<{ classname?: string; url: string; title: string }> = ({ classname, url, title }) => {
  const embedCode = useMemo(
    () =>
      `<iframe
            width="640" height="720" src="${url}"
            title="${title} - ${VITE_APP_TITLE}" frameBorder="0"
            allow="clipboard-write; web-share"
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            >
       </iframe>`,
    [url],
  )

  const handleEmbed = useCallback(async () => {
    await window.navigator.clipboard.writeText(embedCode)
    alert('Embed code copied.')
  }, [embedCode])
  return (
    <MaybeWithTooltip overlay={'Embed this poll'} placement={'top'}>
      <div className={StringUtils.clsx(classes.socialIcon, classname)} onClick={handleEmbed}>
        <svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g clipPath="url(#clip0_2269_194)">
            <path
              d="M8.4 17.1L3.8 12.5L8.4 7.9L7 6.5L1 12.5L7 18.5L8.4 17.1ZM15.6 17.1L20.2 12.5L15.6 7.9L17 6.5L23 12.5L17 18.5L15.6 17.1Z"
              fill="#010038"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.0366 4.7726L10.8955 20.2274L8.96362 19.7098L13.1047 4.25496L15.0366 4.7726Z"
              fill="#010038"
            />
          </g>
          <defs>
            <clipPath id="clip0_2269_194">
              <rect width="24" height="24" fill="white" transform="translate(0 0.5)" />
            </clipPath>
          </defs>
        </svg>
      </div>
    </MaybeWithTooltip>
  )
}

export const SocialShares: FC<{
  label: string
  className?: string
  name: string
  introText: string
  pageTitle: string
}> = ({ label, className, name, introText, pageTitle }) => {
  const url = window.location.href
  const title = `"${name}" \n \n${introText}\n`

  return (
    <>
      <h4>{label}</h4>
      <div className={classes.socialIcons}>
        <TwitterShareButton url={url} title={title}>
          <Twitter classname={className} />
        </TwitterShareButton>

        <LinkedinShareButton url={url} summary={title}>
          <LinkedIn classname={className} />
        </LinkedinShareButton>

        <AsLink classname={className} url={url} />

        <AsEmbed classname={className} url={url} title={pageTitle} />
      </div>
    </>
  )
}
