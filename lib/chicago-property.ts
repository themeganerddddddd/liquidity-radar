import {
  normalizeEntityName,
  stableId,
  type MoneyMotionRecord,
  type NormalizedSourceEvent,
} from "./money-in-motion";

export const CHICAGO_PROPERTY_SCHEMA_VERSION = 2 as const;
export const DEFAULT_COMMERCIAL_THRESHOLD = 1_000_000;
export const DEFAULT_RESIDENTIAL_THRESHOLD = 2_000_000;

export const CHICAGO_PROPERTY_COUNTIES = ["Cook", "DuPage"] as const;
export type PropertyCounty = (typeof CHICAGO_PROPERTY_COUNTIES)[number];

export const PROPERTY_CATEGORIES = [
  "OFFICE",
  "RETAIL",
  "INDUSTRIAL",
  "HOTEL",
  "MULTIFAMILY",
  "MIXED_USE",
  "LAND",
  "SELF_STORAGE",
  "HEALTHCARE",
  "OTHER_COMMERCIAL",
  "RESIDENTIAL_LUXURY",
  "UNKNOWN",
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number];

export const SALE_QUALITIES = [
  "MARKET_SALE",
  "LIKELY_MARKET_SALE",
  "INTERNAL_TRANSFER",
  "TRUST_TRANSFER",
  "FAMILY_OR_RELATED_TRANSFER",
  "MERGER_OR_REORGANIZATION",
  "NOMINAL_CONSIDERATION",
  "FORECLOSURE_OR_DISTRESS",
  "UNKNOWN",
] as const;

export type SaleQuality = (typeof SALE_QUALITIES)[number];
export type ValueStatus = "RECORDED" | "ESTIMATED" | "UNKNOWN";
export type ResolutionMethod =
  | "EXACT_ACCOUNT_NUMBER"
  | "EXACT_LEGAL_NAME"
  | "EXACT_DBA"
  | "NORMALIZED_ENTITY_NAME"
  | "PERSONAL_TITLE_MATCH"
  | "FUZZY_CANDIDATE"
  | "UNRESOLVED";
export type BusinessOwnerRole =
  "OWNER" | "OFFICER" | "MANAGER" | "LEGAL_ENTITY_OWNER" | "UNKNOWN_ROLE";

export type ChicagoPropertyEvidence = {
  id: string;
  sourceId: string;
  publisher: string;
  title: string;
  sourceUrl: string;
  recordId: string;
  retrievedAt: string;
  facts: string[];
};

export type ChicagoBusinessOwner = {
  name: string;
  role: BusinessOwnerRole;
  sourceTitle: string;
  ownershipPercentage: number | null;
};

export type ChicagoBusinessMatch = {
  legalName: string;
  dba: string;
  accountNumber: string;
  resolutionMethod: ResolutionMethod;
  resolutionConfidence: number;
  licenseStatus: string;
  licenseDescription: string;
  licenseChanges: Array<{
    status: string;
    date: string;
    applicationType: string;
  }>;
  owners: ChicagoBusinessOwner[];
};

export type ExitConvergenceComponent = {
  id: string;
  label: string;
  points: number;
  sourceRecordId: string;
};

export type ChicagoPropertyRecord = {
  id: string;
  transactionKey: string;
  sellerPerson: string;
  sellerEntity: string;
  sellerOriginal: string;
  buyer: string;
  resolutionMethod: ResolutionMethod;
  resolutionConfidence: number;
  businessMatch: ChicagoBusinessMatch | null;
  property: {
    county: PropertyCounty;
    address: string;
    city: string;
    state: string;
    zip: string;
    category: PropertyCategory;
    categoryLabel: string;
    classificationBasis: string;
    sourceClassifications: string[];
    pins: string[];
    parcelCount: number;
    commercial: boolean;
    largeResidential: boolean;
    latitude: number | null;
    longitude: number | null;
  };
  transaction: {
    saleDate: string;
    documentNumber: string;
    deedType: string;
    recordedSalePrice: number | null;
    ptaxFullConsideration: number | null;
    ptaxNetConsideration: number | null;
    ptaxTaxableConsideration: number | null;
    valueStatus: ValueStatus;
    displayValueLow: number | null;
    displayValueHigh: number | null;
    valueDiscrepancy: boolean;
    valueExplanation: string;
    quality: SaleQuality;
    qualityReasons: string[];
    multiParcel: boolean;
    additionalSellersReported: boolean;
    additionalBuyersReported: boolean;
    ptax203AAttached: boolean;
    ptax203BAttached: boolean;
  };
  proceeds: {
    recordedSaleConsideration: number | null;
    knownOwnershipShare: number | null;
    grossAttributableValue: number | null;
    potentialProceedsLow: number | null;
    potentialProceedsHigh: number | null;
    netProceedsKnown: false;
    explanation: string;
  };
  exitConvergence: {
    score: number;
    label: string;
    components: ExitConvergenceComponent[];
    hasBusinessExitEvidence: boolean;
    hasLicenseCancellation: boolean;
  };
  repeatedSeller: {
    transactionCount: number;
    totalRecordedDispositions: number;
    windowDays: number;
  };
  evidence: ChicagoPropertyEvidence[];
};

export type ChicagoPropertySourceHealth = {
  id: string;
  name: string;
  publisher: string;
  status: "LIVE" | "DEGRADED" | "ERROR";
  sourceUrl: string;
  lastAttemptAt: string;
  lastSuccessAt: string;
  watermark: string;
  rowsFetched: number;
  recordsCreated: number;
  matches: number;
  matchRate: number;
  errors: string[];
};

export type ChicagoPropertySnapshot = {
  schemaVersion: typeof CHICAGO_PROPERTY_SCHEMA_VERSION;
  generatedAt: string;
  coverage: { startDate: string; endDate: string };
  thresholds: { commercial: number; largeResidential: number };
  disclaimer: string;
  stats: {
    significantSales: number;
    commercialSales: number;
    largeResidentialSales: number;
    resolvedOwners: number;
    strongExitSignals: number;
    highExitSignals: number;
    recordedTransactionValue: number;
    commercialTransactionValue: number;
    largeResidentialTransactionValue: number;
    uniqueSellerEntities: number;
    businessOwnerMatches: number;
    licenseCancellationMatches: number;
    otherBusinessExitMatches: number;
    personResolvedTransactions: number;
    organizationOnlyTransactions: number;
    duplicateTransactionsRemoved: number;
    nonMarketTransfersExcluded: number;
    ptaxMatches: number;
    valueDiscrepancies: number;
    cookSales: number;
    dupageSales: number;
    cookRecordedValue: number;
    dupageRecordedValue: number;
    crossCountySellerEntities: number;
    crossCountyRecordedValue: number;
    byPropertyType: Record<PropertyCategory, number>;
    byValueBucket: Record<string, number>;
    byExitConvergence: Record<string, number>;
  };
  records: ChicagoPropertyRecord[];
  sourceHealth: ChicagoPropertySourceHealth[];
};

export type ChicagoSourceRow = Record<string, unknown>;

export type PropertyTransactionDraft = {
  transactionKey: string;
  county: PropertyCounty;
  cookRowIds: string[];
  declarationIds: string[];
  seller: string;
  buyer: string;
  saleDate: string;
  documentNumber: string;
  deedTypes: string[];
  pins: string[];
  sourceClasses: string[];
  cookSalePrice: number | null;
  ptaxFullConsideration: number | null;
  ptaxNetConsideration: number | null;
  ptaxTaxableConsideration: number | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  ptaxUseCode: string;
  ptaxUseDescription: string;
  relationshipFlags: string[];
  multiParcel: boolean;
  reportedParcelCount: number;
  additionalSellersReported: boolean;
  additionalBuyersReported: boolean;
  ptax203AAttached: boolean;
  ptax203BAttached: boolean;
};

