import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './styles/global.css'
import './styles/theme-dark.css'
import './styles/theme-light.css'
import './styles/shell.css'
import './styles/home.css'
import './styles/chat.css'
import './styles/composer.css'
import './styles/overlays.css'
import './styles/startup.css'
import App from './App.tsx'
import { StartupGate } from './components/StartupGate'
import { SendChat } from './application/chat/send_chat'
import { HttpChatAdapter } from './infrastructure/chat/http_chat_adapter'
import { LocalStorageUserIdentityAdapter } from './infrastructure/identity/local_storage_user_identity_adapter'

const apiBaseUrl = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000')
const healthBaseUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000')
  : apiBaseUrl
const healthUrl = `${healthBaseUrl.replace(/\/$/, '')}/api/health`
const orchestratorStartUrl = import.meta.env.DEV ? '/orchestrator/start' : undefined
const orchestratorStatusUrl = import.meta.env.DEV ? '/orchestrator/status' : undefined
const orchestratorCancelUrl = import.meta.env.DEV ? '/orchestrator/cancel' : undefined
const orchestratorRetryUrl = import.meta.env.DEV ? '/orchestrator/retry' : undefined
const chatAdapter = new HttpChatAdapter(apiBaseUrl)
const identityAdapter = new LocalStorageUserIdentityAdapter()
const sendChat = new SendChat(chatAdapter, identityAdapter)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StartupGate
      healthUrl={healthUrl}
      orchestratorStartUrl={orchestratorStartUrl}
      orchestratorStatusUrl={orchestratorStatusUrl}
      orchestratorCancelUrl={orchestratorCancelUrl}
      orchestratorRetryUrl={orchestratorRetryUrl}
    >
      <App sendChat={sendChat} />
    </StartupGate>
  </StrictMode>,
)
