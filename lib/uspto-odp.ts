import { strFromU8, unzipSync } from "fflate";
import {
  classifyPatentAssignment,
  stableId,
  type NormalizedSourceEvent,
  type SourceMode,
} from "./money-in-motion";

const PRODUCT_URL = "https://api.uspto.gov/api/v1/datasets/products/PASDL";
const MAX_COMPRESSED_BYTES = 25_000_000;
const MAX_INFLATED_BYTES = 125_000_000;
const MAX_EVENTS = 2_500;

type OdpFile = {
  fileName?: string;
  fileSize?: number;
  fileDownloadURI?: string;
  fileReleaseDate?: string;
};

type OdpProductResponse = {
  bulkDataProductBag?: Array<{
    productFileBag?: {
      fileDataBag?: OdpFile[];
    };
  }>;
};

export type UsptoOdpState = {
  version: 1;
  updatedAt: string;
  fileName: string;
  fileReleaseDate: string;
  recordsSeen: number;
  recordsRejected: number;
  events: NormalizedSourceEvent[];
};

export type UsptoOdpHealth = {
  mode: SourceMode;
  lastAttemptAt: string;
  lastSuccessAt: string;
  recordsSeen: number;
  recordsAccepted: number;
  recordsRejected: number;
  latencyMs: number | null;
  error: string;
  errorType: string;
  watermark: string;
  requests: number;
  successfulQueries: number;
  reason: string;
};

export function emptyUsptoOdpState(): UsptoOdpState {
  return {
    version: 1,
    updatedAt: "",
    fileName: "",
    fileReleaseDate: "",
    recordsSeen: 0,
    recordsRejected: 0,
    events: [],
  };
}

export function retainRecentUsptoEvents(
  current: NormalizedSourceEvent[],
  cached: NormalizedSourceEvent[],
) {
  const events = new Map<string, NormalizedSourceEvent>();
  for (const event of [...current, ...cached]) {
    const key = `${event.source_id}:${event.external_record_id}`;
    if (!events.has(key)) events.set(key, event);
  }
  return [...events.values()]
    .sort(
      (left, right) =>
        right.event_date.localeCompare(left.event_date) ||
        right.published_at.localeCompare(left.published_at),
    )
    .slice(0, MAX_EVENTS);
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .trim();
}

function blocks(xml: string, tag: string) {
  return [
    ...xml.matchAll(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"),
    ),
  ].map((match) => match[1]);
}