export type CommercialValuation = {
  pin: string;
  sourceClass: string;
  category: string;
  propertyUse: string;
  propertyDescription: string;
  address: string;
  marketValue: number | null;
  buildingSquareFeet: number | null;
  units: number | null;
};

export type PropertyAddress = {
  pin: string;
  year: number;
  address: string;
  city: string;
  state: string;
  zip: string;
};

export type ParcelGeography = {
  pin: string;
  year: number;
  city: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
};

export type DuPageParcelRecord = {
  pin: string;
  address: string;
  city: string;
  zip: string;
  propertyClass: string;
  latitude: number | null;
  longitude: number | null;
  retrievedAt: string;
};

export type BusinessLicenseRow = {
  accountNumber: string;
  legalName: string;
  dba: string;
  city: string;
  state: string;
  zip: string;
  applicationType: string;
  status: string;
  statusChangeDate: string;
  description: string;
};

export type BusinessOwnerRow = {
  accountNumber: string;
  dba: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  entityName: string;
  title: string;
};

function stringValue(value: unknown) {
  return String(value ?? "").trim();
}

export function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function truthy(value: unknown) {
  return value === true || /^(?:true|t|yes|y|1)$/i.test(stringValue(value));
}

export function normalizePin(value: unknown) {
  const digits = stringValue(value).replace(/\D/g, "");
  return digits ? digits.padStart(14, "0").slice(-14) : "";
}

export function displayPin(value: string) {
  const pin = normalizePin(value);
  return pin
    ? `${pin.slice(0, 2)}-${pin.slice(2, 4)}-${pin.slice(4, 7)}-${pin.slice(7, 10)}-${pin.slice(10)}`
    : "";
}

