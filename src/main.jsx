import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './crm/leads-polish.css'
import './crm/sidebar-collapse.css'
import './crm/customer-workspace-polish.css'
import './crm/responsive-layout.css'
import './crm/quote-status-polish.css'
import './crm/sidebar-collapse.js'
import './crm/quote-status-polish.js'
import App from './App.jsx'
import CrmApp from './crm/CrmApp.jsx'

const RootApp = window.location.hostname === 'app.rinsepoint.com' ? CrmApp : App

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
