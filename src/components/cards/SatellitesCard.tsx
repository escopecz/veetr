import '../Dashboard.css'

interface SatellitesCardProps {
  satellites: number
}

export default function SatellitesCard({ satellites }: SatellitesCardProps) {
  return (
    <div className="card satellites-card">
      <div className="card-value">
        <span className="card-title">SAT</span>
        <span className="value-number">{satellites}</span>
      </div>
    </div>
  )
}
