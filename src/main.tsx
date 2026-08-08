import React, { StrictMode } from 'react';
import {createRoot} from 'react-dom/client';
import './firebase'; // Initialize Firebase
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