function text(xml: string, tag: string) {
  const value = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
  )?.[1];
  return value ? decodeXml(value.replace(/<[^>]+>/g, " ")) : "";
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function titleCase(value: string) {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/(^|[\s'\-/])\p{L}/gu, (letter) => letter.toLocaleUpperCase());
}

function displayPersonName(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  const [last, ...rest] = normalized.split(",").map((part) => part.trim());
  if (rest.length && rest.join(" ")) {
    return titleCase(`${rest.join(" ")} ${last}`);
  }
  return titleCase(normalized);
}

function likelyPerson(value: string) {
  if (!value || value.length > 100) return false;
  if (
    /\b(?:INC|INCORPORATED|LLC|L\.L\.C|CORP|CORPORATION|COMPANY|CO\.|LTD|LIMITED|LP|L\.P\.|PLC|GMBH|UNIVERSITY|COLLEGE|FOUNDATION|TRUST|HOLDINGS|ASSOCIATION|INSTITUTE|SOCIETY|PARTNERS|PARTNERSHIP|VENTURES|BANK|DEPARTMENT|GOVERNMENT|AGENCY)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  const words = value
    .replace(/[^\p{L}\s,'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return value.includes(",") || (words.length >= 2 && words.length <= 6);
}

function isoDate(value: string) {
  const compact = value.replace(/\D/g, "");
  if (compact.length < 8) return "";
  const normalized = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
  return Number.isNaN(Date.parse(normalized)) ? "" : normalized;
}

function isoTimestamp(value: string) {
  if (!value) return "";
  const normalized = value.includes("T")
    ? value
    : `${value.trim().replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function assignmentEvents(
  assignmentXml: string,
  context: {
    retrievedAt: string;
    publishedAt: string;
    sourceUrl: string;
    fileName: string;
  },
) {
  const record = blocks(assignmentXml, "assignment-record")[0] || "";
  const conveyance = text(record, "conveyance-text");
  const classification = classifyPatentAssignment(conveyance);
  if (!classification) return [];

  const reel = text(record, "reel-no");
  const frame = text(record, "frame-no");
  const recordedDate = isoDate(
    text(blocks(record, "recorded-date")[0] || "", "date"),
  );
  if (!reel || !frame || !recordedDate) return [];

  const assignorNames = unique(
    blocks(assignmentXml, "patent-assignor").map((entry) =>
      text(entry, "name"),
    ),
  );
  const assigneeBlocks = blocks(assignmentXml, "patent-assignee");
  const assigneeNames = unique(
    assigneeBlocks.map((entry) => text(entry, "name")),
  );
  if (!assignorNames.length || !assigneeNames.length) return [];

  const primaryAssigneeBlock = assigneeBlocks[0] || "";
  const assigneeCity = titleCase(text(primaryAssigneeBlock, "city"));
  const assigneeState = titleCase(text(primaryAssigneeBlock, "state"));
  const countryName = titleCase(
    text(primaryAssigneeBlock, "country-name") ||
      text(primaryAssigneeBlock, "country"),
  );
  const assigneeCountry = countryName || (assigneeState ? "United States" : "");

  const propertyBlocks = blocks(assignmentXml, "patent-property");
  const inventionTitles = unique(
    propertyBlocks.map((entry) => text(entry, "invention-title")),
  );
  const documentNumbers = unique(
    propertyBlocks.flatMap((entry) =>
      blocks(entry, "document-id").map((document) =>
        text(document, "doc-number"),
      ),
    ),
  );
  const asset =
    inventionTitles.slice(0, 2).join("; ") ||
    documentNumbers.slice(0, 4).join(", ") ||
    `USPTO reel ${reel}, frame ${frame}`;
  const personAssignors = assignorNames.filter(likelyPerson);
  const subjects = personAssignors.length
    ? personAssignors
    : [assignorNames[0]];
  const economicLanguage =
    /\b(?:sale|sold|purchase|acquisition|consideration)\b/i.test(conveyance);

  return subjects.map((subject) => {
    const isPerson = personAssignors.includes(subject);
    const person = isPerson ? displayPersonName(subject) : "";
    const seller = isPerson ? person : titleCase(subject);
    const buyer = assigneeNames.map(titleCase).join("; ");
    const externalId = `${reel}-${frame}:${stableId(subject)}`;
    const rawText = `${conveyance}. USPTO reel ${reel}, frame ${frame}; ${documentNumbers.length} patent document${documentNumbers.length === 1 ? "" : "s"}. ${economicLanguage ? "Transaction language appears in the conveyance, but cash consideration is not reported in this record." : "The assignment establishes a rights transfer; cash consideration is not reported and is not inferred."}`;
    const metadata = {
      assignmentReel: reel,
      assignmentFrame: frame,
      conveyance,
      fileName: context.fileName,
      documentNumbers: documentNumbers.slice(0, 12),
      valueClassification: "UNKNOWN",
      marketClass: "UNKNOWN",
      subjectKind: isPerson ? "PERSON" : "ORGANIZATION",
      publisher: "U.S. Patent and Trademark Office",
      role: isPerson ? "Patent assignor" : "Assignor organization",
      industry: "Intellectual property",
      ownershipEvidence: true,
      economicLanguage,
    };
    return {
      source_id: "uspto_assignments",
      source_type: "Patent Assignment XML (Ownership) Text - Daily",
      external_record_id: externalId,
      source_url: context.sourceUrl,
      retrieved_at: context.retrievedAt,
      published_at: context.publishedAt,
      event_date: recordedDate,
      event_type: classification.eventType,
      event_stage: classification.stage,
      raw_title: `Patent rights assignment from ${seller} to ${assigneeNames.map(titleCase).join("; ")}`,
      raw_text: rawText,
      seller_entity: seller,
      buyer_entity: buyer,
      subject_person: person,
      subject_company: isPerson ? titleCase(assigneeNames[0]) : seller,
      asset,
      location: {
        country: assigneeCountry,
        state: assigneeState,
        city: assigneeCity,
        basis:
          "USPTO-reported assignee business address; not assignor residence",
      },
      reported_transaction_value: null,
      currency: "USD",
      ownership_percentage_low: null,
      ownership_percentage_high: null,
      status: "recorded assignment",
      metadata,
      raw_payload_hash: stableId(
        "uspto_assignments",
        externalId,
        JSON.stringify(metadata),
      ),
    } satisfies NormalizedSourceEvent;
  });
}

export function parseUsptoAssignmentXml(
  xml: string,
  context: {
    retrievedAt: string;
    publishedAt: string;
    sourceUrl: string;
    fileName: string;
  },
) {
  const assignmentBlocks = blocks(xml, "patent-assignment");
  const eventGroups = assignmentBlocks.map((assignment) =>
    assignmentEvents(assignment, context),
  );
  const parsed = eventGroups.flat().sort((left, right) => {
    const economicDifference =
      Number(Boolean(right.metadata.economicLanguage)) -
      Number(Boolean(left.metadata.economicLanguage));
    return (
      economicDifference ||
      right.event_date.localeCompare(left.event_date) ||
      Number(Boolean(right.subject_person)) -
        Number(Boolean(left.subject_person))
    );
  });
  const events = parsed.slice(0, MAX_EVENTS);
  const rejectedAssignments = eventGroups.filter(
    (assignmentEvents) => assignmentEvents.length === 0,
  ).length;
  const truncatedEvents = Math.max(0, parsed.length - events.length);
  return {
    recordsSeen: parsed.length + rejectedAssignments,
    recordsAccepted: events.length,
    recordsRejected: rejectedAssignments + truncatedEvents,
    events,
  };
}

function cachedHealth(
  state: UsptoOdpState,
  now: string,
  mode: SourceMode,
  reason: string,
): UsptoOdpHealth {
  return {
    mode,
    lastAttemptAt: now,
    lastSuccessAt: state.updatedAt,
    recordsSeen: state.recordsSeen,
    recordsAccepted: state.events.length,
    recordsRejected: state.recordsRejected,
    latencyMs: null,
    error: "",
    errorType: "",
    watermark: state.fileReleaseDate,
    requests: 0,
    successfulQueries: 0,
    reason,
  };
}

export async function runUsptoOdpSync(input: {
  apiKey: string;
  state: UsptoOdpState;
  now: string;
  fetchImpl?: typeof fetch;
}) {
  const started = Date.now();
  const fetchImpl = input.fetchImpl || fetch;
  if (!input.apiKey) {
    const hasCache = input.state.events.length > 0;
    return {
      state: input.state,
      events: input.state.events,
      health: cachedHealth(
        input.state,
        input.now,
        hasCache ? "DEGRADED" : "CONFIGURATION_REQUIRED",
        hasCache
          ? "Serving the last successful current-ODP daily assignment release; USPTO_API_KEY is unavailable for refresh."
          : "Add USPTO_API_KEY for the current Open Data Portal. Retired Developer Hub endpoints are not used.",
      ),
    };
  }

  let requests = 0;
  try {
    const headers = { "X-API-KEY": input.apiKey, Accept: "application/json" };
    requests += 1;
    const metadataResponse = await fetchImpl(PRODUCT_URL, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!metadataResponse.ok) {
      throw new Error(
        `USPTO ODP product metadata returned ${metadataResponse.status}`,
      );
    }
    const metadata = (await metadataResponse.json()) as OdpProductResponse;
    const files =
      metadata.bulkDataProductBag?.[0]?.productFileBag?.fileDataBag || [];
    const latest = [...files]
      .filter(
        (file) =>
          /^ad\d{8}\.zip$/i.test(file.fileName || "") &&
          Boolean(file.fileDownloadURI) &&
          Number(file.fileSize || 0) > 0,
      )
      .sort((left, right) =>
        String(right.fileReleaseDate || "").localeCompare(
          String(left.fileReleaseDate || ""),
        ),
      )[0];
    if (!latest?.fileName || !latest.fileDownloadURI) {
      throw new Error("USPTO ODP did not return a current PASDL daily file");
    }
    if (Number(latest.fileSize) > MAX_COMPRESSED_BYTES) {
      throw new Error(
        `USPTO ODP daily file exceeds the ${MAX_COMPRESSED_BYTES}-byte safety limit`,
      );
    }

    const publishedAt = isoTimestamp(latest.fileReleaseDate || "") || input.now;
    if (input.state.fileName === latest.fileName && input.state.events.length) {
      const events = input.state.events.slice(0, MAX_EVENTS);
      const state = {
        ...input.state,
        recordsRejected:
          input.state.recordsRejected +
          Math.max(0, input.state.events.length - events.length),
        events,
      };
      return {
        state,
        events,
        health: {
          ...cachedHealth(
            state,
            input.now,
            "LIVE",
            `Current ODP metadata checked; serving up to ${MAX_EVENTS.toLocaleString("en-US")} events from the latest PASDL daily release with non-economic conveyances excluded.`,
          ),
          latencyMs: Date.now() - started,
          requests,
          successfulQueries: requests,
        },
      };
    }

    requests += 1;
    const fileResponse = await fetchImpl(latest.fileDownloadURI, {
      headers,
      signal: AbortSignal.timeout(60_000),
    });
    if (!fileResponse.ok) {
      throw new Error(`USPTO ODP daily file returned ${fileResponse.status}`);
    }
    const zipped = new Uint8Array(await fileResponse.arrayBuffer());
    if (zipped.byteLength > MAX_COMPRESSED_BYTES) {
      throw new Error(
        "USPTO ODP daily download exceeded the compressed safety limit",
      );
    }
    const unzipped = unzipSync(zipped);
    const xmlFiles = Object.entries(unzipped).filter(([name]) =>
      name.toLocaleLowerCase().endsWith(".xml"),
    );
    const inflatedBytes = xmlFiles.reduce(
      (sum, [, contents]) => sum + contents.byteLength,
      0,
    );
    if (!xmlFiles.length || inflatedBytes > MAX_INFLATED_BYTES) {
      throw new Error(
        "USPTO ODP archive failed XML count or inflated-size validation",
      );
    }
    const parsed = xmlFiles.reduce(
      (aggregate, [, contents]) => {
        const result = parseUsptoAssignmentXml(strFromU8(contents), {
          retrievedAt: input.now,
          publishedAt,
          sourceUrl: latest.fileDownloadURI || PRODUCT_URL,
          fileName: latest.fileName || "",
        });
        aggregate.recordsSeen += result.recordsSeen;
        aggregate.recordsRejected += result.recordsRejected;
        aggregate.events.push(...result.events);
        return aggregate;
      },
      {
        recordsSeen: 0,
        recordsRejected: 0,
        events: [] as NormalizedSourceEvent[],
      },
    );
    const retainedEvents = retainRecentUsptoEvents(
      parsed.events,
      input.state.events,
    );
    const uniqueEventCount = new Set(
      [...parsed.events, ...input.state.events].map(
        (event) => `${event.source_id}:${event.external_record_id}`,
      ),
    ).size;
    const state: UsptoOdpState = {
      version: 1,
      updatedAt: input.now,
      fileName: latest.fileName,
      fileReleaseDate: publishedAt,
      recordsSeen: Math.max(parsed.recordsSeen, retainedEvents.length),
      recordsRejected:
        parsed.recordsRejected +
        Math.max(0, uniqueEventCount - retainedEvents.length),
      events: retainedEvents,
    };
    return {
      state,
      events: state.events,
      health: {
        mode: "LIVE" as const,
        lastAttemptAt: input.now,
        lastSuccessAt: input.now,
        recordsSeen: state.recordsSeen,
        recordsAccepted: state.events.length,
        recordsRejected: state.recordsRejected,
        latencyMs: Date.now() - started,
        error: "",
        errorType: "",
        watermark: publishedAt,
        requests,
        successfulQueries: requests,
        reason: `Current ODP PASDL daily XML is active. Up to ${MAX_EVENTS.toLocaleString("en-US")} recent events are retained across daily releases; name changes, corrective records, and security interests are excluded, and no cash value is inferred.`,
      } satisfies UsptoOdpHealth,
    };
  } catch (error) {
    const hasCache = input.state.events.length > 0;
    const message = error instanceof Error ? error.message : String(error);
    return {
      state: input.state,
      events: input.state.events,
      health: {
        ...cachedHealth(
          input.state,
          input.now,
          hasCache ? "DEGRADED" : "ERROR",
          hasCache
            ? "USPTO ODP refresh failed; serving the last successful bounded daily release."
            : "USPTO ODP refresh failed and no prior daily release is cached.",
        ),
        latencyMs: Date.now() - started,
        error: message,
        errorType: "FETCH_OR_PARSE_ERROR",
        requests,
      },
    };
  }
}
