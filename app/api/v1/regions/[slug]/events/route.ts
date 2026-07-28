import {
  filterLiquidityEvents,
  getRegion,
  publicEvent,
} from "../../../../../../lib/data-query";
import { eventQuerySchema, queryObject } from "../../../../../../lib/regional";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
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
  const parsed = eventQuerySchema.safeParse(
    queryObject(new URL(request.url).searchParams),
  );
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
  const records = filterLiquidityEvents({ ...parsed.data, region: slug });
  return apiResponse(records.map(publicEvent), id, {
    result_count: records.length,
  });
}
