"use client";

import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { HouseholdWorkplaces, LocationRecommendation } from "@/lib/anthropic/schema";

const OKC_METRO_CENTER: [number, number] = [35.35, -97.45];
const OVERLAP_THRESHOLD_DEG = 0.01; // ~0.7 miles

const HOUSEHOLD_COLORS = ["#2563eb", "#dc2626", "#9333ea", "#ea580c", "#0891b2"];
const MIDPOINT_COLOR = "#b45309"; // amber - distinct from household colors and recommendation pins

function householdColor(index: number): string {
  return HOUSEHOLD_COLORS[index % HOUSEHOLD_COLORS.length];
}

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

function spouseIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      display:flex;align-items:center;justify-content:center;
      width:20px;height:20px;border-radius:9999px;
      background:${color};color:white;font-size:9px;font-weight:700;
      border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.35);
    ">${label}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  });
}

function midpointIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;background:${MIDPOINT_COLOR};
      transform:rotate(45deg);
      border:2.5px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
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

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 11);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
  }, [map, points]);
  return null;
}

interface LocationsMapProps {
  locations: LocationRecommendation[];
  householdWorkplaces?: HouseholdWorkplaces[] | null;
  combinedWorkplaceMidpoint?: { lat: number; lon: number } | null;
}

export default function LocationsMap({
  locations,
  householdWorkplaces,
  combinedWorkplaceMidpoint,
}: LocationsMapProps) {
  const pins = useMemo(() => computeDisplayPins(locations), [locations]);
  const workplaces = useMemo(() => householdWorkplaces ?? [], [householdWorkplaces]);
  const midpoint = combinedWorkplaceMidpoint ?? null;

  const allPoints = useMemo<[number, number][]>(() => {
    const points: [number, number][] = pins.map((p) => p.position);
    for (const hh of workplaces) {
      if (hh.spouse1Point) points.push([hh.spouse1Point.lat, hh.spouse1Point.lon]);
      if (hh.spouse2Point) points.push([hh.spouse2Point.lat, hh.spouse2Point.lon]);
    }
    if (midpoint) points.push([midpoint.lat, midpoint.lon]);
    return points;
  }, [pins, workplaces, midpoint]);

  const center = useMemo<[number, number]>(() => {
    if (allPoints.length === 0) return OKC_METRO_CENTER;
    const lat = allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length;
    const lon = allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length;
    return [lat, lon];
  }, [allPoints]);

  if (allPoints.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-400">
        Map unavailable - locations could not be geocoded.
      </div>
    );
  }

  const hasWorkplaces = workplaces.some((hh) => hh.spouse1Point || hh.spouse2Point);

  return (
    <div className="space-y-2">
      <div className="h-80 overflow-hidden rounded-2xl border border-stone-200 shadow-sm">
        <MapContainer center={center} zoom={9} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds points={allPoints} />

          {pins.map(({ location, position, nudged }) => (
            <Marker key={`loc-${location.rank}`} position={position} icon={markerIcon(location.rank)}>
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

          {workplaces.map((hh, i) => {
            const color = householdColor(i);
            return (
              <Fragment key={hh.householdId}>
                {hh.spouse1Point && (
                  <Marker position={[hh.spouse1Point.lat, hh.spouse1Point.lon]} icon={spouseIcon(color, "S1")}>
                    <Popup>
                      <span className="font-medium">{hh.householdName}</span>
                      <br />
                      Spouse 1 workplace
                    </Popup>
                  </Marker>
                )}
                {hh.spouse2Point && (
                  <Marker position={[hh.spouse2Point.lat, hh.spouse2Point.lon]} icon={spouseIcon(color, "S2")}>
                    <Popup>
                      <span className="font-medium">{hh.householdName}</span>
                      <br />
                      Spouse 2 workplace
                    </Popup>
                  </Marker>
                )}
                {midpoint && hh.spouse1Point && (
                  <Polyline
                    positions={[
                      [hh.spouse1Point.lat, hh.spouse1Point.lon],
                      [midpoint.lat, midpoint.lon],
                    ]}
                    pathOptions={{ color, weight: 2, dashArray: "4 4" }}
                  />
                )}
                {midpoint && hh.spouse2Point && (
                  <Polyline
                    positions={[
                      [hh.spouse2Point.lat, hh.spouse2Point.lon],
                      [midpoint.lat, midpoint.lon],
                    ]}
                    pathOptions={{ color, weight: 2, dashArray: "4 4" }}
                  />
                )}
              </Fragment>
            );
          })}

          {midpoint && (
            <Marker position={[midpoint.lat, midpoint.lon]} icon={midpointIcon()}>
              <Popup>
                <span className="font-medium">Combined workplace midpoint</span>
                <br />
                The geographic center of every spouse&apos;s workplace across all households.
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {hasWorkplaces && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-stone-600" />
            Recommended area
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-stone-400" />
            Spouse workplace (S1/S2), colored by household
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rotate-45"
              style={{ backgroundColor: MIDPOINT_COLOR }}
            />
            Combined midpoint (all households)
          </span>
        </div>
      )}
    </div>
  );
}
