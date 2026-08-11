import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'
import { applyThemeEarly } from '@/hooks/useTheme'

// Apply the saved (or system) theme before first paint to avoid a flash.
applyThemeEarly()

createRoot(document.getElementById('root')).render(<App />)
