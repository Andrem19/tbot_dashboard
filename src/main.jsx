import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

console.log('[main.jsx] starting render');

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
