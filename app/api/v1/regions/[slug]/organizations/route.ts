import {
  getRegion,
  organizationsConnectedToRegion,
} from "../../../../../../lib/data-query";
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
  const records = organizationsConnectedToRegion(slug);
  return apiResponse(records, id, { result_count: records.length });
}
