import { useState, useRef, useEffect } from 'react'
import { useBLE } from '../context/BLEContext'
import './Settings.css'

export default function Settings() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [deviceName, setDeviceName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const { state, sendCommand } = useBLE()

  // Pre-fill device name when connected device name is available
  useEffect(() => {
    if (state.deviceName && deviceName === '') {
      setDeviceName(state.deviceName)
    }
  }, [state.deviceName, deviceName])

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleResetHeelAngle = async () => {
    if (!state.isConnected) {
      alert('Please connect to Luna device first')
      return
    }

    if (window.confirm('Reset heel angle? This will calibrate the current position as level (0°).')) {
      setActionInProgress('resetHeel')
      try {
        const success = await sendCommand({ action: 'resetHeelAngle' })
        if (success) {
          alert('Heel angle reset successfully!')
        } else {
          alert('Failed to reset heel angle. Please try again.')
        }
      } catch (error) {
        console.error('Failed to reset heel angle:', error)
        alert('Error resetting heel angle')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleSetDeviceName = async () => {
    if (!state.isConnected) {
      alert('Please connect to Luna device first')
      return
    }

    if (!deviceName.trim()) {
      alert('Please enter a device name')
      return
    }

    if (deviceName.length > 20) {
      alert('Device name must be 20 characters or less')
      return
    }

    if (!/^[A-Za-z0-9_\- ]+$/.test(deviceName)) {
      alert('Device name can only contain letters, numbers, underscore (_), hyphen (-), and space')
      return
    }

    if (window.confirm(`Change device name to "${deviceName.trim()}"? The device will restart and you'll need to reconnect.`)) {
      setActionInProgress('setDeviceName')
      try {
        const success = await sendCommand({ 
          action: 'setDeviceName', 
          deviceName: deviceName.trim() 
        })
        if (success) {
          alert(`Device name changed to "${deviceName.trim()}". Device is restarting...`)
          setDeviceName('')
          // The device will restart, so we'll be disconnected
          setTimeout(() => {
            window.location.reload()
          }, 2000)
        } else {
          alert('Failed to set device name. Please try again.')
        }
      } catch (error) {
        console.error('Failed to set device name:', error)
        alert('Error setting device name')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleRegattaSetPort = async () => {
    if (!state.isConnected) {
      alert('Please connect to Luna device first')
      return
    }

    setActionInProgress('regattaPort')
    try {
      const success = await sendCommand({ action: 'regattaSetPort' })
      if (success) {
        alert('Port line marker set!')
      } else {
        alert('Failed to set port marker. Feature may not be implemented yet.')
      }
    } catch (error) {
      console.error('Failed to set port marker:', error)
      alert('Error setting port marker')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleRegattaSetStarboard = async () => {
    if (!state.isConnected) {
      alert('Please connect to Luna device first')
      return
    }

    setActionInProgress('regattaStarboard')
    try {
      const success = await sendCommand({ action: 'regattaSetStarboard' })
      if (success) {
        alert('Starboard line marker set!')
      } else {
        alert('Failed to set starboard marker. Feature may not be implemented yet.')
      }
    } catch (error) {
      console.error('Failed to set starboard marker:', error)
      alert('Error setting starboard marker')
    } finally {
      setActionInProgress(null)
    }
  }

  return (
    <div className="settings-container" ref={menuRef}>
      <button 
        className="hamburger-button"
        onClick={toggleMenu}
        aria-label="Settings menu"
      >
        <div className="hamburger-icon">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </button>
      
      {menuOpen && (
        <div className="settings-menu">
          <div className="menu-header">
            <h3>Device Settings</h3>
            <button 
              className="close-button" 
              onClick={() => setMenuOpen(false)}
              aria-label="Close settings"
            >
              ×
            </button>
          </div>
          
          <div className="menu-section">
            <h4>Calibration</h4>
            <button 
              className="menu-item" 
              onClick={handleResetHeelAngle}
              disabled={actionInProgress !== null || !state.isConnected}
            >
              {actionInProgress === 'resetHeel' ? 'Resetting...' : 'Reset Heel Angle'}
            </button>
            <p className="help-text">Calibrates current position as level (0°)</p>
          </div>

          <div className="menu-section">
            <h4>Device Configuration</h4>
            
            {state.deviceName && (
              <p className="help-text" style={{ marginBottom: '8px', color: 'rgba(255, 255, 255, 0.8)' }}>
                Current device: <strong>{state.deviceName}</strong>
              </p>
            )}
            
            <div className="input-group">
              <label htmlFor="deviceName">New Device Name:</label>
              <input
                id="deviceName"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder={state.deviceName || "Luna_Port_Side"}
                maxLength={20}
                disabled={actionInProgress !== null}
              />
              <button 
                onClick={handleSetDeviceName}
                disabled={actionInProgress !== null || !state.isConnected || !deviceName.trim()}
              >
                {actionInProgress === 'setDeviceName' ? 'Setting...' : 'Set Name'}
              </button>
            </div>
            <p className="help-text">Device will restart after name change. Allowed: letters, numbers, underscore, hyphen, space</p>
          </div>

          <div className="menu-section">
            <h4>Regatta Features (Beta)</h4>
            <div className="button-group">
              <button 
                className="menu-item half-width" 
                onClick={handleRegattaSetPort}
                disabled={actionInProgress !== null || !state.isConnected}
              >
                {actionInProgress === 'regattaPort' ? 'Setting...' : 'Set Port Line'}
              </button>
              
              <button 
                className="menu-item half-width" 
                onClick={handleRegattaSetStarboard}
                disabled={actionInProgress !== null || !state.isConnected}
              >
                {actionInProgress === 'regattaStarboard' ? 'Setting...' : 'Set Starboard Line'}
              </button>
            </div>
            <p className="help-text">Future regatta timing functionality</p>
          </div>

          {!state.isConnected && (
            <div className="connection-warning">
              <p>⚠️ Connect to Luna device to access settings</p>
            </div>
          )}
          
          <div className="menu-footer">
            <span className="version">Luna Sailing Dashboard v1.0</span>
          </div>
        </div>
      )}
    </div>
  )
}
