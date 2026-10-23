import React from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import WebBootstrap from './WebBootstrap.jsx';
import './bootstrap.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <WebBootstrap />
    </ErrorBoundary>
  </React.StrictMode>
);
