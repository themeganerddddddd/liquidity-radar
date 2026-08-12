import fs from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  CHICAGO_PROPERTY_SCHEMA_VERSION,
  DEFAULT_COMMERCIAL_THRESHOLD,
  DEFAULT_RESIDENTIAL_THRESHOLD,
  applyRepeatedSellerHistory,
  chicagoEntityName,
  chicagoPropertyStats,
  clusterCookSales,
  finalizeChicagoRecords,
  literalEntityName,
  mergePtaxTransactions,
  normalizePin,
  propertyMotionEvents,
  type BusinessLicenseRow,
  type BusinessOwnerRow,
  type ChicagoPropertySnapshot,
  type ChicagoPropertySourceHealth,
  type ChicagoSourceRow,
  type CommercialValuation,
  type DuPageParcelRecord,
  type ParcelGeography,
  type PropertyAddress,
  type PropertyTransactionDraft,
} from "../lib/chicago-property";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";

const root = process.cwd();
const dataDirectory = path.join(root, "public", "data");
const snapshotPath = path.join(dataDirectory, "chicago-property.json");
const clientPath = path.join(dataDirectory, "chicago-property-client.json.gz");
const sourceArchivePath = path.join(
  dataDirectory,
  "chicago-property-source-records.json.gz",
);
const motionEventsPath = path.join(
  dataDirectory,
  "chicago-property-motion-events.json",
);
const statePath = path.join(
  dataDirectory,
  "chicago-property-sync-state.json.gz",
);
const legacyStatePath = path.join(
  dataDirectory,
  "chicago-property-sync-state.json",
);
const motionSnapshotPath = path.join(dataDirectory, "money-in-motion.json");
const motionClientSnapshotPath = path.join(
  dataDirectory,
  "money-in-motion-client.json.gz",
);
const generatedAt = new Date().toISOString();
const backfillStart =
  process.env.CHICAGO_PROPERTY_BACKFILL_START || "2022-01-01";
const commercialThreshold = Number(
  process.env.CHICAGO_PROPERTY_COMMERCIAL_THRESHOLD ||
    DEFAULT_COMMERCIAL_THRESHOLD,
);
const residentialThreshold = Number(
  process.env.CHICAGO_PROPERTY_RESIDENTIAL_THRESHOLD ||
    DEFAULT_RESIDENTIAL_THRESHOLD,
);
const minimumSyncIntervalMinutes = Number(
  process.env.CHICAGO_PROPERTY_MIN_SYNC_INTERVAL_MINUTES || 210,
);
const forceSync = process.env.CHICAGO_PROPERTY_FORCE_SYNC === "1";

const SOURCES = {
  cookSales: {
    id: "cook_property_sales",
    name: "Cook County parcel sales",
    publisher: "Cook County Assessor's Office",
    domain: "datacatalog.cookcountyil.gov",
    dataset: "wvhk-k5uv",
    sourceUrl: "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
  },
  ptax: {
    id: "illinois_ptax",
    name: "Illinois PTAX-203 transfer declarations",
    publisher: "Illinois Department of Revenue",
    domain: "data.illinois.gov",
    dataset: "it54-y4c6",
    sourceUrl: "https://data.illinois.gov/d/it54-y4c6",
  },
  transferForms: {
    id: "cook_transfer_forms",
    name: "Cook County and Chicago transfer forms",
    publisher: "Illinois Department of Revenue",
    domain: "data.illinois.gov",
    dataset: "vbnw-q5s8",
    sourceUrl: "https://data.illinois.gov/d/vbnw-q5s8",
  },
  addresses: {
    id: "cook_parcel_addresses",
    name: "Cook County parcel situs addresses",
    publisher: "Cook County Assessor's Office",
    domain: "datacatalog.cookcountyil.gov",
    dataset: "3723-97qp",
    sourceUrl: "https://datacatalog.cookcountyil.gov/d/3723-97qp",
  },
  commercial: {
    id: "cook_commercial_valuation",
    name: "Cook County commercial valuation",
    publisher: "Cook County Assessor's Office",
    domain: "datacatalog.cookcountyil.gov",
    dataset: "csik-bsws",
    sourceUrl: "https://datacatalog.cookcountyil.gov/d/csik-bsws",
  },
  geography: {
    id: "cook_parcel_universe",
    name: "Cook County parcel geography",
    publisher: "Cook County Assessor's Office",
    domain: "datacatalog.cookcountyil.gov",
    dataset: "nj4t-kc8j",
    sourceUrl: "https://datacatalog.cookcountyil.gov/d/nj4t-kc8j",
  },
  dupageParcels: {
    id: "dupage_parcel_gis",
    name: "DuPage County parcel GIS",
    publisher: "DuPage County Information Technology Department, GIS Division",
    domain: "gis.dupageco.org",
    dataset: "DuPage_County_IL/ParcelsWithRealEstateCC/MapServer/0",
    sourceUrl:
      "https://gis.dupageco.org/arcgis/rest/services/DuPage_County_IL/ParcelsWithRealEstateCC/MapServer/0",
  },
  licenses: {
    id: "chicago_business_licenses",
    name: "Chicago business licenses",
    publisher: "City of Chicago",
    domain: "data.cityofchicago.org",
    dataset: "r5kz-chrr",
    sourceUrl: "https://data.cityofchicago.org/d/r5kz-chrr",
  },
  owners: {
    id: "chicago_business_owners",
    name: "Chicago business owners",
    publisher: "City of Chicago",
    domain: "data.cityofchicago.org",
    dataset: "ezma-pppn",
    sourceUrl: "https://data.cityofchicago.org/d/ezma-pppn",
  },
} as const;

