import { strFromU8, unzipSync } from "fflate";
import type { PublicDataSnapshot } from "../lib/public-data";

export const censusGeographySource =
  "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2025.html";

const placeArchive =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_place_national.zip";
const metroArchive =
  "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_cbsa_national.zip";

function normalize(value: string) {
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

async function archiveText(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  const archive = unzipSync(new Uint8Array(await response.arrayBuffer()));
  const file = Object.entries(archive).find(([name]) => name.endsWith(".txt"));
  if (!file)
    throw new Error("Census Gazetteer archive contained no text file.");
  return strFromU8(file[1]);
}

function rows(text: string) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split("|");
  return lines.map((line) =>
    Object.fromEntries(
      line.split("|").map((value, index) => [columns[index], value.trim()]),
    ),
  );
}

export async function fetchCensusGeography(
  locations: Array<{ city: string; state: string }>,
): Promise<NonNullable<PublicDataSnapshot["geography"]>> {
  const wantedPlaces = new Set(
    locations
      .filter((location) => location.city && location.state)
      .map(
        (location) =>
          `${location.state.toLocaleUpperCase()}:${normalize(location.city)}`,
      ),
  );
  const [placeText, metroText] = await Promise.all([
    archiveText(placeArchive),
    archiveText(metroArchive),
  ]);
  const places = rows(placeText)
    .filter((row) => wantedPlaces.has(`${row.USPS}:${normalize(row.NAME)}`))
    .map((row) => ({
      id: row.GEOID,
      name: row.NAME,
      state: row.USPS,
      latitude: Number(row.INTPTLAT),
      longitude: Number(row.INTPTLONG),
    }))
    .filter(
      (place) =>
        Number.isFinite(place.latitude) && Number.isFinite(place.longitude),
    )
    .sort(
      (left, right) =>
        left.state.localeCompare(right.state) ||
        left.name.localeCompare(right.name),
    );
  const metros = rows(metroText)
    .filter((row) => row.CBSA_TYPE === "1")
    .map((row) => ({
      id: row.GEOID,
      name: row.NAME.replace(/\s+Metro Area$/i, ""),
      type: "Metropolitan Statistical Area" as const,
      latitude: Number(row.INTPTLAT),
      longitude: Number(row.INTPTLONG),
    }))
    .filter(
      (metro) =>
        Number.isFinite(metro.latitude) && Number.isFinite(metro.longitude),
    )
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    updatedAt: new Date().toISOString(),
    sourceUrl: censusGeographySource,
    places,
    metros,
  };
}
