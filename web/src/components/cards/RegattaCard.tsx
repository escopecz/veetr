import React from 'react'
import { useBLE } from '../../context/BLEContext'

const RegattaCard: React.FC = () => {
  const { state } = useBLE()
  const { hasStartLine, distanceToLine } = state.sailingData

  const formatDistance = (meters: number): string => {
    if (meters < 0) return '--'
    if (meters < 1000) return `${meters.toFixed(0)}m`
    return `${(meters / 1000).toFixed(2)}km`
  }

  return (
    <div className="sensor-card">
      <div className="sensor-header">
        <h3>Regatta Start Line</h3>
      </div>
      <div className="sensor-content">
        {!hasStartLine ? (
          <div className="regatta-not-configured">
            <div className="sensor-value">
              <span className="value-large">--</span>
            </div>
            <div className="sensor-label">No Start Line Set</div>
            <div className="sensor-help">
              Use Settings to configure port and starboard line positions
            </div>
          </div>
        ) : (
          <>
            <div className="regatta-distance">
              <div className="sensor-value">
                <span className="value-large">
                  {formatDistance(distanceToLine)}
                </span>
              </div>
              <div className="sensor-label">Distance to Line</div>
            </div>
          </>
        )}
      </div>
      
      <style>{`
        .regatta-not-configured {
          text-align: center;
          opacity: 0.7;
        }
        
        .regatta-distance {
          text-align: center;
          margin-bottom: 15px;
        }
        
        .regatta-details {
          font-size: 0.9em;
          opacity: 0.8;
        }
        
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin: 4px 0;
          padding: 2px 0;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        
        .detail-row:last-child {
          border-bottom: none;
        }
        
        .detail-label {
          color: rgba(255,255,255,0.7);
        }
        
        .detail-value {
          font-weight: 500;
        }
        
        .status-close {
          color: #ff6b6b;
          font-weight: bold;
        }
        
        .status-ok {
          color: #51cf66;
        }
        
        .sensor-help {
          font-size: 0.85em;
          color: rgba(255,255,255,0.6);
          margin-top: 10px;
          line-height: 1.3;
        }
      `}</style>
    </div>
  )
}

export default RegattaCard