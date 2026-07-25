import { organizations, people, regions } from "../../../data";
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
  const query = (
    new URL(request.url).searchParams.get("q") || ""
  ).toLowerCase();
  return apiResponse(
    {
      people: people
        .filter(
          (person) =>
            person.status !== "Pending review" &&
            person.name.toLowerCase().includes(query),
        )
        .slice(0, 10)
        .map(publicPerson),
      organizations: organizations
        .filter((name) => name.toLowerCase().includes(query))
        .slice(0, 10),
      regions: regions
        .filter((region) =>
          `${region.name} ${region.metro}`.toLowerCase().includes(query),
        )
        .slice(0, 10)
        .map((record) => {
          const { coordinates, ...region } = record;
          void coordinates;
          return region;
        }),
    },
    id,
  );
}
