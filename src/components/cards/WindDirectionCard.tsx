import '../Dashboard.css'
import './WindDirectionCard.css'

interface WindDirectionCardProps {
  windDirection: number
  windSpeed: number
  trueWindDirection: number
  trueWindSpeed: number
  deadWindAngle: number
}

export default function WindDirectionCard({ 
  windDirection, 
  windSpeed: _windSpeed, 
  trueWindDirection, 
  trueWindSpeed, 
  deadWindAngle 
}: WindDirectionCardProps) {
  return (
    <div className="card wind-direction-card">
      <div className="wind-compass">
        <svg width="350" height="350" viewBox="0 0 400 400" className="compass-svg">
          {/* Outer compass ring */}
          <circle 
            cx="200" 
            cy="200" 
            r="180" 
            fill="none" 
            stroke="rgba(255,255,255,0.3)" 
            strokeWidth="4"
          />
          
          {/* Inner compass ring */}
          <circle 
            cx="200" 
            cy="200" 
            r="150" 
            fill="none" 
            stroke="rgba(255,255,255,0.2)" 
            strokeWidth="2"
          />
          
          {/* Degree markers */}
          {Array.from({ length: 36 }, (_, i) => {
            const angle = i * 10;
            const isCardinal = angle % 90 === 0;
            const isMajor = angle % 30 === 0;
            const radius = isCardinal ? 165 : isMajor ? 170 : 175;
            const endRadius = 180;
            const x1 = 200 + radius * Math.sin((angle * Math.PI) / 180);
            const y1 = 200 - radius * Math.cos((angle * Math.PI) / 180);
            const x2 = 200 + endRadius * Math.sin((angle * Math.PI) / 180);
            const y2 = 200 - endRadius * Math.cos((angle * Math.PI) / 180);
            
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={isCardinal ? "3" : isMajor ? "2" : "1"}
              />
            );
          })}
          
          {/* Dead wind zone (red V) */}
          <path
            d={`M 200,200 L ${200 + 140 * Math.sin((deadWindAngle * Math.PI) / 180)},${200 - 140 * Math.cos((deadWindAngle * Math.PI) / 180)} M 200,200 L ${200 - 140 * Math.sin((deadWindAngle * Math.PI) / 180)},${200 - 140 * Math.cos((deadWindAngle * Math.PI) / 180)}`}
            stroke="#ef4444"
            strokeWidth="4"
            opacity="0.6"
          />
          
          {/* Boat shape at center */}
          <path
            d="M 200,160 Q 220,200 210,240 Q 200,250 190,240 Q 180,200 200,160 Z"
            fill="rgba(179, 230, 255, 0.9)"
            stroke="#e0e0e0"
            strokeWidth="2"
          />
          <circle cx="200" cy="200" r="5" fill="#000" stroke="#fff" strokeWidth="2" />
          
          {/* Apparent wind arrow */}
          <g transform={`rotate(${windDirection} 200 200)`}>
            <path
              d="M 190,40 L 200,200 L 210,40"
              fill="#3b82f6"
              stroke="#1e40af"
              strokeWidth="3"
              opacity="0.9"
            />
            <circle cx="200" cy="50" r="8" fill="#3b82f6" stroke="#1e40af" strokeWidth="2" />
            {/* Removed APP label for apparent wind arrow */}
          </g>
          
          {/* True wind arrow */}
          {trueWindSpeed > 0 && (
            <g transform={`rotate(${trueWindDirection} 200 200)`}>
              <path
                d="M 185,40 L 200,200 L 215,40"
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth="3"
                opacity="0.8"
              />
              <circle cx="200" cy="50" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
              <text 
                x="220" 
                y="35" 
                fill="#f59e0b" 
                fontSize="10" 
                fontWeight="bold"
              >
                TRUE
              </text>
            </g>
          )}
          
          {/* No cardinal directions for max density */}
        </svg>
      </div>
      
      {trueWindSpeed > 0 && (
        <div className="wind-data">
          <div className="wind-data-item">
            <span className="wind-label">True</span>
            <span className="wind-value">{trueWindDirection.toFixed(0)}°</span>
          </div>
        </div>
      )}
    </div>
  )
}
