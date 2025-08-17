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
  private chunkSize = 512 // ESP32 typical BLE MTU minus headers

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
    
    const encoder = new TextEncoder()
    await this.characteristic.writeValue(encoder.encode(command))
    
    // Wait for acknowledgment
    await this.delay(1000)
  }

  private async transferFirmware(firmwareData: ArrayBuffer): Promise<void> {
    const totalChunks = Math.ceil(firmwareData.byteLength / this.chunkSize)
    const dataView = new DataView(firmwareData)

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const offset = chunkIndex * this.chunkSize
      const chunkSize = Math.min(this.chunkSize, firmwareData.byteLength - offset)
      
      // Create chunk data
      const chunkData = new ArrayBuffer(chunkSize)
      const chunkView = new Uint8Array(chunkData)
      
      for (let i = 0; i < chunkSize; i++) {
        chunkView[i] = dataView.getUint8(offset + i)
      }

      // Send chunk with metadata
      await this.sendFirmwareChunk(chunkIndex, chunkData)

      // Update progress
      const bytesTransferred = offset + chunkSize
      const percentage = Math.round((bytesTransferred / firmwareData.byteLength) * 100)
      
      this.onProgress({
        percentage,
        bytesTransferred,
        totalBytes: firmwareData.byteLength,
        stage: 'transferring',
        message: `Transferring firmware... ${percentage}%`
      })

      // Small delay to prevent overwhelming the ESP32
      await this.delay(50)
    }
  }

  private async sendFirmwareChunk(chunkIndex: number, chunkData: ArrayBuffer): Promise<void> {
    // Create command with binary data
    // In a real implementation, you'd need a binary protocol
    // For now, we'll use base64 encoding (not efficient but works for demo)
    const base64Data = this.arrayBufferToBase64(chunkData)
    
    const command = JSON.stringify({
      cmd: FIRMWARE_COMMANDS.TRANSFER_CHUNK,
      index: chunkIndex,
      data: base64Data
    })

    const encoder = new TextEncoder()
    await this.characteristic.writeValue(encoder.encode(command))
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
    await this.characteristic.writeValue(encoder.encode(command))
    
    // Wait for verification
    await this.delay(2000)
  }

  private async applyUpdate(): Promise<void> {
    this.onProgress({
      percentage: 98,
      bytesTransferred: 0,
      totalBytes: 0,
      stage: 'verifying',
      message: 'Applying firmware update...'
    })

    const command = JSON.stringify({ cmd: FIRMWARE_COMMANDS.APPLY_UPDATE })
    const encoder = new TextEncoder()
    await this.characteristic.writeValue(encoder.encode(command))
    
    // ESP32 will restart after this command
    await this.delay(3000)
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
