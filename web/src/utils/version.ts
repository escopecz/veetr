// Version configuration - single source of truth
// This version is synced from the root package.json
const VERSION = '0.0.2'
export const APP_NAME = 'Veetr'
export const APP_VERSION = `${APP_NAME} v${VERSION}`

// Helper function to get version for different contexts
export function getVersionString(includeAppName = true): string {
  return includeAppName ? APP_VERSION : VERSION
}

export { VERSION }
