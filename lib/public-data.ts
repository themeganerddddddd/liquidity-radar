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

export type PublicLiquidityEvent = {
  id: string;
  accession: string;
  form: "Form 4" | "Form 144";
  status: "completed" | "proposed";
  eventType:
    | "completed_public_share_sale"
    | "completed_public_share_purchase"
    | "proposed_public_share_sale";
  reportingParty: string;
  reportingPartyCik: string;
  issuer: string;
  issuerCik: string;
  issuerSymbol: string;
  relationship: string;
  transactionDate: string;
  filingDate: string;
  securityTitle: string;
  shares: number;
  pricePerShare: number;
  grossAmount: number;
  amountClassification: "observed" | "calculated";
  transactionCode: string;
  directOrIndirect: string;
  sharesOwnedAfter: number | null;
  broker: string;
  location: {
    city: string;
    state: string;
    country: string;
  };
  sourceUrl: string;
  note: string;
};

export type PublicHoldingPosition = {
  id: string;
  reportingParty: string;
  reportingPartyCik: string;
  issuer: string;
  issuerCik: string;
  issuerSymbol: string;
  securityTitle: string;
  shares: number;
  directOrIndirect: string;
  asOfDate: string;
  referencePrice: number | null;
  estimatedValue: number | null;
  valueClassification: "calculated" | "not_valued";
  sourceUrl: string;
  accession: string;
};

