import { useBLE } from '../context/BLEContext'
import './ConnectionStatus.css'

export default function ConnectionStatus() {
  const { state, connect, disconnect } = useBLE()

  const getStatusText = () => {
    if (state.isConnecting) return 'Connecting...'
    if (state.isConnected) return 'Connected'
    if (state.error) return `Error: ${state.error}`
    return 'Disconnected'
  }

  const getStatusClass = () => {
    if (state.isConnecting) return 'connecting'
    if (state.isConnected) return 'connected'
    if (state.error) return 'error'
    return 'disconnected'
  }

  const getSignalBars = () => {
    if (!state.isConnected || state.rssi === null) return 0
    if (state.rssi >= -50) return 4 // Excellent
    if (state.rssi >= -60) return 3 // Good
    if (state.rssi >= -70) return 2 // Fair
    if (state.rssi >= -80) return 1 // Poor
    return 0 // Very poor
  }

  const handleButtonClick = () => {
    if (state.isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  return (
    <div className="connection-status-card">
      <div className="connection-status-info">
        <div className={`status-indicator ${getStatusClass()}`}>
          <span className="status-dot"></span>
          <span className="status-text">{getStatusText()}</span>
        </div>
        {state.isConnected && state.rssi !== null && (
          <div className="signal-strength">
            <div className="signal-bars">
              {[1, 2, 3, 4].map(bar => (
                <div
                  key={bar}
                  className={`signal-bar ${bar <= getSignalBars() ? 'active' : ''}`}
                />
              ))}
            </div>
            <span className="signal-text">
              {state.rssi}dBm ({state.signalQuality})
            </span>
          </div>
        )}
      </div>
      <button 
        className="connection-status-btn"
        onClick={handleButtonClick}
        disabled={state.isConnecting}
      >
        {state.isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  )
}
