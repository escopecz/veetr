import { BLEProvider } from './context/BLEContext'
import { ThemeProvider } from './context/ThemeContext'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  return (
    <ThemeProvider>
      <BLEProvider>
        <div className="app">
          <main className="app-main">
            <Dashboard />
          </main>
        </div>
      </BLEProvider>
    </ThemeProvider>
  )
}

export default App
