import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { getLatestRelease, getFirmwareAsset, downloadFirmware, compareVersions } from '../utils/githubApi'
import { BLEFirmwareUpdater } from '../utils/firmwareUpdater'

// Types for sailing data
export interface SailingData {
  speed: number
  speedMax: number
  speedAvg: number
  windSpeed: number
  windSpeedMax: number
  windSpeedAvg: number
  windAngle: number
  windDirection: number
  trueWindSpeed: number
  trueWindSpeedMax: number
  trueWindSpeedAvg: number
  trueWindAngle: number
  tilt: number
  tiltPortMax: number
  tiltStarboardMax: number
  deadWindAngle: number
  gpsSpeed: number
  gpsSatellites: number
  hdop: number
  lat: number
  lon: number
  heading: number
  // Regatta data
  hasStartLine: boolean
  distanceToLine: number
}

// Firmware update state
export interface FirmwareInfo {
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  updateProgress: number | null
  isUpdating: boolean
}

// BLE connection state
export interface BLEState {
  isConnected: boolean
  isConnecting: boolean
  device: BluetoothDevice | null
  server: BluetoothRemoteGATTServer | null
  sensorDataCharacteristic: BluetoothRemoteGATTCharacteristic | null
  commandCharacteristic: BluetoothRemoteGATTCharacteristic | null
  error: string | null
  rssi: number | null
  signalQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  lastMessageTime: number | null
  deviceName: string | null
  sailingData: SailingData
  firmwareInfo: FirmwareInfo
}

// BLE Service and Characteristic UUIDs (must match ESP32)
export const BLE_CONFIG = {
  SERVICE_UUID: '12345678-1234-1234-1234-123456789abc',
  SENSOR_DATA_UUID: '87654321-4321-4321-4321-cba987654321',
  COMMAND_UUID: '11111111-2222-3333-4444-555555555555',
  DEVICE_NAME: 'Veetr'
}

// Convert 360° wind angle to 180° sailing angle for display
function convertToSailingAngle(windAngle360: number): number {
  if (windAngle360 > 180) {
    return 360 - windAngle360  // Convert 181-359° to 179-1°
  }
  return windAngle360  // Keep 0-180° as is
}

// Action types
type BLEAction =
  | { type: 'CONNECT_START' }
  | { type: 'CONNECT_SUCCESS'; payload: { device: BluetoothDevice; server: BluetoothRemoteGATTServer; sensorDataCharacteristic: BluetoothRemoteGATTCharacteristic; commandCharacteristic: BluetoothRemoteGATTCharacteristic } }
  | { type: 'CONNECT_ERROR'; payload: string }
  | { type: 'DISCONNECT' }
  | { type: 'UPDATE_DATA'; payload: Partial<SailingData> }
  | { type: 'UPDATE_RSSI'; payload: number }
  | { type: 'UPDATE_LAST_MESSAGE_TIME'; payload: number }
  | { type: 'UPDATE_DEVICE_NAME'; payload: string }
  | { type: 'UPDATE_FIRMWARE_VERSION'; payload: string }
  | { type: 'SET_LATEST_VERSION'; payload: string }
  | { type: 'START_FIRMWARE_UPDATE' }
  | { type: 'UPDATE_FIRMWARE_PROGRESS'; payload: number }
  | { type: 'FIRMWARE_UPDATE_COMPLETE' }
  | { type: 'FIRMWARE_UPDATE_ERROR'; payload: string }

