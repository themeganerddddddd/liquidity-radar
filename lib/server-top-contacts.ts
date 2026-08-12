import type {
  ContactWorkflowStatus,
  PersistedRecommendationState,
  ProfessionalContact,
  RecommendationStatus,
  TopContactGeography,
  TopContactRecommendation,
  TopContactsSnapshot,
} from "./top-contacts";

type RecommendationRow = {
  id: string;
  week_start: string;
  geography_id: TopContactGeography;
  rank: number;
  person_id: string;
  workflow_status: ContactWorkflowStatus;
  recommendation_status: RecommendationStatus;
  skip_reason: string;
  last_material_event_at: string;
  last_updated_at: string;
  payload_json: string;
};

type ContactRow = {
  id: string;
  person_id: string;
  company: string;
  contact_type: ProfessionalContact["type"];
  contact_value: string;
  source_url: string;
  source_name: string;
  retrieved_at: string;
  verification_status: ProfessionalContact["verificationStatus"];
  notes: string;
};

async function topContactsDatabase() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Top Contacts database is unavailable.");
  return env.DB;
}

function stateFromRow(row: RecommendationRow): PersistedRecommendationState {
  return {
    weekStart: row.week_start,
    geographyId: row.geography_id,
    personId: row.person_id,
    workflowStatus: row.workflow_status,
    recommendationStatus: row.recommendation_status,
    skipReason: row.skip_reason,
    lastMaterialEventAt: row.last_material_event_at,
    lastUpdatedAt: row.last_updated_at,
  };
}

function contactFromRow(row: ContactRow): ProfessionalContact {
  return {
    id: row.id,
    personId: row.person_id,
    company: row.company,
    type: row.contact_type,
    value: row.contact_value,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    retrievedAt: row.retrieved_at,
    verificationStatus: row.verification_status,
    notes: row.notes,
  };
}

export async function listRecommendationStates() {
  const database = await topContactsDatabase();
  const result = await database
    .prepare(
      `SELECT id, week_start, geography_id, rank, person_id,
      workflow_status, recommendation_status, skip_reason,
      last_material_event_at, last_updated_at, payload_json
      FROM weekly_contact_recommendations
      ORDER BY last_updated_at DESC`,
    )
    .all<RecommendationRow>();
  return (result.results || []).map(stateFromRow);
}

export async function listProfessionalContacts() {
  const database = await topContactsDatabase();
  const result = await database
    .prepare(
      `SELECT id, person_id, company, contact_type, contact_value, source_url,
      source_name, retrieved_at, verification_status, notes
      FROM professional_contacts ORDER BY retrieved_at DESC`,
    )
    .all<ContactRow>();
  return (result.results || []).map(contactFromRow);
}

export async function persistCurrentRecommendations(
  snapshot: TopContactsSnapshot,
) {
  const database = await topContactsDatabase();
  const now = new Date().toISOString();
  const statements = snapshot.recommendations.map((recommendation) => {
    const id = `${recommendation.weekStart}:${recommendation.geographyId}:${recommendation.personId}`;
    return database
      .prepare(
        `INSERT INTO weekly_contact_recommendations (
          id, week_start, geography_id, rank, person_id, primary_event_id,
          contact_priority_score, estimated_proceeds_low,
          estimated_proceeds_high, location, why_now, contactability_status,
          workflow_status, recommendation_status, skip_reason,
          last_material_event_at, payload_json, generated_at,
          last_updated_at, created_at, updated_at, deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(week_start, geography_id, person_id) DO UPDATE SET
          rank = excluded.rank,
          primary_event_id = excluded.primary_event_id,
          contact_priority_score = excluded.contact_priority_score,
          estimated_proceeds_low = excluded.estimated_proceeds_low,
          estimated_proceeds_high = excluded.estimated_proceeds_high,
          location = excluded.location,
          why_now = excluded.why_now,
          contactability_status = excluded.contactability_status,
          last_material_event_at = excluded.last_material_event_at,
          payload_json = excluded.payload_json,
          generated_at = excluded.generated_at,
          updated_at = excluded.updated_at`,
      )
      .bind(
        id,
        recommendation.weekStart,
        recommendation.geographyId,
        recommendation.rank,
        recommendation.personId,
        recommendation.primaryEvent.id,
        recommendation.contactPriorityScore,
        recommendation.estimatedProceedsLow,
        recommendation.estimatedProceedsHigh,
        recommendation.location,
        recommendation.whyNow,
        recommendation.contactability,
        recommendation.workflowStatus,
        recommendation.recommendationStatus,
        "",
        recommendation.latestMaterialEventAt,
        JSON.stringify(recommendation),
        snapshot.generatedAt,
        now,
        now,
        now,
      );
  });
  if (statements.length) await database.batch(statements);
}

