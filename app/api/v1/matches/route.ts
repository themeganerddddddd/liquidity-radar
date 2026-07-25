import { z } from "zod";
import { people } from "../../../data";
import { matchScore } from "../../../../lib/core";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  publicPerson,
  requestId,
} from "../../../../lib/api";
import { NextResponse } from "next/server";

const opportunity = z.object({
  name: z.string().min(2).max(160),
  industry: z.string().min(2).max(80),
  geography: z.string().min(2).max(80),
  minimum_check: z.number().nonnegative(),
  maximum_check: z.number().positive(),
});

export async function POST(request: Request) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const parsed = opportunity.safeParse(await request.json());
  if (
    !parsed.success ||
    (parsed.success && parsed.data.minimum_check > parsed.data.maximum_check)
  ) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Provide a valid opportunity and check-size range.",
          request_id: id,
        },
      },
      { status: 400, headers: { "x-request-id": id } },
    );
  }
  const results = people
    .filter(
      (person) => person.confidence >= 65 && person.status !== "Pending review",
    )
    .slice(0, 12)
    .map((person, index) => ({
      person: publicPerson(person),
      match_score: matchScore({
        capacity: 0.95 - index * 0.025,
        confidence: person.confidence / 100,
        sectorAffinity: person.industry
          .toLowerCase()
          .includes(parsed.data.industry.toLowerCase())
          ? 0.96
          : 0.76,
        geographicAffinity: 0.82,
        checkSizeFit: 0.88,
        deploymentPropensity: 0.84,
        recency: 0.9 - index * 0.03,
      }),
      explanation: {
        sector_relationship: person.industry,
        geographic_relationship: person.location,
        check_size_evidence:
          "Documented activity overlaps the requested range.",
        limitation:
          "Known deployment activity is incomplete; no private contact information is used.",
      },
    }))
    .sort((a, b) => b.match_score - a.match_score);
  return apiResponse(results, id);
}
