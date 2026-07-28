import type { PublicBusinessProfile, PublicExitSignal } from "./public-data";

function normalizedBusinessName(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|incorporated|llc|lp|limited|plc|oy)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const verifiedBusinessProfiles: Record<string, PublicBusinessProfile> =
  Object.fromEntries(
    [
      {
        name: "i merit inc.",
        industry: "AI data services",
        description:
          "Data annotation and production infrastructure for machine-learning and generative-AI programs.",
        headquarters: {
          city: "San Jose",
          state: "CA",
          country: "United States",
          display: "San Jose, CA",
        },
        sourceUrl: "https://imerit.ai/about-us/",
        locationBasis: "company_headquarters" as const,
      },
      {
        name: "Starborn Industries, Inc.",
        industry: "Construction products distribution",
        description:
          "Family-owned distributor and importer of fasteners and related construction products.",
        headquarters: {
          city: "Edison",
          state: "NJ",
          country: "United States",
          display: "Edison, NJ",
        },
        sourceUrl: "https://starbornindustries.com/company/",
        locationBasis: "public_business_address" as const,
      },
      {
        name: "ICEYE Oy",
        industry: "Earth intelligence and aerospace",
        description:
          "Satellite-based synthetic-aperture radar and Earth-observation intelligence provider.",
        headquarters: {
          city: "Espoo",
          state: "",
          country: "Finland",
          display: "Espoo, Finland",
        },
        sourceUrl: "https://www.iceye.com/company",
        locationBasis: "company_headquarters" as const,
      },
      {
        name: "Kiavi, Inc.",
        industry: "Real-estate finance technology",
        description:
          "Technology-enabled private lender serving residential real-estate investors.",
        headquarters: {
          city: "Pittsburgh",
          state: "PA",
          country: "United States",
          display: "Pittsburgh, PA",
        },
        sourceUrl: "https://www.kiavi.com/contact",
        locationBasis: "company_headquarters" as const,
      },
      {
        name: "Treeline Biosciences, Inc.",
        industry: "Biotechnology",
        description:
          "Clinical-stage biotechnology company developing precision medicines.",
        headquarters: {
          city: "Watertown",
          state: "MA",
          country: "United States",
          display: "Watertown, MA",
        },
        sourceUrl: "https://treeline.bio/privacy-policy",
        locationBasis: "public_business_address" as const,
      },
      {
        name: "Fabric8Labs, Inc.",
        industry: "Advanced manufacturing",
        description:
          "Metal additive-manufacturing company using electrochemical additive manufacturing.",
        headquarters: {
          city: "San Diego",
          state: "CA",
          country: "United States",
          display: "San Diego, CA",
        },
        sourceUrl: "https://www.fabric8labs.com/about/",
        locationBasis: "company_headquarters" as const,
      },
      {
        name: "RAFI Indices, LLC",
        industry: "Financial indexes",
        description:
          "Index company of Research Affiliates providing systematic investment strategies.",
        headquarters: {
          city: "Newport Beach",
          state: "CA",
          country: "United States",
          display: "Newport Beach, CA",
        },
        sourceUrl: "https://www.researchaffiliates.com/about-us/contact-us",
        locationBasis: "public_business_address" as const,
      },
      {
        name: "S&P Global Inc.",
        industry: "Financial data and analytics",
        description:
          "Provider of ratings, benchmarks, analytics, and capital- and commodity-market data.",
        headquarters: {
          city: "New York",
          state: "NY",
          country: "United States",
          display: "New York, NY",
        },
        sourceUrl:
          "https://www.spglobal.com/en/who-we-are/corporate-responsibility/impact-report/about-spglobal",
        locationBasis: "company_headquarters" as const,
      },
      {
        name: "RE/MAX Holdings, Inc.",
        industry: "Real-estate franchising",
        description:
          "Public holding company for real-estate brokerage and mortgage franchise networks.",
        headquarters: {
          city: "Denver",
          state: "CO",
          country: "United States",
          display: "Denver, CO",
        },
        sourceUrl:
          "https://investors.remaxholdings.com/resources/investor-faqs/default.aspx",
        locationBasis: "company_headquarters" as const,
      },
    ].map((profile) => [normalizedBusinessName(profile.name), profile]),
  );

export function getExitBusinessProfiles(names: string[]) {
  return [
    ...new Map(
      names
        .map((name) => verifiedBusinessProfiles[normalizedBusinessName(name)])
        .filter((profile): profile is PublicBusinessProfile => Boolean(profile))
        .map((profile) => [normalizedBusinessName(profile.name), profile]),
    ).values(),
  ];
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldItems(article: string, fieldName: string) {
  const block = article.match(
    new RegExp(
      `field--name-${fieldName}[^>]*>([\\s\\S]*?)(?=<div[^>]*class="[^"]*field--name-|<\\/article>)`,
    ),
  )?.[1];
  if (!block) return [];
  return [
    ...block.matchAll(
      /<div[^>]*class="[^"]*field__item[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    ),
  ]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);
}

export function parseFtcExitSignals(html: string) {
  const records: PublicExitSignal[] = [];
  for (const match of html.matchAll(
    /<article about="(\/legal-library\/browse\/early-termination-notices\/(\d+))"[\s\S]*?<\/article>/g,
  )) {
    const article = match[0];
    const acquiringParty = fieldItems(article, "field-acquiring-party")[0];
    const acquiredParty = fieldItems(article, "field-acquired-party")[0];
    const date = article.match(/<time datetime="(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!acquiringParty || !acquiredParty || !date) continue;
    const acquiredEntities = fieldItems(article, "field-other-entities");
    records.push({
      id: match[2],
      date,
      acquiringParty,
      acquiredParty,
      acquiredEntities,
      businessProfiles: getExitBusinessProfiles([
        ...acquiredEntities,
        acquiredParty,
      ]),
      sourceUrl: `https://www.ftc.gov${match[1]}`,
      status: "cleared_to_close",
      note: "FTC early termination means the HSR waiting period ended early. It is a deal signal, not proof that the transaction closed or that a person received cash.",
    });
  }
  return records;
}
