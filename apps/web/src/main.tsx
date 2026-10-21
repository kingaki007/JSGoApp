/** Mounts the web application and loads its base styles before workbench overrides. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';
import './styles/workspace.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
