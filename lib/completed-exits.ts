import type { PublicCompletedExit, SecFiling } from "./public-data";

const SEC_ITEM_201_GUIDANCE =
  "https://www.sec.gov/rules-regulations/staff-guidance/compliance-disclosure-interpretations/exchange-act-form-8-k";

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function amount(value: string, scale = "") {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const normalizedScale = scale.toLocaleLowerCase();
  if (normalizedScale.startsWith("b")) return parsed * 1_000_000_000;
  if (normalizedScale.startsWith("m")) return parsed * 1_000_000;
  if (normalizedScale.startsWith("t")) return parsed * 1_000;
  return parsed;
}

function disclosedAmount(text: string, labels: string[]): number | null {
  for (const label of labels) {
    const labelMatch = text.match(new RegExp(label, "i"));
    if (!labelMatch || labelMatch.index === undefined) continue;
    const before = text.slice(
      Math.max(0, labelMatch.index - 160),
      labelMatch.index,
    );
    const after = text.slice(
      labelMatch.index + labelMatch[0].length,
      labelMatch.index + labelMatch[0].length + 160,
    );
    const beforeAmounts = [
      ...before.matchAll(/\$([\d,.]+)\s*(billion|million|thousand)?/gi),
    ];
    const beforeAmount = beforeAmounts.at(-1);
    const afterAmount = after.match(
      /\$([\d,.]+)\s*(billion|million|thousand)?/i,
    );
    const beforeDistance =
      beforeAmount?.index === undefined
        ? Number.POSITIVE_INFINITY
        : before.length - (beforeAmount.index + beforeAmount[0].length);
    const afterDistance =
      afterAmount?.index === undefined
        ? Number.POSITIVE_INFINITY
        : afterAmount.index;
    const nearest =
      beforeDistance <= afterDistance ? beforeAmount : afterAmount;
    if (nearest) return amount(nearest[1], nearest[2]);
  }
  return null;
}

