import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// ── DEV: Backend readiness checklist ──
if (import.meta.env.DEV) {
  const safe = (key) => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  console.group('🔍 GP-PMS Backend Readiness');
  console.log('API URL:',          import.meta.env.VITE_API_URL      || '❌ NOT SET');
  console.log('Google Client ID:', import.meta.env.VITE_GOOGLE_CLIENT_ID ? '✅ Set' : '❌ NOT SET');
  console.log('Local houses:',     safe('gppms_houses').length,  'records');
  console.log('Local stock:',      safe('gppms_stock').length,   'materials');
  console.log('Local reports:',    safe('gppms_reports').length, 'entries');
  console.log('Session:',          localStorage.getItem('gppms_session') ? '✅ Logged in' : '❌ Not logged in');
  console.groupEnd();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
);
