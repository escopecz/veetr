import { useBLE } from '../context/BLEContext'
import SpeedCard from './cards/SpeedCard'
import WindCard from './cards/WindCard'
import TiltCard from './cards/TiltCard'
import ApparentAngleCard from './cards/ApparentAngleCard'
import TrueWindAngleCard from './cards/TrueWindAngleCard'
import SatellitesCard from './cards/SatellitesCard'
import WindDirectionCard from './cards/WindDirectionCard'
import ConnectionStatus from './ConnectionStatus'
import Settings from './Settings'
import './Dashboard.css'

export default function Dashboard() {
  const { state } = useBLE()
  const { sailingData } = state

  return (
    <div className="dashboard">
      <Settings />
      <div className="dashboard-layout">
        <div className="wind-direction-area">
          <WindDirectionCard
            windDirection={sailingData.windDirection}
            windSpeed={sailingData.windSpeed}
            trueWindDirection={sailingData.trueWindDirection}
            trueWindSpeed={sailingData.trueWindSpeed}
            deadWindAngle={sailingData.deadWindAngle}
            heading={sailingData.heading}
          />
        </div>
        <div className="dashboard-cards-area">
          <WindCard
            windSpeed={sailingData.windSpeed}
            title="Apparent Wind"
          />
          <ApparentAngleCard angle={Math.min(sailingData.windDirection, 360 - sailingData.windDirection)} />
          <WindCard
            windSpeed={sailingData.trueWindSpeed}
            title="True Wind"
          />
          <TrueWindAngleCard twa={sailingData.trueWindAngle} />
          <SpeedCard 
            speed={sailingData.gpsSpeed > 0.5 ? sailingData.gpsSpeed : sailingData.speed}
            satellites={sailingData.gpsSatellites}
          />
          <TiltCard
            tilt={sailingData.tilt}
            portMax={sailingData.tiltPortMax}
            starboardMax={sailingData.tiltStarboardMax}
          />
          <SatellitesCard 
            satellites={sailingData.gpsSatellites}
            hdop={sailingData.hdop}
            lat={sailingData.lat}
            lon={sailingData.lon}
          />
          <div className="card">
            <ConnectionStatus />
          </div>
        </div>
      </div>
    </div>
  )
}
