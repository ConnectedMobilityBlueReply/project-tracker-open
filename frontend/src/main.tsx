import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthContext'
import { ThemeProvider } from './components/theme-provider'
import { WorkspaceProvider } from './workspace/WorkspaceContext'
import DesktopTitleBar from './components/layout/DesktopTitleBar'
import { desktopBridge } from './lib/desktopBridge'
import { migrateStoredTheme } from './lib/themeMigration'
import { IconContext } from '@phosphor-icons/react'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'

// Prima del primo render: lo spazio della title bar desktop è riservato senza salti di layout.
const desktop = desktopBridge()
if (desktop) document.documentElement.dataset.desktop = desktop.platform
// Le preferenze dei temi rimossi (cream, moonlight) passano al tema più vicino prima del render di next-themes.
try {
  migrateStoredTheme(window.localStorage)
} catch {
  // Accesso a localStorage negato dal browser: next-themes ricade sul default.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Il value sostituisce l'intero default di Phosphor: senza size le icone senza classe size-* non hanno width/height e riempiono il contenitore. */}
    <IconContext.Provider value={{ weight: 'bold', size: '1em' }}>
      <ThemeProvider defaultTheme="light">
        <DesktopTitleBar />
        <AuthProvider>
          <WorkspaceProvider>
            <App />
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>
    </IconContext.Provider>
  </React.StrictMode>
)
