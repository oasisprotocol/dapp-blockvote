import { ReactNode } from 'react'
import { appDescription, appRootUrl, VITE_APP_THUMBNAIL } from '../../constants/config'

export const defaultMetatags: ReactNode[] = [
  <meta key="twitter-key" name="twitter:card" content="summary_large_image" />,
  <meta key="twitter-desc" name="twitter:description" content={appDescription} />,
  <meta key="og-desc" property="og:description" content={appDescription} />,
  <meta key="twitter-image" name="twitter:image" content={`${appRootUrl}/${VITE_APP_THUMBNAIL}`} />,
  <meta key="og-image" property="og:image" content={`${appRootUrl}/${VITE_APP_THUMBNAIL}`} />,
]
