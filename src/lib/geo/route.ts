import { GeoPoint } from "./geocode";

export interface DriveInfo {
  minutes: number;
  miles: number;
}

const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

interface OsrmResponse {
  code: string;
  routes?: { duration: number; distance: number }[];
}

export async function getDrivingInfo(from: GeoPoint, to: GeoPoint): Promise<DriveInfo | null> {
  try {
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const res = await fetch(`${OSRM_URL}/${coords}?overview=false`);
    if (!res.ok) return null;
    const data = (await res.json()) as OsrmResponse;
    const route = data.routes?.[0];
    if (data.code !== "Ok" || !route) return null;
    return {
      minutes: Math.round(route.duration / 60),
      miles: Math.round((route.distance / 1609.344) * 10) / 10,
    };
  } catch {
    return null;
  }
}
