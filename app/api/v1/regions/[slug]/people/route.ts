import {
  filterRegionalPeople,
  getRegion,
} from "../../../../../../lib/data-query";
import { peopleQuerySchema, queryObject } from "../../../../../../lib/regional";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  publicPerson,
  requestId,
} from "../../../../../../lib/api";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const { slug } = await context.params;
  if (!getRegion(slug)) {
    return Response.json(
      {
        error: {
          code: "not_found",
          message: "Region not found.",
          request_id: id,
        },
      },
      { status: 404 },
    );
  }
  const url = new URL(request.url);
  const parsed = peopleQuerySchema.safeParse(queryObject(url.searchParams));
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "invalid_parameters",
          details: parsed.error.flatten(),
          request_id: id,
        },
      },
      { status: 400 },
    );
  }
  const records = filterRegionalPeople({
    ...parsed.data,
    region: slug,
    affinityRegion: parsed.data.affinityRegion || slug,
  });
  return apiResponse(
    records.map((record) => ({
      ...publicPerson(record.person),
      relationship_to_region: record.person.geographicRelationships.filter(
        (relationship) => relationship.regionSlug === slug,
      ),
      affinity: record.affinity,
    })),
    id,
    { result_count: records.length },
  );
}
