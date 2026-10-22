/** Mounts page routing and global styles; the playground loads its own editor and workbench styles. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
