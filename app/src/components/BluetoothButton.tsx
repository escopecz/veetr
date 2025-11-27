import { useState } from 'react'
import { Bluetooth, X } from 'lucide-react'
import { useBLE } from '../context/BLEContext'
import './BluetoothButton.css'

export default function BluetoothButton() {
  const { state } = useBLE()
  const [showModal, setShowModal] = useState(false)

  // Only show the bluetooth button when connected
  if (!state.isConnected) {
    return null
  }

  const getRssiColor = (rssi: number | null) => {
    if (rssi === null) return '#6b7280' // Grey - no data
    if (rssi >= -50) return '#22c55e'   // Green - excellent
    if (rssi >= -60) return '#22c55e'   // Green - good  
    if (rssi >= -70) return '#f97316'   // Orange - fair
    if (rssi >= -80) return '#f97316'   // Orange - poor
    return '#ef4444'                    // Red - very poor
  }

  const getRssiText = (rssi: number | null) => {
    if (rssi === null) return 'No Data'
    if (rssi >= -50) return 'Excellent'
    if (rssi >= -60) return 'Good'
    if (rssi >= -70) return 'Fair'
    if (rssi >= -80) return 'Poor'
    return 'Very Poor'
  }

  const handleButtonClick = () => {
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  // Handle click outside modal to close
  const handleModalOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModal()
    }
  }

  return (
    <>
      <button 
        className="bluetooth-btn"
        onClick={handleButtonClick}
        title="Bluetooth Signal Strength"
      >
        <Bluetooth 
          size={24} 
          className="bluetooth-icon" 
          style={{ color: getRssiColor(state.rssi) }}
        />
      </button>

      {/* RSSI Information Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleModalOverlayClick}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Bluetooth Signal</h3>
              <button 
                className="modal-close-btn"
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="bluetooth-info-grid">
                <div className="bluetooth-info-row">
                  <span className="bluetooth-info-label">Signal Strength</span>
                  <span 
                    className="bluetooth-info-value" 
                    style={{ color: getRssiColor(state.rssi) }}
                  >
                    {getRssiText(state.rssi)}
                  </span>
                </div>
                <div className="bluetooth-info-row">
                  <span className="bluetooth-info-label">RSSI</span>
                  <span className="bluetooth-info-value">
                    {state.rssi !== null ? `${state.rssi} dBm` : 'No Data'}
                  </span>
                </div>
                <div className="bluetooth-info-row">
                  <span className="bluetooth-info-label">Device</span>
                  <span className="bluetooth-info-value">
                    {state.deviceName || 'Unknown'}
                  </span>
                </div>
                <div className="bluetooth-info-row">
                  <span className="bluetooth-info-label">Status</span>
                  <span className="bluetooth-info-value bluetooth-connected">
                    Connected
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}