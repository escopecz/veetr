import '../Dashboard.css'

interface WindCardProps {
  windSpeed: number
  title: string
}

export default function WindCard({ windSpeed, title }: WindCardProps) {
  const isTrue = title.toLowerCase().includes('true')
  const label = isTrue ? 'TWS' : 'AWS'
  const displaySpeed = windSpeed > 0 ? windSpeed.toFixed(1) : '0.0'

  return (
    <div className="card wind-card">
      <div className="card-value">
        <span className="card-title">{label}</span>
        <span className="value-unit-row">
          <span className="value-number">{displaySpeed}</span>
          <span className="card-unit">kt</span>
        </span>
      </div>
    </div>
  )
}
