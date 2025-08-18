import { createContext, useContext, useReducer, ReactNode } from 'react'
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
  windDirection: number
  trueWindSpeed: number
  trueWindSpeedMax: number
  trueWindSpeedAvg: number
  trueWindDirection: number
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
    windDirection: 0,
    trueWindSpeed: 0,
    trueWindSpeedMax: 0,
    trueWindSpeedAvg: 0,
    trueWindDirection: 0,
    tilt: 0,
    tiltPortMax: 0,
    tiltStarboardMax: 0,
    deadWindAngle: 40,
    gpsSpeed: 0,
    gpsSatellites: 0,
    hdop: 0,
    lat: 0,
    lon: 0,
    heading: 0
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
          windDirection: 0,
          trueWindSpeed: 0,
          trueWindSpeedMax: 0,
          trueWindSpeedAvg: 0,
          trueWindDirection: 0,
          tilt: 0,
          tiltPortMax: 0,
          tiltStarboardMax: 0,
          deadWindAngle: 40,
          gpsSpeed: 0,
          gpsSatellites: 0,
          hdop: 0,
          lat: 0,
          lon: 0,
          heading: 0
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

// Context
const BLEContext = createContext<{
  state: BLEState
  connect: () => Promise<void>
  disconnect: () => void
  sendCommand: (command: any) => Promise<boolean>
  checkForUpdates: () => Promise<void>
  startFirmwareUpdate: () => Promise<void>
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

      // RSSI now comes from ESP32 data stream, no need for periodic monitoring

    } catch (error) {
      dispatch({ 
        type: 'CONNECT_ERROR', 
        payload: error instanceof Error ? error.message : 'Unknown error occurred' 
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
      console.log('[BLE] Raw data received:', value)

      const data = JSON.parse(value)
      
      // Handle firmware version message
      if (data.type === 'firmware_version') {
        dispatch({ type: 'UPDATE_FIRMWARE_VERSION', payload: data.version })
        console.log('Received firmware version:', data.version)
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
        windDirection: data.AWD || 0,    // Apparent Wind Direction
        trueWindSpeed: data.TWS || 0,    // True Wind Speed
        trueWindSpeedMax: data.TWSMax || 0,
        trueWindSpeedAvg: data.TWSAvg || 0,
        trueWindDirection: data.TWD || 0, // True Wind Direction
        tilt: data.heel || 0,            // Heel angle
        tiltPortMax: data.heelPortMax || 0,
        tiltStarboardMax: data.heelStarboardMax || 0,
        deadWindAngle: data.deadWind || 40,
        gpsSpeed: data.SOG || 0,         // GPS Speed (same as SOG)
        gpsSatellites: data.satellites || 0,
        hdop: data.hdop || 0,            // Horizontal Dilution of Precision
        lat: data.lat || 0,              // Latitude
        lon: data.lon || 0,              // Longitude
        heading: data.HDM || 0           // Heading Magnetic (compass direction)
      }

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

  return (
    <BLEContext.Provider value={{ state, connect, disconnect, sendCommand, checkForUpdates, startFirmwareUpdate }}>
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
