import { NextResponse } from "next/server";
import {
  PROPERTY_CATEGORIES,
  type ValueStatus,
} from "../../../../lib/chicago-property";
import { loadCurrentChicagoPropertySnapshot } from "../../../../lib/server-chicago-property";

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

  const snapshot = await loadCurrentChicagoPropertySnapshot(request.url);
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get("date_from") || "";
  const dateTo = url.searchParams.get("date_to") || "";
  const minValue = Number(url.searchParams.get("min_value") || 0);
  const maxValue = Number(url.searchParams.get("max_value") || 0);
  const propertyType =
    url.searchParams.get("property_type")?.toUpperCase() || "";
  const commercialOnly = booleanParameter(
    url.searchParams.get("commercial_only"),
  );
  const largeResidential = booleanParameter(
    url.searchParams.get("large_residential"),
  );
  const city = (url.searchParams.get("city") || "").trim().toLowerCase();
  const county = (url.searchParams.get("county") || "").trim().toLowerCase();
  const zip = (url.searchParams.get("zip") || "").trim();
  const seller = (url.searchParams.get("seller") || "").trim().toLowerCase();
  const personResolved = booleanParameter(
    url.searchParams.get("person_resolved"),
  );
  const minimumExit = Number(url.searchParams.get("min_exit_convergence") || 0);
  const businessExitSignal = booleanParameter(
    url.searchParams.get("business_exit_signal"),
  );
  const valueStatus = (
    url.searchParams.get("value_status") || ""
  ).toUpperCase() as ValueStatus | "";
  const limit = Math.min(
    250,
    Math.max(1, Number(url.searchParams.get("limit") || 100)),
  );
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const matched = snapshot.records.filter((record) => {
    const value = record.transaction.displayValueHigh || 0;
    const hasBusinessExit = record.exitConvergence.hasBusinessExitEvidence;
    return (
      (!dateFrom || record.transaction.saleDate >= dateFrom) &&
      (!dateTo || record.transaction.saleDate <= dateTo) &&
      (!minValue || value >= minValue) &&
      (!maxValue || value <= maxValue) &&
      (!propertyType ||
        (PROPERTY_CATEGORIES.includes(
          propertyType as (typeof PROPERTY_CATEGORIES)[number],
        ) &&
          record.property.category === propertyType)) &&
      (commercialOnly === null ||
        record.property.commercial === commercialOnly) &&
      (largeResidential === null ||
        record.property.largeResidential === largeResidential) &&
      (!city || record.property.city.toLowerCase() === city) &&
      (!county || record.property.county.toLowerCase() === county) &&
      (!zip || record.property.zip === zip) &&
      (!seller ||
        [record.sellerPerson, record.sellerEntity, record.sellerOriginal]
          .join(" ")
          .toLowerCase()
          .includes(seller)) &&
      (personResolved === null ||
        Boolean(record.sellerPerson) === personResolved) &&
      record.exitConvergence.score >= minimumExit &&
      (businessExitSignal === null || hasBusinessExit === businessExitSignal) &&
      (!valueStatus || record.transaction.valueStatus === valueStatus)
    );
  });

  const records = matched.slice(offset, offset + limit);
  return NextResponse.json(
    {
      data: records,
      meta: {
        returned: records.length,
        matched: matched.length,
        available: snapshot.stats.significantSales,
        offset,
        generated_at: snapshot.generatedAt,
        schema_version: snapshot.schemaVersion,
      },
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
