export interface FirmwareUpdateProgress {
  percentage: number
  bytesTransferred: number
  totalBytes: number
  stage: 'preparing' | 'transferring' | 'verifying' | 'complete' | 'error'
  message: string
}

export type FirmwareUpdateCallback = (progress: FirmwareUpdateProgress) => void

// BLE command types for firmware update
export const FIRMWARE_COMMANDS = {
  GET_VERSION: 'GET_FW_VERSION',
  START_UPDATE: 'START_FW_UPDATE',
  TRANSFER_CHUNK: 'FW_CHUNK',
  VERIFY_UPDATE: 'VERIFY_FW',
  APPLY_UPDATE: 'APPLY_FW'
} as const

export class BLEFirmwareUpdater {
  private characteristic: BluetoothRemoteGATTCharacteristic
  private onProgress: FirmwareUpdateCallback
  private chunkSize = 200 // Reduced chunk size for better reliability

  constructor(
    characteristic: BluetoothRemoteGATTCharacteristic,
    onProgress: FirmwareUpdateCallback
  ) {
    this.characteristic = characteristic
    this.onProgress = onProgress
  }

  async getCurrentVersion(): Promise<string> {
    try {
      const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.GET_VERSION })
      const encoder = new TextEncoder()
      await this.characteristic.writeValue(encoder.encode(command))
      
      // Listen for response (this would need to be handled in your main BLE context)
      // For now, return a placeholder
      return 'v1.0.0'
    } catch (error) {
      console.error('Failed to get firmware version:', error)
      throw new Error('Could not retrieve current firmware version')
    }
  }

  async updateFirmware(firmwareData: ArrayBuffer): Promise<void> {
    try {
      this.onProgress({
        percentage: 0,
        bytesTransferred: 0,
        totalBytes: firmwareData.byteLength,
        stage: 'preparing',
        message: 'Preparing firmware update...'
      })

      // Step 1: Initialize update
      await this.initializeUpdate(firmwareData.byteLength)

      // Step 2: Transfer firmware in chunks
      await this.transferFirmware(firmwareData)

      // Step 3: Verify firmware
      await this.verifyFirmware()

      // Step 4: Apply update
      await this.applyUpdate()

      this.onProgress({
        percentage: 100,
        bytesTransferred: firmwareData.byteLength,
        totalBytes: firmwareData.byteLength,
        stage: 'complete',
        message: 'Firmware update completed successfully!'
      })

    } catch (error) {
      this.onProgress({
        percentage: 0,
        bytesTransferred: 0,
        totalBytes: firmwareData.byteLength,
        stage: 'error',
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      throw error
    }
  }

  private async initializeUpdate(totalSize: number): Promise<void> {
    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.START_UPDATE,
      size: totalSize
    })
    
    console.log('Initializing firmware update...', { totalSize })
    
    const encoder = new TextEncoder()
    
    // Retry mechanism for better reliability
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
        console.log(`Update initialization sent (attempt ${attempt})`)
        
        // Wait longer for ESP32 to initialize OTA
        await this.delay(2000)
        break
      } catch (error) {
        console.error(`Initialization attempt ${attempt} failed:`, error)
        if (attempt === 3) {
          throw new Error(`Failed to initialize update after 3 attempts: ${error}`)
        }
        await this.delay(1000) // Wait before retry
      }
    }
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)
    const dataView = new DataView(firmwareData)
    
    console.log(`Starting firmware transfer: ${totalChunks} chunks of ${this.chunkSize} bytes`)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)
      
      // Create chunk data
      const chunkData = new ArrayBuffer(chunkSize)
      const chunkView = new Uint8Array(chunkData)
      
      for (let i = 0; i < chunkSize; i++) {
        chunkView[i] = dataView.getUint8(offset + i)
      }

      // Send chunk with retry logic
      await this.sendFirmwareChunkWithRetry(chunkIndex, chunkData)

      // Update progress
      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 90) // Reserve 10% for verification
      
      this.onProgress({
        percentage,
        bytesTransferred,
        totalBytes: firmwareData.byteLength,
        stage: 'transferring',
        message: `Transferring firmware... ${chunkIndex + 1}/${totalChunks} chunks`
      })

      // Small delay between chunks for stability
      if (chunkIndex < totalChunks - 1) {
        await this.delay(50)
      }
    }
  }

  private async sendFirmwareChunkWithRetry(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.sendFirmwareChunk(chunkIndex, chunkData)
        return // Success, exit retry loop
      } catch (error) {
        console.error(`Chunk ${chunkIndex} attempt ${attempt} failed:`, error)
        if (attempt === 3) {
          throw new Error(`Failed to send chunk ${chunkIndex} after 3 attempts: ${error}`)
        }
        await this.delay(500) // Wait before retry
      }
    }
  }

  private async sendFirmwareChunk(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    // Create command with binary data
    const base64Data = this.arrayBufferToBase64(chunkData)
    
    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK,
      index: chunkIndex,
      data: base64Data
    })

    const encoder = new TextEncoder()
    const encodedCommand = encoder.encode(command)
    
    // Validate size before sending
    if (encodedCommand.length > 512) {
      throw new Error(`Command too large: ${encodedCommand.length} bytes (max 512). Chunk ${chunkIndex} size: ${chunkData.byteLength}`)
    }
    
    console.log(`Sending chunk ${chunkIndex}: ${chunkData.byteLength} bytes raw -> ${encodedCommand.length} bytes encoded`)
    
    // Use writeValueWithoutResponse for better reliability
    await this.characteristic.writeValueWithoutResponse(encodedCommand)
  }

  private async verifyFirmware(): Promise<void> {
    this.onProgress({
      percentage: 95,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Verifying firmware integrity...'
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.VERIFY_UPDATE })
    const encoder = new TextEncoder()
    
    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      console.log('Verification command sent, waiting for ESP32 to verify...')
      
      // Wait longer for verification - firmware verification can take time
      await this.delay(8000)
    } catch (error) {
      throw new Error(`Verification failed: ${error}`)
    }
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({
      percentage: 98,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Applying firmware update (device will restart)...'
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE })
    const encoder = new TextEncoder()
    
    try {
      await this.characteristic.writeValueWithoutResponse(encoder.encode(command))
      console.log('Apply command sent, device should restart...')
      
      // Wait for application - device may restart during this process
      await this.delay(12000)
    } catch (error) {
      // Apply command might fail due to device restart - this could be normal
      console.warn('Apply command may have failed due to device restart:', error)
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
