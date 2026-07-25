import { events } from "../../../data";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  requestId,
} from "../../../../lib/api";

export function GET(request: Request) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  const limit = Math.min(
    100,
    Math.max(1, Number(new URL(request.url).searchParams.get("limit") || 25)),
  );
  return apiResponse(
    events.slice(0, limit).map((event) => ({
      id: event.id,
      person: event.person,
      organization: event.organization,
      event_type: event.type,
      event_date: event.date,
      location: event.place,
      gross_amount: { ...event.gross, currency: "USD" },
      estimated_net_amount: { ...event.net, currency: "USD" },
      confidence: event.confidence,
      status: event.status.toLowerCase(),
      classification: event.classification,
      primary_source: event.source,
    })),
    id,
    { next_cursor: events.length > limit ? "demo_event_cursor" : null },
  );
}
