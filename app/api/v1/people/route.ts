import { filterRegionalPeople } from "../../../../lib/data-query";
import { peopleQuerySchema, queryObject } from "../../../../lib/regional";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  publicPerson,
  requestId,
} from "../../../../lib/api";

export function GET(request: Request) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const url = new URL(request.url);
  const parsed = peopleQuerySchema.safeParse(queryObject(url.searchParams));
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "invalid_parameters",
          message: "One or more people filters are invalid.",
          details: parsed.error.flatten(),
          request_id: id,
        },
      },
      { status: 400, headers: { "x-request-id": id } },
    );
  }
  const {
    cursor,
    limit: requestedLimit,
    affinityRegion,
    ...filters
  } = parsed.data;
  const limit = requestedLimit ?? 25;
  const offset = cursor ? Math.max(0, Number(cursor) || 0) : 0;
  const matched = filterRegionalPeople({
    ...filters,
    affinityRegion: affinityRegion || filters.region || "montgomery-county-md",
  });
  const data = matched.slice(offset, offset + limit).map((record) => ({
    ...publicPerson(record.person),
    affinity: record.affinity,
  }));
  const nextOffset = offset + data.length;
  return apiResponse(data, id, {
    result_count: matched.length,
    next_cursor: nextOffset < matched.length ? String(nextOffset) : null,
  });
}
