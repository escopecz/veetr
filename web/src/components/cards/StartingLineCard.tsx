import '../Dashboard.css'

interface StartingLineCardProps {
  hasStartLine: boolean
  distanceToLine: number
}

export default function StartingLineCard({ hasStartLine, distanceToLine }: StartingLineCardProps) {
  const formatDistance = (distance: number) => {
    if (distance < 0 || !hasStartLine) return null
    return distance.toFixed(0)
  }

  const distanceValue = formatDistance(distanceToLine)

  return (
    <div className="card starting-line-card">
      <div className="card-value">
        <span className="card-title">Line</span>
        {distanceValue ? (
          <span className="value-unit-row">
            <span className="value-number">{distanceValue}</span>
            <span className="card-unit">m</span>
          </span>
        ) : (
          <span className="value-number">--</span>
        )}
      </div>
    </div>
  )
}