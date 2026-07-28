import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import {
  fetchCurrentSecFilings,
  fetchSecLiquidityEvidence,
  type AdviserFirm,
  type FoundationFiling,
  type PublicDataSnapshot,
  type StateAdviserSummary,
  type StateBusinessFormation,
  type StateEconomy,
} from "../lib/public-data";

const configuredSecUserAgent = process.env.SEC_USER_AGENT;

if (!configuredSecUserAgent || !configuredSecUserAgent.includes("@")) {
  throw new Error(
    "Set SEC_USER_AGENT to a descriptive product name and monitored contact email.",
  );
}
const SEC_USER_AGENT = configuredSecUserAgent;

const sourceUrls = {
  secApi:
    "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
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

const [secFilings, advisers, foundations, businessFormation, regionalEconomy] =
  await Promise.all([
    fetchCurrentSecFilings(SEC_USER_AGENT),
    adviserSnapshot(),
    foundationSnapshot(),
    businessFormationSnapshot(),
    regionalEconomySnapshot(),
  ]);

const liquidity = await fetchSecLiquidityEvidence(secFilings, SEC_USER_AGENT);

if (
  secFilings.length < 10 ||
  liquidity.events.length < 5 ||
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
      name: "EDGAR current filings",
      publisher: "U.S. Securities and Exchange Commission",
      freshness: "Near real time",
      recordCount: secFilings.length,
      sourceUrl: sourceUrls.secApi,
      methodology:
        "Exact-form EDGAR metadata plus underlying ownership XML. Completed gross proceeds are recognized only from Form 4 sale transactions with reported shares and price or completed prior sales explicitly disclosed on Form 144. Proposed Form 144 values remain excluded from completed liquidity.",
    },
    {
      id: "adv",
      name: "Form ADV adviser roster",
      publisher: "U.S. Securities and Exchange Commission",
      freshness: advisers.period,
      recordCount: advisers.firmCount,
      sourceUrl: sourceUrls.advisers,
      methodology:
        "Approved SEC-registered advisers with public office and reported regulatory-asset fields.",
    },
    {
      id: "irs",
      name: "Form 990-PF filings",
      publisher: "Internal Revenue Service",
      freshness: "2026 e-file index",
      recordCount: foundations.filingCount,
      sourceUrl: sourceUrls.foundations,
      methodology:
        "Electronically filed private-foundation returns indexed by the IRS. Values are filing metadata, not modeled wealth.",
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
  ],
  sec: {
    mode: "snapshot",
    updatedAt: generatedAt,
    filings: secFilings,
  },
  liquidity,
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
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

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
