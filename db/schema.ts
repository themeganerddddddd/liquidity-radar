import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const auditColumns = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  deletedAt: text("deleted_at"),
};

export const people = sqliteTable(
  "people",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    primaryRole: text("primary_role"),
    biography: text("biography"),
    profileStatus: text("profile_status").notNull().default("active"),
    publicationStatus: text("publication_status").notNull().default("draft"),
    privacyStatus: text("privacy_status").notNull().default("standard"),
    primaryLocationId: text("primary_location_id"),
    primaryOrganizationId: text("primary_organization_id"),
    currentLiquidityEstimateId: text("current_liquidity_estimate_id"),
    sourceCount: integer("source_count").notNull().default(0),
    lastMeaningfulEventAt: text("last_meaningful_event_at"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("people_slug_idx").on(table.slug),
    index("people_normalized_name_idx").on(table.normalizedName),
    index("people_publication_idx").on(table.publicationStatus),
  ],
);

export const organizations = sqliteTable(
  "organizations",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    organizationType: text("organization_type").notNull(),
    cik: text("cik"),
    website: text("website"),
    industry: text("industry"),
    naics: text("naics"),
    headquartersLocationId: text("headquarters_location_id"),
    publicClassification: text("public_classification")
      .notNull()
      .default("private"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
    index("organizations_cik_idx").on(table.cik),
    index("organizations_name_idx").on(table.normalizedName),
  ],
);

export const locations = sqliteTable(
  "locations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    geographicType: text("geographic_type").notNull(),
    parentLocationId: text("parent_location_id"),
    fipsCode: text("fips_code"),
    longitude: real("longitude"),
    latitude: real("latitude"),
    population: integer("population"),
    metadataSource: text("metadata_source"),
    effectiveFrom: text("effective_from"),
    effectiveThrough: text("effective_through"),
    ...auditColumns,
  },
  (table) => [
    index("locations_type_idx").on(table.geographicType),
    index("locations_fips_idx").on(table.fipsCode),
  ],
);

export const sourceDocuments = sqliteTable(
  "source_documents",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    publisher: text("publisher"),
    title: text("title").notNull(),
    originalUrl: text("original_url"),
    canonicalUrl: text("canonical_url"),
    filingAccessionNumber: text("filing_accession_number"),
    secFormType: text("sec_form_type"),
    cik: text("cik"),
    publishedAt: text("published_at"),
    retrievedAt: text("retrieved_at").notNull(),
    contentHash: text("content_hash").notNull(),
    mimeType: text("mime_type"),
    objectStorageKey: text("object_storage_key"),
    retrievalStatus: text("retrieval_status").notNull(),
    reliabilityTier: integer("reliability_tier").notNull(),
    licenseNotes: text("license_notes"),
    supersededAt: text("superseded_at"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("source_hash_idx").on(table.contentHash),
    uniqueIndex("source_accession_idx").on(table.filingAccessionNumber),
  ],
);

export const evidenceClaims = sqliteTable(
  "evidence_claims",
  {
    id: text("id").primaryKey(),
    subjectEntityType: text("subject_entity_type").notNull(),
    subjectEntityId: text("subject_entity_id").notNull(),
    predicate: text("predicate").notNull(),
    valueType: text("value_type").notNull(),
    structuredValue: text("structured_value"),
    displayValue: text("display_value").notNull(),
    classification: text("classification").notNull(),
    sourceDocumentId: text("source_document_id").notNull(),
    sourceExcerpt: text("source_excerpt"),
    sourceLocation: text("source_location"),
    reliabilityScore: integer("reliability_score").notNull(),
    analystStatus: text("analyst_status").notNull(),
    validFrom: text("valid_from"),
    validThrough: text("valid_through"),
    publicVisibility: integer("public_visibility", { mode: "boolean" })
      .notNull()
      .default(true),
    notes: text("notes"),
    ...auditColumns,
  },
  (table) => [
    index("claims_subject_idx").on(
      table.subjectEntityType,
      table.subjectEntityId,
    ),
    index("claims_source_idx").on(table.sourceDocumentId),
  ],
);

export const liquidityEvents = sqliteTable(
  "liquidity_events",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    organizationId: text("organization_id"),
    eventType: text("event_type").notNull(),
    eventDate: text("event_date").notNull(),
    announcementDate: text("announcement_date"),
    completionDate: text("completion_date"),
    status: text("status").notNull(),
    currency: text("currency").notNull().default("USD"),
    grossLow: integer("gross_low"),
    grossMedian: integer("gross_median"),
    grossHigh: integer("gross_high"),
    netLow: integer("net_low"),
    netMedian: integer("net_median"),
    netHigh: integer("net_high"),
    confidence: integer("confidence").notNull(),
    eventLocationId: text("event_location_id"),
    reviewState: text("review_state").notNull(),
    publicationState: text("publication_state").notNull(),
    calculationMethod: text("calculation_method"),
    modelRunId: text("model_run_id"),
    externalIdentifier: text("external_identifier"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("events_external_idx").on(table.externalIdentifier),
    index("events_date_idx").on(table.eventDate),
    index("events_publication_idx").on(table.publicationState),
    index("events_confidence_idx").on(table.confidence),
  ],
);

