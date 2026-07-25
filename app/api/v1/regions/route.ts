import { regions } from "../../../data";
import {
  apiResponse,
  apiUnauthorized,
  authorizeApi,
  requestId,
} from "../../../../lib/api";

export function GET(request: Request) {
  const id = requestId(request);
  if (!authorizeApi(request)) return apiUnauthorized(id);
  return apiResponse(
    regions.map((record) => {
      const { coordinates, ...region } = record;
      void coordinates;
      return {
        ...region,
        created_liquidity_classification: "estimated",
        known_deployment_coverage: "incomplete",
        geographic_precision: "metro",
      };
    }),
    id,
  );
}
