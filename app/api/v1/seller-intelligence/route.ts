import { NextResponse } from "next/server";
import { loadCurrentChicagoPropertySnapshot } from "../../../../lib/server-chicago-property";
import {
  buildSellerIntelligence,
  sortSellerProfiles,
  type SellerManualRecord,
} from "../../../../lib/seller-intelligence";

const DEMO_API_KEY = "lr_demo_local_2026";

function booleanParameter(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (token !== DEMO_API_KEY) {
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

  const propertySnapshot = await loadCurrentChicagoPropertySnapshot(
    request.url,
  );
  let manualRecords: SellerManualRecord[] = [];
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    try {
      const { listSellerManualRecords } =
        await import("../../../../lib/server-seller-manual");
      manualRecords = await listSellerManualRecords();
    } catch {
      manualRecords = [];
    }
  }
  const snapshot = buildSellerIntelligence(propertySnapshot, manualRecords);
  const url = new URL(request.url);
  const seller = (url.searchParams.get("seller") || "").trim().toLowerCase();
  const person = (url.searchParams.get("person") || "").trim().toLowerCase();
  const location = (url.searchParams.get("location") || "")
    .trim()
    .toLowerCase();
  const minimumDispositions = Math.max(
    0,
    Number(url.searchParams.get("min_dispositions") || 0),
  );
  const minimumValue = Math.max(
    0,
    Number(url.searchParams.get("min_value") || 0),
  );
  const minimumExit = Math.max(
    0,
    Number(url.searchParams.get("min_exit_convergence") || 0),
  );
  const personResolved = booleanParameter(
    url.searchParams.get("person_resolved"),
  );
  const ownerFound = booleanParameter(url.searchParams.get("owner_found"));
  const multiple = booleanParameter(
    url.searchParams.get("multiple_dispositions"),
  );
  const businessExit = booleanParameter(
    url.searchParams.get("business_exit_candidate"),
  );
  const updatedSince = url.searchParams.get("updated_since") || "";
  const limit = Math.min(
    250,
    Math.max(1, Number(url.searchParams.get("limit") || 100)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const matched = sortSellerProfiles(
    snapshot.profiles.filter((profile) => {
      const hasPerson = profile.relatedPeople.length > 0;
      return (
        (!seller || profile.seller.toLowerCase().includes(seller)) &&
        (!person ||
          profile.relatedPeople.some((relationship) =>
            relationship.name.toLowerCase().includes(person),
          )) &&
        (!location ||
          profile.location.display.toLowerCase().includes(location)) &&
        profile.dispositionCount >= minimumDispositions &&
        profile.totalRecordedConsideration >= minimumValue &&
        profile.exitConvergence.score >= minimumExit &&
        (personResolved === null || hasPerson === personResolved) &&
        (ownerFound === null || profile.ownerFound === ownerFound) &&
        (multiple === null || profile.multipleDispositions === multiple) &&
        (businessExit === null ||
          profile.businessExitCandidate === businessExit) &&
        (!updatedSince || profile.latestUpdate >= updatedSince)
      );
    }),
    "priority",
    "desc",
  );
  const profiles = matched.slice(offset, offset + limit);

  return NextResponse.json(
    {
      data: profiles,
      meta: {
        returned: profiles.length,
        matched: matched.length,
        available: snapshot.stats.totalSellerEntities,
        offset,
        generated_at: snapshot.generatedAt,
        schema_version: snapshot.schemaVersion,
      },
      stats: snapshot.stats,
      disclaimer: snapshot.disclaimer,
      request_id: requestId,
    },
    {
      headers: {
        "x-request-id": requestId,
        "cache-control": "private, max-age=60",
      },
    },
  );
}
