import { NextResponse } from "next/server";

export const DEMO_API_KEY = "lr_demo_local_2026";

export function requestId(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

export function apiUnauthorized(id: string) {
  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message: "Provide a valid workspace API key as a Bearer token.",
        request_id: id,
      },
    },
    { status: 401, headers: { "x-request-id": id } },
  );
}

export function authorizeApi(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  return token === DEMO_API_KEY;
}

export function apiResponse(
  data: unknown,
  id: string,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    {
      data,
      request_id: id,
      data_date: "2026-07-24",
      methodology_version: "LR-2.4",
      ...extra,
    },
    { headers: { "x-request-id": id, "cache-control": "private, max-age=60" } },
  );
}

export function publicPerson(person: {
  id: string;
  slug: string;
  name: string;
  role: string;
  organization: string;
  industry: string;
  location: string;
  remaining: { low: number; median: number; high: number };
  confidence: number;
  radar: number;
  status: string;
}) {
  return {
    id: person.id,
    slug: person.slug,
    display_name: person.name,
    primary_role: person.role,
    primary_organization: person.organization,
    industry: person.industry,
    primary_economic_location: person.location,
    estimated_remaining_liquidity: {
      ...person.remaining,
      currency: "USD",
      classification: "estimated",
    },
    confidence: person.confidence,
    radar_score: person.radar,
    publication_status: person.status.toLowerCase().replace(/\s+/g, "_"),
    estimate_date: "2026-07-24",
  };
}