// Initial state
const initialState: BLEState = {
  isConnected: false,
  isConnecting: false,
  device: null,
  server: null,
  sensorDataCharacteristic: null,
  commandCharacteristic: null,
  error: null,
  rssi: null,
  signalQuality: 'unknown',
  lastMessageTime: null,
  deviceName: null,
  sailingData: {
    speed: 0,
    speedMax: 0,
    speedAvg: 0,
    windSpeed: 0,
    windSpeedMax: 0,
    windSpeedAvg: 0,
    windAngle: 0,
    windDirection: 0,
    trueWindSpeed: 0,
    trueWindSpeedMax: 0,
    trueWindSpeedAvg: 0,
    trueWindAngle: 0,
    tilt: 0,
    tiltPortMax: 0,
    tiltStarboardMax: 0,
    deadWindAngle: 40,
    gpsSpeed: 0,
    gpsSatellites: 0,
    hdop: 0,
    lat: 0,
    lon: 0,
    heading: 0,
    // Regatta data
    hasStartLine: false,
    distanceToLine: -1
  },
  firmwareInfo: {
    currentVersion: 'Unknown',
    latestVersion: null,
    updateAvailable: false,
    updateProgress: null,
    isUpdating: false
  }
}

// Helper function to determine signal quality from RSSI
function getSignalQuality(rssi: number): 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' {
  if (rssi >= -50) return 'excellent'
  if (rssi >= -60) return 'good'
  if (rssi >= -70) return 'fair'
  if (rssi >= -80) return 'poor'
  return 'poor'
}

// Reducer
function bleReducer(state: BLEState, action: BLEAction): BLEState {
  switch (action.type) {
    case 'CONNECT_START':
      return { ...state, isConnecting: true, error: null }
    case 'CONNECT_SUCCESS':
      return {
        ...state,
        isConnecting: false,
        isConnected: true,
        device: action.payload.device,
        server: action.payload.server,
        sensorDataCharacteristic: action.payload.sensorDataCharacteristic,
        commandCharacteristic: action.payload.commandCharacteristic,
        error: null
      }
    case 'CONNECT_ERROR':
      return { ...state, isConnecting: false, error: action.payload }
    case 'DISCONNECT':
      return {
        ...state,
        isConnected: false,
        isConnecting: false,
        device: null,
        server: null,
        sensorDataCharacteristic: null,
        commandCharacteristic: null,
        rssi: null,
        signalQuality: 'unknown',
        lastMessageTime: null,
        deviceName: null,
        sailingData: {
          speed: 0,
          speedMax: 0,
          speedAvg: 0,
          windSpeed: 0,
          windSpeedMax: 0,
          windSpeedAvg: 0,
          windAngle: 0,
          windDirection: 0,
          trueWindSpeed: 0,
          trueWindSpeedMax: 0,
          trueWindSpeedAvg: 0,
          trueWindAngle: 0,
          tilt: 0,
          tiltPortMax: 0,
          tiltStarboardMax: 0,
          deadWindAngle: 40,
          gpsSpeed: 0,
          gpsSatellites: 0,
          hdop: 0,
          lat: 0,
          lon: 0,
          heading: 0,
          // Regatta data
          hasStartLine: false,
          distanceToLine: -1
        }
      }
    case 'UPDATE_DATA':
      return {
        ...state,
        sailingData: { ...state.sailingData, ...action.payload }
      }
    case 'UPDATE_RSSI':
      return {
        ...state,
        rssi: action.payload,
        signalQuality: getSignalQuality(action.payload)
      }
    case 'UPDATE_LAST_MESSAGE_TIME':
      return {
        ...state,
        lastMessageTime: action.payload
      }
    case 'UPDATE_DEVICE_NAME':
      return {
        ...state,
        deviceName: action.payload
      }
    case 'UPDATE_FIRMWARE_VERSION':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          currentVersion: action.payload
        }
      }
    case 'SET_LATEST_VERSION':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          latestVersion: action.payload,
          updateAvailable: action.payload !== state.firmwareInfo.currentVersion
        }
      }
    case 'START_FIRMWARE_UPDATE':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          isUpdating: true,
          updateProgress: 0
        }
      }
    case 'UPDATE_FIRMWARE_PROGRESS':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          updateProgress: action.payload
        }
      }
    case 'FIRMWARE_UPDATE_COMPLETE':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          isUpdating: false,
          updateProgress: null,
          updateAvailable: false,
          currentVersion: state.firmwareInfo.latestVersion || state.firmwareInfo.currentVersion
        }
      }
    case 'FIRMWARE_UPDATE_ERROR':
      return {
        ...state,
        firmwareInfo: {
          ...state.firmwareInfo,
          isUpdating: false,
          updateProgress: null
        },
        error: action.payload
      }
    default:
      return state
  }
}