export function normalizeDocumentNumber(value: unknown) {
  return stringValue(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function dateValue(value: unknown) {
  const raw = stringValue(value);
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().slice(0, 10)
    : "";
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\b(?:Llc|Lp|Llp|Inc)\b/g, (word) => word.toUpperCase());
}

function standardizedChicagoMetroCity(value: string) {
  const city = titleCase(value.trim());
  const normalized = city.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const names: Record<string, string> = {
    ELKGROVEVLG: "Elk Grove Village",
    GLENDALEHTS: "Glendale Heights",
    OAKBROOKTERR: "Oakbrook Terrace",
    STCHARLES: "St. Charles",
    UNINCORPORATEDWESTCHICAGO: "Unincorporated West Chicago",
  };
  return names[normalized] || city;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function literalEntityName(value: string) {
  return value
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chicagoEntityName(value: string) {
  return literalEntityName(value)
    .replace(
      /\b(?:L L C|LLC|INCORPORATED|INC|CORPORATION|CORP|L P|LP|L L P|LLP|LIMITED|LTD|COMPANY|CO)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function personNameCandidate(value: string) {
  const normalized = literalEntityName(value);
  if (
    !normalized ||
    /\b(?:L L C|LLC|L L P|LLP|L P|LP|INCORPORATED|INC|CORPORATION|CORP|LIMITED|LTD|COMPANY|CO|BANK|TRUST|TRUSTEE|ESTATE|FOUNDATION|ASSOCIATION|PARTNERSHIP|PARTNERS|HOLDINGS?|PROPERTIES|VENTURES|AUTHORITY|COUNTY|CITY|SECRETARY|RECEIVER|SOCIETY|CHURCH|UNIVERSITY|COLLEGE|SCHOOL|DISTRICT|DEPARTMENT|AGENCY|CLUB|CONDOMINIUM)\b/.test(
      normalized,
    )
  )
    return "";
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 2 || tokens.length > 5) return "";
  if (tokens.some((token) => /^\d+$/.test(token))) return "";
  return titleCase(normalized);
}

function splitAddress(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const match = normalized.match(
    /^(.*?)(?:\s+)([A-Z .'-]+),?\s+IL\s+(\d{5})(?:\d{4})?$/i,
  );
  return match
    ? {
        address: titleCase(match[1]),
        city: titleCase(match[2]),
        state: "Illinois",
        zip: match[3],
      }
    : { address: titleCase(normalized), city: "", state: "Illinois", zip: "" };
}

function ptaxAddress(row: ChicagoSourceRow) {
  const street = stringValue(row.line_1_street);
  const city = stringValue(row.line_1_city);
  const zip = stringValue(row.line_1_zip_code).replace(/\D/g, "").slice(0, 5);
  if (street || city || zip)
    return {
      address: titleCase(street),
      city: titleCase(city),
      state: "Illinois",
      zip,
    };
  return splitAddress(stringValue(row.full_address));
}

function propertyCounty(value: unknown): PropertyCounty {
  return /^du\s*page$/i.test(stringValue(value)) ? "DuPage" : "Cook";
}

function draftKey(input: {
  documentNumber: string;
  seller: string;
  buyer: string;
  saleDate: string;
  value: number | null;
  fallback: string;
}) {
  return input.documentNumber
    ? `DOC:${input.documentNumber}`
    : `ROW:${stableId(
        chicagoEntityName(input.seller),
        chicagoEntityName(input.buyer),
        input.saleDate,
        input.value === null ? "" : String(input.value),
        input.fallback,
      )}`;
}

export function clusterCookSales(rows: ChicagoSourceRow[]) {
  const drafts = new Map<string, PropertyTransactionDraft>();
  for (const row of rows) {
    const documentNumber = normalizeDocumentNumber(row.doc_no);
    const seller = stringValue(row.seller_name);
    const buyer = stringValue(row.buyer_name);
    const saleDate = dateValue(row.sale_date);
    const price = numberValue(row.sale_price);
    const rowId = stringValue(row[":id"] || row.row_id || row.id);
    const key = draftKey({
      documentNumber,
      seller,
      buyer,
      saleDate,
      value: price,
      fallback: rowId || normalizePin(row.pin),
    });
    const current =
      drafts.get(key) ||
      ({
        transactionKey: key,
        county: "Cook",
        cookRowIds: [],
        declarationIds: [],
        seller: "",
        buyer: "",
        saleDate,
        documentNumber,
        deedTypes: [],
        pins: [],
        sourceClasses: [],
        cookSalePrice: price,
        ptaxFullConsideration: null,
        ptaxNetConsideration: null,
        ptaxTaxableConsideration: null,
        address: "",
        city: "",
        state: "Illinois",
        zip: "",
        ptaxUseCode: "",
        ptaxUseDescription: "",
        relationshipFlags: [],
        multiParcel: false,
        reportedParcelCount: 1,
        additionalSellersReported: false,
        additionalBuyersReported: false,
        ptax203AAttached: false,
        ptax203BAttached: false,
      } satisfies PropertyTransactionDraft);
    current.cookRowIds = unique([...current.cookRowIds, rowId]);
    current.seller ||= seller;
    current.buyer ||= buyer;
    current.saleDate ||= saleDate;
    current.documentNumber ||= documentNumber;
    current.deedTypes = unique([
      ...current.deedTypes,
      stringValue(row.deed_type),
      stringValue(row.mydec_deed_type),
    ]);
    current.pins = unique([...current.pins, normalizePin(row.pin)]);
    current.sourceClasses = unique([
      ...current.sourceClasses,
      stringValue(row.class),
    ]);
    current.cookSalePrice ??= price;
    current.multiParcel =
      current.multiParcel ||
      truthy(row.is_multisale) ||
      Number(row.num_parcels_sale || 0) > 1 ||
      current.pins.length > 1;
    current.reportedParcelCount = Math.max(
      current.multiParcel ? 2 : current.reportedParcelCount,
      numberValue(row.num_parcels_sale) || 1,
      current.pins.length,
    );
    if (truthy(row.sale_filter_less_than_10k))
      current.relationshipFlags.push("COOK_LESS_THAN_10K_FILTER");
    if (truthy(row.sale_filter_deed_type))
      current.relationshipFlags.push("COOK_DEED_TYPE_FILTER");
    if (truthy(row.sale_filter_same_sale_within_365))
      current.relationshipFlags.push("COOK_REPEAT_SALE_FILTER");
    current.relationshipFlags = unique(current.relationshipFlags);
    drafts.set(key, current);
  }
  return [...drafts.values()];
}

function ptaxFlags(row: ChicagoSourceRow) {
  const fields: Array<[string, string]> = [
    ["line_10b_sale_between_related", "RELATED_PARTIES"],
    ["line_10c_transfer_of_100", "PARTIAL_INTEREST"],
    ["line_10d_court_ordered_sale", "COURT_ORDERED"],
    ["line_10e_sale_in_lieu_of", "IN_LIEU_OF_FORECLOSURE"],
    ["line_10f_condemnation", "CONDEMNATION"],
    ["line_10g_short_sale", "SHORT_SALE"],
    ["line_10h_bank_reo", "BANK_REO"],
    ["line_10i_auction_sale", "AUCTION"],
    ["line_10j_seller_buyer_is", "RELOCATION_COMPANY"],
    ["line_10k_seller_buyer_is", "FINANCIAL_OR_GOVERNMENT"],
    ["line_10p_trade_of_property", "PROPERTY_TRADE"],
    ["line_10q_sale_leaseback", "SALE_LEASEBACK"],
  ];
  return fields.flatMap(([field, label]) =>
    truthy(row[field]) ? [label] : [],
  );
}

export function mergePtaxTransactions(
  cookDrafts: PropertyTransactionDraft[],
  rows: ChicagoSourceRow[],
) {
  const drafts = new Map(
    cookDrafts.map((draft) => [draft.transactionKey, draft]),
  );
  const byDocument = new Map(
    cookDrafts
      .filter((draft) => draft.documentNumber)
      .map((draft) => [draft.documentNumber, draft.transactionKey]),
  );
  for (const row of rows) {
    const documentNumber = normalizeDocumentNumber(row.document_number);
    const seller = stringValue(
      row.step_4_seller_organization || row.step_4_seller_name,
    );
    const buyer = stringValue(
      row.step_4_buyer_organization || row.step_4_buyer_name,
    );
    const saleDate = dateValue(row.date_recorded);
    const full = numberValue(row.line_11_full_consideration);
    const declarationId = stringValue(row.declaration_id);
    const county = propertyCounty(row.line_1_county);
    const existingKey =
      county === "Cook" && documentNumber ? byDocument.get(documentNumber) : "";
    const key =
      existingKey ||
      (county === "DuPage" && documentNumber
        ? `DUPAGE:DOC:${documentNumber}`
        : "") ||
      draftKey({
        documentNumber,
        seller,
        buyer,
        saleDate,
        value: full,
        fallback: declarationId,
      });
    const parsedAddress = ptaxAddress(row);
    const current =
      drafts.get(key) ||
      ({
        transactionKey: key,
        county,
        cookRowIds: [],
        declarationIds: [],
        seller,
        buyer,
        saleDate,
        documentNumber,
        deedTypes: [],
        pins: [],
        sourceClasses: [],
        cookSalePrice: null,
        ptaxFullConsideration: full,
        ptaxNetConsideration: null,
        ptaxTaxableConsideration: null,
        ...parsedAddress,
        ptaxUseCode: "",
        ptaxUseDescription: "",
        relationshipFlags: [],
        multiParcel: false,
        reportedParcelCount: 1,
        additionalSellersReported: false,
        additionalBuyersReported: false,
        ptax203AAttached: false,
        ptax203BAttached: false,
      } satisfies PropertyTransactionDraft);
    current.county = county;
    current.declarationIds = unique([...current.declarationIds, declarationId]);
    current.seller ||= seller;
    current.buyer ||= buyer;
    current.saleDate ||= saleDate;
    current.documentNumber ||= documentNumber;
    current.deedTypes = unique([
      ...current.deedTypes,
      stringValue(row.line_5_instrument_type),
      stringValue(row.line_5_other_instrument_type),
    ]);
    current.pins = unique([
      ...current.pins,
      normalizePin(row.line_1_primary_pin),
      normalizePin(row._203_a_line_2_primary_pin),
      normalizePin(row._203_a_line_5_property_1_2),
      normalizePin(row._203_a_line_5_property_2_2),
    ]);
    current.ptaxFullConsideration ??= full;
    current.ptaxNetConsideration ??= numberValue(row.line_13_net_consideration);
    current.ptaxTaxableConsideration ??= numberValue(
      row.line_17_net_consideration,
    );
    current.address ||= parsedAddress.address;
    current.city ||= parsedAddress.city;
    current.state ||= parsedAddress.state;
    current.zip ||= parsedAddress.zip;
    current.ptaxUseCode ||= stringValue(row.line_8_current_use).toUpperCase();
    current.ptaxUseDescription ||= stringValue(
      row.line_8_current_commercial ||
        row.line_8_current_other ||
        row.line_8_current_other_use,
    );
    current.relationshipFlags = unique([
      ...current.relationshipFlags,
      ...ptaxFlags(row),
    ]);
    current.additionalSellersReported ||= truthy(row.additional_sellers);
    current.additionalBuyersReported ||= truthy(row.additional_buyers);
    current.ptax203AAttached ||= truthy(row.ptax_203_a_attached);
    current.ptax203BAttached ||= truthy(row.ptax_203_b_attached);
    current.multiParcel =
      current.multiParcel ||
      Number(row.line_2_total_parcels || 0) > 1 ||
      current.pins.length > 1;
    current.reportedParcelCount = Math.max(
      current.multiParcel ? 2 : current.reportedParcelCount,
      numberValue(row.line_2_total_parcels) || 1,
      current.pins.length,
    );
    drafts.set(key, current);
    if (county === "Cook" && documentNumber)
      byDocument.set(documentNumber, key);
  }
  return [...drafts.values()];
}

function formattedClass(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 3 ? `${digits[0]}-${digits.slice(1)}` : value;
}

function categoryFromText(value: string): PropertyCategory | null {
  const text = value.toUpperCase();
  if (/SELF.?STORAGE|MINI.?STORAGE/.test(text)) return "SELF_STORAGE";
  if (/HOSPITAL|NURSING|MEDICAL|HEALTH|CLINIC|SENIOR LIVING/.test(text))
    return "HEALTHCARE";
  if (/HOTEL|MOTEL|ROOMS?\b/.test(text)) return "HOTEL";
  if (/INDUSTR|WAREHOUSE|MANUFACTUR|DISTRIBUT|LOGISTIC/.test(text))
    return "INDUSTRIAL";
  if (/MIXED.?USE|RESIDENTIAL.*COMM|COMM.*RESIDENTIAL/.test(text))
    return "MIXED_USE";
  if (/MULTIFAMILY|APARTMENT|\bUNITS?\b/.test(text)) return "MULTIFAMILY";
  if (/OFFICE|BANK\b/.test(text)) return "OFFICE";
  if (/RETAIL|STORE|SHOPPING|RESTAURANT|GAS STATION|AUTO DEAL/.test(text))
    return "RETAIL";
  if (/VACANT|LAND|DEVELOPMENT SITE/.test(text)) return "LAND";
  return null;
}

export function classifyPropertyCategory(input: {
  sourceClasses: string[];
  ptaxUseCode: string;
  ptaxUseDescription: string;
  commercialValuations: CommercialValuation[];
  transferFormUse?: string;
}) {
  const valuations = input.commercialValuations;
  const text = [
    input.transferFormUse || "",
    input.ptaxUseDescription,
    ...valuations.flatMap((valuation) => [
      valuation.category,
      valuation.propertyUse,
      valuation.propertyDescription,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
  const textCategory = categoryFromText(text);
  if (textCategory) {
    return {
      category: textCategory,
      basis: input.transferFormUse
        ? "Cook/Chicago transfer-form property use"
        : input.ptaxUseDescription
          ? "Illinois PTAX-203 reported property use"
          : "Cook County commercial valuation description",
    };
  }
  const code = input.ptaxUseCode.toUpperCase();
  const useCategory: Record<string, PropertyCategory> = {
    A: "LAND",
    B: "RESIDENTIAL_LUXURY",
    C: "RESIDENTIAL_LUXURY",
    D: "MULTIFAMILY",
    E: "MULTIFAMILY",
    F: "OFFICE",
    G: "RETAIL",
    H: "OTHER_COMMERCIAL",
    I: "INDUSTRIAL",
    K: "OTHER_COMMERCIAL",
  };
  if (useCategory[code]) {
    return {
      category: useCategory[code],
      basis: "Illinois PTAX-203 current-use code",
    };
  }
  const classes = unique([
    ...input.sourceClasses.map(formattedClass),
    ...valuations.flatMap((valuation) =>
      valuation.sourceClass.split(",").map((value) => value.trim()),
    ),
  ]);
  if (classes.includes("DUPAGE-R"))
    return {
      category: "RESIDENTIAL_LUXURY" as const,
      basis: "DuPage County residential property class",
    };
  if (classes.includes("DUPAGE-I"))
    return {
      category: "INDUSTRIAL" as const,
      basis: "DuPage County industrial property class",
    };
  if (classes.some((value) => ["DUPAGE-A", "DUPAGE-L"].includes(value)))
    return {
      category: "LAND" as const,
      basis: "DuPage County land/agricultural property class",
    };
  if (
    classes.some((value) =>
      ["DUPAGE-C", "DUPAGE-E", "DUPAGE-M"].includes(value),
    )
  )
    return {
      category: "OTHER_COMMERCIAL" as const,
      basis: "DuPage County non-residential property class",
    };
  if (classes.some((value) => /^2-/.test(value)))
    return {
      category: "RESIDENTIAL_LUXURY" as const,
      basis: "Cook County Class 2 residential code",
    };
  if (classes.some((value) => /^3-18/.test(value)))
    return {
      category: "MIXED_USE" as const,
      basis: "Cook County Class 3-18 mixed-use code",
    };
  if (classes.some((value) => /^3-/.test(value)))
    return {
      category: "MULTIFAMILY" as const,
      basis: "Cook County Class 3 multifamily code",
    };
  if (classes.some((value) => /^1-|^[35]-00/.test(value)))
    return {
      category: "LAND" as const,
      basis: "Cook County vacant-land class code",
    };
  if (classes.some((value) => /^5-(?:80|81|83|87|89|93|97)/.test(value)))
    return {
      category: "INDUSTRIAL" as const,
      basis: "Cook County industrial class code",
    };
  if (classes.some((value) => /^5-29/.test(value)))
    return {
      category: "HOTEL" as const,
      basis: "Cook County motel/hotel class code",
    };
  if (classes.some((value) => /^[456789]-/.test(value)) || valuations.length)
    return {
      category: "OTHER_COMMERCIAL" as const,
      basis: "Cook County commercial valuation/class record",
    };
  return {
    category: "UNKNOWN" as const,
    basis: "Property use not established",
  };
}

export function classifySaleQuality(draft: PropertyTransactionDraft) {
  const price = draft.ptaxFullConsideration ?? draft.cookSalePrice;
  const deed = draft.deedTypes.join(" ").toUpperCase();
  const reasons: string[] = [];
  const seller = chicagoEntityName(draft.seller);
  const buyer = chicagoEntityName(draft.buyer);
  if (price !== null && price <= 100) {
    return {
      quality: "NOMINAL_CONSIDERATION" as const,
      reasons: ["Recorded consideration is nominal ($100 or less)."],
    };
  }
  if (seller && buyer && seller === buyer) {
    return {
      quality: "INTERNAL_TRANSFER" as const,
      reasons: ["Normalized buyer and seller names are identical."],
    };
  }
  if (/CORRECTIVE|QUIT.?CLAIM|NON.?SALE/.test(deed)) {
    return {
      quality: "INTERNAL_TRANSFER" as const,
      reasons: [
        "Instrument type indicates a corrective, quitclaim, or non-sale transfer.",
      ],
    };
  }
  if (/MERGER|REORGANIZATION|CONSOLIDATION/.test(deed)) {
    return {
      quality: "MERGER_OR_REORGANIZATION" as const,
      reasons: ["Instrument identifies a merger or entity reorganization."],
    };
  }
  if (/TRUST|BENEFICIAL INTEREST/.test(deed)) {
    return {
      quality: "TRUST_TRANSFER" as const,
      reasons: ["Instrument is a trust or beneficial-interest transfer."],
    };
  }
  if (draft.relationshipFlags.includes("RELATED_PARTIES")) {
    return {
      quality: "FAMILY_OR_RELATED_TRANSFER" as const,
      reasons: [
        "PTAX-203 marks the parties as related individuals or corporate affiliates.",
      ],
    };
  }
  if (
    draft.relationshipFlags.some((flag) =>
      [
        "COURT_ORDERED",
        "IN_LIEU_OF_FORECLOSURE",
        "SHORT_SALE",
        "BANK_REO",
        "AUCTION",
      ].includes(flag),
    )
  ) {
    return {
      quality: "FORECLOSURE_OR_DISTRESS" as const,
      reasons: [
        "PTAX-203 identifies a court, foreclosure, REO, short-sale, or auction condition.",
      ],
    };
  }
  if (
    draft.relationshipFlags.some((flag) =>
      ["COOK_DEED_TYPE_FILTER", "COOK_LESS_THAN_10K_FILTER"].includes(flag),
    )
  ) {
    return {
      quality: "UNKNOWN" as const,
      reasons: [
        "Cook County sale-quality flags caution against treating this as an arm's-length sale.",
      ],
    };
  }
  if (/WARRANTY|BARGAIN|SPECIAL WARRANTY/.test(deed) && price && price > 100) {
    reasons.push(
      "Recorded consideration and a market-sale deed type are present.",
    );
    return { quality: "MARKET_SALE" as const, reasons };
  }
  if (price && price > 100) {
    reasons.push(
      "Substantial recorded consideration is present; no disqualifying transfer flag was found.",
    );
    return { quality: "LIKELY_MARKET_SALE" as const, reasons };
  }
  return {
    quality: "UNKNOWN" as const,
    reasons: [
      "The public records do not establish an arm's-length market sale.",
    ],
  };
}

function ownerRole(title: string, entityName: string): BusinessOwnerRole {
  if (entityName) return "LEGAL_ENTITY_OWNER";
  const value = title.toUpperCase();
  if (/OWNER|MEMBER|PARTNER|SHAREHOLDER|PROPRIETOR/.test(value)) return "OWNER";
  if (/MANAGER/.test(value)) return "MANAGER";
  if (
    /PRESIDENT|VICE PRESIDENT|SECRETARY|TREASURER|OFFICER|DIRECTOR/.test(value)
  )
    return "OFFICER";
  return "UNKNOWN_ROLE";
}

function ownerName(row: BusinessOwnerRow) {
  return row.entityName
    ? row.entityName
    : [row.firstName, row.middleInitial, row.lastName, row.suffix]
        .filter(Boolean)
        .join(" ")
        .trim();
}

export function resolveBusinessSeller(input: {
  seller: string;
  licenses: BusinessLicenseRow[];
  owners: BusinessOwnerRow[];
}) {
  // A personal-title seller is already a directly named party to the deed.
  // A same-name business-license row alone is not enough to connect that person
  // to an account, avoiding common-name false positives.
  if (personNameCandidate(input.seller)) return null;
  type BusinessCandidate = {
    license: BusinessLicenseRow;
    method: Extract<
      ResolutionMethod,
      "EXACT_LEGAL_NAME" | "EXACT_DBA" | "NORMALIZED_ENTITY_NAME"
    >;
    confidence: number;
  };
  const literal = literalEntityName(input.seller);
  const normalized = chicagoEntityName(input.seller);
  const candidates: BusinessCandidate[] = input.licenses.flatMap(
    (license): BusinessCandidate[] => {
      const legalLiteral = literalEntityName(license.legalName);
      const dbaLiteral = literalEntityName(license.dba);
      if (legalLiteral && legalLiteral === literal)
        return [
          { license, method: "EXACT_LEGAL_NAME" as const, confidence: 0.99 },
        ];
      if (dbaLiteral && dbaLiteral === literal)
        return [{ license, method: "EXACT_DBA" as const, confidence: 0.97 }];
      if (
        normalized.length >= 6 &&
        [
          chicagoEntityName(license.legalName),
          chicagoEntityName(license.dba),
        ].includes(normalized)
      )
        return [
          {
            license,
            method: "NORMALIZED_ENTITY_NAME" as const,
            confidence: 0.9,
          },
        ];
      return [];
    },
  );
  if (!candidates.length) return null;
  candidates.sort(
    (left, right) =>
      right.confidence - left.confidence ||
      right.license.statusChangeDate.localeCompare(
        left.license.statusChangeDate,
      ),
  );
  const best = candidates[0];
  const accountLicenses = input.licenses.filter(
    (license) => license.accountNumber === best.license.accountNumber,
  );
  const changes = accountLicenses
    .filter((license) => license.statusChangeDate)
    .map((license) => ({
      status: license.status,
      date: license.statusChangeDate,
      applicationType: license.applicationType,
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
  const owners = input.owners
    .filter((owner) => owner.accountNumber === best.license.accountNumber)
    .map((owner) => ({
      name: ownerName(owner),
      role: ownerRole(owner.title, owner.entityName),
      sourceTitle: owner.title,
      ownershipPercentage: null,
    }))
    .filter((owner) => owner.name);
  return {
    legalName: best.license.legalName,
    dba: best.license.dba,
    accountNumber: best.license.accountNumber,
    resolutionMethod: best.method,
    resolutionConfidence: best.confidence,
    licenseStatus: best.license.status,
    licenseDescription: best.license.description,
    licenseChanges: changes,
    owners,
  } satisfies ChicagoBusinessMatch;
}

function withinDays(left: string, right: string, days: number) {
  const leftTime = Date.parse(`${left}T00:00:00Z`);
  const rightTime = Date.parse(`${right}T00:00:00Z`);
  return (
    Number.isFinite(leftTime) &&
    Number.isFinite(rightTime) &&
    Math.abs(leftTime - rightTime) <= days * 86_400_000
  );
}

function relatedMotionRecords(
  seller: string,
  person: string,
  saleDate: string,
  records: MoneyMotionRecord[],
) {
  const sellerKey = normalizeEntityName(seller);
  const personKey = normalizeEntityName(person);
  return records.filter((record) => {
    if (
      record.evidence.some(
        (evidence) => evidence.sourceId === "chicago_property",
      )
    )
      return false;
    if (!withinDays(saleDate, record.eventDate || record.publishedAt, 365))
      return false;
    const keys = [
      record.person,
      record.company,
      record.seller,
      record.buyer,
    ].map(normalizeEntityName);
    return (
      (sellerKey && keys.includes(sellerKey)) ||
      (personKey && keys.includes(personKey))
    );
  });
}

export function exitConvergence(input: {
  id: string;
  commercial: boolean;
  largeResidential: boolean;
  businessMatch: ChicagoBusinessMatch | null;
  saleDate: string;
  relatedMotion: MoneyMotionRecord[];
}) {
  const components: ExitConvergenceComponent[] = [];
  if (input.commercial)
    components.push({
      id: "commercial_disposition",
      label: "Commercial property disposition",
      points: 20,
      sourceRecordId: input.id,
    });
  if (input.largeResidential)
    components.push({
      id: "large_residential",
      label: "Large residential property sale",
      points: 5,
      sourceRecordId: input.id,
    });
  const personOwners = input.businessMatch?.owners.filter(
    (owner) => owner.role === "OWNER",
  );
  if (personOwners?.length)
    components.push({
      id: "business_owner_resolution",
      label: "Exact Chicago business-owner resolution",
      points: 15,
      sourceRecordId: input.businessMatch!.accountNumber,
    });
  const cancellation = input.businessMatch?.licenseChanges.find(
    (change) =>
      /AAC|CANCEL|REV|REVOK/i.test(
        `${change.status} ${change.applicationType}`,
      ) && withinDays(input.saleDate, change.date, 180),
  );
  if (cancellation)
    components.push({
      id: "license_cancellation",
      label: "Business-license cancellation or revocation near the sale",
      points: 10,
      sourceRecordId: `${input.businessMatch!.accountNumber}:${cancellation.date}`,
    });
  const businessExit = input.relatedMotion.find((record) =>
    ["BUSINESS_SALE", "ACQUISITION", "MERGER"].includes(record.eventType),
  );
  if (businessExit)
    components.push({
      id: "confirmed_business_exit",
      label:
        businessExit.eventType === "ACQUISITION"
          ? "Corroborating company acquisition"
          : "Corroborating business sale or merger",
      points: 35,
      sourceRecordId: businessExit.id,
    });
  const corporateChange = input.relatedMotion.find((record) =>
    ["DISSOLUTION_AFTER_TRANSACTION", "CHANGE_OF_CONTROL"].includes(
      record.eventType,
    ),
  );
  if (corporateChange)
    components.push({
      id: "corporate_change",
      label: "Corroborating corporate control or dissolution record",
      points: 10,
      sourceRecordId: corporateChange.id,
    });
  const other = input.relatedMotion.find(
    (record) => ![businessExit?.id, corporateChange?.id].includes(record.id),
  );
  if (other)
    components.push({
      id: "other_exit_signal",
      label: "Other corroborating Liquidity Radar signal",
      points: 5,
      sourceRecordId: other.id,
    });
  const deduped = [
    ...new Map(components.map((item) => [item.id, item])).values(),
  ];
  const score = Math.min(
    100,
    deduped.reduce((sum, component) => sum + component.points, 0),
  );
  return {
    score,
    label:
      score >= 75
        ? "High Exit Convergence"
        : score >= 50
          ? "Strong Exit Signals"
          : score >= 25
            ? "Possible Exit Activity"
            : "Asset Sale Only",
    components: deduped,
    hasBusinessExitEvidence: Boolean(businessExit || corporateChange || other),
    hasLicenseCancellation: Boolean(cancellation),
  };
}

function recordedValues(draft: PropertyTransactionDraft) {
  return unique(
    [draft.cookSalePrice, draft.ptaxFullConsideration]
      .filter((value): value is number => value !== null && value > 0)
      .map(String),
  ).map(Number);
}

export function hasMaterialValueDiscrepancy(
  left: number | null,
  right: number | null,
) {
  if (left === null || right === null || left <= 0 || right <= 0) return false;
  const difference = Math.abs(left - right);
  return difference > Math.max(50_000, Math.max(left, right) * 0.1);
}

export function estimatePropertyValue(input: {
  comparableValues: number[];
  cookMarketValue?: number | null;
}) {
  const values = input.comparableValues
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  if (values.length < 4) return null;
  const quantile = (ratio: number) => {
    const index = (values.length - 1) * ratio;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    return values[lower] + (values[upper] - values[lower]) * (index - lower);
  };
  let low = quantile(0.25);
  let high = quantile(0.75);
  if (input.cookMarketValue && input.cookMarketValue > 0) {
    low = Math.min(low, input.cookMarketValue);
    high = Math.max(high, input.cookMarketValue);
  }
  return {
    low: Math.round(low / 10_000) * 10_000,
    high: Math.round(high / 10_000) * 10_000,
    methodology:
      "Robust interquartile range from comparable recorded sales, cross-checked against Cook County market value.",
  };
}

function categoryLabel(category: PropertyCategory) {
  return (
    {
      OFFICE: "Office sale",
      RETAIL: "Retail sale",
      INDUSTRIAL: "Industrial sale",
      HOTEL: "Hotel sale",
      MULTIFAMILY: "Multifamily sale",
      MIXED_USE: "Mixed-use sale",
      LAND: "Land sale",
      SELF_STORAGE: "Self-storage sale",
      HEALTHCARE: "Healthcare property sale",
      OTHER_COMMERCIAL: "Commercial property sale",
      RESIDENTIAL_LUXURY: "Large residential sale",
      UNKNOWN: "Property sale",
    } as Record<PropertyCategory, string>
  )[category];
}

export function finalizeChicagoRecords(input: {
  drafts: PropertyTransactionDraft[];
  addressesByPin: Record<string, PropertyAddress>;
  geographyByPin: Record<string, ParcelGeography>;
  dupageByPin?: Record<string, DuPageParcelRecord>;
  commercialByPin: Record<string, CommercialValuation[]>;
  transferFormUseByDeclaration: Record<string, string>;
  licenses: BusinessLicenseRow[];
  owners: BusinessOwnerRow[];
  motionRecords: MoneyMotionRecord[];
  generatedAt: string;
  commercialThreshold?: number;
  residentialThreshold?: number;
}) {
  const commercialThreshold =
    input.commercialThreshold ?? DEFAULT_COMMERCIAL_THRESHOLD;
  const residentialThreshold =
    input.residentialThreshold ?? DEFAULT_RESIDENTIAL_THRESHOLD;
  let nonMarketTransfersExcluded = 0;
  let thresholdExcluded = 0;
  const records = input.drafts.flatMap((draft) => {
    if (draft.county === "DuPage" && !draft.seller) {
      thresholdExcluded += 1;
      return [];
    }
    const quality = classifySaleQuality(draft);
    if (!["MARKET_SALE", "LIKELY_MARKET_SALE"].includes(quality.quality)) {
      nonMarketTransfersExcluded += 1;
      return [];
    }
    const addressRows = draft.pins
      .map((pin) => input.addressesByPin[pin])
      .filter(Boolean);
    const geographyRows = draft.pins
      .map((pin) => input.geographyByPin[pin])
      .filter(Boolean);
    const valuations = draft.pins.flatMap(
      (pin) => input.commercialByPin[pin] || [],
    );
    const dupageParcels = draft.pins
      .map((pin) => input.dupageByPin?.[pin])
      .filter((row): row is DuPageParcelRecord => Boolean(row));
    const classification = classifyPropertyCategory({
      sourceClasses: unique([
        ...draft.sourceClasses,
        ...dupageParcels.map((parcel) =>
          parcel.propertyClass
            ? `DUPAGE-${parcel.propertyClass.toUpperCase()}`
            : "",
        ),
      ]),
      ptaxUseCode: draft.ptaxUseCode,
      ptaxUseDescription: draft.ptaxUseDescription,
      commercialValuations: valuations,
      transferFormUse: draft.declarationIds
        .map((id) => input.transferFormUseByDeclaration[id])
        .find(Boolean),
    });
    const commercial = !["RESIDENTIAL_LUXURY", "UNKNOWN"].includes(
      classification.category,
    );
    const values = recordedValues(draft);
    const displayValue = draft.ptaxFullConsideration ?? draft.cookSalePrice;
    const largeResidential =
      classification.category === "RESIDENTIAL_LUXURY" &&
      displayValue !== null &&
      displayValue >= residentialThreshold;
    if (
      displayValue === null ||
      (commercial && displayValue < commercialThreshold) ||
      (!commercial && !largeResidential)
    ) {
      thresholdExcluded += 1;
      return [];
    }
    const businessMatch = resolveBusinessSeller({
      seller: draft.seller,
      licenses: input.licenses,
      owners: input.owners,
    });
    const directPerson = personNameCandidate(draft.seller);
    const ownerPeople =
      businessMatch?.owners.filter((owner) => owner.role === "OWNER") || [];
    const sellerPerson =
      ownerPeople.length === 1 ? ownerPeople[0].name : directPerson;
    const resolutionMethod =
      ownerPeople.length === 1
        ? businessMatch!.resolutionMethod
        : directPerson
          ? "PERSONAL_TITLE_MATCH"
          : businessMatch?.resolutionMethod || "UNRESOLVED";
    const resolutionConfidence =
      ownerPeople.length === 1
        ? businessMatch!.resolutionConfidence
        : directPerson
          ? 0.9
          : businessMatch?.resolutionConfidence || 0;
    const id = stableId(
      "chicago-property",
      draft.documentNumber,
      draft.transactionKey,
    );
    const related = relatedMotionRecords(
      businessMatch?.legalName || draft.seller,
      sellerPerson,
      draft.saleDate,
      input.motionRecords,
    );
    const convergence = exitConvergence({
      id,
      commercial,
      largeResidential,
      businessMatch,
      saleDate: draft.saleDate,
      relatedMotion: related,
    });
    const discrepancy = hasMaterialValueDiscrepancy(
      draft.cookSalePrice,
      draft.ptaxFullConsideration,
    );
    const address = addressRows[0];
    const geography = geographyRows[0];
    const dupageParcel = dupageParcels[0];
    const propertyAddress =
      dupageParcel?.address ||
      address?.address ||
      draft.address ||
      valuations[0]?.address ||
      "";
    const city = standardizedChicagoMetroCity(
      dupageParcel?.city ||
        address?.city ||
        draft.city ||
        geography?.city ||
        `${draft.county} County`,
    );
    const zip =
      dupageParcel?.zip || address?.zip || draft.zip || geography?.zip || "";
    const evidence: ChicagoPropertyEvidence[] = [];
    if (draft.cookRowIds.length)
      evidence.push({
        id: stableId(id, "cook"),
        sourceId: "cook_property_sales",
        publisher: "Cook County Assessor's Office",
        title: "Cook County Assessor parcel sale",
        sourceUrl: "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
        recordId: draft.documentNumber || draft.cookRowIds[0],
        retrievedAt: input.generatedAt,
        facts: [
          `${draft.pins.length} parcel${draft.pins.length === 1 ? "" : "s"}`,
          draft.cookSalePrice === null
            ? "Recorded price unavailable"
            : `Recorded price ${draft.cookSalePrice}`,
        ],
      });
    if (draft.declarationIds.length)
      evidence.push({
        id: stableId(id, "ptax"),
        sourceId: "illinois_ptax",
        publisher: "Illinois Department of Revenue",
        title: "Illinois PTAX-203 transfer declaration",
        sourceUrl: "https://data.illinois.gov/d/it54-y4c6",
        recordId: draft.declarationIds[0],
        retrievedAt: input.generatedAt,
        facts: [
          `${draft.county} County`,
          draft.documentNumber
            ? `Recorder document ${draft.documentNumber}`
            : "Recorder document number unavailable",
          draft.ptaxFullConsideration === null
            ? "Full consideration unavailable"
            : `Full consideration ${draft.ptaxFullConsideration}`,
          draft.ptaxNetConsideration === null
            ? "Net real-property consideration unavailable"
            : `Net real-property consideration ${draft.ptaxNetConsideration}`,
          draft.additionalSellersReported
            ? "Additional sellers reported on the declaration"
            : "No additional-seller flag reported",
          draft.additionalBuyersReported
            ? "Additional buyers reported on the declaration"
            : "No additional-buyer flag reported",
          draft.ptax203AAttached
            ? "PTAX-203-A attachment reported"
            : "No PTAX-203-A attachment reported",
          draft.ptax203BAttached
            ? "PTAX-203-B attachment reported"
            : "No PTAX-203-B attachment reported",
        ],
      });
    if (draft.county === "DuPage" && dupageParcel)
      evidence.push({
        id: stableId(id, "dupage-parcel"),
        sourceId: "dupage_property_lookup",
        publisher: "DuPage County",
        title: "DuPage County property record and GIS parcel match",
        sourceUrl: `https://propertylookup.dupagecounty.gov/Datalets/Datalet.aspx?UseSearch=no&pin=${dupageParcel.pin.slice(-10)}`,
        recordId: dupageParcel.pin.slice(-10),
        retrievedAt: dupageParcel.retrievedAt || input.generatedAt,
        facts: [
          dupageParcel.address || "Situs address unavailable",
          dupageParcel.city || "Municipality unavailable",
          dupageParcel.propertyClass
            ? `County property class ${dupageParcel.propertyClass}`
            : "County property class unavailable",
          "Parcel geometry used for the map; situs record only",
        ],
      });
    if (draft.county === "DuPage" && draft.documentNumber)
      evidence.push({
        id: stableId(id, "dupage-recorder"),
        sourceId: "dupage_recorder",
        publisher: "DuPage County Recorder",
        title: "DuPage County Recorder targeted document lookup",
        sourceUrl: "https://recorder.dupageco.org/Search.aspx",
        recordId: draft.documentNumber,
        retrievedAt: input.generatedAt,
        facts: [
          `Recorder document ${draft.documentNumber}`,
          "Official targeted verification route; no bulk recorder crawling performed",
        ],
      });
    if (businessMatch)
      evidence.push({
        id: stableId(id, "business"),
        sourceId: "chicago_business_licenses",
        publisher: "City of Chicago",
        title: "Chicago business-license and owner match",
        sourceUrl: "https://data.cityofchicago.org/d/r5kz-chrr",
        recordId: businessMatch.accountNumber,
        retrievedAt: input.generatedAt,
        facts: [
          businessMatch.resolutionMethod,
          `${businessMatch.owners.length} public owner/officer record${businessMatch.owners.length === 1 ? "" : "s"}`,
        ],
      });
    return [
      {
        id,
        transactionKey: draft.transactionKey,
        sellerPerson,
        sellerEntity:
          businessMatch?.legalName || (directPerson ? "" : draft.seller),
        sellerOriginal: draft.seller,
        buyer: draft.buyer,
        resolutionMethod,
        resolutionConfidence,
        businessMatch,
        property: {
          county: draft.county,
          address: propertyAddress,
          city,
          state: "Illinois",
          zip,
          category: classification.category,
          categoryLabel: categoryLabel(classification.category),
          classificationBasis: classification.basis,
          sourceClassifications: unique([
            ...draft.sourceClasses.map(formattedClass),
            ...dupageParcels.map((parcel) =>
              parcel.propertyClass
                ? `DuPage class ${parcel.propertyClass.toUpperCase()}`
                : "",
            ),
            ...valuations.map((valuation) => valuation.sourceClass),
          ]),
          pins: draft.pins,
          parcelCount: Math.max(
            1,
            draft.reportedParcelCount,
            draft.pins.length,
          ),
          commercial,
          largeResidential,
          latitude: dupageParcel?.latitude ?? geography?.latitude ?? null,
          longitude: dupageParcel?.longitude ?? geography?.longitude ?? null,
        },
        transaction: {
          saleDate: draft.saleDate,
          documentNumber: draft.documentNumber,
          deedType: draft.deedTypes.join(" / ") || "Not reported",
          recordedSalePrice: draft.cookSalePrice,
          ptaxFullConsideration: draft.ptaxFullConsideration,
          ptaxNetConsideration: draft.ptaxNetConsideration,
          ptaxTaxableConsideration: draft.ptaxTaxableConsideration,
          valueStatus: values.length ? "RECORDED" : "UNKNOWN",
          displayValueLow: displayValue,
          displayValueHigh: displayValue,
          valueDiscrepancy: discrepancy,
          valueExplanation: discrepancy
            ? "Cook recorded sale price and PTAX full consideration differ materially; both are retained."
            : "Recorded consideration is shown as transaction value, not net cash received.",
          quality: quality.quality,
          qualityReasons: quality.reasons,
          multiParcel:
            draft.multiParcel ||
            draft.reportedParcelCount > 1 ||
            draft.pins.length > 1,
          additionalSellersReported: draft.additionalSellersReported,
          additionalBuyersReported: draft.additionalBuyersReported,
          ptax203AAttached: draft.ptax203AAttached,
          ptax203BAttached: draft.ptax203BAttached,
        },
        proceeds: {
          recordedSaleConsideration: displayValue,
          knownOwnershipShare: null,
          grossAttributableValue: null,
          potentialProceedsLow: null,
          potentialProceedsHigh: null,
          netProceedsKnown: false,
          explanation:
            "Net proceeds are unknown. Public records do not establish debt, liens, taxes, transaction costs, co-ownership, exchanges, or reinvestment.",
        },
        exitConvergence: convergence,
        repeatedSeller: {
          transactionCount: 1,
          totalRecordedDispositions: displayValue || 0,
          windowDays: 0,
        },
        evidence,
      } satisfies ChicagoPropertyRecord,
    ];
  });
  return { records, nonMarketTransfersExcluded, thresholdExcluded };
}

export function applyRepeatedSellerHistory(records: ChicagoPropertyRecord[]) {
  const bySeller = new Map<string, ChicagoPropertyRecord[]>();
  for (const record of records) {
    const key = normalizeEntityName(
      record.sellerEntity || record.sellerOriginal || record.sellerPerson,
    );
    if (!key) continue;
    bySeller.set(key, [...(bySeller.get(key) || []), record]);
  }
  for (const group of bySeller.values()) {
    group.sort((left, right) =>
      left.transaction.saleDate.localeCompare(right.transaction.saleDate),
    );
    for (const record of group) {
      const recent = group.filter((candidate) =>
        withinDays(
          record.transaction.saleDate,
          candidate.transaction.saleDate,
          365,
        ),
      );
      const dates = recent.map((candidate) =>
        Date.parse(`${candidate.transaction.saleDate}T00:00:00Z`),
      );
      record.repeatedSeller = {
        transactionCount: recent.length,
        totalRecordedDispositions: recent.reduce(
          (sum, candidate) =>
            sum + (candidate.proceeds.recordedSaleConsideration || 0),
          0,
        ),
        windowDays:
          dates.length > 1
            ? Math.round((Math.max(...dates) - Math.min(...dates)) / 86_400_000)
            : 0,
      };
    }
  }
  return records;
}

function valueBucket(value: number | null) {
  if (value === null) return "Unknown";
  if (value >= 100_000_000) return "$100M+";
  if (value >= 50_000_000) return "$50M-$100M";
  if (value >= 25_000_000) return "$25M-$50M";
  if (value >= 10_000_000) return "$10M-$25M";
  if (value >= 5_000_000) return "$5M-$10M";
  return "$1M-$5M";
}

export function chicagoPropertyStats(input: {
  records: ChicagoPropertyRecord[];
  duplicateTransactionsRemoved: number;
  nonMarketTransfersExcluded: number;
}) {
  const byPropertyType = Object.fromEntries(
    PROPERTY_CATEGORIES.map((category) => [category, 0]),
  ) as Record<PropertyCategory, number>;
  const byValueBucket: Record<string, number> = {
    "$1M-$5M": 0,
    "$5M-$10M": 0,
    "$10M-$25M": 0,
    "$25M-$50M": 0,
    "$50M-$100M": 0,
    "$100M+": 0,
    Unknown: 0,
  };
  const byExitConvergence: Record<string, number> = {
    "Asset Sale Only": 0,
    "Possible Exit Activity": 0,
    "Strong Exit Signals": 0,
    "High Exit Convergence": 0,
  };
  for (const record of input.records) {
    byPropertyType[record.property.category] += 1;
    byValueBucket[valueBucket(record.transaction.displayValueHigh)] += 1;
    byExitConvergence[record.exitConvergence.label] += 1;
  }
  const recorded = (record: ChicagoPropertyRecord) =>
    record.proceeds.recordedSaleConsideration || 0;
  const sellerCounties = new Map<string, Set<PropertyCounty>>();
  for (const record of input.records) {
    const seller = normalizeEntityName(
      record.sellerEntity || record.sellerOriginal || record.sellerPerson,
    );
    if (!seller) continue;
    const counties = sellerCounties.get(seller) || new Set<PropertyCounty>();
    counties.add(record.property.county);
    sellerCounties.set(seller, counties);
  }
  const crossCountySellers = new Set(
    [...sellerCounties.entries()]
      .filter(([, counties]) => counties.size > 1)
      .map(([seller]) => seller),
  );
  return {
    significantSales: input.records.length,
    commercialSales: input.records.filter(
      (record) => record.property.commercial,
    ).length,
    largeResidentialSales: input.records.filter(
      (record) => record.property.largeResidential,
    ).length,
    resolvedOwners: input.records.filter((record) => record.sellerPerson)
      .length,
    strongExitSignals: input.records.filter(
      (record) => record.exitConvergence.score >= 50,
    ).length,
    highExitSignals: input.records.filter(
      (record) => record.exitConvergence.score >= 75,
    ).length,
    recordedTransactionValue: input.records.reduce(
      (sum, record) => sum + recorded(record),
      0,
    ),
    commercialTransactionValue: input.records
      .filter((record) => record.property.commercial)
      .reduce((sum, record) => sum + recorded(record), 0),
    largeResidentialTransactionValue: input.records
      .filter((record) => record.property.largeResidential)
      .reduce((sum, record) => sum + recorded(record), 0),
    uniqueSellerEntities: new Set(
      input.records.map((record) =>
        normalizeEntityName(
          record.sellerEntity || record.sellerOriginal || record.sellerPerson,
        ),
      ),
    ).size,
    businessOwnerMatches: input.records.filter((record) =>
      record.businessMatch?.owners.some((owner) => owner.role === "OWNER"),
    ).length,
    licenseCancellationMatches: input.records.filter(
      (record) => record.exitConvergence.hasLicenseCancellation,
    ).length,
    otherBusinessExitMatches: input.records.filter(
      (record) => record.exitConvergence.hasBusinessExitEvidence,
    ).length,
    personResolvedTransactions: input.records.filter(
      (record) => record.sellerPerson,
    ).length,
    organizationOnlyTransactions: input.records.filter(
      (record) => !record.sellerPerson,
    ).length,
    duplicateTransactionsRemoved: input.duplicateTransactionsRemoved,
    nonMarketTransfersExcluded: input.nonMarketTransfersExcluded,
    ptaxMatches: input.records.filter(
      (record) => record.transaction.ptaxFullConsideration !== null,
    ).length,
    valueDiscrepancies: input.records.filter(
      (record) => record.transaction.valueDiscrepancy,
    ).length,
    cookSales: input.records.filter(
      (record) => record.property.county === "Cook",
    ).length,
    dupageSales: input.records.filter(
      (record) => record.property.county === "DuPage",
    ).length,
    cookRecordedValue: input.records
      .filter((record) => record.property.county === "Cook")
      .reduce((sum, record) => sum + recorded(record), 0),
    dupageRecordedValue: input.records
      .filter((record) => record.property.county === "DuPage")
      .reduce((sum, record) => sum + recorded(record), 0),
    crossCountySellerEntities: crossCountySellers.size,
    crossCountyRecordedValue: input.records
      .filter((record) =>
        crossCountySellers.has(
          normalizeEntityName(
            record.sellerEntity || record.sellerOriginal || record.sellerPerson,
          ),
        ),
      )
      .reduce((sum, record) => sum + recorded(record), 0),
    byPropertyType,
    byValueBucket,
    byExitConvergence,
  };
}

export function isQualifiedPropertyMotionRecord(record: ChicagoPropertyRecord) {
  if (
    !["MARKET_SALE", "LIKELY_MARKET_SALE"].includes(
      record.transaction.quality,
    ) ||
    record.transaction.displayValueHigh === null
  )
    return false;
  if (record.property.commercial) return true;
  return (
    record.property.largeResidential &&
    Boolean(record.sellerPerson) &&
    record.exitConvergence.score >= 25
  );
}

export function propertyMotionEvents(
  records: ChicagoPropertyRecord[],
  retrievedAt: string,
) {
  return records.filter(isQualifiedPropertyMotionRecord).map((record) => {
    const primary = record.evidence[0];
    return {
      source_id: "chicago_property",
      source_type: `${record.property.county} County / Illinois recorded property disposition`,
      external_record_id: record.id,
      source_url:
        primary?.sourceUrl ||
        "https://datacatalog.cookcountyil.gov/d/wvhk-k5uv",
      retrieved_at: retrievedAt,
      published_at: record.transaction.saleDate,
      event_date: record.transaction.saleDate,
      event_type: "COMMERCIAL_REAL_ESTATE_SALE",
      event_stage: "CLOSED",
      raw_title: `${record.sellerPerson || record.sellerEntity || record.sellerOriginal} - ${record.property.categoryLabel}`,
      raw_text: `${record.property.address || record.property.city}; ${record.property.parcelCount} parcel${record.property.parcelCount === 1 ? "" : "s"}; recorded consideration is not net proceeds.`,
      seller_entity:
        record.sellerEntity || record.sellerOriginal || record.sellerPerson,
      buyer_entity: record.buyer,
      subject_person: record.sellerPerson,
      subject_company: record.sellerEntity,
      asset: record.property.address || `${record.property.city} property`,
      location: {
        country: "United States",
        state: "Illinois",
        city: record.property.city,
        basis: `${record.property.county} County parcel situs address; owner mailing addresses excluded`,
      },
      reported_transaction_value: record.transaction.displayValueHigh,
      currency: "USD",
      ownership_percentage_low: null,
      ownership_percentage_high: null,
      status: "recorded property sale",
      metadata: {
        valueClassification: "KNOWN",
        marketClass: "PRIVATE",
        subjectKind: record.sellerPerson
          ? "PERSON"
          : record.sellerEntity
            ? "ORGANIZATION"
            : "UNKNOWN",
        publisher:
          primary?.publisher ||
          (record.property.county === "DuPage"
            ? "Illinois Department of Revenue"
            : "Cook County Assessor's Office"),
        industry: "Real Estate",
        propertyCategory: record.property.category,
        propertyCounty: record.property.county,
        parcelCount: record.property.parcelCount,
        documentNumber: record.transaction.documentNumber,
        exitConvergenceScore: record.exitConvergence.score,
        netProceedsKnown: false,
        resolutionMethod: record.resolutionMethod,
      },
      raw_payload_hash: stableId(
        record.id,
        record.transaction.documentNumber,
        record.transaction.displayValueHigh === null
          ? ""
          : String(record.transaction.displayValueHigh),
      ),
    } satisfies NormalizedSourceEvent;
  });
}
