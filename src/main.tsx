// Polyfill for ES Iterator global (required by modern pdfjs-dist)
if (typeof (globalThis as any).Iterator === 'undefined') {
  try {
    const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
    (globalThis as any).Iterator = IteratorPrototype?.constructor || class Iterator {};
  } catch {
    (globalThis as any).Iterator = class Iterator {};
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