type SourceName = keyof typeof SOURCES;

type SyncState = {
  version: 2;
  updatedAt: string;
  backfillStart: string;
  sourceUpdatedAt: Record<string, string>;
  transferUseByDeclaration: Record<string, string>;
  addressesByPin: Record<string, PropertyAddress>;
  geographyByPin: Record<string, ParcelGeography>;
  dupageByPin: Record<string, DuPageParcelRecord>;
  commercialByPin: Record<string, CommercialValuation[]>;
  licensesBySeller: Record<string, BusinessLicenseRow[]>;
  ownersByAccount: Record<string, BusinessOwnerRow[]>;
};

type SourceArchive = {
  schemaVersion: 2;
  retrievedAt: string;
  fieldsPolicy: string;
  cookParcelSales: ChicagoSourceRow[];
  illinoisPtax: ChicagoSourceRow[];
};

type HealthAccumulator = ChicagoPropertySourceHealth & {
  requests: number;
};

function emptyState(): SyncState {
  return {
    version: 2,
    updatedAt: "",
    backfillStart,
    sourceUpdatedAt: {},
    transferUseByDeclaration: {},
    addressesByPin: {},
    geographyByPin: {},
    dupageByPin: {},
    commercialByPin: {},
    licensesBySeller: {},
    ownersByAccount: {},
  };
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function readGzipJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(
      gunzipSync(await fs.readFile(filePath)).toString("utf8"),
    ) as T;
  } catch {
    return fallback;
  }
}

const health = new Map<SourceName, HealthAccumulator>();
for (const [key, source] of Object.entries(SOURCES) as Array<
  [SourceName, (typeof SOURCES)[SourceName]]
>) {
  health.set(key, {
    id: source.id,
    name: source.name,
    publisher: source.publisher,
    status: "LIVE",
    sourceUrl: source.sourceUrl,
    lastAttemptAt: generatedAt,
    lastSuccessAt: "",
    watermark: "",
    rowsFetched: 0,
    recordsCreated: 0,
    matches: 0,
    matchRate: 0,
    errors: [],
    requests: 0,
  });
}

function sourceHealth(name: SourceName) {
  return health.get(name)!;
}

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function escapeSoda(value: string) {
  return value.replaceAll("'", "''");
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchWithRetry(url: string, attempts = 4) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "LiquidityRadar/0.3 public-record-sync",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.ok) return response;
      if (![429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(`HTTP_${response.status}`);
      }
      const retryAfter = Number(response.headers.get("retry-after") || 0);
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          retryAfter ? retryAfter * 1_000 : 750 * 2 ** attempt,
        ),
      );
      lastError = new Error(`HTTP_${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts)
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchMetadata(name: SourceName) {
  const source = SOURCES[name];
  const accumulator = sourceHealth(name);
  accumulator.requests += 1;
  try {
    const response = await fetchWithRetry(
      name === "dupageParcels"
        ? `https://${source.domain}/arcgis/rest/services/${source.dataset}?f=json`
        : `https://${source.domain}/api/views/${source.dataset}`,
    );
    const payload = (await response.json()) as {
      rowsUpdatedAt?: number;
      rowsUpdatedBy?: string;
      currentVersion?: number;
      editingInfo?: { lastEditDate?: number };
    };
    const watermark = payload.rowsUpdatedAt
      ? new Date(payload.rowsUpdatedAt * 1_000).toISOString()
      : payload.editingInfo?.lastEditDate
        ? new Date(payload.editingInfo.lastEditDate).toISOString()
        : name === "dupageParcels"
          ? `arcgis-${payload.currentVersion || "live"}`
          : "";
    accumulator.watermark = watermark;
    accumulator.lastSuccessAt = generatedAt;
    return watermark;
  } catch (error) {
    accumulator.status = "DEGRADED";
    accumulator.errors.push(
      error instanceof Error ? error.message : String(error),
    );
    return "";
  }
}

async function fetchSodaPage(
  name: SourceName,
  query: {
    select: string;
    where?: string;
    order?: string;
    limit: number;
    offset: number;
  },
) {
  const source = SOURCES[name];
  const parameters = new URLSearchParams({
    $select: query.select,
    $limit: String(query.limit),
    $offset: String(query.offset),
  });
  if (query.where) parameters.set("$where", query.where);
  if (query.order) parameters.set("$order", query.order);
  const accumulator = sourceHealth(name);
  accumulator.requests += 1;
  const response = await fetchWithRetry(
    `https://${source.domain}/resource/${source.dataset}.json?${parameters}`,
  );
  const rows = (await response.json()) as ChicagoSourceRow[];
  accumulator.rowsFetched += rows.length;
  accumulator.lastSuccessAt = generatedAt;
  return rows;
}

