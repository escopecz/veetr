import { useBLE } from '../context/BLEContext'
import SpeedCard from './cards/SpeedCard'
import WindCard from './cards/WindCard'
import TiltCard from './cards/TiltCard'
import ApparentAngleCard from './cards/ApparentAngleCard'
import TrueWindAngleCard from './cards/TrueWindAngleCard'
import WindAngleCard from './cards/WindAngleCard'
import SatellitesCard from './cards/SatellitesCard'
import HeadingCard from './cards/HeadingCard'
import CompactConnectionButton from './CompactConnectionButton'
import Settings from './Settings'
import './Dashboard.css'

export default function Dashboard() {
  const { state } = useBLE()
  const { sailingData } = state

  return (
    <div className="dashboard">
      <CompactConnectionButton />
      <Settings />
      <div className="dashboard-layout">
        <div className="wind-direction-area">
          <WindAngleCard
            windDirection={sailingData.windDirection}
            windSpeed={sailingData.windSpeed}
            trueWindSpeed={sailingData.trueWindSpeed}
            trueWindAngle={sailingData.trueWindAngle}
            deadWindAngle={sailingData.deadWindAngle}
            heading={sailingData.heading}
          />
        </div>
        <div className="dashboard-cards-area">
          <WindCard
            windSpeed={sailingData.windSpeed}
            title="Apparent Wind"
          />
          <ApparentAngleCard angle={sailingData.windAngle} />
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
          <HeadingCard 
            heading={sailingData.heading}
          />
        </div>
      </div>
    </div>
  )
}
