import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CrmApp from './crm/CrmApp.jsx'

const RootApp = window.location.hostname === 'app.rinsepoint.com' ? CrmApp : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
