"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LocationRecommendation } from "@/lib/anthropic/schema";

const OKC_METRO_CENTER: [number, number] = [35.35, -97.45];
const OVERLAP_THRESHOLD_DEG = 0.01; // ~0.7 miles

function markerIcon(rank: number) {
  const isTopPick = rank === 1;
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:28px;height:28px;border-radius:9999px;
      background:${isTopPick ? "#059669" : "#57534e"};
      color:white;font-size:12px;font-weight:600;
      border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);
    ">${rank}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface DisplayPin {
  location: LocationRecommendation;
  position: [number, number];
  nudged: boolean;
}

// Two locations can legitimately resolve to (near) the same point - e.g. both
// only matched at county level. Rather than let one marker hide the other,
// spread them apart visually (in a small spiral) so every recommendation is
// always clickable; the underlying commute data is untouched by this.
function computeDisplayPins(locations: LocationRecommendation[]): DisplayPin[] {
  const placed: [number, number][] = [];
  const pins: DisplayPin[] = [];

  for (const location of locations) {
    if (!location.coordinates) continue;
    let lat = location.coordinates.lat;
    let lon = location.coordinates.lon;
    let attempt = 0;
    while (
      placed.some(
        ([pLat, pLon]) =>
          Math.abs(pLat - lat) < OVERLAP_THRESHOLD_DEG && Math.abs(pLon - lon) < OVERLAP_THRESHOLD_DEG,
      )
    ) {
      attempt += 1;
      const angle = (attempt * 137.5 * Math.PI) / 180;
      const radius = 0.015 * attempt;
      lat = location.coordinates.lat + radius * Math.cos(angle);
      lon = location.coordinates.lon + radius * Math.sin(angle);
    }
    placed.push([lat, lon]);
    pins.push({ location, position: [lat, lon], nudged: attempt > 0 });
  }

  return pins;
}

export default function LocationsMap({ locations }: { locations: LocationRecommendation[] }) {
  const pins = useMemo(() => computeDisplayPins(locations), [locations]);

  const center = useMemo<[number, number]>(() => {
    if (pins.length === 0) return OKC_METRO_CENTER;
    const lat = pins.reduce((sum, p) => sum + p.position[0], 0) / pins.length;
    const lon = pins.reduce((sum, p) => sum + p.position[1], 0) / pins.length;
    return [lat, lon];
  }, [pins]);

  if (pins.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
        Map unavailable - locations could not be geocoded.
      </div>
    );
  }

  return (
    <div className="h-80 overflow-hidden rounded-2xl border border-stone-200 shadow-sm">
      <MapContainer center={center} zoom={9} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map(({ location, position, nudged }) => (
          <Marker key={location.rank} position={position} icon={markerIcon(location.rank)}>
            <Popup>
              <span className="font-medium">
                #{location.rank} {location.name}
              </span>
              <br />
              {location.cityArea} · {location.county}
              {nudged && (
                <>
                  <br />
                  <span className="text-xs text-stone-500">
                    Position adjusted slightly so it doesn&apos;t overlap another pin.
                  </span>
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
