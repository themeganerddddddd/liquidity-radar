import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Unzip, UnzipInflate } from "fflate";
import {
  stableId,
  type NormalizedSourceEvent,
  type SourceMode,
} from "./money-in-motion";

const PRODUCT_URL = "https://api.uspto.gov/api/v1/datasets/products/PASDL";
const DEFAULT_MAX_DOWNLOAD_BYTES = 150_000_000;
const DEFAULT_MAX_DECOMPRESSED_BYTES = 1_250_000_000;
const DEFAULT_STREAM_CHUNK_BYTES = 1_048_576;
const DEFAULT_MAX_FILES_PER_RUN = 2;
const MAX_EVENTS = 2_500;
const MAX_PROCESSED_IDS = 30_000;
const MAX_PROCESSED_FILES = 60;

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

export const USPTO_CONVEYANCE_CATEGORIES = [
  "SALE_OR_ASSIGNMENT",
  "MERGER",
  "NAME_CHANGE",
  "SECURITY_INTEREST",
  "LIEN",
  "LICENSE",
  "CORRECTION",
  "INTERNAL_REORGANIZATION",
  "UNKNOWN",
] as const;

export type UsptoConveyanceCategory =
  (typeof USPTO_CONVEYANCE_CATEGORIES)[number];

export type UsptoClassification = {
  category: UsptoConveyanceCategory;
  accepted: boolean;
  reason: string;
};

export type UsptoClassificationCounts = Record<UsptoConveyanceCategory, number>;

export type UsptoCheckpoint = {
  fileName: string;
  fileReleaseDate: string;
  compressedBytes: number;
  decompressedBytes: number;
  recordsProcessed: number;
  updatedAt: string;
  status: "IDLE" | "DOWNLOADING" | "PROCESSING" | "INTERRUPTED" | "COMPLETE";
};

export type UsptoOdpState = {
  version: 2;
  updatedAt: string;
  fileName: string;
  fileReleaseDate: string;
  recordsSeen: number;
  recordsRejected: number;
  events: NormalizedSourceEvent[];
  processedFiles: string[];
  processedAssignmentIds: string[];
  checkpoint: UsptoCheckpoint;
  classificationCounts: UsptoClassificationCounts;
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
  nextRetryAt: string;
  requests: number;
  successfulQueries: number;
  reason: string;
  details: {
    currentFile: string;
    filesProcessed: string[];
    bytesDownloaded: number;
    bytesProcessed: number;
    recordsProcessed: number;
    currentCheckpoint: string;
    classificationCounts: UsptoClassificationCounts;
    transactionMatches: number;
    peakMemoryBytes: number | null;
  };
};

export type UsptoLimits = {
  maxDownloadBytes: number;
  maxDecompressedBytes: number;
  streamChunkBytes: number;
  maxFilesPerRun: number;
};

function emptyClassificationCounts(): UsptoClassificationCounts {
  return Object.fromEntries(
    USPTO_CONVEYANCE_CATEGORIES.map((category) => [category, 0]),
  ) as UsptoClassificationCounts;
}

function emptyCheckpoint(): UsptoCheckpoint {
  return {
    fileName: "",
    fileReleaseDate: "",
    compressedBytes: 0,
    decompressedBytes: 0,
    recordsProcessed: 0,
    updatedAt: "",
    status: "IDLE",
  };
}

export function emptyUsptoOdpState(): UsptoOdpState {
  return {
    version: 2,
    updatedAt: "",
    fileName: "",
    fileReleaseDate: "",
    recordsSeen: 0,
    recordsRejected: 0,
    events: [],
    processedFiles: [],
    processedAssignmentIds: [],
    checkpoint: emptyCheckpoint(),
    classificationCounts: emptyClassificationCounts(),
  };
}