function isoDateFromText(text: string) {
  const match = text.match(
    /\b(?:On\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i,
  );
  if (!match) return "";
  const month = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(match[1].toLocaleLowerCase());
  return `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function item201Text(text: string) {
  const start = text.search(
    /Item\s*2\.01[.\s:–—-]*Completion of Acquisition or Disposition of Assets/i,
  );
  if (start < 0) return "";
  const remainder = text.slice(start);
  const nextItem = remainder.slice(80).search(/\bItem\s+[2-9]\.\d{2}\b/i);
  return nextItem < 0
    ? remainder.slice(0, 18_000)
    : remainder.slice(0, nextItem + 80);
}

function subjectFromItem(text: string, fallback: string) {
  const acquisition = text.match(
    /(?:completed|consummated)\s+(?:the\s+)?(?:previously announced\s+)?acquisition[^.]{0,80}?\sof\s+(.+?)(?=,\s+(?:a|an)\s+|,\s+pursuant|\s+pursuant|\.| \(the)/i,
  );
  if (acquisition?.[1]) return acquisition[1].trim();
  const acquired = text.match(
    /\bacquired\s+(?:all of\s+)?(?:the\s+)?(?:issued and outstanding\s+)?(?:capital stock|equity interests|ordinary shares|assets)\s+of\s+(.+?)(?=,\s+(?:a|an)\s+|,\s+pursuant|\s+pursuant|\.| \(the)/i,
  );
  return acquired?.[1]?.trim() || `${fallback} disclosed transaction`;
}

export function parseCompletedExit8K(
  html: string,
  filing: SecFiling,
  primaryDocumentUrl = filing.url,
): PublicCompletedExit | null {
  const text = decodeHtml(html);
  const item = item201Text(text);
  if (!item) return null;

  const transactionType: PublicCompletedExit["transactionType"] =
    /\bdisposition\b|\bdisposed\b|\bsold\b/i.test(item) &&
    !/\bacquisition\b|\bacquired\b|\bmerger\b/i.test(item)
      ? "disposition"
      : /\bmerger\b/i.test(item)
        ? "merger"
        : "acquisition";
  const filerRole: PublicCompletedExit["filerRole"] =
    transactionType === "disposition"
      ? "seller_or_target"
      : /\b(?:the Company|Registrant|[A-Z][A-Za-z.& ]+)\s+(?:completed|consummated)[^.]{0,80}\bacquisition\b|\bthe Company acquired\b/i.test(
            item,
          )
        ? "acquirer"
        : "seller_or_target";
  const cashAmount = disclosedAmount(item, [
    "cash consideration",
    "cash purchase price",
    "cash portion",
    "in cash",
  ]);
  const totalAmount = disclosedAmount(item, [
    "aggregate consideration",
    "total consideration",
    "aggregate purchase price",
    "purchase price",
    "up-front consideration",
  ]);
  const perShare = item.match(
    /\$([\d,.]+)\s+in cash per (?:Company |ordinary )?[Ss]hare/i,
  );
  const contingent = disclosedAmount(item, [
    "contingent payment",
    "contingent consideration",
    "earnout",
    "earn-out",
  ]);
  const subjectBusiness = subjectFromItem(item, filing.issuer);
  const filerCik = filing.url.match(/\/data\/0*(\d+)\//)?.[1] ?? "";
  const completedAt =
    isoDateFromText(
      item.match(
        /(?:On\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}[^.]{0,400}(?:completed|consummated|closed|acquired)[^.]{0,400}/i,
      )?.[0] ?? item,
    ) || filing.filedAt;
  const summary = item
    .replace(
      /^Item\s*2\.01[.\s:–—-]*Completion of Acquisition or Disposition of Assets[.\s]*/i,
      "",
    )
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !/incorporated by reference/i.test(sentence))
    .slice(0, 2)
    .join(" ")
    .slice(0, 520);

  return {
    id: `sec-8k-${filing.accession}`,
    accession: filing.accession,
    filedAt: filing.filedAt,
    completedAt,
    filer: filing.issuer,
    filerCik,
    filerRole,
    transactionType,
    subjectBusiness,
    buyer:
      filerRole === "acquirer" ? filing.issuer : "Buyer disclosed in filing",
    sellerOrTarget: filerRole === "acquirer" ? subjectBusiness : filing.issuer,
    consideration: {
      currency: "USD",
      cashAmount,
      totalAmount,
      cashPerShare: perShare ? amount(perShare[1]) : null,
      contingentAmount: contingent,
      classification:
        cashAmount !== null || totalAmount !== null || perShare
          ? cashAmount !== null && totalAmount !== null
            ? "observed"
            : "partially_disclosed"
          : "not_disclosed",
      summary:
        summary ||
        "The filer reported a completed acquisition or disposition under Item 2.01.",
    },
    ownerAttributions: [],
    location: {
      city: "",
      state: "",
      country: "",
      display: "Location not established",
      basis: "not_established",
      sourceUrl: "",
    },
    sourceUrl: primaryDocumentUrl,
    status: "completed",
    note: "Confirmed from SEC Form 8-K Item 2.01. Consideration is shown only when the filing text states it; no recipient is inferred.",
  };
}

async function fetchSec(url: string, userAgent: string, signal?: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
      "user-agent": userAgent,
    },
    signal,
  });
  if (!response.ok) throw new Error(`SEC request returned ${response.status}.`);
  return response.text();
}

function primary8KUrl(indexHtml: string, indexUrl: string) {
  for (const row of indexHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowText = decodeHtml(row[1]);
    if (!/(?:^|\s)8-K(?:\/A)?(?:\s|$)/i.test(rowText)) continue;
    const href = row[1].match(/href="([^"]+\.(?:htm|html))"/i)?.[1];
    if (href) return new URL(href, indexUrl).toString();
  }
  return "";
}

export async function fetchSecCompletedExits(
  filings: SecFiling[],
  userAgent: string,
  signal?: AbortSignal,
) {
  const records: PublicCompletedExit[] = [];
  const eightKs = filings
    .filter((filing) => filing.form === "Form 8-K")
    .slice(0, 100);

  for (const filing of eightKs) {
    try {
      const indexHtml = await fetchSec(filing.url, userAgent, signal);
      const documentUrl = primary8KUrl(indexHtml, filing.url);
      if (!documentUrl) continue;
      const record = parseCompletedExit8K(
        await fetchSec(documentUrl, userAgent, signal),
        filing,
        documentUrl,
      );
      if (record) records.push(record);
    } catch {
      // One unavailable filing must not discard other verified Item 2.01 records.
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return records;
}

export function mergeCompletedExits(...collections: PublicCompletedExit[][]) {
  return [
    ...collections
      .flat()
      .reduce((records, record) => {
        const current = records.get(record.accession);
        if (
          !current ||
          record.ownerAttributions.length > current.ownerAttributions.length ||
          (record.consideration.cashAmount !== null &&
            current.consideration.cashAmount === null)
        ) {
          records.set(record.accession, record);
        }
        return records;
      }, new Map<string, PublicCompletedExit>())
      .values(),
  ].sort(
    (left, right) =>
      right.completedAt.localeCompare(left.completedAt) ||
      right.filedAt.localeCompare(left.filedAt),
  );
}

export const verifiedCompletedExits: PublicCompletedExit[] = [
  {
    id: "sec-8k-0001104659-26-082926",
    accession: "0001104659-26-082926",
    filedAt: "2026-07-14",
    completedAt: "2026-07-13",
    filer: "Esperion Therapeutics, Inc.",
    filerCik: "1434868",
    filerRole: "seller_or_target",
    transactionType: "merger",
    subjectBusiness: "Esperion Therapeutics, Inc.",
    buyer: "Essence Parent Inc.",
    sellerOrTarget: "Esperion Therapeutics, Inc.",
    consideration: {
      currency: "USD",
      cashAmount: null,
      totalAmount: null,
      cashPerShare: 3.16,
      contingentAmount: 100_000_000,
      classification: "partially_disclosed",
      summary:
        "$3.16 cash per share plus one contingent value right; CVRs can participate in up to $100 million of aggregate milestone payments.",
    },
    ownerAttributions: [
      {
        name: "John Craig Thompson",
        kind: "person",
        relationship: "Director",
        attributedShares: 79_873,
        cashPerShare: 3.16,
        attributedCash: 252_398.68,
        amountClassification: "calculated",
        sourceType: "Form 4",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1434868/000162828026048006/xslF345X06/wk-form4_1783973085.xml",
        location: {
          city: "Ann Arbor",
          state: "MI",
          country: "United States",
          display: "Ann Arbor, MI",
        },
        note: "Calculated from 79,873 shares disposed at the disclosed $3.16 cash-per-share merger consideration. Excludes the separately reported option cash-out and any future CVR value.",
      },
    ],
    location: {
      city: "Ann Arbor",
      state: "MI",
      country: "United States",
      display: "Ann Arbor, MI",
      basis: "public_business_address",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1434868/000162828026048006/xslF345X06/wk-form4_1783973085.xml",
    },
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1434868/000110465926082926/tm2620034d3_8k.htm",
    status: "completed",
    note: "The 8-K confirms the merger closed. The named-person amount is a filing-based gross calculation, not net proceeds or current cash.",
  },
  {
    id: "sec-8k-0001193125-26-280337",
    accession: "0001193125-26-280337",
    filedAt: "2026-06-24",
    completedAt: "2026-06-24",
    filer: "Centessa Pharmaceuticals plc",
    filerCik: "1847903",
    filerRole: "seller_or_target",
    transactionType: "acquisition",
    subjectBusiness: "Centessa Pharmaceuticals plc",
    buyer: "Eli Lilly and Company",
    sellerOrTarget: "Centessa Pharmaceuticals plc",
    consideration: {
      currency: "USD",
      cashAmount: null,
      totalAmount: null,
      cashPerShare: 38,
      contingentAmount: null,
      classification: "partially_disclosed",
      summary:
        "$38 cash per share plus one non-transferable CVR with up to $9 per share in contingent milestone payments.",
    },
    ownerAttributions: [
      {
        name: "Mario Alberto Accardi",
        kind: "person",
        relationship: "Chief Executive Officer and Director",
        attributedShares: 243_282,
        cashPerShare: 38,
        attributedCash: 9_244_716,
        amountClassification: "calculated",
        sourceType: "Form 4",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1847903/000147083126000616/xslF345X06/wk-form4_1782332177.xml",
        location: {
          city: "Altrincham",
          state: "",
          country: "United Kingdom",
          display: "Altrincham, United Kingdom",
        },
        note: "Calculated from 243,282 shares disposed at $38 cash per share. Includes 81,806 RSU shares; excludes separately reported option cash-outs and CVR value.",
      },
      {
        name: "Karen M. Anderson",
        kind: "person",
        relationship: "Chief People Officer",
        attributedShares: 62_085,
        cashPerShare: 38,
        attributedCash: 2_359_230,
        amountClassification: "calculated",
        sourceType: "Form 4",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1762176/000147083126000619/xslF345X06/wk-form4_1782332204.xml",
        location: {
          city: "Altrincham",
          state: "",
          country: "United Kingdom",
          display: "Altrincham, United Kingdom",
        },
        note: "Calculated from 62,085 shares disposed at $38 cash per share. Includes 58,050 RSU shares; excludes separately reported option cash-outs and CVR value.",
      },
    ],
    location: {
      city: "Altrincham",
      state: "",
      country: "United Kingdom",
      display: "Altrincham, United Kingdom",
      basis: "company_headquarters",
      sourceUrl:
        "https://www.sec.gov/Archives/edgar/data/1847903/000119312526280337/d150381d8k.htm",
    },
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1847903/000119312526280337/d150381d8k.htm",
    status: "completed",
    note: "The 8-K confirms the acquisition closed. Attributed amounts are filing-based gross calculations, not net proceeds or current cash.",
  },
  {
    id: "sec-8k-0001622536-26-000048",
    accession: "0001622536-26-000048",
    filedAt: "2026-06-17",
    completedAt: "2026-06-15",
    filer: "Talen Energy Corporation",
    filerCik: "1622536",
    filerRole: "acquirer",
    transactionType: "acquisition",
    subjectBusiness:
      "Lawrenceburg Power Plant, Waterford Energy Center, and Darby Generating Station",
    buyer: "Talen Energy Corporation",
    sellerOrTarget: "Affiliates of Energy Capital Partners",
    consideration: {
      currency: "USD",
      cashAmount: 2_550_000_000,
      totalAmount: 3_450_000_000,
      cashPerShare: null,
      contingentAmount: null,
      classification: "observed",
      summary:
        "$3.45 billion purchase price, including approximately $2.55 billion cash and 2,399,998 Talen shares.",
    },
    ownerAttributions: [
      {
        name: "Affiliates of Energy Capital Partners",
        kind: "entity",
        relationship: "Seller group",
        attributedShares: null,
        cashPerShare: null,
        attributedCash: null,
        amountClassification: "not_disclosed",
        sourceType: "8-K seller disclosure",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1622536/000162253626000048/tln-20260615.htm",
        location: {
          city: "Summit",
          state: "NJ",
          country: "United States",
          display: "Summit, NJ",
        },
        note: "The 8-K names ECP affiliates as counterparties but does not allocate the cash consideration among specific seller entities or individuals.",
      },
    ],
    location: {
      city: "Summit",
      state: "NJ",
      country: "United States",
      display: "Summit, NJ",
      basis: "public_business_address",
      sourceUrl: "https://www.ecpgp.com/about/contact",
    },
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1622536/000162253626000048/tln-20260615.htm",
    status: "completed",
    note: "Completed consideration is observed, but no amount is attributed to an individual because the filing does not provide that allocation.",
  },
  {
    id: "sec-8k-0001193125-26-251442",
    accession: "0001193125-26-251442",
    filedAt: "2026-06-01",
    completedAt: "2026-06-01",
    filer: "Repay Holdings Corporation",
    filerCik: "1720592",
    filerRole: "acquirer",
    transactionType: "acquisition",
    subjectBusiness: "KUBRA",
    buyer: "Repay Holdings Corporation",
    sellerOrTarget: "Hearst KUBRA Holdings, Inc.",
    consideration: {
      currency: "USD",
      cashAmount: 372_000_000,
      totalAmount: 372_000_000,
      cashPerShare: null,
      contingentAmount: null,
      classification: "observed",
      summary:
        "Approximately $372 million aggregate cash purchase price, subject to customary post-closing adjustments.",
    },
    ownerAttributions: [
      {
        name: "Hearst KUBRA Holdings, Inc.",
        kind: "entity",
        relationship: "Seller",
        attributedShares: null,
        cashPerShare: null,
        attributedCash: 372_000_000,
        amountClassification: "observed",
        sourceType: "8-K seller disclosure",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/1720592/000119312526251442/rpay-20260601.htm",
        location: {
          city: "",
          state: "",
          country: "",
          display: "Location not established",
        },
        note: "The filing states the aggregate cash purchase price and names the seller entity. It does not attribute proceeds to any individual beneficial owner.",
      },
    ],
    location: {
      city: "Mississauga",
      state: "ON",
      country: "Canada",
      display: "Mississauga, Ontario, Canada",
      basis: "public_business_address",
      sourceUrl: "https://www.kubra.com/about-us/FAQs",
    },
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/1720592/000119312526251442/rpay-20260601.htm",
    status: "completed",
    note: "The 8-K confirms the acquisition closed and identifies the seller entity. No individual receipt is inferred.",
  },
  {
    id: "sec-8k-0001193125-26-210245",
    accession: "0001193125-26-210245",
    filedAt: "2026-05-07",
    completedAt: "2026-05-05",
    filer: "VSE Corporation",
    filerCik: "102752",
    filerRole: "acquirer",
    transactionType: "acquisition",
    subjectBusiness: "Precision Aviation Group",
    buyer: "VSE Corporation",
    sellerOrTarget: "GenNx360 PAG Buyer, LLC",
    consideration: {
      currency: "USD",
      cashAmount: 1_750_000_000,
      totalAmount: 2_025_000_000,
      cashPerShare: null,
      contingentAmount: 125_000_000,
      classification: "observed",
      summary:
        "$2.025 billion up-front consideration: $1.75 billion cash and approximately $275 million of rollover shares, plus up to $125 million contingent consideration.",
    },
    ownerAttributions: [
      {
        name: "GenNx360 PAG Buyer, LLC",
        kind: "entity",
        relationship: "Seller",
        attributedShares: null,
        cashPerShare: null,
        attributedCash: 1_750_000_000,
        amountClassification: "observed",
        sourceType: "8-K seller disclosure",
        sourceUrl:
          "https://www.sec.gov/Archives/edgar/data/102752/000119312526210245/d115996d8k.htm",
        location: {
          city: "",
          state: "",
          country: "",
          display: "Location not established",
        },
        note: "The filing states that Cash Purchaser paid the $1.75 billion cash consideration to this seller entity. It does not allocate proceeds to an individual.",
      },
    ],
    location: {
      city: "Atlanta",
      state: "GA",
      country: "United States",
      display: "Atlanta, GA",
      basis: "company_headquarters",
      sourceUrl: "https://www.precisionaviationgroup.com/Contact/",
    },
    sourceUrl:
      "https://www.sec.gov/Archives/edgar/data/102752/000119312526210245/d115996d8k.htm",
    status: "completed",
    note: "The 8-K confirms the acquisition closed and identifies the seller entity. No individual receipt is inferred.",
  },
];

export { SEC_ITEM_201_GUIDANCE };
