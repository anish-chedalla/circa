/**
 * Small non-interactive Leaflet map for the Business Detail page.
 * Shows a single marker pinpointing the business location.
 */

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import styles from './MiniMap.module.css';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MiniMapProps {
  lat: number;
  lng: number;
  name: string;
}

/**
 * Renders a small map centered on the given coordinates with a labeled marker.
 */
export default function MiniMap({ lat, lng, name }: MiniMapProps) {
  return (
    <div className={styles.wrapper}>
      <MapContainer
        center={[lat, lng]}
        zoom={15}
        className={styles.map}
        scrollWheelZoom={false}
        zoomControl={false}
        dragging={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]}>
          <Popup>{name}</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
