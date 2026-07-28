import { getRegion } from "../../../../../lib/data-query";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  requestId,
} from "../../../../../lib/api";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const { slug } = await context.params;
  const region = getRegion(slug);
  if (!region) {
    return Response.json(
      {
        error: {
          code: "not_found",
          message: "Region not found.",
          request_id: id,
        },
      },
      { status: 404, headers: { "x-request-id": id } },
    );
  }
  return apiResponse(
    {
      ...region,
      estimate_range: {
        low: Math.round(region.controlled * 0.78),
        median: region.controlled,
        high: Math.round(region.controlled * 1.28),
        currency: "USD",
      },
      geographic_precision: region.type,
    },
    id,
  );
}
