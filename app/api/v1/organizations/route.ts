import { organizations } from "../../../data";
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
    organizations.map((name, index) => ({
      id: `org_${String(index + 1).padStart(3, "0")}`,
      display_name: name,
      organization_type: [
        "private_company",
        "acquirer",
        "investment_firm",
        "foundation",
        "family_office",
      ][index % 5],
      industry: [
        "Life Sciences",
        "Enterprise Software",
        "Climate Technology",
        "Advanced Manufacturing",
      ][index % 4],
      publication_status: "published",
    })),
    id,
  );
}
