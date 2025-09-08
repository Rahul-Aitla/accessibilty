import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Get the root element with error checking
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element. Please check your HTML file contains a div with id="root".');
}

const root = createRoot(rootElement);

// Error boundary for unhandled errors
const renderApp = () => {
  try {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error('Failed to render app:', error);
    rootElement.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: #dc2626;">
        <h1>Application Error</h1>
        <p>Sorry, something went wrong loading the application.</p>
        <p>Please refresh the page and try again.</p>
      </div>
    `;
  }
};

renderApp();
