import { useBLE } from '../context/BLEContext'
import './CompactConnectionButton.css'

export default function CompactConnectionButton() {
  const { state, connect, disconnect } = useBLE()

  const handleButtonClick = () => {
    if (state.isConnected) {
      disconnect()
    } else {
      connect()
    }
  }

  // Only show the red connect button when disconnected
  if (state.isConnected) {
    return null
  }

  // Red "Connect" button when disconnected
  return (
    <button 
      className="compact-connection-btn disconnected"
      onClick={handleButtonClick}
      disabled={state.isConnecting}
    >
      {state.isConnecting ? 'Connecting...' : 'Connect'}
    </button>
  )
}
