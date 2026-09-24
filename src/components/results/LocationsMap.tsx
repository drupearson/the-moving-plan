"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { LocationRecommendation } from "@/lib/anthropic/schema";

const OKC_METRO_CENTER: [number, number] = [35.35, -97.45];

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

export default function LocationsMap({ locations }: { locations: LocationRecommendation[] }) {
  const withCoordinates = locations.filter((loc) => loc.coordinates);

  const center = useMemo<[number, number]>(() => {
    if (withCoordinates.length === 0) return OKC_METRO_CENTER;
    const lat = withCoordinates.reduce((sum, l) => sum + l.coordinates!.lat, 0) / withCoordinates.length;
    const lon = withCoordinates.reduce((sum, l) => sum + l.coordinates!.lon, 0) / withCoordinates.length;
    return [lat, lon];
  }, [withCoordinates]);

  if (withCoordinates.length === 0) {
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
        {withCoordinates.map((location) => (
          <Marker
            key={location.rank}
            position={[location.coordinates!.lat, location.coordinates!.lon]}
            icon={markerIcon(location.rank)}
          >
            <Popup>
              <span className="font-medium">
                #{location.rank} {location.name}
              </span>
              <br />
              {location.cityArea} · {location.county}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
