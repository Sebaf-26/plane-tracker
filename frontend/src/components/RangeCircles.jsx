import { Circle, Marker } from 'react-leaflet'
import L from 'leaflet'

const RINGS = [50, 100, 150, 200, 250, 300]

function labelIcon(km) {
  return L.divIcon({
    html: `<span style="
      color: rgba(255,255,255,0.35);
      font-size: 10px;
      font-family: 'SF Mono', ui-monospace, monospace;
      font-weight: 600;
      white-space: nowrap;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      pointer-events: none;
    ">${km} km</span>`,
    className: '',
    iconSize: [48, 14],
    iconAnchor: [24, 14],
  })
}

export default function RangeCircles({ lat, lon }) {
  return (
    <>
      {RINGS.map((km) => {
        // 1° lat ≈ 111 km — posiziona l'etichetta in cima al cerchio
        const labelLat = lat + km / 111
        return (
          <>
            <Circle
              key={`c-${km}`}
              center={[lat, lon]}
              radius={km * 1000}
              pathOptions={{
                color: 'rgba(255,255,255,0.18)',
                weight: 1,
                fill: false,
                dashArray: '4 6',
              }}
            />
            <Marker
              key={`l-${km}`}
              position={[labelLat, lon]}
              icon={labelIcon(km)}
              interactive={false}
              zIndexOffset={-1000}
            />
          </>
        )
      })}
    </>
  )
}
