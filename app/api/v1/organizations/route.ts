import { organizationProfiles } from "../../../data";
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
    organizationProfiles.map((organization) => ({
      id: organization.id,
      slug: organization.slug,
      display_name: organization.name,
      organization_type: organization.type,
      industry: organization.industry,
      public_classification: organization.publicClassification,
      region_slugs: organization.regionSlugs,
      publication_status: "published",
    })),
    id,
  );
}
