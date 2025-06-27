import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { setAnimationPolicy } from './components/Animations'
import { allowedAnimations } from './constants/config'
import 'rc-tooltip/assets/bootstrap_white.css'

if (window.location.pathname.endsWith('/lido')) window.location.href = 'https://vote-lido.oasis.io'

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

setAnimationPolicy({ id: 'allow', allow: allowedAnimations })