export type PublicLiquidityEvidence = {
  updatedAt: string;
  events: PublicLiquidityEvent[];
  holdings: PublicHoldingPosition[];
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
  liquidity: PublicLiquidityEvidence;
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
  { query: "4", label: "Form 4", accepted: ["4", "4/A"] },
  { query: "144", label: "Form 144", accepted: ["144", "144/A"] },
  { query: "8-K", label: "Form 8-K", accepted: ["8-K", "8-K/A"] },
  {
    query: "SC 13D",
    label: "Schedule 13D",
    accepted: ["SC 13D", "SC 13D/A"],
  },
  {
    query: "SC 13G",
    label: "Schedule 13G",
    accepted: ["SC 13G", "SC 13G/A"],
  },
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
  const match = xml.match(
    new RegExp(
      `<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
    ),
  );
  if (!match) return "";
  const nestedValue = match[1].match(
    /<(?:[\w-]+:)?value[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?value>/,
  )?.[1];
  return decodeXml(nestedValue ?? match[1].replace(/<[^>]+>/g, ""));
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
): SecFiling & { role: string; entity: string; actualForm: string } {
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
    actualForm: attributeValue(entry, "category", "term"),
  };
}

export function parseSecAtom(
  xml: string,
  formLabel: string,
  acceptedForms?: readonly string[],
) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match) => parseEntry(match[1], formLabel))
    .filter(
      (entry) =>
        !acceptedForms?.length || acceptedForms.includes(entry.actualForm),
    );
}

export async function fetchCurrentSecFilings(
  userAgent: string,
  signal?: AbortSignal,
): Promise<SecFiling[]> {
  const responses = await Promise.all(
    secForms.map(async ({ query, label, accepted }) => {
      const url = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
      url.searchParams.set("action", "getcurrent");
      url.searchParams.set("type", query);
      url.searchParams.set("company", "");
      url.searchParams.set("dateb", "");
      url.searchParams.set("owner", "include");
      url.searchParams.set("start", "0");
      url.searchParams.set("count", "100");
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
      return parseSecAtom(await response.text(), label, accepted);
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
    .slice(0, 200);
}

function tagBlocks(xml: string, tag: string) {
  return [
    ...xml.matchAll(
      new RegExp(
        `<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`,
        "g",
      ),
    ),
  ].map((match) => match[1]);
}

function allTagValues(xml: string, tag: string) {
  return tagBlocks(xml, tag).map((block) =>
    decodeXml(block.replace(/<[^>]+>/g, "")),
  );
}

function numericValue(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : value.slice(0, 10);
}

function relationshipLabel(ownerXml: string) {
  const relationships: string[] = [];
  if (tagValue(ownerXml, "isDirector") === "1") relationships.push("Director");
  if (tagValue(ownerXml, "isOfficer") === "1") {
    relationships.push(tagValue(ownerXml, "officerTitle") || "Officer");
  }
  if (tagValue(ownerXml, "isTenPercentOwner") === "1")
    relationships.push("10% owner");
  if (tagValue(ownerXml, "isOther") === "1")
    relationships.push(tagValue(ownerXml, "otherText") || "Other");
  return relationships.join(", ") || "Reporting owner";
}

export function parseForm4Liquidity(
  xml: string,
  filing: SecFiling,
): PublicLiquidityEvidence {
  const ownerXml = tagBlocks(xml, "reportingOwner")[0] ?? "";
  const reportingParty =
    tagValue(ownerXml, "rptOwnerName") || filing.reportingParty;
  const reportingPartyCik = tagValue(ownerXml, "rptOwnerCik");
  const issuer = tagValue(xml, "issuerName") || filing.issuer;
  const issuerCik = tagValue(xml, "issuerCik");
  const issuerSymbol = tagValue(xml, "issuerTradingSymbol");
  const relationship = relationshipLabel(ownerXml);
  const location = {
    city: tagValue(ownerXml, "rptOwnerCity"),
    state:
      tagValue(ownerXml, "rptOwnerState") ||
      tagValue(ownerXml, "rptOwnerNonUSStateTerritory"),
    country: tagValue(ownerXml, "rptOwnerCountry"),
  };
  const underPlan = tagValue(xml, "aff10b5One") === "1";
  const transactionBlocks = [
    ...tagBlocks(xml, "nonDerivativeTransaction"),
    ...tagBlocks(xml, "derivativeTransaction"),
  ];
  const events: PublicLiquidityEvent[] = [];
  const holdingsBySecurity = new Map<string, PublicHoldingPosition>();

  transactionBlocks.forEach((transaction, index) => {
    const transactionCode = tagValue(transaction, "transactionCode");
    const acquiredDisposed = tagValue(
      transaction,
      "transactionAcquiredDisposedCode",
    );
    const shares = numericValue(tagValue(transaction, "transactionShares"));
    const pricePerShare = numericValue(
      tagValue(transaction, "transactionPricePerShare"),
    );
    const sharesOwnedAfter = numericValue(
      tagValue(transaction, "sharesOwnedFollowingTransaction"),
    );
    const transactionDate =
      dateValue(tagValue(transaction, "transactionDate")) ||
      dateValue(tagValue(xml, "periodOfReport")) ||
      filing.filedAt;
    const securityTitle =
      tagValue(transaction, "securityTitle") ||
      tagValue(transaction, "underlyingSecurityTitle") ||
      "Reported security";
    const directOrIndirect =
      tagValue(transaction, "directOrIndirectOwnership") || "Not reported";
    const eventType =
      transactionCode === "S" && acquiredDisposed === "D"
        ? "completed_public_share_sale"
        : transactionCode === "P" && acquiredDisposed === "A"
          ? "completed_public_share_purchase"
          : null;

    if (eventType && shares > 0 && pricePerShare > 0) {
      events.push({
        id: `${filing.accession}-${eventType}-${index}`,
        accession: filing.accession,
        form: "Form 4",
        status: "completed",
        eventType,
        reportingParty,
        reportingPartyCik,
        issuer,
        issuerCik,
        issuerSymbol,
        relationship,
        transactionDate,
        filingDate: filing.filedAt,
        securityTitle,
        shares,
        pricePerShare,
        grossAmount: shares * pricePerShare,
        amountClassification: "calculated",
        transactionCode,
        directOrIndirect,
        sharesOwnedAfter,
        broker: "",
        location,
        sourceUrl: filing.url,
        note:
          eventType === "completed_public_share_sale"
            ? `Completed sale reported on Form 4${underPlan ? " with the filing marked as a Rule 10b5-1 transaction" : ""}.`
            : "Completed open-market purchase reported on Form 4.",
      });
    }

    if (tagValue(transaction, "sharesOwnedFollowingTransaction")) {
      const referencePrice = pricePerShare > 0 ? pricePerShare : null;
      const holding: PublicHoldingPosition = {
        id: `${filing.accession}-${securityTitle}-${directOrIndirect}`,
        reportingParty,
        reportingPartyCik,
        issuer,
        issuerCik,
        issuerSymbol,
        securityTitle,
        shares: sharesOwnedAfter,
        directOrIndirect,
        asOfDate: transactionDate,
        referencePrice,
        estimatedValue:
          referencePrice === null ? null : sharesOwnedAfter * referencePrice,
        valueClassification:
          referencePrice === null ? "not_valued" : "calculated",
        sourceUrl: filing.url,
        accession: filing.accession,
      };
      holdingsBySecurity.set(
        `${securityTitle.toLowerCase()}:${directOrIndirect}`,
        holding,
      );
    }
  });

  return {
    updatedAt: filing.updatedAt,
    events,
    holdings: [...holdingsBySecurity.values()],
  };
}

export function parseForm144Liquidity(
  xml: string,
  filing: SecFiling,
): PublicLiquidityEvidence {
  const reportingParty =
    tagValue(xml, "nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold") ||
    filing.reportingParty;
  const reportingPartyCik = tagValue(xml, "cik");
  const issuer = tagValue(xml, "issuerName") || filing.issuer;
  const issuerCik = tagValue(xml, "issuerCik");
  const relationship =
    allTagValues(xml, "relationshipToIssuer").join(", ") || "Seller";
  const events: PublicLiquidityEvent[] = [];

  const proposedSecurities = tagBlocks(xml, "securitiesInformation");
  (proposedSecurities.length ? proposedSecurities : [xml]).forEach(
    (security, index) => {
      const shares = numericValue(tagValue(security, "noOfUnitsSold"));
      const grossAmount = numericValue(
        tagValue(security, "aggregateMarketValue"),
      );
      const brokerXml =
        tagBlocks(security, "brokerOrMarketmakerDetails")[0] ?? "";
      const transactionDate =
        dateValue(tagValue(security, "approxSaleDate")) || filing.filedAt;
      if (shares <= 0 || grossAmount <= 0) return;
      events.push({
        id: `${filing.accession}-proposed-${index}`,
        accession: filing.accession,
        form: "Form 144",
        status: "proposed",
        eventType: "proposed_public_share_sale",
        reportingParty,
        reportingPartyCik,
        issuer,
        issuerCik,
        issuerSymbol: "",
        relationship,
        transactionDate,
        filingDate: filing.filedAt,
        securityTitle:
          tagValue(security, "securitiesClassTitle") || "Reported security",
        shares,
        pricePerShare: grossAmount / shares,
        grossAmount,
        amountClassification: "observed",
        transactionCode: "144",
        directOrIndirect: "Not reported",
        sharesOwnedAfter: null,
        broker: tagValue(brokerXml, "name") || tagValue(security, "brokerName"),
        location: { city: "", state: "", country: "" },
        sourceUrl: filing.url,
        note: "Proposed sale value reported on Form 144. This is not proof that the sale was completed.",
      });
    },
  );

  tagBlocks(xml, "securitiesSoldInPast3Months").forEach((sale, index) => {
    const shares = numericValue(tagValue(sale, "amountOfSecuritiesSold"));
    const grossAmount = numericValue(tagValue(sale, "grossProceeds"));
    const priorSeller = tagValue(sale, "sellerName") || reportingParty;
    if (shares <= 0 || grossAmount <= 0) return;
    events.push({
      id: `${filing.accession}-prior-sale-${index}`,
      accession: filing.accession,
      form: "Form 144",
      status: "completed",
      eventType: "completed_public_share_sale",
      reportingParty: priorSeller,
      reportingPartyCik:
        priorSeller.toLowerCase() === reportingParty.toLowerCase()
          ? reportingPartyCik
          : "",
      issuer,
      issuerCik,
      issuerSymbol: "",
      relationship,
      transactionDate: dateValue(tagValue(sale, "saleDate")) || filing.filedAt,
      filingDate: filing.filedAt,
      securityTitle:
        tagValue(sale, "securitiesClassTitle") || "Reported security",
      shares,
      pricePerShare: grossAmount / shares,
      grossAmount,
      amountClassification: "observed",
      transactionCode: "144-prior-sale",
      directOrIndirect: "Not reported",
      sharesOwnedAfter: null,
      broker: "",
      location: { city: "", state: "", country: "" },
      sourceUrl: filing.url,
      note: "Completed prior-three-month sale disclosed on Form 144.",
    });
  });

  return { updatedAt: filing.updatedAt, events, holdings: [] };
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchSecDocument(
  url: string,
  userAgent: string,
  signal?: AbortSignal,
) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        accept: "application/xml,text/xml;q=0.9,*/*;q=0.5",
        "user-agent": userAgent,
      },
      signal,
    });
    lastStatus = response.status;
    if (response.ok) return response;
    if (response.status === 404) return response;
    if (response.status !== 429 && response.status < 500) break;
    await delay(400 * 2 ** attempt);
  }
  throw new Error(`SEC document request returned ${lastStatus}.`);
}

async function filingXml(
  filing: SecFiling,
  userAgent: string,
  signal?: AbortSignal,
) {
  const directoryUrl = filing.url.replace(/[^/]+$/, "");
  const primary = await fetchSecDocument(
    `${directoryUrl}primary_doc.xml`,
    userAgent,
    signal,
  );
  if (primary.ok) return primary.text();

  const indexResponse = await fetchSecDocument(
    `${directoryUrl}index.json`,
    userAgent,
    signal,
  );
  if (!indexResponse.ok) return "";
  const index = (await indexResponse.json()) as {
    directory?: { item?: Array<{ name?: string }> };
  };
  const xmlName = index.directory?.item
    ?.map((item) => item.name ?? "")
    .find(
      (name) =>
        name.endsWith(".xml") &&
        !name.includes("index") &&
        !name.includes("header"),
    );
  if (!xmlName) return "";
  const xmlResponse = await fetchSecDocument(
    `${directoryUrl}${xmlName}`,
    userAgent,
    signal,
  );
  return xmlResponse.ok ? xmlResponse.text() : "";
}

export async function fetchSecLiquidityEvidence(
  filings: SecFiling[],
  userAgent: string,
  signal?: AbortSignal,
): Promise<PublicLiquidityEvidence> {
  const relevant = [
    ...new Map(
      filings
        .filter(
          (filing) => filing.form === "Form 4" || filing.form === "Form 144",
        )
        .map((filing) => [`${filing.form}:${filing.accession}`, filing]),
    ).values(),
  ];
  const events: PublicLiquidityEvent[] = [];
  const latestHoldings = new Map<string, PublicHoldingPosition>();

  for (const filing of relevant) {
    try {
      const xml = await filingXml(filing, userAgent, signal);
      if (!xml) continue;
      const evidence =
        filing.form === "Form 4"
          ? parseForm4Liquidity(xml, filing)
          : parseForm144Liquidity(xml, filing);
      events.push(...evidence.events);
      for (const holding of evidence.holdings) {
        const key = [
          holding.reportingParty.toLowerCase(),
          holding.issuerCik,
          holding.securityTitle.toLowerCase(),
          holding.directOrIndirect,
        ].join(":");
        const current = latestHoldings.get(key);
        if (!current || holding.asOfDate >= current.asOfDate) {
          latestHoldings.set(key, holding);
        }
      }
    } catch {
      // A single unavailable filing must not discard the rest of the official snapshot.
    }
    await delay(110);
  }

  return {
    updatedAt: new Date().toISOString(),
    events: [
      ...events
        .reduce((deduplicated, event) => {
          const key = [
            event.eventType,
            event.reportingParty.toLowerCase(),
            event.issuer.toLowerCase().replace(/[,.]/g, ""),
            event.transactionDate,
            event.shares.toFixed(4),
            event.grossAmount.toFixed(2),
          ].join(":");
          const current = deduplicated.get(key);
          if (
            !current ||
            (current.form === "Form 144" && event.form === "Form 4")
          ) {
            deduplicated.set(key, event);
          }
          return deduplicated;
        }, new Map<string, PublicLiquidityEvent>())
        .values(),
    ].sort((left, right) =>
      right.transactionDate.localeCompare(left.transactionDate),
    ),
    holdings: [...latestHoldings.values()].sort((left, right) =>
      right.asOfDate.localeCompare(left.asOfDate),
    ),
  };
}
