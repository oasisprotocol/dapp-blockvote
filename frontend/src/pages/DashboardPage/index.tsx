import { FC } from 'react'
import { RestrictedContent } from '../RestrictedContent'
import { Dashboard } from './Dashboard'
import { Helmet } from 'react-helmet-async'
import { VITE_APP_TAGLINE, appRootUrl } from '../../constants/config'
import { defaultMetatags } from '../../components/metatags'

export const DashboardPage: FC = () => {
  return (
    <>
      <Helmet>
        {...defaultMetatags}
        <title>{VITE_APP_TAGLINE}</title>
        <meta name="twitter:title" content={VITE_APP_TAGLINE} />
        ,
        <meta property="og:title" content={VITE_APP_TAGLINE} />,
        <meta property="og:url" content={appRootUrl} />
      </Helmet>
      <RestrictedContent>
        <Dashboard />
      </RestrictedContent>
    </>
  )
}
