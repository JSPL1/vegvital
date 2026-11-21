import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { loadState } from './lib/store.js';
import './styles.css';

loadState().then(() => {
  createRoot(document.getElementById('root')).render(<App />);
  const splash = document.getElementById('splash');
  if (splash) { splash.classList.add('hide'); setTimeout(() => splash.remove(), 600); }
});