// PWA Health Check and Recovery Functions
const checkPWAHealth = () => {
  const issues = []
  
  // Check if we're running as PWA
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (!isStandalone) {
    issues.push('Not running as PWA')
  }
  
  // Check memory usage (if available)
  let memoryUsage = null
  if ((performance as any).memory) {
    const memInfo = (performance as any).memory
    const memUsedMB = Math.round(memInfo.usedJSHeapSize / 1048576)
    const memLimitMB = Math.round(memInfo.jsHeapSizeLimit / 1048576)
    const usedPercent = Math.round((memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit) * 100)
    
    memoryUsage = {
      usedMB: memUsedMB,
      limitMB: memLimitMB,
      usedPercent: usedPercent
    }
    
    if (usedPercent > 80) {
      issues.push(`High memory usage: ${usedPercent}% (${memUsedMB}MB)`)
    }
  }
  
  // Check Web Bluetooth availability
  const bluetoothAvailable = !!navigator.bluetooth
  if (!bluetoothAvailable) {
    issues.push('Web Bluetooth API not available')
  }
  
  // Check service worker status
  let serviceWorkerActive = false
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    serviceWorkerActive = true
  }
  
  // Calculate uptime (rough estimate from timestamp)
  const uptime = Date.now() - (window.performance?.timeOrigin || Date.now())
  
  return {
    healthy: issues.length === 0,
    issues,
    isStandalone,
    memoryUsage,
    bluetoothAvailable,
    serviceWorkerActive,
    uptime,
    timestamp: Date.now()
  }
}

const refreshPWA = () => {
  console.log('[PWA] Attempting PWA refresh...')
  
  // Try to reload the PWA
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    // Force service worker to refresh
    navigator.serviceWorker.controller.postMessage({ action: 'SKIP_WAITING' })
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  } else {
    // Fallback: normal page reload
    window.location.reload()
  }
}

// Context
const BLEContext = createContext<{
  state: BLEState
  connect: () => Promise<void>
  disconnect: () => void
  sendCommand: (command: any) => Promise<boolean>
  checkForUpdates: () => Promise<void>
  startFirmwareUpdate: () => Promise<void>
  refreshPWA: () => void
  checkPWAHealth: () => any
} | null>(null)

