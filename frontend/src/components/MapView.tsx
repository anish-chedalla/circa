/**
 * Interactive Leaflet map displaying business pins.
 * Fixes the Vite/Webpack default icon issue on mount.
 */

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import L from 'leaflet';

import type { Business } from '../types';
import styles from './MapView.module.css';

// Fix Leaflet default marker icon paths for Vite bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface MapViewProps {
  /** Businesses to render as pins on the map. */
  businesses: Business[];
}

const ARIZONA_CENTER: [number, number] = [33.45, -111.97];

/**
 * Renders a Leaflet map centered on the Phoenix/Scottsdale area with business markers.
 */
export default function MapView({ businesses }: MapViewProps) {
  const withCoords = businesses.filter((b) => b.lat !== null && b.lng !== null);

  return (
    <div className={styles.mapWrapper}>
      <MapContainer
        center={ARIZONA_CENTER}
        zoom={10}
        className={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((biz) => (
          <Marker key={biz.id} position={[biz.lat!, biz.lng!]}>
            <Popup>
              <div className={styles.popup}>
                <strong className={styles.popupName}>{biz.name}</strong>
                <span className={styles.popupCategory}>{biz.category}</span>
                <span className={styles.popupRating}>
                  ★ {biz.avg_rating.toFixed(1)} ({biz.review_count} reviews)
                </span>
                {biz.has_active_deals && (
                  <span className={styles.popupDeal}>Active Deal Available</span>
                )}
                <Link to={`/business/${biz.id}`} className={styles.popupLink}>
                  View Details →
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
