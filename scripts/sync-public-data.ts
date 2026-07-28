import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import {
  enrichSecFilingLocations,
  fetchCurrentSecFilings,
  fetchSecLiquidityEvidence,
  mergePublicLiquidityEvidence,
  selectLiquidityProfileCoverage,
  type AdviserFirm,
  type FoundationFiling,
  type PublicDataSnapshot,
  type StateAdviserSummary,
  type StateBusinessFormation,
  type StateEconomy,
} from "../lib/public-data";
import { parseFtcExitSignals } from "../lib/exit-signals";
import {
  fetchSecCompletedExits,
  mergeCompletedExits,
  verifiedCompletedExits,
} from "../lib/completed-exits";
import { parseSecInsiderArchive } from "../lib/sec-insider-data";
import { censusGeographySource, fetchCensusGeography } from "./geography-data";
import {
  readChunkedPublicSnapshot,
  writeChunkedPublicSnapshot,
} from "./public-snapshot-files";

const configuredSecUserAgent = process.env.SEC_USER_AGENT;

if (!configuredSecUserAgent || !configuredSecUserAgent.includes("@")) {
  throw new Error(
    "Set SEC_USER_AGENT to a descriptive product name and monitored contact email.",
  );
}
const SEC_USER_AGENT = configuredSecUserAgent;

const sourceUrls = {
  secApi:
    "https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets",
  secCompletedExits:
    "https://www.sec.gov/rules-regulations/staff-guidance/compliance-disclosure-interpretations/exchange-act-form-8-k",
  secInsiderArchives: [
    "https://www.sec.gov/files/datastandardsinnovation/data/insider-transactions-data-sets/2026q2_form345.zip",
    "https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/2026q1_form345.zip",
    "https://www.sec.gov/files/structureddata/data/insider-transactions-data-sets/2025q4_form345.zip",
  ],
  advisers:
    "https://www.sec.gov/data-research/sec-markets-data/information-about-registered-investment-advisers-exempt-reporting-advisers",
  adviserZip:
    "https://www.sec.gov/files/investment/data/other/information-about-registered-investment-advisers-exempt-reporting-advisers/ia07012026.zip",
  foundations:
    "https://www.irs.gov/charities-non-profits/form-990-series-downloads",
  foundationIndex:
    "https://apps.irs.gov/pub/epostcard/990/xml/2026/index_2026.csv",
  census: "https://www.census.gov/econ/bfs/current/index.html",
  censusCsv: "https://www.census.gov/econ/bfs/csv/bfs_monthly.csv",
  bea: "https://www.bea.gov/itable/regional-gdp-and-personal-income",
  beaZip: "https://apps.bea.gov/regional/zip/SQGDP.zip",
  ftc: "https://www.ftc.gov/legal-library/browse/early-termination-notices",
  censusOwners:
    "https://www.census.gov/data/tables/2024/econ/abs/2024-abs-characteristics-of-owners.html",
} as const;

const stateNames: Record<string, string> = {
  AK: "Alaska",
  AL: "Alabama",
  AR: "Arkansas",
  AZ: "Arizona",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  MA: "Massachusetts",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
};

const stateCodesByName = new Map(
  Object.entries(stateNames).map(([code, name]) => [name, code]),
);

