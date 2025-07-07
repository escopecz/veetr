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
      </div>
      <button 
        className="connection-status-btn"
        onClick={handleButtonClick}
        disabled={state.isConnecting}
        style={{ minWidth: 0, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '1em', padding: '0.6em 0.2em' }}
      >
        {state.isConnected ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  )
}
