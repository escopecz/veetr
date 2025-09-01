import { useState, useRef, useEffect } from 'react'
import { useBLE } from '../context/BLEContext'
import { FirmwareUpdateCard } from './cards/FirmwareUpdateCard'
import ThemeToggle from './ThemeToggle'
import { APP_VERSION } from '../utils/version'
import './Settings.css'

export default function Settings() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState<'main' | 'configuration' | 'regatta' | 'about'>('main')
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
        setCurrentView('main')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
    if (!menuOpen) {
      setCurrentView('main')
    }
  }

  const navigateToView = (view: 'main' | 'configuration' | 'regatta' | 'about') => {
    setCurrentView(view)
  }

  const handleCalibrateLevel = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    if (window.confirm('Calibrate vessel level position? This will set the current orientation as level (0°) across all axes.')) {
      setActionInProgress('resetHeel')
      try {
        const success = await sendCommand({ action: 'resetHeelAngle' })
        if (success) {
          alert('Vessel level calibration completed successfully!')
        } else {
          alert('Failed to calibrate level position. Please try again.')
        }
      } catch (error) {
        console.error('Failed to calibrate level:', error)
        alert('Error calibrating level position')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleCalibrateCompass = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
      return
    }

    if (window.confirm('Calibrate compass to north? Point the vessel\'s bow toward north and press OK. This will set the current magnetic heading as the north reference.')) {
      setActionInProgress('resetCompass')
      try {
        const success = await sendCommand({ action: 'resetCompassNorth' })
        if (success) {
          alert('Compass calibrated successfully! The current heading is now set as north (0°).')
        } else {
          alert('Failed to calibrate compass. Please try again.')
        }
      } catch (error) {
        console.error('Failed to calibrate compass:', error)
        alert('Error calibrating compass')
      } finally {
        setActionInProgress(null)
      }
    }
  }

  const handleSetDeviceName = async () => {
    if (!state.isConnected) {
      alert('Please connect to Veetr device first')
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
      alert('Please connect to Veetr device first')
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
      alert('Please connect to Veetr device first')
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
          {currentView === 'main' && (
            <>
              <div className="menu-header">
                <h3>Veetr Menu</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
              
              <div className="menu-section">
                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('configuration')}
                >
                  <span className="menu-icon">⚙️</span>
                  <div className="menu-item-content">
                    <h4>Configuration</h4>
                    <p>Calibration and device settings</p>
                  </div>
                  <span className="menu-arrow">›</span>
                </button>
                
                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('regatta')}
                >
                  <span className="menu-icon">🏁</span>
                  <div className="menu-item-content">
                    <h4>Regatta</h4>
                    <p>Starting procedure and race setup</p>
                  </div>
                  <span className="menu-arrow">›</span>
                </button>
                
                <button 
                  className="menu-item main-menu-item" 
                  onClick={() => navigateToView('about')}
                >
                  <span className="menu-icon">ℹ️</span>
                  <div className="menu-item-content">
                    <h4>About</h4>
                    <p>Version info and updates</p>
                  </div>
                  <span className="menu-arrow">›</span>
                </button>
                
                <div className="menu-item main-menu-item theme-menu-item">
                  <span className="menu-icon">🌙</span>
                  <div className="menu-item-content">
                    <h4>Theme</h4>
                    <p>Switch between light and dark mode</p>
                  </div>
                  <div className="theme-toggle-container">
                    <ThemeToggle variant="menu" />
                  </div>
                </div>
              </div>
            </>
          )}

          {currentView === 'configuration' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  ‹
                </button>
                <h3>Configuration</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
              
              <div className="menu-section">
                <h4>Calibration</h4>
                <button 
                  className="menu-item" 
                  onClick={handleCalibrateLevel}
                  disabled={actionInProgress !== null || !state.isConnected}
                >
                  {actionInProgress === 'resetHeel' ? 'Calibrating...' : 'Vessel is Level'}
                </button>
                <p className="help-text">Calibrates current position as level across all axes (heel, pitch, roll)</p>
                
                <button 
                  className="menu-item" 
                  onClick={handleCalibrateCompass}
                  disabled={actionInProgress !== null || !state.isConnected}
                >
                  {actionInProgress === 'resetCompass' ? 'Calibrating...' : 'Set Compass North'}
                </button>
                <p className="help-text">Point vessel's bow to north, then press to calibrate compass heading</p>
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
                    placeholder={state.deviceName || "Veetr_Port_Side"}
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

              {!state.isConnected && (
                <div className="connection-warning">
                  <p>⚠️ Connect to Veetr device to access settings</p>
                </div>
              )}
            </>
          )}

          {currentView === 'regatta' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  ‹
                </button>
                <h3>Regatta</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
              
              <div className="menu-section">
                <h4>Starting Line Setup</h4>
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
                <p className="help-text">Set the starting line markers for race timing</p>
              </div>

              <div className="menu-section">
                <h4>Starting Procedure</h4>
                <button 
                  className="menu-item" 
                  disabled={true}
                >
                  Coming Soon: Race Timer
                </button>
                <p className="help-text">Countdown timer and race start alerts</p>
              </div>

              {!state.isConnected && (
                <div className="connection-warning">
                  <p>⚠️ Connect to Veetr device to access regatta features</p>
                </div>
              )}
            </>
          )}

          {currentView === 'about' && (
            <>
              <div className="menu-header">
                <button 
                  className="back-button" 
                  onClick={() => navigateToView('main')}
                  aria-label="Back to main menu"
                >
                  ‹
                </button>
                <h3>About</h3>
                <button 
                  className="close-button" 
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
              
              <div className="menu-section">
                <h4>Version Information</h4>
                <div className="version-info">
                  <p><strong>Veetr Dashboard</strong></p>
                  <p>Version: {APP_VERSION}</p>
                  {state.deviceName && (
                    <p>Connected Device: {state.deviceName}</p>
                  )}
                </div>
              </div>

              <div className="menu-section">
                <h4>Firmware Update</h4>
                <FirmwareUpdateCard />
              </div>

              <div className="menu-section">
                <h4>Information</h4>
                <p className="help-text">
                  Veetr is an open-source sailing dashboard providing real-time wind, GPS, and boat data via Bluetooth Low Energy.
                </p>
                <p className="help-text">
                  For support and updates, visit the GitHub repository or check the documentation.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
