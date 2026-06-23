import type { CSSProperties } from "react";
import { coordinatesForLocation, coordinatesForPoint, distanceInKm, type Coordinates } from "@toolshare/shared";

type SearchMapPoint = {
  id: string;
  label: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
};

type SearchRadiusMapProps = {
  centerAddress: string;
  /** Echte Koordinaten des Mittelpunkts (z. B. der Heimadresse); Fallback ist centerAddress. */
  centerLatitude?: number | null;
  centerLongitude?: number | null;
  points: SearchMapPoint[];
  radiusKm: number;
  onRadiusChange: (value: number) => void;
  sliderId: string;
};

const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_M = 40075016.686;

function longitudeToTileX(lon: number, zoom: number) {
  return ((lon + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(lat: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** zoom;
}

function chooseZoom(center: Coordinates, radiusKm: number) {
  const desiredRadiusPx = 96;
  const radiusM = Math.max(1000, radiusKm * 1000);
  const rawZoom = Math.log2((Math.cos((center.lat * Math.PI) / 180) * EARTH_CIRCUMFERENCE_M * desiredRadiusPx) / (TILE_SIZE * radiusM));
  return Math.min(15, Math.max(11, Math.round(rawZoom)));
}

function pixelPosition(point: Coordinates, center: Coordinates, zoom: number) {
  const centerX = longitudeToTileX(center.lon, zoom) * TILE_SIZE;
  const centerY = latitudeToTileY(center.lat, zoom) * TILE_SIZE;
  const pointX = longitudeToTileX(point.lon, zoom) * TILE_SIZE;
  const pointY = latitudeToTileY(point.lat, zoom) * TILE_SIZE;

  return {
    left: `calc(50% + ${pointX - centerX}px)`,
    top: `calc(50% + ${pointY - centerY}px)`
  };
}

function tileGrid(center: Coordinates, zoom: number) {
  const centerTileX = longitudeToTileX(center.lon, zoom);
  const centerTileY = latitudeToTileY(center.lat, zoom);
  const centerTileFloorX = Math.floor(centerTileX);
  const centerTileFloorY = Math.floor(centerTileY);
  const offsetX = (centerTileX - centerTileFloorX) * TILE_SIZE;
  const offsetY = (centerTileY - centerTileFloorY) * TILE_SIZE;
  const maxTile = 2 ** zoom;

  return [-2, -1, 0, 1, 2].flatMap((x) =>
    [-2, -1, 0, 1, 2].map((y) => {
      const tileX = centerTileFloorX + x;
      const tileY = centerTileFloorY + y;
      return {
        key: `${zoom}-${tileX}-${tileY}`,
        src: `https://tile.openstreetmap.org/${zoom}/${((tileX % maxTile) + maxTile) % maxTile}/${tileY}.png`,
        left: `calc(50% + ${(x * TILE_SIZE) - offsetX}px)`,
        top: `calc(50% + ${(y * TILE_SIZE) - offsetY}px)`
      };
    })
  );
}

export function SearchRadiusMap({
  centerAddress,
  centerLatitude,
  centerLongitude,
  points,
  radiusKm,
  onRadiusChange,
  sliderId
}: SearchRadiusMapProps) {
  const center =
    coordinatesForPoint({ latitude: centerLatitude, longitude: centerLongitude, location: centerAddress }) ??
    coordinatesForLocation("München Zentrum")!;
  const zoom = chooseZoom(center, radiusKm);
  const visiblePoints = points
    .map((point) => {
      const coordinates = coordinatesForPoint({
        latitude: point.latitude,
        longitude: point.longitude,
        location: point.location
      });
      if (!coordinates) return null;
      return {
        ...point,
        coordinates,
        inRadius: distanceInKm(center, coordinates) <= radiusKm
      };
    })
    .filter((point): point is NonNullable<typeof point> => Boolean(point));
  const metersPerPixel = (Math.cos((center.lat * Math.PI) / 180) * EARTH_CIRCUMFERENCE_M) / (TILE_SIZE * 2 ** zoom);
  const radiusPx = Math.max(46, Math.min(150, (radiusKm * 1000) / metersPerPixel));

  return (
    <div className="search-map" aria-label={`Karte um ${centerAddress}`}>
      <div className="search-map-tiles" aria-hidden="true">
        {tileGrid(center, zoom).map((tile) => (
          <img key={tile.key} src={tile.src} alt="" style={{ left: tile.left, top: tile.top }} draggable={false} />
        ))}
      </div>
      <div className="search-map-overlay" aria-hidden="true">
        <span className="search-map-radius" style={{ width: `${radiusPx * 2}px` }} />
        <span className="search-map-user" style={pixelPosition(center, center, zoom)} />
        {visiblePoints.map((point) => (
          <span
            key={point.id}
            className={`search-map-marker ${point.inRadius ? "" : "outside"}`.trim()}
            style={pixelPosition(point.coordinates, center, zoom)}
            title={`${point.label}${point.location ? `, ${point.location}` : ""}`}
          />
        ))}
      </div>
      <div className="search-map-control">
        <label htmlFor={sliderId}>
          Umkreis <strong>{radiusKm} km</strong>
        </label>
        <input
          id={sliderId}
          className="radius-slider"
          type="range"
          min={1}
          max={30}
          value={radiusKm}
          style={{ "--range-progress": `${((radiusKm - 1) / 29) * 100}%` } as CSSProperties}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
        />
      </div>
      <a
        className="search-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap-Mitwirkende
      </a>
    </div>
  );
}
