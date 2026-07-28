import type { PublicDataSnapshot } from "./public-data";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type SavedTerritory = {
  id: string;
  name: string;
  metroId: string;
  radiusMiles: number;
  minimumCapital: number;
  alertOnCompletedExits: boolean;
  createdAt: string;
};

function normalizedPlaceName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[.,]/g, " ")
    .replace(
      /\b(city|town|village|borough|municipality|cdp|charter township|township)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function findPlaceCoordinates(
  geography: PublicDataSnapshot["geography"],
  city: string,
  state: string,
): Coordinates | null {
  if (!geography || !city || !state) return null;
  const cityKey = normalizedPlaceName(city);
  const place = geography.places.find(
    (candidate) =>
      candidate.state.toLocaleUpperCase() === state.toLocaleUpperCase() &&
      normalizedPlaceName(candidate.name) === cityKey,
  );
  return place
    ? { latitude: place.latitude, longitude: place.longitude }
    : null;
}

export function distanceMiles(left: Coordinates, right: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(left.latitude)) *
      Math.cos(radians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function metroCoordinates(
  geography: PublicDataSnapshot["geography"],
  metroId: string,
) {
  const metro = geography?.metros.find((candidate) => candidate.id === metroId);
  return metro
    ? { latitude: metro.latitude, longitude: metro.longitude }
    : null;
}

export function isWithinTerritory(
  coordinates: Coordinates | null,
  geography: PublicDataSnapshot["geography"],
  metroId: string,
  radiusMiles: number,
) {
  const center = metroCoordinates(geography, metroId);
  return Boolean(
    coordinates && center && distanceMiles(coordinates, center) <= radiusMiles,
  );
}

export const territoryStorageKey = "liquidity-radar-territories-v1";
