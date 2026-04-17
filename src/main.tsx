import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ThemeProvider } from './hooks/useTheme';
import './index.css';

// StrictMode removed: React 18's double-invoke of layout effects fires during
// @hello-pangea/dnd's flushSync at drag lift, causing the library to detect
// Draggable register/unregister mid-drag and break the gesture.
createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
