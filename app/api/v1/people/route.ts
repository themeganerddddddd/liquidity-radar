import { people } from "../../../data";
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
  const query = (url.searchParams.get("q") || "").toLowerCase();
  const minimumConfidence = Number(
    url.searchParams.get("minimum_confidence") || 65,
  );
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") || 25)),
  );
  const data = people
    .filter(
      (person) =>
        person.status !== "Pending review" &&
        person.confidence >= minimumConfidence,
    )
    .filter((person) =>
      `${person.name} ${person.organization} ${person.location}`
        .toLowerCase()
        .includes(query),
    )
    .slice(0, limit)
    .map(publicPerson);
  return apiResponse(data, id, {
    next_cursor: data.length === limit ? "demo_cursor_next" : null,
  });
}
