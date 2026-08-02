import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter/index.css'
import '@fontsource-variable/jetbrains-mono/index.css'
import './styles/global.css'
import './styles/shell.css'
import './styles/home.css'
import './styles/chat.css'
import './styles/composer.css'
import './styles/overlays.css'
import App from './App.tsx'
import { SendChat } from './application/chat/send_chat'
import { HttpChatAdapter } from './infrastructure/chat/http_chat_adapter'
import { LocalStorageUserIdentityAdapter } from './infrastructure/identity/local_storage_user_identity_adapter'

const chatAdapter = new HttpChatAdapter(import.meta.env.VITE_API_BASE_URL)
const identityAdapter = new LocalStorageUserIdentityAdapter()
const sendChat = new SendChat(chatAdapter, identityAdapter)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App sendChat={sendChat} />
  </StrictMode>,
)
