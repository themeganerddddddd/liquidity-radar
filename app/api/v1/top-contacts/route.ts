import { NextResponse } from "next/server";
import { loadCurrentChicagoPropertySnapshot } from "../../../../lib/server-chicago-property";
import { loadCurrentMotionSnapshot } from "../../../../lib/server-motion-snapshot";
import {
  buildTopContacts,
  CONTACT_WORKFLOW_STATUSES,
  TOP_CONTACT_GEOGRAPHIES,
  weekStart,
  type ContactWorkflowStatus,
  type PersistedRecommendationState,
  type ProfessionalContact,
  type RecommendationStatus,
  type TopContactGeography,
} from "../../../../lib/top-contacts";

const DEMO_API_KEY = "lr_demo_local_2026";
const recommendationStatuses: RecommendationStatus[] = [
  "ACTIVE",
  "SAVED",
  "SKIPPED",
];
const contactTypes: ProfessionalContact["type"][] = [
  "BUSINESS_EMAIL",
  "WORK_PHONE",
  "COMPANY_WEBSITE",
  "CONTACT_PAGE",
  "PROFESSIONAL_PROFILE",
];
const verificationStatuses: ProfessionalContact["verificationStatus"][] = [
  "VERIFIED_PUBLIC",
  "COMPANY_ROUTE",
  "PROFESSIONAL_PROFILE",
  "UNVERIFIED",
  "NOT_FOUND",
];

function requestId(request: Request) {
  return request.headers.get("x-request-id") || crypto.randomUUID();
}

function authorized(request: Request) {
  return (
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ===
    DEMO_API_KEY
  );
}

function unauthorized(id: string) {
  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message: "Provide a valid workspace API key as a Bearer token.",
        request_id: id,
      },
    },
    { status: 401, headers: { "x-request-id": id } },
  );
}

function geographyFrom(url: URL): TopContactGeography {
  const county = (url.searchParams.get("county") || "").toUpperCase();
  if (county === "COOK") return "COOK";
  if (county === "DUPAGE") return "DUPAGE";
  const location = (url.searchParams.get("location") || "")
    .toUpperCase()
    .replaceAll(" ", "_");
  return TOP_CONTACT_GEOGRAPHIES.includes(location as TopContactGeography)
    ? (location as TopContactGeography)
    : "CHICAGO_METRO";
}