// Provider component
export function BLEProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bleReducer, initialState)

  const connect = async () => {
    if (!navigator.bluetooth) {
      dispatch({ type: 'CONNECT_ERROR', payload: 'Web Bluetooth API is not supported in this browser' })
      return
    }

    try {
      dispatch({ type: 'CONNECT_START' })

      // Clean up any existing connections first (PWA recovery)
      if (state.device && state.device.gatt?.connected) {
        console.log('[BLE Recovery] Cleaning up existing connection...')
        try {
          state.device.gatt.disconnect()
        } catch (e) {
          console.log('[BLE Recovery] Error cleaning up:', e)
        }
        await new Promise(resolve => setTimeout(resolve, 500)) // Wait for cleanup
      }

      // Additional diagnostics for PWA issues
      console.log('[BLE] Connection attempt - PWA mode:', window.matchMedia('(display-mode: standalone)').matches)
      console.log('[BLE] Available memory:', (performance as any).memory ? 
        `${Math.round((performance as any).memory.usedJSHeapSize / 1048576)}MB used` : 'Unknown')

      // Request BLE device - show all devices with our service
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [BLE_CONFIG.SERVICE_UUID] }],
        optionalServices: [BLE_CONFIG.SERVICE_UUID]
      })

      // Connect to the device
      const server = await device.gatt!.connect()
      
      // Get the service
      const service = await server.getPrimaryService(BLE_CONFIG.SERVICE_UUID)
      
      // Get characteristics
      const sensorDataCharacteristic = await service.getCharacteristic(BLE_CONFIG.SENSOR_DATA_UUID)
      const commandCharacteristic = await service.getCharacteristic(BLE_CONFIG.COMMAND_UUID)
      
      // Start notifications for sensor data
      await sensorDataCharacteristic.startNotifications()
      sensorDataCharacteristic.addEventListener('characteristicvaluechanged', handleSensorData)
      
      // Set up disconnect handler
      device.addEventListener('gattserverdisconnected', () => {
        dispatch({ type: 'DISCONNECT' })
      })

      dispatch({
        type: 'CONNECT_SUCCESS',
        payload: { device, server, sensorDataCharacteristic, commandCharacteristic }
      })

      // Store the device name for display in settings
      if (device.name) {
        dispatch({ type: 'UPDATE_DEVICE_NAME', payload: device.name })
      }

      // Request firmware version after connection is established
      setTimeout(async () => {
        try {
          const command = JSON.stringify({ cmd: 'GET_FW_VERSION' })
          const encoder = new TextEncoder()
          await commandCharacteristic.writeValue(encoder.encode(command))
          console.log('Firmware version requested')
        } catch (error) {
          console.error('Failed to request firmware version:', error)
        }
      }, 2000) // Wait 2 seconds to ensure connection is stable

      // RSSI now comes from ESP32 data stream, no need for periodic monitoring

    } catch (error) {
      console.error('[BLE] Connection failed:', error)
      
      // Enhanced error handling for PWA issues
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Detect common PWA/Android issues
      if (errorMessage.includes('User cancelled') || errorMessage.includes('AbortError')) {
        errorMessage = 'Connection cancelled by user'
      } else if (errorMessage.includes('NetworkError') || errorMessage.includes('NotFoundError')) {
        errorMessage = 'Device not found or Bluetooth is disabled. Try:\n• Enable Bluetooth\n• Move closer to device\n• Refresh the PWA if issue persists'
      } else if (errorMessage.includes('SecurityError')) {
        errorMessage = 'PWA security issue detected. Please:\n• Close and reopen the PWA\n• Clear browser cache if needed'
      } else if (errorMessage.includes('InvalidStateError')) {
        errorMessage = 'Bluetooth adapter is in invalid state. Try:\n• Restart Bluetooth\n• Refresh the PWA\n• Reboot device if needed'
      }
      
      dispatch({ 
        type: 'CONNECT_ERROR', 
        payload: errorMessage
      })
      
      // Log detailed error info for debugging
      console.log('[BLE Debug] Error details:', {
        error: error,
        isStandalone: window.matchMedia('(display-mode: standalone)').matches,
        userAgent: navigator.userAgent,
        bluetoothAvailable: !!navigator.bluetooth,
        timestamp: new Date().toISOString()
      })
    }
  }

  const disconnect = () => {
    if (state.device && state.device.gatt?.connected) {
      state.device.gatt.disconnect()
    }
    dispatch({ type: 'DISCONNECT' })
  }

  const sendCommand = async (command: any): Promise<boolean> => {
    if (!state.isConnected || !state.commandCharacteristic) {
      console.error('BLE not connected or command characteristic not available')
      return false
    }

    try {
      const commandStr = JSON.stringify(command)
      console.log('Attempting to send command:', commandStr)
      console.log('Command length:', commandStr.length, 'bytes')
      
      const encoder = new TextEncoder()
      const encodedData = encoder.encode(commandStr)
      console.log('Encoded data length:', encodedData.length, 'bytes')
      
      // Use writeValueWithoutResponse for better compatibility as recommended by ESP32 docs
      await state.commandCharacteristic.writeValueWithoutResponse(encodedData)
      console.log('BLE command sent successfully:', command)
      return true
    } catch (error) {
      console.error('Error sending BLE command:', error)
      console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error)
      console.error('Error message:', error instanceof Error ? error.message : String(error))
      return false
    }
  }

  const handleSensorData = (event: Event) => {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const value = new TextDecoder().decode(target.value!)
      
      // Filter out obviously corrupted data
      if (!value || value.length < 2 || !value.startsWith('{')) {
        console.warn('[BLE] Received corrupted data, ignoring:', value)
        return
      }
      
      console.log('[BLE] Raw data received:', value)

      let data
      try {
        data = JSON.parse(value)
      } catch (parseError) {
        console.warn('[BLE] Failed to parse JSON, ignoring corrupted message:', value)
        return
      }
      
      // Handle firmware version message
      if (data.type === 'firmware_version') {
        dispatch({ type: 'UPDATE_FIRMWARE_VERSION', payload: data.version })
        console.log('Received firmware version:', data.version)
        return
      }
      
      // Handle memory check response
      if (data.type === 'memory_info') {
        const { required, available, total, sufficient } = data
        console.log(`Device memory: ${available}/${total} bytes available, needs ${required} bytes, sufficient: ${sufficient}`)
        
        if (!sufficient) {
          const errorMsg = `Insufficient device memory: ${available} bytes available, ${required} bytes required`
          dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: errorMsg })
          
          // Show user-friendly memory error
          alert(`❌ Insufficient Device Memory\n\nYour device doesn't have enough memory for this firmware update:\n\nRequired: ${(required/1024).toFixed(1)} KB\nAvailable: ${(available/1024).toFixed(1)} KB\nShortfall: ${((required-available)/1024).toFixed(1)} KB\n\nThis firmware update cannot be installed over Bluetooth. You may need to use a USB cable for updating.`)
        }
        return
      }
      
      // Handle firmware update responses
      if (data.type === 'update_ready') {
        console.log('ESP32 confirmed OTA update initialization successful')
        return
      }
      
      if (data.type === 'update_error') {
        console.error('ESP32 OTA update error:', data.message)
        
        // Handle empty or unhelpful error messages with more specific debugging
        let userMessage = data.message
        let originalMessage = data.message || 'No message provided'
        
        if (!userMessage || userMessage.trim() === '' || userMessage.toLowerCase() === 'no error') {
          userMessage = 'Device initialization failed (no specific error provided)'
        }
        
        // Provide specific guidance based on error type
        let guidance = ''
        if (userMessage.includes('too large') || userMessage.includes('space')) {
          guidance = '\n\nThe firmware is too large for the device memory. This device may need to be updated via USB cable instead.'
        } else if (userMessage.includes('initialization') || userMessage.includes('begin') || userMessage.includes('failed')) {
          guidance = '\n\nThe device could not prepare for the update. This might be due to:\n• Another update in progress\n• Device in invalid state\n• Hardware memory issues\n\nTry restarting the device and reconnecting.'
        } else {
          guidance = '\n\nTry:\n• Ensure device has stable power\n• Move closer to device\n• Restart device and reconnect'
        }
        
        const errorMsg = `Firmware Update Failed: ${userMessage}`
        dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: errorMsg })
        
        // Show user-visible error with actionable guidance and debugging info
        alert(`❌ Firmware Update Failed\n\n${userMessage}${guidance}\n\n[Debug Info: "${originalMessage}"]`)
        return
      }
      
      if (data.type === 'chunk_ack') {
        console.log(`ESP32 confirmed chunk ${data.index} received successfully`)
        return
      }
      
      if (data.type === 'chunk_error') {
        console.error(`ESP32 failed to write chunk ${data.index}`)
        const errorMsg = `Failed to write firmware data (chunk ${data.index})`
        dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: errorMsg })
        
        // Show user-visible error
        alert(`❌ Firmware Update Failed\n\nFailed to write firmware data to device.\nThis could be due to:\n• Poor BLE connection\n• Device memory issues\n• Hardware problems\n\nPlease try again with a stronger connection.`)
        return
      }
      
      if (data.type === 'verify_complete') {
        if (data.success) {
          console.log('ESP32 firmware verification successful! Device should restart...')
          // Don't mark as complete yet - wait for reconnection with new version
        } else {
          console.error('ESP32 firmware verification failed:', data.error)
          const errorMsg = `Firmware verification failed: ${data.error}`
          dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: errorMsg })
          
          // Show user-visible error with specific details
          alert(`❌ Firmware Verification Failed\n\n${data.error}\n\nThe firmware was uploaded but failed verification. This could mean:\n• Corrupted data during transfer\n• Incompatible firmware file\n• Device hardware issues\n\nPlease try the update again.`)
        }
        return
      }
      
      // Map standard keys to internal data structure
      const mappedData: Partial<SailingData> = {
        speed: data.SOG || 0,            // Speed Over Ground
        speedMax: data.SOGMax || 0,
        speedAvg: data.SOGAvg || 0,
        windSpeed: data.AWS || 0,        // Apparent Wind Speed
        windSpeedMax: data.AWSMax || 0,
        windSpeedAvg: data.AWSAvg || 0,
        windAngle: convertToSailingAngle(data.AWA || 0),        // Convert 360° to 180° sailing angle
        trueWindSpeed: data.TWS || 0,    // True Wind Speed
        trueWindSpeedMax: data.TWSMax || 0,
        trueWindSpeedAvg: data.TWSAvg || 0,
        trueWindAngle: convertToSailingAngle(data.TWA || 0),    // Convert 360° to 180° sailing angle
        tilt: data.heel || 0,            // Heel angle
        tiltPortMax: data.heelPortMax || 0,
        tiltStarboardMax: data.heelStarboardMax || 0,
        deadWindAngle: data.deadWind || 40,
        gpsSpeed: data.SOG || 0,         // GPS Speed (same as SOG)
        gpsSatellites: data.satellites || 0,
        hdop: data.hdop || 0,            // Horizontal Dilution of Precision
        lat: data.lat || 0,              // Latitude
        lon: data.lon || 0,              // Longitude
        heading: data.HDM || 0,          // Heading Magnetic (compass direction)
        // Regatta data
        hasStartLine: data.regatta || false,          // Whether start line is configured
        distanceToLine: data.distanceToLine || -1    // Distance to start line in meters (-1 = invalid)
      }

      // Set windDirection to the same value as converted windAngle (both now 0-180°)
      mappedData.windDirection = mappedData.windAngle

      dispatch({ type: 'UPDATE_DATA', payload: mappedData })

      // Update RSSI if included in sensor data
      if (data.rssi !== undefined) {
        dispatch({ type: 'UPDATE_RSSI', payload: data.rssi })
      }

      // Update last message timestamp
      dispatch({ type: 'UPDATE_LAST_MESSAGE_TIME', payload: Date.now() })

    } catch (error) {
      console.error('Error parsing BLE sensor data:', error)
    }
  }

  const checkForUpdates = async () => {
    try {
      const release = await getLatestRelease()
      if (!release) {
        console.warn('No releases found')
        return
      }

      const latestVersion = release.tag_name
      dispatch({ type: 'SET_LATEST_VERSION', payload: latestVersion })

      // Check if update is available
      if (compareVersions(state.firmwareInfo.currentVersion, latestVersion)) {
        console.log(`Update available: ${state.firmwareInfo.currentVersion} -> ${latestVersion}`)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      dispatch({ type: 'CONNECT_ERROR', payload: 'Failed to check for firmware updates' })
    }
  }

  const startFirmwareUpdate = async () => {
    if (!state.isConnected || !state.commandCharacteristic || !state.firmwareInfo.latestVersion) {
      throw new Error('Device not connected or no update available')
    }

    try {
      dispatch({ type: 'START_FIRMWARE_UPDATE' })

      // Get latest release and firmware asset
      const release = await getLatestRelease()
      if (!release) {
        throw new Error('Could not fetch latest release')
      }

      const firmwareAsset = await getFirmwareAsset(release)
      if (!firmwareAsset) {
        throw new Error('No firmware found in latest release')
      }

      // Check firmware size against known partition limits
      const firmwareSize = firmwareAsset.size
      const MAX_FIRMWARE_SIZE = 1310720 // 1.25MB - typical ESP32 OTA partition size
      
      console.log(`Firmware size: ${firmwareSize} bytes (${(firmwareSize / 1024).toFixed(1)} KB)`)
      console.log(`Maximum allowed: ${MAX_FIRMWARE_SIZE} bytes (${(MAX_FIRMWARE_SIZE / 1024).toFixed(1)} KB)`)

      if (firmwareSize > MAX_FIRMWARE_SIZE) {
        throw new Error(`Firmware too large: ${(firmwareSize/1024).toFixed(1)} KB exceeds ${(MAX_FIRMWARE_SIZE/1024).toFixed(1)} KB limit. Use USB cable for update.`)
      }

      // Download firmware
      const firmwareData = await downloadFirmware(firmwareAsset)

      // Create updater and start update
      const updater = new BLEFirmwareUpdater(
        state.commandCharacteristic,
        (progress) => {
          dispatch({ type: 'UPDATE_FIRMWARE_PROGRESS', payload: progress.percentage })
        }
      )

      await updater.updateFirmware(firmwareData)
      dispatch({ type: 'FIRMWARE_UPDATE_COMPLETE' })

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      dispatch({ type: 'FIRMWARE_UPDATE_ERROR', payload: errorMessage })
      throw error
    }
  }

  // Automatic PWA health monitoring for Android stability
  useEffect(() => {
    let healthCheckInterval: number | null = null

    // Only run health checks in PWA mode to avoid unnecessary overhead
    if (window.matchMedia('(display-mode: standalone)').matches) {
      console.log('[PWA Health] Starting automatic health monitoring...')

      healthCheckInterval = setInterval(() => {
        try {
          const healthStatus = checkPWAHealth()
          
          // Check for critical memory usage (>80% of available)
          if (healthStatus.memoryUsage && healthStatus.memoryUsage.usedPercent > 80) {
            console.warn('[PWA Health] High memory usage detected:', healthStatus.memoryUsage)
            
            // Trigger garbage collection if available
            if ((window as any).gc) {
              console.log('[PWA Health] Triggering manual garbage collection')
              ;(window as any).gc()
            }
          }

          // Check for disconnected BLE device that should be connected
          if (state.isConnected && state.device && !state.device.gatt?.connected) {
            console.warn('[PWA Health] BLE device disconnected unexpectedly, attempting reconnection...')
            
            // Attempt automatic reconnection after short delay
            setTimeout(() => {
              if (!state.isConnected) { // Double-check state hasn't changed
                connect().catch(error => {
                  console.error('[PWA Health] Auto-reconnection failed:', error)
                })
              }
            }, 2000)
          }

          // Log health status periodically for debugging
          if (healthStatus.uptime && healthStatus.uptime > 3600000) { // > 1 hour
            console.log('[PWA Health] Long session detected:', {
              uptime: `${Math.round(healthStatus.uptime / 60000)} minutes`,
              memory: healthStatus.memoryUsage,
              bluetooth: healthStatus.bluetoothAvailable,
              serviceWorker: healthStatus.serviceWorkerActive
            })
          }

        } catch (error) {
          console.error('[PWA Health] Health check failed:', error)
        }
      }, 60000) // Check every minute

      // Also run immediate health check
      setTimeout(() => {
        const initialHealth = checkPWAHealth()
        console.log('[PWA Health] Initial health check:', initialHealth)
      }, 5000) // Wait 5 seconds for app to stabilize
    }

    return () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
        console.log('[PWA Health] Stopped automatic health monitoring')
      }
    }
  }, [state.isConnected, state.device]) // Re-run when connection state changes

  return (
    <BLEContext.Provider value={{ 
      state, 
      connect, 
      disconnect, 
      sendCommand, 
      checkForUpdates, 
      startFirmwareUpdate,
      refreshPWA,
      checkPWAHealth 
    }}>
      {children}
    </BLEContext.Provider>
  )
}

// Hook to use BLE context
export function useBLE() {
  const context = useContext(BLEContext)
  if (!context) {
    throw new Error('useBLE must be used within a BLEProvider')
  }
  return context
}