async function fetchSodaAll(
  name: SourceName,
  input: { select: string; where?: string; order?: string; pageSize?: number },
) {
  const pageSize = input.pageSize || 5_000;
  const rows: ChicagoSourceRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchSodaPage(name, {
      ...input,
      limit: pageSize,
      offset,
    });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function overlapTimestamp(value: string, days = 7) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp - days * 86_400_000).toISOString()
    : "";
}

function mergeSourceRows(
  previous: ChicagoSourceRow[],
  changedRows: ChicagoSourceRow[],
  keyFor: (row: ChicagoSourceRow) => string,
) {
  const merged = new Map<string, ChicagoSourceRow>();
  for (const row of [...previous, ...changedRows]) {
    const key = keyFor(row);
    if (key) merged.set(key, row);
  }
  return [...merged.values()];
}

async function fetchCookSales(since = "") {
  const where = [
    `sale_date >= '${backfillStart}T00:00:00'`,
    `sale_price >= ${commercialThreshold}`,
    since ? `:updated_at >= '${since}'` : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  return fetchSodaAll("cookSales", {
    select:
      ":id,:updated_at,pin,year,township_code,nbhd,class,sale_date,sale_price,doc_no,deed_type,mydec_deed_type,seller_name,buyer_name,is_multisale,num_parcels_sale,sale_type,sale_filter_same_sale_within_365,sale_filter_less_than_10k,sale_filter_deed_type,row_id",
    where,
    order: "sale_date DESC,:id",
  });
}

async function fetchPtax(since = "") {
  const where = [
    `date_recorded >= '${backfillStart}T00:00:00'`,
    "line_1_county IN ('Cook','DuPage')",
    `line_11_full_consideration >= ${commercialThreshold}`,
    since ? `:updated_at >= '${since}'` : "",
  ]
    .filter(Boolean)
    .join(" AND ");
  return fetchSodaAll("ptax", {
    select:
      ":id,:updated_at,declaration_id,document_number,date_recorded,full_address,line_1_street,line_1_city,line_1_zip_code,line_1_county,line_1_primary_pin,line_2_total_parcels,line_3_additional_pins,line_5_instrument_type,line_5_other_instrument_type,line_8_current_use,line_8_current_number_of,line_8_current_commercial,line_8_current_other,line_8_current_other_use,line_8_intended_use,line_8_intended_number_of,line_8_intended_commercial,line_8_intended_other,line_8_intended_other_use,line_10b_sale_between_related,line_10c_transfer_of_100,line_10d_court_ordered_sale,line_10e_sale_in_lieu_of,line_10f_condemnation,line_10g_short_sale,line_10h_bank_reo,line_10i_auction_sale,line_10j_seller_buyer_is,line_10k_seller_buyer_is,line_10p_trade_of_property,line_10q_sale_leaseback,line_11_full_consideration,line_13_net_consideration,line_17_net_consideration,step_4_seller_name,step_4_seller_organization,additional_sellers,step_4_buyer_name,step_4_buyer_organization,additional_buyers,ptax_203_a_attached,_203_a_line_1_street,_203_a_line_1_city,_203_a_line_2_primary_pin,_203_a_line_5_property_1,_203_a_line_5_property_1_1,_203_a_line_5_property_1_2,_203_a_line_5_property_2,_203_a_line_5_property_2_1,_203_a_line_5_property_2_2,ptax_203_b_attached,_203_b_line_1_street,_203_b_line_1_city,_203_b_line_2_primary_pin,_203_b_line_3_controlling,_203_b_line_11a_full,_203_b_line_13_consideration,_203_b_line_17_taxable_value",
    where,
    order: "date_recorded DESC,declaration_id",
  });
}

function draftPriority(draft: PropertyTransactionDraft) {
  const value = draft.ptaxFullConsideration ?? draft.cookSalePrice ?? 0;
  const timestamp = Date.parse(`${draft.saleDate || backfillStart}T00:00:00Z`);
  return (Number.isFinite(timestamp) ? timestamp : 0) / 10_000 + value;
}

function priorityDrafts(drafts: PropertyTransactionDraft[], limit: number) {
  return [...drafts]
    .sort((left, right) => draftPriority(right) - draftPriority(left))
    .slice(0, limit);
}

function duPageGeometryCenter(geometry: unknown) {
  const rings = (geometry as { rings?: number[][][] } | null)?.rings || [];
  const points = rings
    .flat()
    .filter(
      (point) =>
        Array.isArray(point) &&
        Number.isFinite(point[0]) &&
        Number.isFinite(point[1]),
    );
  if (!points.length) return { latitude: null, longitude: null };
  return {
    latitude: points.reduce((sum, point) => sum + point[1], 0) / points.length,
    longitude: points.reduce((sum, point) => sum + point[0], 0) / points.length,
  };
}

async function fetchDuPageParcels(pins: string[]) {
  const source = SOURCES.dupageParcels;
  const parameters = new URLSearchParams({
    where: `PIN IN (${pins
      .map((pin) => `'${escapeSoda(pin.slice(-10))}'`)
      .join(",")})`,
    outFields: "PIN,PROPADDRL1,PROPCITY,PROPZIP,REA017_PROP_CLASS",
    returnGeometry: "true",
    outSR: "4326",
    f: "json",
  });
  const accumulator = sourceHealth("dupageParcels");
  accumulator.requests += 1;
  const response = await fetchWithRetry(
    `https://${source.domain}/arcgis/rest/services/${source.dataset}/query?${parameters}`,
  );
  const payload = (await response.json()) as {
    error?: { message?: string };
    features?: Array<{
      attributes?: Record<string, unknown>;
      geometry?: unknown;
    }>;
  };
  if (payload.error)
    throw new Error(payload.error.message || "DuPage ArcGIS query failed");
  const features = payload.features || [];
  accumulator.rowsFetched += features.length;
  accumulator.lastSuccessAt = generatedAt;
  return features;
}

async function enrichDuPageParcels(
  state: SyncState,
  drafts: PropertyTransactionDraft[],
) {
  const duPageDrafts = priorityDrafts(
    drafts.filter((draft) => draft.county === "DuPage"),
    7_500,
  );
  const pins = [
    ...new Set(
      duPageDrafts
        .filter(
          (draft) =>
            (draft.ptaxFullConsideration ?? 0) >= commercialThreshold ||
            !draft.address ||
            !draft.city,
        )
        .flatMap((draft) => draft.pins),
    ),
  ].filter((pin) => !(pin in state.dupageByPin));
  for (const group of chunks(pins, 120)) {
    try {
      const features = await fetchDuPageParcels(group);
      const found = new Set<string>();
      for (const feature of features) {
        const attributes = feature.attributes || {};
        const pin = normalizePin(attributes.PIN);
        if (!pin) continue;
        found.add(pin);
        const center = duPageGeometryCenter(feature.geometry);
        state.dupageByPin[pin] = {
          pin,
          address: stringValue(attributes.PROPADDRL1),
          city: stringValue(attributes.PROPCITY),
          zip: stringValue(attributes.PROPZIP).slice(0, 5),
          propertyClass: stringValue(attributes.REA017_PROP_CLASS),
          latitude: center.latitude,
          longitude: center.longitude,
          retrievedAt: generatedAt,
        };
      }
      for (const pin of group) {
        if (found.has(pin)) continue;
        state.dupageByPin[pin] = {
          pin,
          address: "",
          city: "",
          zip: "",
          propertyClass: "",
          latitude: null,
          longitude: null,
          retrievedAt: generatedAt,
        };
      }
    } catch (error) {
      const accumulator = sourceHealth("dupageParcels");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  sourceHealth("dupageParcels").matches = Object.values(
    state.dupageByPin,
  ).filter((row) => row.address || row.latitude !== null).length;
}

async function enrichTransferForms(
  state: SyncState,
  drafts: PropertyTransactionDraft[],
) {
  const ids = [
    ...new Set(
      priorityDrafts(drafts, 3_000).flatMap((draft) => draft.declarationIds),
    ),
  ].filter((id) => !(id in state.transferUseByDeclaration));
  for (const group of chunks(ids, 120)) {
    const where = `declaration_id IN (${group
      .map((id) => `'${escapeSoda(id)}'`)
      .join(",")})`;
    try {
      const rows = await fetchSodaAll("transferForms", {
        select:
          "declaration_id,county_form_property_use,county_form_other_property,county_form_other_property_1,chicago_form_property_type,chicago_form_property_type_1,chicago_form_property_type_2,chicago_form_property_type_3,chicago_form_property_type_4,chicago_form_use_type,chicago_form_use_type_1,chicago_form_use_type_2",
        where,
      });
      const found = new Set<string>();
      for (const row of rows) {
        const id = stringValue(row.declaration_id);
        found.add(id);
        state.transferUseByDeclaration[id] = [
          row.county_form_property_use,
          row.county_form_other_property,
          row.county_form_other_property_1,
          row.chicago_form_property_type,
          row.chicago_form_property_type_1,
          row.chicago_form_property_type_2,
          row.chicago_form_property_type_3,
          row.chicago_form_property_type_4,
          row.chicago_form_use_type,
          row.chicago_form_use_type_1,
          row.chicago_form_use_type_2,
        ]
          .map(stringValue)
          .filter((value) => value && !/^(?:false|0|n)$/i.test(value))
          .join(" / ");
      }
      for (const id of group)
        if (!found.has(id)) state.transferUseByDeclaration[id] = "";
    } catch (error) {
      const accumulator = sourceHealth("transferForms");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  const matches = Object.values(state.transferUseByDeclaration).filter(
    Boolean,
  ).length;
  sourceHealth("transferForms").matches = matches;
}

function pinsFromCommercialRow(row: ChicagoSourceRow) {
  return [row.keypin, ...stringValue(row.pins).split(/[,;\s]+/)]
    .map(normalizePin)
    .filter(Boolean);
}

async function enrichCommercialValuations(
  state: SyncState,
  relevantPins: Set<string>,
  changed: boolean,
) {
  if (!changed && Object.keys(state.commercialByPin).length) {
    sourceHealth("commercial").matches = Object.keys(
      state.commercialByPin,
    ).filter((pin) => relevantPins.has(pin)).length;
    return;
  }
  try {
    const rows = await fetchSodaAll("commercial", {
      select:
        "keypin,pins,year,class_es,category,property_type_use,property_name_description,address,finalmarketvalue,bldgsf,gross_building_area,tot_units",
      where: "year >= 2022",
      order: "year DESC,keypin",
      pageSize: 10_000,
    });
    const next: Record<string, CommercialValuation[]> = {};
    for (const row of rows) {
      const pins = pinsFromCommercialRow(row).filter((pin) =>
        relevantPins.has(pin),
      );
      if (!pins.length) continue;
      const value: CommercialValuation = {
        pin: pins[0],
        sourceClass: stringValue(row.class_es),
        category: stringValue(row.category),
        propertyUse: stringValue(row.property_type_use),
        propertyDescription: stringValue(row.property_name_description),
        address: stringValue(row.address),
        marketValue: numberValue(row.finalmarketvalue),
        buildingSquareFeet:
          numberValue(row.bldgsf) ?? numberValue(row.gross_building_area),
        units: numberValue(row.tot_units),
      };
      for (const pin of pins) {
        const existing = next[pin] || [];
        if (existing.length < 3) existing.push({ ...value, pin });
        next[pin] = existing;
      }
    }
    state.commercialByPin = next;
    sourceHealth("commercial").matches = Object.keys(next).length;
  } catch (error) {
    const accumulator = sourceHealth("commercial");
    accumulator.status = "DEGRADED";
    accumulator.errors.push(
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function enrichAddresses(
  state: SyncState,
  drafts: PropertyTransactionDraft[],
) {
  const pins = [
    ...new Set(priorityDrafts(drafts, 5_000).flatMap((draft) => draft.pins)),
  ].filter((pin) => !(pin in state.addressesByPin));
  for (const group of chunks(pins, 150)) {
    const where = `year >= 2025 AND pin IN (${group
      .map((pin) => `'${pin}'`)
      .join(",")})`;
    try {
      const rows = await fetchSodaAll("addresses", {
        select:
          "pin,year,prop_address_full,prop_address_city_name,prop_address_state,prop_address_zipcode_1",
        where,
        order: "year DESC",
      });
      const found = new Set<string>();
      for (const row of rows) {
        const pin = normalizePin(row.pin);
        found.add(pin);
        const year = Number(row.year || 0);
        if ((state.addressesByPin[pin]?.year || 0) > year) continue;
        state.addressesByPin[pin] = {
          pin,
          year,
          address: stringValue(row.prop_address_full),
          city: stringValue(row.prop_address_city_name),
          state: stringValue(row.prop_address_state) || "IL",
          zip: stringValue(row.prop_address_zipcode_1).slice(0, 5),
        };
      }
      for (const pin of group) {
        if (!found.has(pin))
          state.addressesByPin[pin] = {
            pin,
            year: 0,
            address: "",
            city: "",
            state: "",
            zip: "",
          };
      }
    } catch (error) {
      const accumulator = sourceHealth("addresses");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  sourceHealth("addresses").matches = Object.values(
    state.addressesByPin,
  ).filter((row) => row.address).length;
}

async function enrichGeography(
  state: SyncState,
  drafts: PropertyTransactionDraft[],
) {
  const pins = [
    ...new Set(priorityDrafts(drafts, 5_000).flatMap((draft) => draft.pins)),
  ].filter((pin) => !(pin in state.geographyByPin));
  for (const group of chunks(pins, 150)) {
    const where = `year >= 2025 AND pin IN (${group
      .map((pin) => `'${pin}'`)
      .join(",")})`;
    try {
      const rows = await fetchSodaAll("geography", {
        select:
          "pin,year,zip_code,lon,lat,cook_municipality_name,tax_municipality_name",
        where,
        order: "year DESC",
      });
      const found = new Set<string>();
      for (const row of rows) {
        const pin = normalizePin(row.pin);
        found.add(pin);
        const year = Number(row.year || 0);
        if ((state.geographyByPin[pin]?.year || 0) > year) continue;
        state.geographyByPin[pin] = {
          pin,
          year,
          city: stringValue(
            row.cook_municipality_name || row.tax_municipality_name,
          ),
          zip: stringValue(row.zip_code).slice(0, 5),
          latitude: numberValue(row.lat),
          longitude: numberValue(row.lon),
        };
      }
      for (const pin of group) {
        if (!found.has(pin))
          state.geographyByPin[pin] = {
            pin,
            year: 0,
            city: "",
            zip: "",
            latitude: null,
            longitude: null,
          };
      }
    } catch (error) {
      const accumulator = sourceHealth("geography");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  sourceHealth("geography").matches = Object.values(
    state.geographyByPin,
  ).filter((row) => row.latitude !== null && row.longitude !== null).length;
}

function licenseRow(row: ChicagoSourceRow): BusinessLicenseRow {
  return {
    accountNumber: stringValue(row.account_number),
    legalName: stringValue(row.legal_name),
    dba: stringValue(row.doing_business_as_name),
    city: stringValue(row.city),
    state: stringValue(row.state),
    zip: stringValue(row.zip_code).slice(0, 5),
    applicationType: stringValue(row.application_type),
    status: stringValue(row.license_status),
    statusChangeDate: stringValue(row.license_status_change_date).slice(0, 10),
    description: stringValue(row.license_description),
  };
}

async function enrichBusinessLicenses(
  state: SyncState,
  drafts: PropertyTransactionDraft[],
) {
  const sellerNames = [
    ...new Set(
      priorityDrafts(drafts, 2_000)
        .map((draft) => literalEntityName(draft.seller))
        .filter(
          (seller) =>
            seller &&
            /\b(?:LLC|INC|CORP|COMPANY|L P|LP|LTD|HOLDINGS|PROPERTIES)\b/.test(
              seller,
            ),
        ),
    ),
  ].filter((seller) => !(seller in state.licensesBySeller));
  for (const group of chunks(sellerNames, 20)) {
    const values = group.map((seller) => `'${escapeSoda(seller)}'`).join(",");
    const where = `upper(legal_name) IN (${values}) OR upper(doing_business_as_name) IN (${values})`;
    try {
      const rows = await fetchSodaAll("licenses", {
        select:
          "account_number,legal_name,doing_business_as_name,city,state,zip_code,application_type,license_status,license_status_change_date,license_description",
        where,
        order: "license_status_change_date DESC",
        pageSize: 10_000,
      });
      const normalizedRows = rows.map(licenseRow);
      for (const seller of group) {
        const sellerEntity = chicagoEntityName(seller);
        state.licensesBySeller[seller] = normalizedRows.filter(
          (license) =>
            [
              literalEntityName(license.legalName),
              literalEntityName(license.dba),
            ].includes(seller) ||
            [
              chicagoEntityName(license.legalName),
              chicagoEntityName(license.dba),
            ].includes(sellerEntity),
        );
      }
    } catch (error) {
      const accumulator = sourceHealth("licenses");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  sourceHealth("licenses").matches = Object.values(
    state.licensesBySeller,
  ).filter((rows) => rows.length).length;
}

function ownerRow(row: ChicagoSourceRow): BusinessOwnerRow {
  return {
    accountNumber: stringValue(row.account_number),
    dba: stringValue(row.doing_business_as_name),
    firstName: stringValue(row.owner_first_name),
    middleInitial: stringValue(row.owner_middle_initial),
    lastName: stringValue(row.owner_last_name),
    suffix: stringValue(row.owner_name_suffix),
    entityName: stringValue(row.owner_name),
    title: stringValue(row.owner_title),
  };
}

async function enrichBusinessOwners(state: SyncState) {
  const accounts = [
    ...new Set(
      Object.values(state.licensesBySeller)
        .flat()
        .map((license) => license.accountNumber)
        .filter(Boolean),
    ),
  ].filter((account) => !(account in state.ownersByAccount));
  for (const group of chunks(accounts, 150)) {
    const where = `account_number IN (${group
      .map((account) => `'${escapeSoda(account)}'`)
      .join(",")})`;
    try {
      const rows = await fetchSodaAll("owners", {
        select:
          "account_number,doing_business_as_name,owner_first_name,owner_middle_initial,owner_last_name,owner_name_suffix,owner_name,owner_title",
        where,
        pageSize: 10_000,
      });
      const normalizedRows = rows.map(ownerRow);
      for (const account of group) {
        state.ownersByAccount[account] = normalizedRows.filter(
          (owner) => owner.accountNumber === account,
        );
      }
    } catch (error) {
      const accumulator = sourceHealth("owners");
      accumulator.status = "DEGRADED";
      accumulator.errors.push(
        error instanceof Error ? error.message : String(error),
      );
      break;
    }
  }
  sourceHealth("owners").matches = Object.values(state.ownersByAccount).filter(
    (rows) => rows.length,
  ).length;
}

function allLicenses(state: SyncState) {
  return [
    ...new Map(
      Object.values(state.licensesBySeller)
        .flat()
        .map((license) => [
          [
            license.accountNumber,
            literalEntityName(license.legalName),
            literalEntityName(license.dba),
            license.status,
            license.statusChangeDate,
            license.description,
          ].join(":"),
          license,
        ]),
    ).values(),
  ];
}

function allOwners(state: SyncState) {
  return Object.values(state.ownersByAccount).flat();
}

function finishHealth(
  sourceName: SourceName,
  recordCount: number,
  state: SyncState,
) {
  const accumulator = sourceHealth(sourceName);
  accumulator.recordsCreated = recordCount;
  accumulator.matchRate = recordCount
    ? Number((accumulator.matches / recordCount).toFixed(4))
    : 0;
  accumulator.watermark ||= state.sourceUpdatedAt[SOURCES[sourceName].id] || "";
  if (!accumulator.lastSuccessAt && !accumulator.errors.length)
    accumulator.lastSuccessAt = state.updatedAt;
  if (accumulator.errors.length && accumulator.status === "LIVE")
    accumulator.status = "DEGRADED";
}

async function main() {
  await fs.mkdir(dataDirectory, { recursive: true });
  const [
    compressedState,
    legacyState,
    existingSnapshot,
    existingArchive,
    rawMotionSnapshot,
    clientMotionSnapshot,
  ] = await Promise.all([
    readGzipJson<SyncState | null>(statePath, null),
    readJson<SyncState | null>(legacyStatePath, null),
    readGzipJson<ChicagoPropertySnapshot | null>(clientPath, null),
    readGzipJson<SourceArchive | null>(sourceArchivePath, null),
    readJson<MoneyMotionSnapshot | null>(motionSnapshotPath, null),
    readGzipJson<MoneyMotionSnapshot | null>(motionClientSnapshotPath, null),
  ]);
  const motionSnapshot = rawMotionSnapshot || clientMotionSnapshot;
  const state = compressedState || legacyState || emptyState();
  if (state.backfillStart !== backfillStart) {
    Object.assign(state, emptyState());
  }
  state.version = 2;
  state.dupageByPin ||= {};
  const lastCompletedAt = Date.parse(state.updatedAt);
  const snapshotAgeMinutes = Number.isFinite(lastCompletedAt)
    ? (Date.now() - lastCompletedAt) / 60_000
    : Number.POSITIVE_INFINITY;
  if (
    !forceSync &&
    existingSnapshot?.schemaVersion === CHICAGO_PROPERTY_SCHEMA_VERSION &&
    existingArchive?.schemaVersion === 2 &&
    snapshotAgeMinutes >= 0 &&
    snapshotAgeMinutes < minimumSyncIntervalMinutes
  ) {
    console.log(
      `Chicago Metro Property is current (${Math.floor(snapshotAgeMinutes)} minutes old); no source reload required before the next four-hour window.`,
    );
    return;
  }
  const metadataEntries = await Promise.all(
    (Object.keys(SOURCES) as SourceName[]).map(
      async (name) => [name, await fetchMetadata(name)] as const,
    ),
  );
  const changed = new Map(
    metadataEntries.map(([name, watermark]) => [
      name,
      Boolean(
        watermark && watermark !== state.sourceUpdatedAt[SOURCES[name].id],
      ),
    ]),
  );
  try {
    const archiveIsReusable =
      existingArchive?.schemaVersion === 2 &&
      state.backfillStart === backfillStart;
    const [changedCookRows, changedPtaxRows] = await Promise.all([
      archiveIsReusable && !changed.get("cookSales")
        ? Promise.resolve([])
        : fetchCookSales(
            archiveIsReusable
              ? overlapTimestamp(
                  state.sourceUpdatedAt[SOURCES.cookSales.id] || "",
                )
              : "",
          ),
      archiveIsReusable && !changed.get("ptax")
        ? Promise.resolve([])
        : fetchPtax(
            archiveIsReusable
              ? overlapTimestamp(state.sourceUpdatedAt[SOURCES.ptax.id] || "")
              : "",
          ),
    ]);
    const cookRows = archiveIsReusable
      ? mergeSourceRows(
          existingArchive!.cookParcelSales,
          changedCookRows,
          (row) => stringValue(row[":id"] || row.row_id || row.id),
        )
      : changedCookRows;
    const ptaxRows = archiveIsReusable
      ? mergeSourceRows(existingArchive!.illinoisPtax, changedPtaxRows, (row) =>
          stringValue(
            row.declaration_id ||
              row[":id"] ||
              `${row.document_number}:${row.date_recorded}`,
          ),
        )
      : changedPtaxRows;
    const cookDrafts = clusterCookSales(cookRows);
    const drafts = mergePtaxTransactions(cookDrafts, ptaxRows);
    const sourceRowCount = cookRows.length + ptaxRows.length;
    const duplicateTransactionsRemoved = Math.max(
      0,
      sourceRowCount - drafts.length,
    );
    const cookDraftsOnly = drafts.filter((draft) => draft.county === "Cook");
    const relevantPins = new Set(cookDraftsOnly.flatMap((draft) => draft.pins));
    await enrichTransferForms(state, cookDraftsOnly);
    await Promise.all([
      enrichCommercialValuations(
        state,
        relevantPins,
        Boolean(changed.get("commercial")),
      ),
      enrichAddresses(state, cookDraftsOnly),
      enrichGeography(state, cookDraftsOnly),
      enrichDuPageParcels(state, drafts),
      enrichBusinessLicenses(
        state,
        cookDraftsOnly.filter(
          (draft) => draft.county === "Cook" || /^chicago$/i.test(draft.city),
        ),
      ),
    ]);
    await enrichBusinessOwners(state);
    const finalized = finalizeChicagoRecords({
      drafts,
      addressesByPin: state.addressesByPin,
      geographyByPin: state.geographyByPin,
      dupageByPin: state.dupageByPin,
      commercialByPin: state.commercialByPin,
      transferFormUseByDeclaration: state.transferUseByDeclaration,
      licenses: allLicenses(state),
      owners: allOwners(state),
      motionRecords: motionSnapshot?.records || [],
      generatedAt,
      commercialThreshold,
      residentialThreshold,
    });
    const records = applyRepeatedSellerHistory(finalized.records).sort(
      (left, right) =>
        right.transaction.saleDate.localeCompare(left.transaction.saleDate) ||
        right.exitConvergence.score - left.exitConvergence.score ||
        (right.transaction.displayValueHigh || 0) -
          (left.transaction.displayValueHigh || 0),
    );
    sourceHealth("cookSales").matches = records.filter((record) =>
      record.evidence.some(
        (evidence) => evidence.sourceId === "cook_property_sales",
      ),
    ).length;
    sourceHealth("ptax").matches = records.filter((record) =>
      record.evidence.some((evidence) => evidence.sourceId === "illinois_ptax"),
    ).length;
    for (const [name, watermark] of metadataEntries) {
      if (watermark) state.sourceUpdatedAt[SOURCES[name].id] = watermark;
    }
    state.updatedAt = generatedAt;
    state.backfillStart = backfillStart;
    for (const name of Object.keys(SOURCES) as SourceName[]) {
      finishHealth(name, records.length, state);
    }
    const dates = records
      .map((record) => record.transaction.saleDate)
      .filter(Boolean);
    const snapshot: ChicagoPropertySnapshot = {
      schemaVersion: CHICAGO_PROPERTY_SCHEMA_VERSION,
      generatedAt,
      coverage: {
        startDate: dates.length
          ? dates.reduce((left, right) => (left < right ? left : right))
          : "",
        endDate: dates.length
          ? dates.reduce((left, right) => (left > right ? left : right))
          : "",
      },
      thresholds: {
        commercial: commercialThreshold,
        largeResidential: residentialThreshold,
      },
      disclaimer:
        "Recorded sale consideration is not net cash received. Debt, liens, taxes, transaction expenses, co-ownership, exchanges, and reinvestment may be unknown. Owner mailing addresses are excluded.",
      stats: chicagoPropertyStats({
        records,
        duplicateTransactionsRemoved,
        nonMarketTransfersExcluded: finalized.nonMarketTransfersExcluded,
      }),
      records,
      sourceHealth: [...health.values()].map(
        (entry) =>
          Object.fromEntries(
            Object.entries(entry).filter(([key]) => key !== "requests"),
          ) as ChicagoPropertySourceHealth,
      ),
    };
    const sourceArchive: SourceArchive = {
      schemaVersion: 2,
      retrievedAt: generatedAt,
      fieldsPolicy:
        "Selected Cook County, DuPage County, and Illinois source fields required for transaction evidence; owner mailing addresses are never collected.",
      cookParcelSales: cookRows,
      illinoisPtax: ptaxRows,
    };
    const motionEvents = propertyMotionEvents(records, generatedAt);
    await Promise.all([
      fs.writeFile(snapshotPath, `${JSON.stringify(snapshot)}\n`, "utf8"),
      fs.writeFile(
        clientPath,
        gzipSync(JSON.stringify(snapshot), { level: 9 }),
      ),
      fs.writeFile(
        sourceArchivePath,
        gzipSync(JSON.stringify(sourceArchive), { level: 9 }),
      ),
      fs.writeFile(
        motionEventsPath,
        `${JSON.stringify({ generatedAt, events: motionEvents })}\n`,
        "utf8",
      ),
      fs.writeFile(statePath, gzipSync(JSON.stringify(state), { level: 9 })),
    ]);
    console.log(
      `Chicago Metro Property: ${records.length.toLocaleString()} significant transactions (${snapshot.stats.cookSales.toLocaleString()} Cook, ${snapshot.stats.dupageSales.toLocaleString()} DuPage; ${snapshot.stats.commercialSales.toLocaleString()} commercial, ${snapshot.stats.largeResidentialSales.toLocaleString()} large residential), ${snapshot.stats.crossCountySellerEntities.toLocaleString()} cross-county sellers, ${snapshot.stats.personResolvedTransactions.toLocaleString()} person-resolved, ${motionEvents.length.toLocaleString()} promoted capital events.`,
    );
  } catch (error) {
    if (existingSnapshot) {
      console.warn(
        `Chicago Property refresh failed; preserving ${existingSnapshot.records.length.toLocaleString()} existing records: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    throw error;
  }
}

await main();
