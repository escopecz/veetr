import { useState, useEffect } from 'react'
import { useBLE } from '../../context/BLEContext'
import './FirmwareUpdateCard.css'
import { showSingleAlert } from '../../utils/alertUtils'

export function FirmwareUpdateCard() {
  const { state, checkForUpdates, startFirmwareUpdate } = useBLE()
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const handleCheckForUpdates = async () => {
    setIsChecking(true)
    try {
      await checkForUpdates()
      setLastChecked(new Date())
    } catch (error) {
      console.error('Failed to check for updates:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleStartUpdate = async () => {
    if (!window.confirm('Are you sure you want to update the firmware? The device will restart during this process.')) {
      return
    }

    try {
      await startFirmwareUpdate()
      
      // Show success message with next steps
      showSingleAlert(`The device has restarted with the new firmware. Please:
1. Wait 10-15 seconds for the device to fully boot
2. Click "Connect to Veetr" to reconnect
3. Check that the "Current Version" shows the new version

If you still see the old version, the update may have failed.`, '✅ Firmware Update Completed!')
      
    } catch (error) {
      console.error('Firmware update failed:', error)
      showSingleAlert(`${error instanceof Error ? error.message : 'Unknown error'}`, '❌ Firmware Update Failed')
    }
  }

  // Auto-check for updates when connected
  useEffect(() => {
    if (state.isConnected && !lastChecked) {
      handleCheckForUpdates()
    }
  }, [state.isConnected])

  if (!state.isConnected) {
    return (
      <div className="firmware-update-card">
        <div className="card-header">
          <h3>Firmware Update</h3>
          <div className="status-badge status-disconnected">
            Device Disconnected
          </div>
        </div>
        <p>Connect to your sailing device to check for firmware updates.</p>
      </div>
    )
  }

  return (
    <div className="firmware-update-card">
      <div className="card-header">
        <h3>Firmware Update</h3>
        {state.firmwareInfo.updateAvailable && (
          <div className="status-badge status-update-available">
            Update Available
          </div>
        )}
      </div>

      <div className="firmware-info">
        <div className="version-info">
          <div className="version-item">
            <label>Current Version:</label>
            <span className="version-number">{state.firmwareInfo.currentVersion}</span>
          </div>
          
          {state.firmwareInfo.latestVersion && (
            <div className="version-item">
              <label>Latest Version:</label>
              <span className="version-number">{state.firmwareInfo.latestVersion}</span>
            </div>
          )}
        </div>

        {lastChecked && (
          <div className="last-checked">
            Last checked: {lastChecked.toLocaleTimeString()}
          </div>
        )}
      </div>

      {state.firmwareInfo.isUpdating && (
        <div className="update-progress">
          <div className="progress-info">
            <span>Updating firmware...</span>
            <span>{state.firmwareInfo.updateProgress}%</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${state.firmwareInfo.updateProgress}%` }}
            />
          </div>
          <div className="update-warning">
            ⚠️ Do not disconnect the device during update
          </div>
        </div>
      )}

      {!state.firmwareInfo.isUpdating && (
        <div className="action-buttons">
          <button 
            onClick={handleCheckForUpdates}
            disabled={isChecking}
            className="btn btn-secondary"
          >
            {isChecking ? 'Checking...' : 'Check for Updates'}
          </button>

          {state.firmwareInfo.updateAvailable && (
            <button 
              onClick={handleStartUpdate}
              className="btn btn-primary"
            >
              Update Firmware
            </button>
          )}
        </div>
      )}

      {state.error && (
        <div className="error-message">
          Error: {state.error}
        </div>
      )}
    </div>
  )
}
