export interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  assets: Array<{
    name: string
    download_url: string
    browser_download_url: string
    size: number
  }>
}

export interface FirmwareAsset {
  version: string
  downloadUrl: string
  size: number
  filename: string
}

const GITHUB_REPO = 'escopecz/sailing-dashboard'
const GITHUB_API_BASE = 'https://api.github.com'

export async function getLatestRelease(): Promise<GitHubRelease | null> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/latest`)
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Failed to fetch latest release:', error)
    return null
  }
}

export async function getFirmwareAsset(release: GitHubRelease): Promise<FirmwareAsset | null> {
  // Look for firmware binary in release assets
  const firmwareAsset = release.assets.find(asset => 
    asset.name.endsWith('.bin') || 
    asset.name.includes('firmware') ||
    asset.name.includes('esp32')
  )

  if (!firmwareAsset) {
    console.warn('No firmware asset found in release')
    return null
  }

  return {
    version: release.tag_name,
    downloadUrl: firmwareAsset.browser_download_url,
    size: firmwareAsset.size,
    filename: firmwareAsset.name
  }
}

export async function downloadFirmware(asset: FirmwareAsset): Promise<ArrayBuffer> {
  const response = await fetch(asset.downloadUrl)
  if (!response.ok) {
    throw new Error(`Failed to download firmware: ${response.status}`)
  }
  return await response.arrayBuffer()
}

export function compareVersions(current: string, latest: string): boolean {
  // Simple semantic version comparison
  // Returns true if latest > current
  const parseVersion = (version: string) => {
    const cleaned = version.replace(/^v/, '') // Remove 'v' prefix
    return cleaned.split('.').map(Number)
  }

  try {
    const currentParts = parseVersion(current)
    const latestParts = parseVersion(latest)
    
    const maxLength = Math.max(currentParts.length, latestParts.length)
    
    for (let i = 0; i < maxLength; i++) {
      const currentPart = currentParts[i] || 0
      const latestPart = latestParts[i] || 0
      
      if (latestPart > currentPart) return true
      if (latestPart < currentPart) return false
    }
    
    return false // Versions are equal
  } catch (error) {
    console.error('Version comparison error:', error)
    return false
  }
}
