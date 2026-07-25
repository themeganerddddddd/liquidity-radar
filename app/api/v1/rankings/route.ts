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
  const ranked = people
    .filter(
      (person) => person.status !== "Pending review" && person.confidence >= 65,
    )
    .sort((a, b) => b.remaining.median - a.remaining.median)
    .slice(0, 25)
    .map((person, index) => ({ rank: index + 1, ...publicPerson(person) }));
  return apiResponse(ranked, id, {
    minimum_confidence: 65,
    ranking_method: "estimated_remaining_liquidity_median",
  });
}
