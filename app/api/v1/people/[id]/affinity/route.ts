import { people, regions } from "../../../../../data";
import { getRegion } from "../../../../../../lib/data-query";
import { calculateAffinity } from "../../../../../../lib/regional";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  requestId,
} from "../../../../../../lib/api";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const { id: personId } = await context.params;
  const person = people.find(
    (record) => record.id === personId || record.slug === personId,
  );
  const regionSlug =
    new URL(request.url).searchParams.get("region") || "montgomery-county-md";
  const region = getRegion(regionSlug);
  if (!person || person.status === "Pending review" || !region) {
    return Response.json(
      {
        error: {
          code: "not_found",
          message: "Published person or region not found.",
          request_id: id,
        },
      },
      { status: 404 },
    );
  }
  return apiResponse(calculateAffinity(person, region, regions), id);
}