function records(csv: string) {
  return parse(csv, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

async function download(url: string, headers: HeadersInit = {}) {
  const response = await fetch(url, {
    headers: { accept: "*/*", ...headers },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  return new Uint8Array(await response.arrayBuffer());
}

async function downloadText(url: string, headers: HeadersInit = {}) {
  return strFromU8(await download(url, headers));
}

function unzipCsv(archive: Uint8Array, filename: (name: string) => boolean) {
  const files = unzipSync(archive);
  const entry = Object.entries(files).find(([name]) => filename(name));
  if (!entry) throw new Error("Expected CSV was not present in the archive.");
  return strFromU8(entry[1]);
}

function numeric(value: string | undefined) {
  const parsed = Number(String(value ?? "").replace(/[,$\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : value;
}

function percentChange(current: number, previous: number) {
  return previous ? Math.round((current / previous - 1) * 100 * 10) / 10 : 0;
}

function monthLabel(year: string, month: string) {
  return `${year}-${String(
    [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ].indexOf(month) + 1,
  ).padStart(2, "0")}`;
}

async function adviserSnapshot() {
  const archive = await download(sourceUrls.adviserZip, {
    "user-agent": SEC_USER_AGENT,
  });
  const csv = unzipCsv(archive, (name) => name.toLowerCase().endsWith(".csv"));
  const rows = records(csv).filter(
    (row) =>
      row["SEC Current Status"] === "Approved" &&
      Boolean(stateNames[row["Main Office State"]]),
  );

  const firms: AdviserFirm[] = rows.map((row) => ({
    crd: row["Organization CRD#"],
    secNumber: row["SEC#"],
    name: row["Primary Business Name"] || row["Legal Name"],
    legalName: row["Legal Name"],
    city: row["Main Office City"],
    state: row["Main Office State"],
    regulatoryAssets: numeric(row["5F(2)(c)"]),
    filingDate: isoDate(row["Latest ADV Filing Date"]),
    website: row["Website Address"],
  }));
  const stateMap = new Map<string, StateAdviserSummary>();
  for (const firm of firms) {
    const current = stateMap.get(firm.state) ?? {
      code: firm.state,
      firms: 0,
      regulatoryAssets: 0,
    };
    current.firms += 1;
    current.regulatoryAssets += firm.regulatoryAssets;
    stateMap.set(firm.state, current);
  }
  return {
    period: "July 2026",
    firmCount: firms.length,
    totalRegulatoryAssets: firms.reduce(
      (total, firm) => total + firm.regulatoryAssets,
      0,
    ),
    latestFilingDate: firms
      .map((firm) => firm.filingDate)
      .sort()
      .at(-1)!,
    topFirms: firms
      .filter((firm) => firm.regulatoryAssets > 0)
      .sort((a, b) => b.regulatoryAssets - a.regulatoryAssets)
      .slice(0, 12),
    states: [...stateMap.values()].sort(
      (a, b) => b.regulatoryAssets - a.regulatoryAssets,
    ),
  };
}

async function foundationSnapshot() {
  const rows = records(await downloadText(sourceUrls.foundationIndex));
  const foundations = rows.filter((row) => row.RETURN_TYPE === "990PF");
  const recentFilings: FoundationFiling[] = foundations
    .sort((a, b) => b.OBJECT_ID.localeCompare(a.OBJECT_ID))
    .slice(0, 16)
    .map((row) => ({
      name: row.TAXPAYER_NAME,
      ein: row.EIN,
      taxPeriod: row.TAX_PERIOD,
      objectId: row.OBJECT_ID,
    }));
  return {
    year: 2026,
    filingCount: foundations.length,
    recentFilings,
  };
}

async function businessFormationSnapshot() {
  const rows = records(await downloadText(sourceUrls.censusCsv));
  const nationalRows = rows.filter(
    (row) =>
      row.sa === "A" &&
      row.naics_sector === "TOTAL" &&
      row.geo === "US" &&
      row.series === "BA_BA",
  );
  const year = nationalRows
    .map((row) => row.year)
    .sort()
    .at(-1)!;
  const nationalApplications = nationalRows.find((row) => row.year === year)!;
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const monthIndex = months.findLastIndex(
    (month) => numeric(nationalApplications[month]) > 0,
  );
  const month = months[monthIndex];
  const previousMonth = months[Math.max(0, monthIndex - 1)];
  const nationalProjected = rows.find(
    (row) =>
      row.sa === "A" &&
      row.naics_sector === "TOTAL" &&
      row.geo === "US" &&
      row.series === "BF_PBF4Q" &&
      row.year === year,
  )!;
  const stateRows = rows.filter(
    (row) =>
      row.sa === "A" &&
      row.naics_sector === "TOTAL" &&
      row.series === "BA_BA" &&
      row.year === year &&
      Boolean(stateNames[row.geo]),
  );
  const states: StateBusinessFormation[] = stateRows.map((row) => {
    const projected = rows.find(
      (candidate) =>
        candidate.sa === "A" &&
        candidate.naics_sector === "TOTAL" &&
        candidate.series === "BF_PBF4Q" &&
        candidate.geo === row.geo &&
        candidate.year === year,
    );
    const current = numeric(row[month]);
    const previous = numeric(row[previousMonth]);
    return {
      code: row.geo,
      name: stateNames[row.geo],
      applications: current,
      projectedFormations: numeric(projected?.[month]),
      monthlyChange: percentChange(current, previous),
    };
  });
  const nationalCurrent = numeric(nationalApplications[month]);
  const nationalPrevious = numeric(nationalApplications[previousMonth]);
  return {
    period: monthLabel(year, month),
    national: {
      applications: nationalCurrent,
      projectedFormations: numeric(nationalProjected[month]),
      monthlyChange: percentChange(nationalCurrent, nationalPrevious),
    },
    states: states.sort((a, b) => b.applications - a.applications),
  };
}

async function regionalEconomySnapshot() {
  const archive = await download(sourceUrls.beaZip);
  const csv = unzipCsv(
    archive,
    (name) => name.startsWith("SQGDP1__ALL_AREAS_") && name.endsWith(".csv"),
  );
  const rows = records(csv).filter(
    (row) => row.LineCode === "1" && stateCodesByName.has(row.GeoName),
  );
  const periods = Object.keys(rows[0])
    .filter((key) => /^\d{4}:Q[1-4]$/.test(key))
    .sort();
  const period = periods.at(-1)!;
  const previousPeriod = periods.at(-2)!;
  const states: StateEconomy[] = rows.map((row) => {
    const current = numeric(row[period]);
    const previous = numeric(row[previousPeriod]);
    return {
      code: stateCodesByName.get(row.GeoName)!,
      name: row.GeoName,
      realGdpMillions: current,
      quarterlyGrowth: percentChange(current, previous),
    };
  });
  return {
    period,
    states: states.sort((a, b) => b.realGdpMillions - a.realGdpMillions),
  };
}

async function existingSnapshot() {
  try {
    return await readChunkedPublicSnapshot(
      path.join(process.cwd(), "public", "data", "public-signals.json"),
    );
  } catch {
    return null;
  }
}

async function insiderHistorySnapshot() {
  const evidence = [];
  for (const url of sourceUrls.secInsiderArchives) {
    try {
      evidence.push(
        parseSecInsiderArchive(
          await download(url, {
            "user-agent": SEC_USER_AGENT,
          }),
        ),
      );
    } catch {
      // The verified checked-in history remains available when SEC bulk data is temporarily unavailable.
    }
  }
  return evidence;
}

async function exitSignalsSnapshot() {
  const pages = await Promise.all(
    Array.from({ length: 5 }, async (_, page) => {
      const suffix = page ? `?page=${page}` : "";
      return downloadText(`${sourceUrls.ftc}${suffix}`, {
        "user-agent": SEC_USER_AGENT,
      });
    }),
  );
  const records = [
    ...new Map(
      pages.flatMap(parseFtcExitSignals).map((record) => [record.id, record]),
    ).values(),
  ]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 100);
  return {
    updatedAt: new Date().toISOString(),
    records,
  };
}

const previousSnapshot = await existingSnapshot();
const [
  secFilings,
  advisers,
  foundations,
  businessFormation,
  regionalEconomy,
  historicalEvidence,
  exitSignals,
] = await Promise.all([
  fetchCurrentSecFilings(SEC_USER_AGENT),
  adviserSnapshot(),
  foundationSnapshot(),
  businessFormationSnapshot(),
  regionalEconomySnapshot(),
  insiderHistorySnapshot(),
  exitSignalsSnapshot().catch(
    () =>
      previousSnapshot?.exitSignals ?? {
        updatedAt: new Date().toISOString(),
        records: [],
      },
  ),
]);

const currentLiquidity = await fetchSecLiquidityEvidence(
  secFilings,
  SEC_USER_AGENT,
);
const currentCompletedExits = await fetchSecCompletedExits(
  secFilings,
  SEC_USER_AGENT,
);
const liquidity = selectLiquidityProfileCoverage(
  mergePublicLiquidityEvidence(
    ...(historicalEvidence.length
      ? historicalEvidence
      : previousSnapshot
        ? [previousSnapshot.liquidity]
        : []),
    currentLiquidity,
  ),
  1500,
);
const locatedAccessions = new Set(
  liquidity.events
    .filter(
      (event) =>
        event.location.city || event.location.state || event.location.country,
    )
    .map((event) => event.accession),
);
const filingsNeedingLocations = secFilings.filter(
  (filing) =>
    (filing.form === "Form 4" || filing.form === "Form 144") &&
    !locatedAccessions.has(filing.accession),
);
const enrichedLocationFilings = await enrichSecFilingLocations(
  filingsNeedingLocations,
  SEC_USER_AGENT,
);
const enrichedLocationByAccession = new Map(
  enrichedLocationFilings
    .filter((filing) => filing.location)
    .map((filing) => [filing.accession, filing]),
);
const locatedSecFilings = secFilings.map(
  (filing) => enrichedLocationByAccession.get(filing.accession) ?? filing,
);
const completedExitRecords = mergeCompletedExits(
  verifiedCompletedExits,
  previousSnapshot?.completedExits?.records ?? [],
  currentCompletedExits,
).slice(0, 250);
const geography = await fetchCensusGeography([
  ...liquidity.events.map((event) => event.location),
  ...completedExitRecords.flatMap((record) => [
    record.location,
    ...record.ownerAttributions.map((owner) => owner.location),
  ]),
]).catch(() => previousSnapshot?.geography);

if (
  secFilings.length < 10 ||
  liquidity.events.length < 5 ||
  completedExitRecords.length < verifiedCompletedExits.length ||
  advisers.firmCount < 10_000 ||
  foundations.filingCount < 10_000 ||
  businessFormation.states.length !== 51 ||
  regionalEconomy.states.length !== 51
) {
  throw new Error("One or more public datasets failed validation.");
}

const generatedAt = new Date().toISOString();
const snapshot: PublicDataSnapshot = {
  generatedAt,
  sources: [
    {
      id: "sec",
      name: "EDGAR insider transactions",
      publisher: "U.S. Securities and Exchange Commission",
      freshness: `${liquidity.coverage?.startDate || "Historical"} to ${liquidity.coverage?.endDate || "current"}`,
      recordCount: liquidity.events.length,
      sourceUrl: sourceUrls.secApi,
      methodology:
        "Quarterly SEC Insider Transactions Data Sets plus exact-form current EDGAR metadata and underlying ownership XML. Completed gross proceeds are recognized only from Form 4 sale transactions with reported shares and price or completed prior sales explicitly disclosed on Form 144. Proposed Form 144 values remain excluded from completed liquidity.",
    },
    {
      id: "sec_exits",
      name: "Completed Form 8-K transactions",
      publisher: "U.S. Securities and Exchange Commission",
      freshness:
        completedExitRecords[0]?.completedAt || "Current Item 2.01 filings",
      recordCount: completedExitRecords.length,
      sourceUrl: sourceUrls.secCompletedExits,
      methodology:
        "Form 8-K Item 2.01 records are treated as completed only because SEC guidance limits the item to consummated significant acquisitions and dispositions. Consideration is retained only when disclosed in the filing. Named-owner proceeds require a linked Form 4, Schedule 13D/G, or explicit seller disclosure; otherwise attribution remains unavailable.",
    },
    {
      id: "adv",
      name: "Form ADV adviser roster",
      publisher: "U.S. Securities and Exchange Commission",
      freshness: advisers.period,
      recordCount: advisers.firmCount,
      sourceUrl: sourceUrls.advisers,
      methodology:
        "Approved SEC-registered advisers with public office and reported regulatory-asset fields. Used only as regional capital-market context; adviser assets are not attributed to the firm or its employees as liquidity.",
    },
    {
      id: "irs",
      name: "Form 990-PF filings",
      publisher: "Internal Revenue Service",
      freshness: "2026 e-file index",
      recordCount: foundations.filingCount,
      sourceUrl: sourceUrls.foundations,
      methodology:
        "Electronically filed private-foundation returns indexed by the IRS. Retained as source context only until return-level asset and cash fields can be verified; no foundation value enters a liquidity estimate.",
    },
    {
      id: "census",
      name: "Business Formation Statistics",
      publisher: "U.S. Census Bureau",
      freshness: businessFormation.period,
      recordCount: businessFormation.states.length,
      sourceUrl: sourceUrls.census,
      methodology:
        "Seasonally adjusted monthly business applications and projected employer formations for every state and D.C.",
    },
    ...(geography
      ? [
          {
            id: "census_geo" as const,
            name: "U.S. place and metro reference points",
            publisher: "U.S. Census Bureau",
            freshness: "2025 Gazetteer",
            recordCount: geography.places.length + geography.metros.length,
            sourceUrl: censusGeographySource,
            methodology:
              "Representative Census Gazetteer coordinates for public SEC care-of cities and metropolitan statistical areas. Radius results measure straight-line distance between public place and metro reference points; they do not imply a residence.",
          },
        ]
      : []),
    {
      id: "bea",
      name: "Regional real GDP",
      publisher: "U.S. Bureau of Economic Analysis",
      freshness: regionalEconomy.period,
      recordCount: regionalEconomy.states.length,
      sourceUrl: sourceUrls.bea,
      methodology:
        "Quarterly state real GDP in millions of chained 2017 dollars, with quarter-over-quarter change calculated by Liquidity Radar.",
    },
    {
      id: "ftc",
      name: "HSR early-termination notices",
      publisher: "Federal Trade Commission",
      freshness: exitSignals.records[0]?.date || "Current public notices",
      recordCount: exitSignals.records.length,
      sourceUrl: sourceUrls.ftc,
      methodology:
        "Recent public HSR early-termination notices identify acquiring parties, acquired parties, and acquired entities. They are deal-watch signals only and do not prove closing, consideration, or personal proceeds.",
    },
  ],
  sec: {
    mode: "snapshot",
    updatedAt: generatedAt,
    filings: locatedSecFilings,
  },
  liquidity,
  exitSignals,
  completedExits: {
    updatedAt: generatedAt,
    records: completedExitRecords,
  },
  geography,
  advisers,
  foundations,
  businessFormation,
  regionalEconomy,
};

const output = path.join(
  process.cwd(),
  "public",
  "data",
  "public-signals.json",
);
await writeChunkedPublicSnapshot(snapshot, output);

console.log(
  JSON.stringify({
    status: "completed",
    output,
    generatedAt,
    records: Object.fromEntries(
      snapshot.sources.map((source) => [source.id, source.recordCount]),
    ),
  }),
);
