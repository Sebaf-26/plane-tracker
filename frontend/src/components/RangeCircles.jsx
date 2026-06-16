import { Circle, Tooltip } from 'react-leaflet'

const RINGS = [50, 100, 150, 200, 250, 300]

export default function RangeCircles({ lat, lon }) {
  return (
    <>
      {RINGS.map((km) => (
        <Circle
          key={km}
          center={[lat, lon]}
          radius={km * 1000}
          pathOptions={{
            color: 'rgba(255,255,255,0.18)',
            weight: 1,
            fill: false,
            dashArray: '4 6',
          }}
        >
          <Tooltip
            permanent
            direction="top"
            offset={[0, 0]}
            position={[lat + (km / 111), lon]}
            className="range-label"
          >
            {km} km
          </Tooltip>
        </Circle>
      ))}
    </>
  )
}
