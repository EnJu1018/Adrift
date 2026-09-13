import React from 'react';
import { MotionConfig } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>
);