function normalizeState(input: UsptoOdpState) {
  const empty = emptyUsptoOdpState();
  const supplied = (input || {}) as Partial<UsptoOdpState>;
  const processedFiles =
    supplied.processedFiles || (supplied.fileName ? [supplied.fileName] : []);
  const processedAssignmentIds = supplied.processedAssignmentIds || [
    ...new Set(
      (supplied.events || []).map(
        (event) => event.external_record_id.split(":")[0],
      ),
    ),
  ];
  return {
    ...empty,
    ...structuredClone(supplied),
    version: 2 as const,
    events: supplied.events || [],
    processedFiles,
    processedAssignmentIds,
    checkpoint: { ...empty.checkpoint, ...(supplied.checkpoint || {}) },
    classificationCounts: {
      ...empty.classificationCounts,
      ...(supplied.classificationCounts || {}),
    },
  } satisfies UsptoOdpState;
}

function configuredInteger(
  value: number | string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, Math.floor(parsed)))
    : fallback;
}

export function usptoLimits(overrides: Partial<UsptoLimits> = {}): UsptoLimits {
  return {
    maxDownloadBytes: configuredInteger(
      overrides.maxDownloadBytes ?? process.env.USPTO_MAX_DOWNLOAD_BYTES,
      DEFAULT_MAX_DOWNLOAD_BYTES,
      1_000_000,
      1_000_000_000,
    ),
    maxDecompressedBytes: configuredInteger(
      overrides.maxDecompressedBytes ??
        process.env.USPTO_MAX_DECOMPRESSED_BYTES,
      DEFAULT_MAX_DECOMPRESSED_BYTES,
      5_000_000,
      5_000_000_000,
    ),
    streamChunkBytes: configuredInteger(
      overrides.streamChunkBytes ?? process.env.USPTO_STREAM_CHUNK_BYTES,
      DEFAULT_STREAM_CHUNK_BYTES,
      65_536,
      8_388_608,
    ),
    maxFilesPerRun: configuredInteger(
      overrides.maxFilesPerRun ?? process.env.USPTO_MAX_FILES_PER_RUN,
      DEFAULT_MAX_FILES_PER_RUN,
      1,
      10,
    ),
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
  if (rest.length && rest.join(" "))
    return titleCase(`${rest.join(" ")} ${last}`);
  return titleCase(normalized);
}

function likelyPerson(value: string) {
  if (!value || value.length > 100) return false;
  if (
    /\b(?:INC|INCORPORATED|LLC|L\.L\.C|CORP|CORPORATION|COMPANY|CO\.|LTD|LIMITED|LP|L\.P\.|PLC|GMBH|UNIVERSITY|COLLEGE|FOUNDATION|TRUST|HOLDINGS|ASSOCIATION|INSTITUTE|SOCIETY|PARTNERS|PARTNERSHIP|VENTURES|BANK|DEPARTMENT|GOVERNMENT|AGENCY)\b/i.test(
      value,
    )
  )
    return false;
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

export function classifyUsptoConveyance(
  conveyance: string,
): UsptoClassification {
  const value = conveyance.replace(/\s+/g, " ").trim();
  if (/correct(?:ion|ive)|re-?record/i.test(value))
    return {
      category: "CORRECTION",
      accepted: false,
      reason:
        "Corrective or re-recorded instrument; not new liquidity evidence.",
    };
  if (/change of name|name change/i.test(value))
    return {
      category: "NAME_CHANGE",
      accepted: false,
      reason: "Entity name change without a commercial transfer.",
    };
  if (
    /internal reorg|internal corporate|intercompany|intra-?company/i.test(value)
  )
    return {
      category: "INTERNAL_REORGANIZATION",
      accepted: false,
      reason: "Internal reorganization without third-party liquidity evidence.",
    };
  if (/security interest|collateral|mortgage/i.test(value))
    return {
      category: "SECURITY_INTEREST",
      accepted: false,
      reason: "Financing or collateral instrument; not a sale.",
    };
  if (/\blien\b/i.test(value))
    return {
      category: "LIEN",
      accepted: false,
      reason: "Lien filing; not a commercial transfer.",
    };
  if (/\blicen[cs]e\b/i.test(value))
    return {
      category: "LICENSE",
      accepted: false,
      reason: "License rights alone do not establish assignment proceeds.",
    };
  if (/\bmerger\b/i.test(value))
    return {
      category: "MERGER",
      accepted: true,
      reason: "Recorded merger conveyance transfers patent rights.",
    };
  if (/assignment|sale|sold|purchase|acquisition|transfer/i.test(value))
    return {
      category: "SALE_OR_ASSIGNMENT",
      accepted: true,
      reason: "Recorded sale or assignment language transfers patent rights.",
    };
  return {
    category: "UNKNOWN",
    accepted: false,
    reason: "Conveyance does not establish a recognized commercial transfer.",
  };
}

type AssignmentContext = {
  retrievedAt: string;
  publishedAt: string;
  sourceUrl: string;
  fileName: string;
};

function parseAssignment(assignmentXml: string, context: AssignmentContext) {
  const record = blocks(assignmentXml, "assignment-record")[0] || "";
  const conveyance = text(record, "conveyance-text");
  const classification = classifyUsptoConveyance(conveyance);
  const reel = text(record, "reel-no");
  const frame = text(record, "frame-no");
  const assignmentId = reel && frame ? `${reel}-${frame}` : "";
  const recordedDate = isoDate(
    text(blocks(record, "recorded-date")[0] || "", "date"),
  );
  const assignorBlocks = blocks(assignmentXml, "patent-assignor");
  const assignorNames = unique(
    assignorBlocks.map((entry) => text(entry, "name")),
  );
  const executionDates = unique(
    assignorBlocks.map((entry) =>
      isoDate(text(blocks(entry, "execution-date")[0] || "", "date")),
    ),
  );
  const assigneeBlocks = blocks(assignmentXml, "patent-assignee");
  const assigneeNames = unique(
    assigneeBlocks.map((entry) => text(entry, "name")),
  );
  if (
    !classification.accepted ||
    !assignmentId ||
    !recordedDate ||
    !assignorNames.length ||
    !assigneeNames.length
  ) {
    return {
      assignmentId,
      classification,
      events: [] as NormalizedSourceEvent[],
    };
  }

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

  const events = subjects.map((subject) => {
    const isPerson = personAssignors.includes(subject);
    const person = isPerson ? displayPersonName(subject) : "";
    const seller = isPerson ? person : titleCase(subject);
    const buyer = assigneeNames.map(titleCase).join("; ");
    const externalId = `${assignmentId}:${stableId(subject)}`;
    const rawText = `${conveyance}. USPTO reel ${reel}, frame ${frame}; ${documentNumbers.length} patent document${documentNumbers.length === 1 ? "" : "s"}. ${economicLanguage ? "Transaction language appears in the conveyance, but cash consideration is not reported in this record." : "The assignment establishes a rights transfer; cash consideration is not reported and is not inferred."}`;
    const metadata = {
      assignmentId,
      assignmentReel: reel,
      assignmentFrame: frame,
      executionDates,
      recordationDate: recordedDate,
      conveyance,
      conveyanceClassification: classification.category,
      classificationReason: classification.reason,
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
      event_type:
        classification.category === "MERGER" ? "MERGER" : "PATENT_ASSIGNMENT",
      event_stage: "CLOSED",
      raw_title: `Patent rights ${classification.category === "MERGER" ? "merger transfer" : "assignment"} from ${seller} to ${buyer}`,
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
  return { assignmentId, classification, events };
}

export function parseUsptoAssignmentXml(
  xml: string,
  context: AssignmentContext,
) {
  const assignmentBlocks = blocks(xml, "patent-assignment");
  const classificationCounts = emptyClassificationCounts();
  const events: NormalizedSourceEvent[] = [];
  let rejected = 0;
  for (const assignment of assignmentBlocks) {
    const parsed = parseAssignment(assignment, context);
    classificationCounts[parsed.classification.category] += 1;
    if (!parsed.events.length) rejected += 1;
    events.push(...parsed.events);
  }
  const retained = events
    .sort((left, right) => right.event_date.localeCompare(left.event_date))
    .slice(0, MAX_EVENTS);
  return {
    recordsSeen: assignmentBlocks.length,
    recordsAccepted: retained.length,
    recordsRejected: rejected + Math.max(0, events.length - retained.length),
    events: retained,
    classificationCounts,
  };
}

function healthDetails(
  state: UsptoOdpState,
  filesProcessed: string[] = [],
  peakMemoryBytes: number | null = null,
) {
  return {
    currentFile: state.checkpoint.fileName || state.fileName,
    filesProcessed,
    bytesDownloaded: state.checkpoint.compressedBytes,
    bytesProcessed: state.checkpoint.decompressedBytes,
    recordsProcessed: state.checkpoint.recordsProcessed,
    currentCheckpoint: `${state.checkpoint.status}:${state.checkpoint.recordsProcessed}`,
    classificationCounts: state.classificationCounts,
    transactionMatches: 0,
    peakMemoryBytes,
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
    nextRetryAt: "",
    requests: 0,
    successfulQueries: 0,
    reason,
    details: healthDetails(state),
  };
}

function validArchiveContentType(value: string) {
  return /(?:zip|octet-stream|binary)/i.test(value);
}

export async function streamResponseToFile(input: {
  response: Response;
  filePath: string;
  maximumBytes: number;
}) {
  if (!input.response.body) throw new Error("USPTO_EMPTY_RESPONSE_BODY");
  const contentType = input.response.headers.get("content-type") || "";
  if (contentType && !validArchiveContentType(contentType))
    throw new Error(`USPTO_INVALID_CONTENT_TYPE:${contentType}`);
  const contentLength = Number(input.response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > input.maximumBytes)
    throw new Error(`USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:${contentLength}`);
  const handle = await fs.open(input.filePath, "wx");
  let downloadedBytes = 0;
  try {
    const reader = input.response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      downloadedBytes += value.byteLength;
      if (downloadedBytes > input.maximumBytes) {
        await reader.cancel("USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED");
        throw new Error(`USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:${downloadedBytes}`);
      }
      await handle.write(value);
    }
  } finally {
    await handle.close();
  }
  return downloadedBytes;
}

type StreamParseResult = {
  recordsSeen: number;
  recordsRejected: number;
  events: NormalizedSourceEvent[];
  assignmentIds: string[];
  classificationCounts: UsptoClassificationCounts;
  decompressedBytes: number;
};

class InterruptedProcessingError extends Error {
  partial: StreamParseResult | null = null;

  constructor() {
    super("USPTO_PROCESSING_INTERRUPTED");
  }
}

async function streamAssignmentArchive(input: {
  filePath: string;
  context: AssignmentContext;
  limits: UsptoLimits;
  alreadyProcessed: Set<string>;
  interruptAfterRecords?: number;
  checkpoint: UsptoCheckpoint;
}) {
  const result: StreamParseResult = {
    recordsSeen: 0,
    recordsRejected: 0,
    events: [],
    assignmentIds: [],
    classificationCounts: emptyClassificationCounts(),
    decompressedBytes: 0,
  };
  let xmlFileCount = 0;
  let streamError: Error | null = null;
  const decoders = new Set<TextDecoder>();
  const buffers = new Map<TextDecoder, string>();

  const processText = (
    decoder: TextDecoder,
    chunk: Uint8Array,
    final: boolean,
  ) => {
    let buffer =
      (buffers.get(decoder) || "") + decoder.decode(chunk, { stream: !final });
    while (true) {
      const start = buffer.search(/<patent-assignment(?:\s|>)/i);
      if (start < 0) {
        buffer = buffer.slice(-64);
        break;
      }
      const tail = buffer.slice(start);
      const endMatch = /<\/patent-assignment>/i.exec(tail);
      if (!endMatch) {
        buffer = tail;
        if (buffer.length > input.limits.maxDecompressedBytes)
          throw new Error("USPTO_XML_RECORD_EXCEEDS_DECOMPRESSED_LIMIT");
        break;
      }
      const end = start + endMatch.index + endMatch[0].length;
      const assignmentXml = buffer.slice(start, end);
      buffer = buffer.slice(end);
      const parsed = parseAssignment(assignmentXml, input.context);
      result.recordsSeen += 1;
      input.checkpoint.recordsProcessed = result.recordsSeen;
      result.classificationCounts[parsed.classification.category] += 1;
      if (!parsed.events.length) result.recordsRejected += 1;
      if (
        parsed.assignmentId &&
        !input.alreadyProcessed.has(parsed.assignmentId)
      ) {
        input.alreadyProcessed.add(parsed.assignmentId);
        result.assignmentIds.push(parsed.assignmentId);
        result.events.push(...parsed.events);
        if (result.assignmentIds.length > MAX_PROCESSED_IDS)
          result.assignmentIds.splice(
            0,
            result.assignmentIds.length - MAX_PROCESSED_IDS,
          );
        if (result.events.length > MAX_EVENTS * 2) {
          result.events = retainRecentUsptoEvents(result.events, []);
        }
      }
      if (
        input.interruptAfterRecords &&
        result.recordsSeen >= input.interruptAfterRecords
      ) {
        const interrupted = new InterruptedProcessingError();
        interrupted.partial = result;
        throw interrupted;
      }
    }
    buffers.set(decoder, buffer);
  };

  const unzip = new Unzip((file) => {
    if (!file.name.toLocaleLowerCase().endsWith(".xml")) return;
    xmlFileCount += 1;
    if (
      file.originalSize &&
      file.originalSize > input.limits.maxDecompressedBytes
    ) {
      streamError = new Error(
        `USPTO_MAX_DECOMPRESSED_BYTES_EXCEEDED:${file.originalSize}`,
      );
      return;
    }
    const decoder = new TextDecoder();
    decoders.add(decoder);
    buffers.set(decoder, "");
    file.ondata = (error, data, final) => {
      if (streamError) return;
      if (error) {
        streamError = error;
        return;
      }
      try {
        result.decompressedBytes += data.byteLength;
        input.checkpoint.decompressedBytes = result.decompressedBytes;
        if (result.decompressedBytes > input.limits.maxDecompressedBytes)
          throw new Error(
            `USPTO_MAX_DECOMPRESSED_BYTES_EXCEEDED:${result.decompressedBytes}`,
          );
        processText(decoder, data, final);
      } catch (caught) {
        streamError =
          caught instanceof Error ? caught : new Error(String(caught));
        file.terminate();
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  const handle = await fs.open(input.filePath, "r");
  const chunk = new Uint8Array(input.limits.streamChunkBytes);
  try {
    while (true) {
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) break;
      unzip.push(chunk.slice(0, bytesRead), false);
      if (streamError) throw streamError;
    }
    unzip.push(new Uint8Array(), true);
    if (streamError) throw streamError;
  } finally {
    await handle.close();
  }
  if (!xmlFileCount) throw new Error("USPTO_ARCHIVE_CONTAINS_NO_XML");
  return result;
}

function candidateFiles(metadata: OdpProductResponse, state: UsptoOdpState) {
  const files =
    metadata.bulkDataProductBag?.[0]?.productFileBag?.fileDataBag || [];
  const daily = files
    .filter(
      (file) =>
        /^ad\d{8}\.zip$/i.test(file.fileName || "") &&
        Boolean(file.fileDownloadURI) &&
        Number(file.fileSize || 0) > 0,
    )
    .sort((left, right) =>
      String(left.fileReleaseDate || "").localeCompare(
        String(right.fileReleaseDate || ""),
      ),
    );
  const processed = new Set(state.processedFiles);
  const pending = daily.filter((file) => {
    if (processed.has(file.fileName || "")) return false;
    if (!state.fileReleaseDate) return true;
    return (
      (isoTimestamp(file.fileReleaseDate || "") || "") > state.fileReleaseDate
    );
  });
  return state.fileReleaseDate ? pending : daily.slice(-1);
}

function mergeCounts(
  left: UsptoClassificationCounts,
  right: UsptoClassificationCounts,
) {
  const result = emptyClassificationCounts();
  for (const category of USPTO_CONVEYANCE_CATEGORIES)
    result[category] = left[category] + right[category];
  return result;
}

export async function runUsptoOdpSync(input: {
  apiKey: string;
  state: UsptoOdpState;
  now: string;
  fetchImpl?: typeof fetch;
  limits?: Partial<UsptoLimits>;
  tempRoot?: string;
  interruptAfterRecords?: number;
}) {
  const started = Date.now();
  const fetchImpl = input.fetchImpl || fetch;
  const limits = usptoLimits(input.limits);
  let state = normalizeState(input.state);
  const startingState = structuredClone(state);
  if (!input.apiKey) {
    const hasCache = state.events.length > 0;
    return {
      state,
      events: state.events,
      health: cachedHealth(
        state,
        input.now,
        hasCache ? "DEGRADED" : "CONFIGURATION_REQUIRED",
        hasCache
          ? "Serving the last successful streamed ODP daily assignment release; USPTO_API_KEY is unavailable for refresh."
          : "Add USPTO_API_KEY for the current Open Data Portal. Retired Developer Hub endpoints are not used.",
      ),
    };
  }

  let requests = 0;
  let successfulQueries = 0;
  const filesProcessed: string[] = [];
  const runEvents: NormalizedSourceEvent[] = [];
  const runAssignmentIds: string[] = [];
  let runRecordsSeen = 0;
  let runRecordsRejected = 0;
  let runCounts = emptyClassificationCounts();
  let temporaryDirectory = "";
  const peakMemoryStart = process.memoryUsage?.().rss || 0;
  try {
    const headers = { "X-API-KEY": input.apiKey, Accept: "application/json" };
    requests += 1;
    const metadataResponse = await fetchImpl(PRODUCT_URL, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    if (!metadataResponse.ok)
      throw new Error(`USPTO_ODP_METADATA_HTTP_${metadataResponse.status}`);
    successfulQueries += 1;
    const metadata = (await metadataResponse.json()) as OdpProductResponse;
    const pendingFiles = candidateFiles(metadata, state).slice(
      0,
      limits.maxFilesPerRun,
    );
    if (!pendingFiles.length) {
      state.checkpoint = {
        ...state.checkpoint,
        status: "COMPLETE",
        updatedAt: input.now,
      };
      return {
        state,
        events: state.events,
        health: {
          ...cachedHealth(
            state,
            input.now,
            "LIVE",
            "Current ODP metadata checked; no unprocessed PASDL daily release is available.",
          ),
          latencyMs: Date.now() - started,
          requests,
          successfulQueries,
          details: healthDetails(state),
        },
      };
    }

    temporaryDirectory = await fs.mkdtemp(
      path.join(input.tempRoot || os.tmpdir(), "liquidity-radar-uspto-"),
    );
    const processedIds = new Set(state.processedAssignmentIds);
    for (const file of pendingFiles) {
      const fileName = file.fileName || "";
      const sourceUrl = file.fileDownloadURI || PRODUCT_URL;
      const publishedAt = isoTimestamp(file.fileReleaseDate || "") || input.now;
      const declaredBytes = Number(file.fileSize || 0);
      if (declaredBytes > limits.maxDownloadBytes)
        throw new Error(`USPTO_MAX_DOWNLOAD_BYTES_EXCEEDED:${declaredBytes}`);
      state.checkpoint = {
        fileName,
        fileReleaseDate: publishedAt,
        compressedBytes: 0,
        decompressedBytes: 0,
        recordsProcessed: 0,
        updatedAt: input.now,
        status: "DOWNLOADING",
      };
      requests += 1;
      const fileResponse = await fetchImpl(sourceUrl, {
        headers,
        signal: AbortSignal.timeout(5 * 60_000),
      });
      if (!fileResponse.ok)
        throw new Error(`USPTO_ODP_FILE_HTTP_${fileResponse.status}`);
      const archivePath = path.join(temporaryDirectory, fileName);
      state.checkpoint.compressedBytes = await streamResponseToFile({
        response: fileResponse,
        filePath: archivePath,
        maximumBytes: limits.maxDownloadBytes,
      });
      successfulQueries += 1;
      state.checkpoint.status = "PROCESSING";
      const parsed = await streamAssignmentArchive({
        filePath: archivePath,
        context: {
          retrievedAt: input.now,
          publishedAt,
          sourceUrl,
          fileName,
        },
        limits,
        alreadyProcessed: processedIds,
        interruptAfterRecords: input.interruptAfterRecords,
        checkpoint: state.checkpoint,
      });
      runRecordsSeen += parsed.recordsSeen;
      runRecordsRejected += parsed.recordsRejected;
      runEvents.push(...parsed.events);
      runAssignmentIds.push(...parsed.assignmentIds);
      runCounts = mergeCounts(runCounts, parsed.classificationCounts);
      filesProcessed.push(fileName);
      state.fileName = fileName;
      state.fileReleaseDate = publishedAt;
      state.processedFiles = [
        ...new Set([...state.processedFiles, fileName]),
      ].slice(-MAX_PROCESSED_FILES);
      state.checkpoint.status = "COMPLETE";
      await fs.unlink(archivePath);
    }

    const retainedEvents = retainRecentUsptoEvents(runEvents, state.events);
    state = {
      ...state,
      updatedAt: input.now,
      recordsSeen: runRecordsSeen,
      recordsRejected:
        runRecordsRejected +
        Math.max(
          0,
          runEvents.length + state.events.length - retainedEvents.length,
        ),
      events: retainedEvents,
      processedAssignmentIds: [
        ...new Set([...state.processedAssignmentIds, ...runAssignmentIds]),
      ].slice(-MAX_PROCESSED_IDS),
      classificationCounts: runCounts,
      checkpoint: {
        ...state.checkpoint,
        updatedAt: input.now,
        status: "COMPLETE",
      },
    };
    const peakMemoryBytes = Math.max(
      peakMemoryStart,
      process.memoryUsage?.().rss || 0,
    );
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
        watermark: state.fileReleaseDate,
        nextRetryAt: "",
        requests,
        successfulQueries,
        reason:
          "Current ODP PASDL daily ZIP is downloaded to a temporary file and XML is decompressed incrementally under separate compressed and decompressed limits. Only sale/assignment and merger conveyances are retained; no cash value is inferred.",
        details: healthDetails(state, filesProcessed, peakMemoryBytes),
      } satisfies UsptoOdpHealth,
    };
  } catch (error) {
    const interrupted = error instanceof InterruptedProcessingError;
    const message = error instanceof Error ? error.message : String(error);
    if (interrupted) {
      const partial = error.partial;
      if (partial) {
        runRecordsSeen += partial.recordsSeen;
        runRecordsRejected += partial.recordsRejected;
        runEvents.push(...partial.events);
        runAssignmentIds.push(...partial.assignmentIds);
        runCounts = mergeCounts(runCounts, partial.classificationCounts);
      }
      state = {
        ...state,
        recordsSeen: runRecordsSeen,
        recordsRejected: runRecordsRejected,
        processedAssignmentIds: [
          ...new Set([...state.processedAssignmentIds, ...runAssignmentIds]),
        ].slice(-MAX_PROCESSED_IDS),
        events: retainRecentUsptoEvents(runEvents, state.events),
        classificationCounts: runCounts,
        checkpoint: {
          ...state.checkpoint,
          status: "INTERRUPTED",
          updatedAt: input.now,
        },
      };
    } else {
      state = {
        ...startingState,
        checkpoint: {
          ...state.checkpoint,
          status: "INTERRUPTED",
          updatedAt: input.now,
        },
      };
    }
    const hasCache = state.events.length > 0;
    return {
      state,
      events: state.events,
      health: {
        ...cachedHealth(
          state,
          input.now,
          hasCache ? "DEGRADED" : "ERROR",
          interrupted
            ? "USPTO processing stopped at a persisted idempotent checkpoint; the same file can restart without duplicate events."
            : hasCache
              ? "USPTO ODP refresh failed in its isolated bounded stream; serving the last successful release."
              : "USPTO ODP refresh failed and no prior daily release is cached.",
        ),
        latencyMs: Date.now() - started,
        error: message,
        errorType: interrupted ? "INTERRUPTED" : "FETCH_OR_PARSE_ERROR",
        nextRetryAt: new Date(
          Date.parse(input.now) + 4 * 60 * 60 * 1000,
        ).toISOString(),
        requests,
        successfulQueries,
        details: healthDetails(state, filesProcessed),
      },
    };
  } finally {
    if (temporaryDirectory)
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