async function persistence() {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return null;
  try {
    return await import("../../../../lib/server-top-contacts");
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const id = requestId(request);
  if (!authorized(request)) return unauthorized(id);
  const url = new URL(request.url);
  const geography = geographyFrom(url);
  const motion = await loadCurrentMotionSnapshot(request.url);
  const property = await loadCurrentChicagoPropertySnapshot(request.url);
  const currentWeek = weekStart(motion.generatedAt);
  const requestedWeek = url.searchParams.get("week") || currentWeek;
  const store = await persistence();

  if (requestedWeek === "history" || requestedWeek !== currentWeek) {
    let history: import("../../../../lib/top-contacts").TopContactRecommendation[] =
      [];
    if (store) {
      const selectedWeek =
        requestedWeek === "history"
          ? undefined
          : requestedWeek === "last"
            ? weekStart(
                new Date(
                  Date.parse(`${currentWeek}T00:00:00Z`) - 7 * 86_400_000,
                ),
              )
            : requestedWeek;
      try {
        history = await store.listHistoricalRecommendations({
          geographyId: geography,
          weekStart: selectedWeek,
          limit: requestedWeek === "history" ? 250 : 100,
        });
      } catch {
        history = [];
      }
    }
    return NextResponse.json(
      {
        data: history,
        meta: {
          scope: requestedWeek,
          geography,
          returned: history.length,
          generated_at: motion.generatedAt,
        },
        request_id: id,
      },
      { headers: { "x-request-id": id, "cache-control": "no-store" } },
    );
  }

  let states: PersistedRecommendationState[] = [];
  let manualContacts: ProfessionalContact[] = [];
  if (store) {
    try {
      [states, manualContacts] = await Promise.all([
        store.listRecommendationStates(),
        store.listProfessionalContacts(),
      ]);
    } catch {
      states = [];
      manualContacts = [];
    }
  }
  const status = url.searchParams.get("status") || "";
  const snapshot = buildTopContacts(motion, property, {
    geography,
    limit: Number(url.searchParams.get("limit") || 10),
    minimumProceeds: Number(url.searchParams.get("min_proceeds") || 0),
    maximumProceeds: Number(url.searchParams.get("max_proceeds") || 0),
    minimumPriority: Number(url.searchParams.get("min_priority") || 0),
    workflowStatus: CONTACT_WORKFLOW_STATUSES.includes(
      status as ContactWorkflowStatus,
    )
      ? (status as ContactWorkflowStatus)
      : "",
    includeContacted: url.searchParams.get("include_contacted") === "true",
    states,
    manualContacts,
  });
  if (store) {
    try {
      await store.persistCurrentRecommendations(snapshot);
    } catch {
      // Rankings remain available even when workflow persistence is degraded.
    }
  }
  return NextResponse.json(
    {
      data: snapshot.recommendations,
      stats: snapshot.stats,
      meta: snapshot,
      request_id: id,
    },
    { headers: { "x-request-id": id, "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const id = requestId(request);
  if (!authorized(request)) return unauthorized(id);
  const store = await persistence();
  if (!store) {
    return NextResponse.json(
      { error: { code: "persistence_unavailable", request_id: id } },
      { status: 503, headers: { "x-request-id": id } },
    );
  }
  const input = (await request.json()) as Record<string, unknown>;
  const action = String(input.action || "");
  try {
    if (action === "status") {
      const geographyId = String(
        input.geographyId || "",
      ) as TopContactGeography;
      const workflowStatus = String(
        input.workflowStatus || "",
      ) as ContactWorkflowStatus;
      const recommendationStatus = String(
        input.recommendationStatus || "ACTIVE",
      ) as RecommendationStatus;
      if (
        !TOP_CONTACT_GEOGRAPHIES.includes(geographyId) ||
        !CONTACT_WORKFLOW_STATUSES.includes(workflowStatus) ||
        !recommendationStatuses.includes(recommendationStatus)
      )
        throw new Error("Invalid recommendation status.");
      const state = await store.updateRecommendationState({
        weekStart: String(input.weekStart || ""),
        geographyId,
        personId: String(input.personId || ""),
        workflowStatus,
        recommendationStatus,
        reason: String(input.reason || "").slice(0, 500),
        actor: "Demo analyst",
      });
      return NextResponse.json(
        { data: state, request_id: id },
        { headers: { "x-request-id": id, "cache-control": "no-store" } },
      );
    }
    if (action === "contact") {
      const type = String(input.type || "") as ProfessionalContact["type"];
      const verificationStatus = String(
        input.verificationStatus || "",
      ) as ProfessionalContact["verificationStatus"];
      const sourceUrl = String(input.sourceUrl || "").trim();
      const value = String(input.value || "").trim();
      if (
        !contactTypes.includes(type) ||
        !verificationStatuses.includes(verificationStatus) ||
        !/^https:\/\//i.test(sourceUrl) ||
        !value
      )
        throw new Error(
          "A public HTTPS source and contact value are required.",
        );
      if (
        ["BUSINESS_EMAIL", "WORK_PHONE"].includes(type) &&
        verificationStatus !== "VERIFIED_PUBLIC"
      )
        throw new Error("Direct contact details must be publicly verified.");
      const now = new Date().toISOString();
      const contact: ProfessionalContact = {
        id: crypto.randomUUID(),
        personId: String(input.personId || ""),
        company: String(input.company || ""),
        type,
        value,
        sourceUrl,
        sourceName: String(input.sourceName || "Manual public-source review"),
        retrievedAt: String(input.retrievedAt || now).slice(0, 10),
        verificationStatus,
        notes: String(input.notes || "").slice(0, 1_000),
      };
      const saved = await store.saveProfessionalContact(contact);
      return NextResponse.json(
        { data: saved, request_id: id },
        { status: 201, headers: { "x-request-id": id } },
      );
    }
    throw new Error("Unsupported action.");
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_top_contact_update",
          message: error instanceof Error ? error.message : "Update failed.",
          request_id: id,
        },
      },
      { status: 400, headers: { "x-request-id": id } },
    );
  }
}
