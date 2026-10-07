import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './walkway-offer.css'
import './walkway-offer.js'
import App from './App.jsx'
import { applySeo } from './seo.js'

applySeo()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
