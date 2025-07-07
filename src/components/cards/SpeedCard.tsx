import '../Dashboard.css'

interface SpeedCardProps {
  speed: number
  satellites: number
}

export default function SpeedCard({ speed }: SpeedCardProps) {
  const displaySpeed = speed.toFixed(1)

  return (
    <div className="card speed-card">
      <div className="card-value">
        <span className="card-title">SOG</span>
        <span className="value-unit-row">
          <span className="value-number">{displaySpeed}</span>
          <span className="card-unit">kt</span>
        </span>
      </div>
    </div>
  )
}
