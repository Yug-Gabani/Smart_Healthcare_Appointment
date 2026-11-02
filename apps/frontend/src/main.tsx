import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { MotionConfigProvider } from './motion/MotionConfig'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfigProvider>
        <App />
      </MotionConfigProvider>
    </BrowserRouter>
  </StrictMode>,
)