export async function listHistoricalRecommendations(input: {
  geographyId: TopContactGeography;
  weekStart?: string;
  limit?: number;
}) {
  const database = await topContactsDatabase();
  const statement = input.weekStart
    ? database
        .prepare(
          `SELECT id, week_start, geography_id, rank, person_id,
          workflow_status, recommendation_status, skip_reason,
          last_material_event_at, last_updated_at, payload_json
          FROM weekly_contact_recommendations
          WHERE geography_id = ? AND week_start = ?
          ORDER BY rank ASC LIMIT ?`,
        )
        .bind(input.geographyId, input.weekStart, input.limit || 100)
    : database
        .prepare(
          `SELECT id, week_start, geography_id, rank, person_id,
          workflow_status, recommendation_status, skip_reason,
          last_material_event_at, last_updated_at, payload_json
          FROM weekly_contact_recommendations
          WHERE geography_id = ?
          ORDER BY week_start DESC, rank ASC LIMIT ?`,
        )
        .bind(input.geographyId, input.limit || 250);
  const result = await statement.all<RecommendationRow>();
  return (result.results || []).map((row) => {
    const payload = JSON.parse(row.payload_json) as TopContactRecommendation;
    return {
      ...payload,
      workflowStatus: row.workflow_status,
      recommendationStatus: row.recommendation_status,
      weekStart: row.week_start,
      rank: row.rank,
    };
  });
}

export async function updateRecommendationState(input: {
  weekStart: string;
  geographyId: TopContactGeography;
  personId: string;
  workflowStatus: ContactWorkflowStatus;
  recommendationStatus: RecommendationStatus;
  reason: string;
  actor: string;
}) {
  const database = await topContactsDatabase();
  const row = await database
    .prepare(
      `SELECT id, week_start, geography_id, rank, person_id,
      workflow_status, recommendation_status, skip_reason,
      last_material_event_at, last_updated_at, payload_json
      FROM weekly_contact_recommendations
      WHERE week_start = ? AND geography_id = ? AND person_id = ?`,
    )
    .bind(input.weekStart, input.geographyId, input.personId)
    .first<RecommendationRow>();
  if (!row) throw new Error("Recommendation not found.");
  const now = new Date().toISOString();
  const historyId = crypto.randomUUID();
  await database.batch([
    database
      .prepare(
        `UPDATE weekly_contact_recommendations
        SET workflow_status = ?, recommendation_status = ?, skip_reason = ?,
        last_updated_at = ?, updated_at = ? WHERE id = ?`,
      )
      .bind(
        input.workflowStatus,
        input.recommendationStatus,
        input.reason,
        now,
        now,
        row.id,
      ),
    database
      .prepare(
        `INSERT INTO weekly_contact_history (
          id, recommendation_id, person_id, week_start, geography_id,
          previous_workflow_status, workflow_status,
          previous_recommendation_status, recommendation_status,
          reason, actor, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        historyId,
        row.id,
        input.personId,
        input.weekStart,
        input.geographyId,
        row.workflow_status,
        input.workflowStatus,
        row.recommendation_status,
        input.recommendationStatus,
        input.reason,
        input.actor,
        now,
      ),
  ]);
  return {
    ...stateFromRow(row),
    workflowStatus: input.workflowStatus,
    recommendationStatus: input.recommendationStatus,
    skipReason: input.reason,
    lastUpdatedAt: now,
  };
}

export async function saveProfessionalContact(contact: ProfessionalContact) {
  const database = await topContactsDatabase();
  const now = new Date().toISOString();
  await database.batch([
    database
      .prepare(
        `INSERT INTO professional_contacts (
        id, person_id, company, contact_type, contact_value, source_url,
        source_name, retrieved_at, verification_status, notes,
        created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      ON CONFLICT(person_id, contact_type, contact_value) DO UPDATE SET
        source_url = excluded.source_url,
        source_name = excluded.source_name,
        retrieved_at = excluded.retrieved_at,
        verification_status = excluded.verification_status,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      )
      .bind(
        contact.id,
        contact.personId,
        contact.company,
        contact.type,
        contact.value,
        contact.sourceUrl,
        contact.sourceName,
        contact.retrievedAt,
        contact.verificationStatus,
        contact.notes,
        now,
        now,
      ),
    database
      .prepare(
        `INSERT INTO audit_logs (
          id, workspace_id, actor_email, action, entity_type, entity_id,
          reason, request_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        "demo-workspace",
        "demo@liquidityradar.local",
        "professional_contact_saved",
        "professional_contact",
        contact.id,
        contact.notes,
        "",
        JSON.stringify({
          personId: contact.personId,
          type: contact.type,
          sourceUrl: contact.sourceUrl,
          verificationStatus: contact.verificationStatus,
        }),
        now,
      ),
  ]);
  return contact;
}
