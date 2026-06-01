import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// NOTE: deliberately NOT using <StrictMode> — its double-mount cycle in dev
// starts/stops the MediaPipe camera twice and can leave it in a broken state.
createRoot(document.getElementById('root')).render(<App />);