export const deploymentEvents = sqliteTable(
  "deployment_events",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    organizationId: text("organization_id"),
    deploymentType: text("deployment_type").notNull(),
    eventDate: text("event_date").notNull(),
    amountLow: integer("amount_low"),
    amountMedian: integer("amount_median"),
    amountHigh: integer("amount_high"),
    destinationLocationId: text("destination_location_id"),
    confidence: integer("confidence").notNull(),
    sourceDocumentId: text("source_document_id"),
    publicationState: text("publication_state").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("deployments_person_idx").on(table.personId),
    index("deployments_date_idx").on(table.eventDate),
  ],
);

export const modelRuns = sqliteTable(
  "model_runs",
  {
    id: text("id").primaryKey(),
    modelName: text("model_name").notNull(),
    modelVersion: text("model_version").notNull(),
    randomSeed: integer("random_seed").notNull(),
    inputSnapshot: text("input_snapshot").notNull(),
    configurationSnapshot: text("configuration_snapshot").notNull(),
    sampleCount: integer("sample_count").notNull(),
    outputPercentiles: text("output_percentiles"),
    confidenceComponents: text("confidence_components"),
    sensitivityAnalysis: text("sensitivity_analysis"),
    codeVersion: text("code_version"),
    status: text("status").notNull(),
    errorInformation: text("error_information"),
    executedAt: text("executed_at").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("model_runs_model_idx").on(table.modelName, table.modelVersion),
  ],
);

export const liquidityEstimates = sqliteTable(
  "liquidity_estimates",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    remainingLow: integer("remaining_low").notNull(),
    remainingMedian: integer("remaining_median").notNull(),
    remainingHigh: integer("remaining_high").notNull(),
    createdLow: integer("created_low").notNull(),
    createdMedian: integer("created_median").notNull(),
    createdHigh: integer("created_high").notNull(),
    knownDeploymentLow: integer("known_deployment_low").notNull(),
    knownDeploymentMedian: integer("known_deployment_median").notNull(),
    knownDeploymentHigh: integer("known_deployment_high").notNull(),
    unobservedDeploymentLow: integer("unobserved_deployment_low").notNull(),
    unobservedDeploymentMedian: integer(
      "unobserved_deployment_median",
    ).notNull(),
    unobservedDeploymentHigh: integer("unobserved_deployment_high").notNull(),
    confidenceScore: integer("confidence_score").notNull(),
    radarScore: integer("radar_score").notNull(),
    modelRunId: text("model_run_id").notNull(),
    estimateDate: text("estimate_date").notNull(),
    recalculateAt: text("recalculate_at"),
    ...auditColumns,
  },
  (table) => [
    index("estimates_person_idx").on(table.personId),
    index("estimates_median_idx").on(table.remainingMedian),
    index("estimates_confidence_idx").on(table.confidenceScore),
  ],
);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  seats: integer("seats").notNull(),
  restrictedUseAcknowledgedAt: text("restricted_use_acknowledged_at"),
  billingCustomerReference: text("billing_customer_reference"),
  ...auditColumns,
});

export const workspaceRecords = sqliteTable(
  "workspace_records",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userEmail: text("user_email").notNull(),
    recordType: text("record_type").notNull(),
    title: text("title").notNull(),
    payload: text("payload").notNull(),
    status: text("status").notNull().default("active"),
    ...auditColumns,
  },
  (table) => [
    index("workspace_records_owner_idx").on(
      table.workspaceId,
      table.recordType,
    ),
    index("workspace_records_user_idx").on(table.userEmail),
  ],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    name: text("name").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    keyHash: text("key_hash").notNull(),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("api_keys_hash_idx").on(table.keyHash)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    reason: text("reason"),
    requestId: text("request_id"),
    metadata: text("metadata"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => [
    index("audit_workspace_idx").on(table.workspaceId, table.createdAt),
  ],
);

export const privacyRequests = sqliteTable(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    requesterEmail: text("requester_email").notNull(),
    relationshipToSubject: text("relationship_to_subject").notNull(),
    subjectEntityType: text("subject_entity_type").notNull(),
    subjectEntityId: text("subject_entity_id"),
    requestType: text("request_type").notNull(),
    explanation: text("explanation").notNull(),
    jurisdiction: text("jurisdiction"),
    status: text("status").notNull(),
    assignedTo: text("assigned_to"),
    dueAt: text("due_at"),
    ...auditColumns,
  },
  (table) => [index("privacy_status_idx").on(table.status, table.dueAt)],
);

export const jobRuns = sqliteTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    jobType: text("job_type").notNull(),
    status: text("status").notNull(),
    inputHash: text("input_hash"),
    recordsProcessed: integer("records_processed").notNull().default(0),
    attempts: integer("attempts").notNull().default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    errorInformation: text("error_information"),
    ...auditColumns,
  },
  (table) => [
    index("jobs_status_idx").on(table.status, table.createdAt),
    uniqueIndex("jobs_idempotency_idx").on(table.jobType, table.inputHash),
  ],
);
