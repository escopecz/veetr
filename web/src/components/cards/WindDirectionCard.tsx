import '../Dashboard.css'
import './WindDirectionCard.css'
import { useSmoothRotation } from '../../hooks/useSmoothRotation'

interface WindDirectionCardProps {
  windDirection: number
  windSpeed: number
  trueWindDirection: number
  trueWindSpeed: number
  deadWindAngle: number
  heading: number
}

export default function WindDirectionCard({ 
  windDirection, 
  windSpeed: _windSpeed, 
  trueWindDirection, 
  trueWindSpeed, 
  deadWindAngle,
  heading 
}: WindDirectionCardProps) {
  // Use smooth rotation for all rotating elements
  const smoothWindDirection = useSmoothRotation(windDirection, { duration: 800 })
  const smoothTrueWindDirection = useSmoothRotation(trueWindDirection, { duration: 800 })
  const smoothHeading = useSmoothRotation(heading, { duration: 1000 })

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
          
          {/* North pointer on inner ring - rotates opposite to boat heading to always point north */}
          <g transform={`rotate(${-smoothHeading} 200 200)`}>
            <path
              d="M 195,49 L 200,34 L 205,49 Z"
              fill="rgba(255,255,255,0.3)"
              stroke="none"
            />
            <text 
              x="200" 
              y="65" 
              fill="#ffffff" 
              fontSize="12" 
              fontWeight="bold"
              textAnchor="middle"
            >
              N
            </text>
          </g>
          
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
          
          {/* Boat shape at center */}
          <path
            d="M 200,172 Q 214,200 207,228 Q 200,235 193,228 Q 186,200 200,172 Z"
            fill="#404040"
            stroke="#e0e0e0"
            strokeWidth="2"
          />
          <circle cx="200" cy="200" r="5" fill="#000" stroke="#fff" strokeWidth="2" />
          
          {/* Dead wind zone (red V) - drawn after boat to appear on top */}
          <path
            d={`M 200,200 L ${200 + 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${200 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)} M 200,200 L ${200 - 180 * Math.sin((deadWindAngle * Math.PI) / 180)},${200 - 180 * Math.cos((deadWindAngle * Math.PI) / 180)}`}
            stroke="#ef4444"
            strokeWidth="4"
            opacity="0.6"
          />
          
          {/* Apparent wind arrow */}
          <g transform={`rotate(${smoothWindDirection} 200 200)`}>
            <path
              d="M 190,20 L 200,200 L 210,20"
              fill="#ffffff"
              stroke="#ffff00"
              strokeWidth="3"
              opacity="0.95"
            />
            <circle cx="200" cy="30" r="8" fill="#ffffff" stroke="#ffff00" strokeWidth="2" />
            {/* Removed APP label for apparent wind arrow */}
          </g>
          
          {/* True wind arrow */}
          {trueWindSpeed > 0 && (
            <g transform={`rotate(${smoothTrueWindDirection} 200 200)`}>
              <path
                d="M 185,20 L 200,200 L 215,20"
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth="3"
                opacity="0.8"
              />
              <circle cx="200" cy="30" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
              <text 
                x="220" 
                y="15" 
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
    </div>
  )
}
