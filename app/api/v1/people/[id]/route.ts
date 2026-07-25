import { people } from "../../../../data";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  publicPerson,
  requestId,
} from "../../../../../lib/api";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const { id: personId } = await context.params;
  const person = people.find(
    (item) => item.id === personId || item.slug === personId,
  );
  if (!person || person.status === "Pending review") {
    return NextResponse.json(
      {
        error: {
          code: "not_found",
          message: "Published person record not found.",
          request_id: id,
        },
      },
      { status: 404, headers: { "x-request-id": id } },
    );
  }
  return apiResponse(
    {
      ...publicPerson(person),
      liquidity_created: { ...person.created, currency: "USD" },
      known_deployments: { ...person.deployed, currency: "USD" },
      source_count: person.sourceCount,
      evidence_lineage_available: true,
    },
    id,
  );
}
