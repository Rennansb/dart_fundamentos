// Global diagnostic handlers
window.onerror = (message, source, lineno, colno, error) => {
  console.error('[Global Error]', { message, source, lineno, colno, error: error?.stack || error });
  return false;
};
window.onunhandledrejection = (event) => {
  console.error('[Unhandled Rejection]', event.reason);
};

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Unregister all service workers to clear potential cache issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
      console.log('SW unregistered successfully');
    }
  });
}
