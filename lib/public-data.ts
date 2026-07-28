export type PublicSourceStatus = {
  id: "sec" | "adv" | "irs" | "census" | "bea";
  name: string;
  publisher: string;
  freshness: string;
  recordCount: number;
  sourceUrl: string;
  methodology: string;
};

export type SecFiling = {
  accession: string;
  form: string;
  filedAt: string;
  updatedAt: string;
  issuer: string;
  reportingParty: string;
  url: string;
};

export type AdviserFirm = {
  crd: string;
  secNumber: string;
  name: string;
  legalName: string;
  city: string;
  state: string;
  regulatoryAssets: number;
  filingDate: string;
  website: string;
};

export type StateAdviserSummary = {
  code: string;
  firms: number;
  regulatoryAssets: number;
};

export type FoundationFiling = {
  name: string;
  ein: string;
  taxPeriod: string;
  objectId: string;
};

export type StateBusinessFormation = {
  code: string;
  name: string;
  applications: number;
  projectedFormations: number;
  monthlyChange: number;
};

export type StateEconomy = {
  code: string;
  name: string;
  realGdpMillions: number;
  quarterlyGrowth: number;
};

export type PublicDataSnapshot = {
  generatedAt: string;
  sources: PublicSourceStatus[];
  sec: {
    mode: "live" | "snapshot";
    updatedAt: string;
    filings: SecFiling[];
  };
  advisers: {
    period: string;
    firmCount: number;
    totalRegulatoryAssets: number;
    latestFilingDate: string;
    topFirms: AdviserFirm[];
    states: StateAdviserSummary[];
  };
  foundations: {
    year: number;
    filingCount: number;
    recentFilings: FoundationFiling[];
  };
  businessFormation: {
    period: string;
    national: {
      applications: number;
      projectedFormations: number;
      monthlyChange: number;
    };
    states: StateBusinessFormation[];
  };
  regionalEconomy: {
    period: string;
    states: StateEconomy[];
  };
};

const secForms = [
  { query: "4", label: "Form 4" },
  { query: "144", label: "Form 144" },
  { query: "8-K", label: "Form 8-K" },
  { query: "SC 13D", label: "Schedule 13D" },
  { query: "SC 13G", label: "Schedule 13G" },
] as const;

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]) : "";
}

function attributeValue(xml: string, tag: string, attribute: string) {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*\\s${attribute}="([^"]+)"[^>]*\\/?>`),
  );
  return match ? decodeXml(match[1]) : "";
}

function parseEntry(
  entry: string,
  formLabel: string,
): SecFiling & { role: string; entity: string } {
  const title = tagValue(entry, "title");
  const summary = tagValue(entry, "summary");
  const id = tagValue(entry, "id");
  const link = attributeValue(entry, "link", "href");
  const titleMatch = title.match(
    /^(?:[^-]+?)\s+-\s+(.+?)\s+\((\d+)\)(?:\s+\((Issuer|Reporting)\))?$/,
  );
  const accession =
    id.match(/accession-number=([0-9-]+)/)?.[1] ??
    link.match(/([0-9]{10}-[0-9]{2}-[0-9]{6})/)?.[1] ??
    id;
  return {
    accession,
    form: formLabel,
    filedAt: summary.match(/Filed:<\/b>\s*([0-9-]+)/i)?.[1] ?? "",
    updatedAt: tagValue(entry, "updated"),
    issuer: "",
    reportingParty: "",
    url: link,
    role: titleMatch?.[3] ?? "",
    entity: titleMatch?.[1] ?? title.replace(/^[^-]+-\s*/, ""),
  };
}

export function parseSecAtom(xml: string, formLabel: string) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((match) =>
    parseEntry(match[1], formLabel),
  );
}

export async function fetchCurrentSecFilings(
  userAgent: string,
  signal?: AbortSignal,
): Promise<SecFiling[]> {
  const responses = await Promise.all(
    secForms.map(async ({ query, label }) => {
      const url = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
      url.searchParams.set("action", "getcurrent");
      url.searchParams.set("type", query);
      url.searchParams.set("company", "");
      url.searchParams.set("dateb", "");
      url.searchParams.set("owner", "include");
      url.searchParams.set("start", "0");
      url.searchParams.set("count", "40");
      url.searchParams.set("output", "atom");
      const response = await fetch(url, {
        headers: {
          accept: "application/atom+xml, application/xml;q=0.9",
          "user-agent": userAgent,
        },
        signal,
      });
      if (!response.ok) {
        throw new Error(`SEC ${label} feed returned ${response.status}.`);
      }
      return parseSecAtom(await response.text(), label);
    }),
  );

  const merged = new Map<
    string,
    SecFiling & { issuerFallback?: string; reporterFallback?: string }
  >();
  for (const entry of responses.flat()) {
    const key = `${entry.form}:${entry.accession}`;
    const current = merged.get(key) ?? {
      accession: entry.accession,
      form: entry.form,
      filedAt: entry.filedAt,
      updatedAt: entry.updatedAt,
      issuer: "",
      reportingParty: "",
      url: entry.url,
    };
    if (entry.role === "Issuer") current.issuer = entry.entity;
    else if (entry.role === "Reporting") current.reportingParty = entry.entity;
    else current.issuerFallback = entry.entity;
    if (!current.filedAt) current.filedAt = entry.filedAt;
    if (entry.updatedAt > current.updatedAt)
      current.updatedAt = entry.updatedAt;
    merged.set(key, current);
  }

  return [...merged.values()]
    .map(({ issuerFallback, reporterFallback, ...filing }) => ({
      ...filing,
      issuer: filing.issuer || issuerFallback || "SEC filing entity",
      reportingParty: filing.reportingParty || reporterFallback || "",
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 30);
}
