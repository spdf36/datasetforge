// src/index.js — react-scripts entry point shim
// react-scripts requires its entry at src/index.js exactly.
// This simply forwards to the renderer module.
import React from 'react';
import ReactDOM from 'react-dom/client';
import './renderer/styles/globals.css';
import './renderer/styles/app.css';
import App from './renderer/App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
