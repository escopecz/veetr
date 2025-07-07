import { BLEProvider } from './context/BLEContext'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  return (
    <BLEProvider>
      <div className="app">
        <main className="app-main">
          <Dashboard />
        </main>
      </div>
    </BLEProvider>
  )
}

export default App
