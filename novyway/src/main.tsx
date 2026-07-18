import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import '@fontsource/fira-sans/cyrillic-400.css'
import '@fontsource/fira-sans/cyrillic-500.css'
import '@fontsource/fira-sans/cyrillic-600.css'
import '@fontsource/fira-sans/cyrillic-700.css'
import '@fontsource/fira-sans/400.css'
import '@fontsource/fira-sans/500.css'
import '@fontsource/fira-sans/600.css'
import '@fontsource/fira-sans/700.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/unbounded/cyrillic-500.css'
import '@fontsource/unbounded/cyrillic-700.css'
import '@fontsource/unbounded/500.css'
import '@fontsource/unbounded/700.css'
import '@fontsource/fira-code/500.css'
import './styles/global.css'
import './styles/participation.css'

import App from './App'
import { AppProviders } from './demo/store'
import { installSoundDelegate } from './sound/engine'
import { SessionProvider } from './auth/session'

installSoundDelegate()

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=20260717-wallet-setup', { updateViaCache: 'none' })
        .then((registration) => registration.update())
        .catch(() => { /* offline shell unavailable */ })
    })
  } else {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {})

    if ('caches' in window) {
      caches.keys()
        .then((keys) => keys
          .filter((key) => key.startsWith('novyi-put-'))
          .forEach((key) => caches.delete(key)))
        .catch(() => {})
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <HashRouter>
        <AppProviders>
          <App />
        </AppProviders>
      </HashRouter>
    </SessionProvider>
  </StrictMode>,
)
