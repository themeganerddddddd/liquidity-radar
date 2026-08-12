import { NextResponse } from "next/server";
import {
  listSellerManualRecords,
  saveSellerManualRecord,
} from "../../../../../lib/server-seller-manual";
import type { SellerManualRecord } from "../../../../../lib/seller-intelligence";
import {
  normalizeEntityName,
  stableId,
} from "../../../../../lib/money-in-motion";

const DEMO_API_KEY = "lr_demo_local_2026";

function unauthorized(requestId: string) {
  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message: "Provide a valid workspace API key as a Bearer token.",
        request_id: requestId,
      },
    },
    { status: 401, headers: { "x-request-id": requestId } },
  );
}

function authorized(request: Request) {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ===
    DEMO_API_KEY
  );
}

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  if (!authorized(request)) return unauthorized(requestId);
  const sellerKey = new URL(request.url).searchParams.get("seller_key") || "";
  const records = await listSellerManualRecords(sellerKey || undefined);
  return NextResponse.json(
    { data: records, request_id: requestId },
    { headers: { "x-request-id": requestId, "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  if (!authorized(request)) return unauthorized(requestId);
  const input = (await request.json()) as Partial<SellerManualRecord> & {
    managers?: string[] | string;
  };
  const entityLegalName = String(input.entityLegalName || "").trim();
  const sellerKey = normalizeEntityName(
    String(input.sellerKey || entityLegalName),
  );
  const sourceUrl = String(input.sourceUrl || "").trim();
  const lookupDate = String(input.lookupDate || "").slice(0, 10);
  const checkedBy = String(input.checkedBy || "Demo analyst").trim();
  if (
    !entityLegalName ||
    !sellerKey ||
    !/^https:\/\//i.test(sourceUrl) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(lookupDate)
  ) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_manual_record",
          message:
            "Entity legal name, HTTPS source URL, and lookup date are required.",
          request_id: requestId,
        },
      },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  const managers = Array.isArray(input.managers)
    ? input.managers
        .map(String)
        .map((value) => value.trim())
        .filter(Boolean)
    : String(input.managers || "")
        .split(/[,;\n]/)
        .map((value) => value.trim())
        .filter(Boolean);
  const now = new Date().toISOString();
  const record: SellerManualRecord = {
    id: stableId(
      "seller-manual",
      sellerKey,
      String(input.illinoisFileNumber || ""),
      sourceUrl,
      lookupDate,
    ),
    sellerKey,
    entityLegalName,
    illinoisFileNumber: String(input.illinoisFileNumber || "").trim(),
    entityType: String(input.entityType || "").trim(),
    entityStatus: String(input.entityStatus || "").trim(),
    formationDate: String(input.formationDate || "").slice(0, 10),
    president: String(input.president || "").trim(),
    secretary: String(input.secretary || "").trim(),
    managers,
    registeredAgent: String(input.registeredAgent || "").trim(),
    sourceUrl,
    lookupDate,
    checkedBy,
    createdAt: now,
    updatedAt: now,
  };
  await saveSellerManualRecord(record);
  return NextResponse.json(
    { data: record, request_id: requestId },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}
