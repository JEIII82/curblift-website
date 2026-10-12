import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './walkway-offer.css'
import './walkway-offer.js'
import App from './App.jsx'
import { applySeo } from './seo.js'

const LEGACY_LEAD_INTAKE_URL = 'https://cfrdooivdzjuqsauhaqy.supabase.co/functions/v1/lead-intake'
const V2_LEAD_INTAKE_URL = 'https://ttathwanhbudynarcewr.supabase.co/functions/v1/lead-intake'
const V2_ANON_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0YXRod2FuaGJ1ZHluYXJjZXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MDE5MDgsImV4cCI6MjEwNjk3NzkwOH0.u1Qlma9TQBVWX0Br9kNeBh9K4gqKu87LmUjFWoV8K1A'

// Compatibility bridge: the existing QuoteForm still calls the legacy endpoint.
// Route that one request to V2 at the network boundary so no new lead data lands in the old OS.
const nativeFetch = window.fetch.bind(window)
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url !== LEGACY_LEAD_INTAKE_URL) return nativeFetch(input, init)

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined))
  headers.set('Authorization', `Bearer ${V2_ANON_JWT}`)
  headers.set('apikey', V2_ANON_JWT)

  return nativeFetch(V2_LEAD_INTAKE_URL, { ...init, headers })
}

function enforceQuoteEmailRequirement() {
  const email = document.getElementById('quote-email')
  if (!(email instanceof HTMLInputElement)) return

  email.required = true
  email.setAttribute('aria-describedby', 'quote-email-help')

  const label = document.querySelector('label[for="quote-email"]')
  if (label) label.textContent = 'Email'

  if (!document.getElementById('quote-email-help')) {
    const help = document.createElement('p')
    help.id = 'quote-email-help'
    help.className = 'mt-2 text-xs leading-5 text-slate-500'
    help.textContent = 'We’ll send your quote and secure approval link here.'
    email.insertAdjacentElement('afterend', help)
  }
}

applySeo()

const rootElement = document.getElementById('root')
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Contact is a full-page navigation in this site, so a one-shot post-render sync is sufficient.
requestAnimationFrame(enforceQuoteEmailRequirement)
