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

const GITHUB_REPO = 'escopecz/veetr'
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
  console.log('Available assets in release:', release.assets.map(a => a.name))
  
  // Look for firmware binary in release assets - prioritize .bin files
  const firmwareAsset = release.assets.find(asset => 
    asset.name.endsWith('.bin') && !asset.name.includes('info')
  ) || release.assets.find(asset => 
    asset.name.includes('firmware') && asset.name.endsWith('.bin')
  ) || release.assets.find(asset => 
    asset.name.includes('esp32') && asset.name.endsWith('.bin')
  )

  if (!firmwareAsset) {
    console.warn('No firmware binary (.bin) asset found in release')
    console.warn('Available assets:', release.assets.map(a => ({ name: a.name, size: a.size })))
    return null
  }

  console.log('Selected firmware asset:', firmwareAsset.name, 'Size:', firmwareAsset.size)

  return {
    version: release.tag_name,
    downloadUrl: firmwareAsset.browser_download_url,
    size: firmwareAsset.size,
    filename: firmwareAsset.name
  }
}

export async function downloadFirmware(asset: FirmwareAsset): Promise<ArrayBuffer> {
  console.log('Attempting to download firmware:', asset.filename, 'from:', asset.downloadUrl)
  
  // GitHub's API supports CORS, so we'll use the API endpoint instead of direct download
  try {
    // Get the release info from GitHub API to find the asset
    const releaseResponse = await fetch(`${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases/tags/${asset.version}`)
    if (!releaseResponse.ok) {
      throw new Error(`Failed to get release info: ${releaseResponse.status}`)
    }
    
    const releaseData = await releaseResponse.json()
    const assetInfo = releaseData.assets.find((a: any) => a.name === asset.filename)
    
    if (!assetInfo) {
      throw new Error(`Asset ${asset.filename} not found in release`)
    }

    // Download using GitHub API with proper Accept header for binary content
    const downloadResponse = await fetch(assetInfo.url, {
      headers: {
        'Accept': 'application/octet-stream',
        'User-Agent': 'veetr-firmware-updater'
      }
    })

    if (!downloadResponse.ok) {
      throw new Error(`GitHub API download failed: ${downloadResponse.status}`)
    }

    const data = await downloadResponse.arrayBuffer()
    console.log(`Firmware downloaded successfully via GitHub API: ${data.byteLength} bytes`)
    return data

  } catch (error) {
    console.error('GitHub API download failed, trying fallback methods:', error)
    
    // Fallback: Try a reliable CORS proxy as backup
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(asset.downloadUrl)}`
      console.log('Trying CORS proxy fallback...')
      
      const response = await fetch(proxyUrl)
      if (response.ok) {
        const data = await response.arrayBuffer()
        console.log(`Firmware downloaded via proxy: ${data.byteLength} bytes`)
        return data
      }
    } catch (proxyError) {
      console.error('Proxy fallback also failed:', proxyError)
    }
    
    throw new Error(`Failed to download firmware: ${error instanceof Error ? error.message : 'Unknown error'}. This may be due to GitHub API rate limits or network issues.`)
  }
}

export function compareVersions(current: string, latest: string): boolean {
  // Semantic version comparison with pre-release support
  // Returns true if latest > current
  const parseVersion = (version: string) => {
    const [versionPart, preRelease] = version.split('-', 2)
    const parts = versionPart.split('.').map(Number)
    
    // Ensure we have at least [major, minor, patch]
    while (parts.length < 3) {
      parts.push(0)
    }
    
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0, 
      patch: parts[2] || 0,
      preRelease: preRelease || null
    }
  }

  try {
    const currentVersion = parseVersion(current)
    const latestVersion = parseVersion(latest)
    
    // Compare major.minor.patch first
    if (latestVersion.major !== currentVersion.major) {
      return latestVersion.major > currentVersion.major
    }
    if (latestVersion.minor !== currentVersion.minor) {
      return latestVersion.minor > currentVersion.minor
    }
    if (latestVersion.patch !== currentVersion.patch) {
      return latestVersion.patch > currentVersion.patch
    }
    
    // If versions are equal, handle pre-release precedence
    // According to semver: 1.0.0-alpha < 1.0.0-beta < 1.0.0-rc < 1.0.0
    
    // If neither has pre-release, versions are equal
    if (!currentVersion.preRelease && !latestVersion.preRelease) {
      return false
    }
    
    // Normal version (no pre-release) has higher precedence than pre-release
    if (!currentVersion.preRelease && latestVersion.preRelease) {
      return false // current (1.0.0) > latest (1.0.0-alpha)
    }
    if (currentVersion.preRelease && !latestVersion.preRelease) {
      return true // latest (1.0.0) > current (1.0.0-alpha)
    }
    
    // Both have pre-release, compare them lexically
    // This handles: alpha < beta < rc, and also numbered pre-releases
    if (currentVersion.preRelease && latestVersion.preRelease) {
      return latestVersion.preRelease > currentVersion.preRelease
    }
    
    return false // Versions are equal
  } catch (error) {
    console.error('Version comparison error:', error)
    return false
  }
}
