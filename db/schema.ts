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
    slug: text("slug"),
    name: text("name").notNull(),
    geographicType: text("geographic_type").notNull(),
    parentLocationId: text("parent_location_id"),
    fipsCode: text("fips_code"),
    stateCode: text("state_code"),
    metroName: text("metro_name"),
    countyName: text("county_name"),
    cityName: text("city_name"),
    normalizedLookup: text("normalized_lookup"),
    longitude: real("longitude"),
    latitude: real("latitude"),
    population: integer("population"),
    metadataSource: text("metadata_source"),
    effectiveFrom: text("effective_from"),
    effectiveThrough: text("effective_through"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("locations_slug_idx").on(table.slug),
    index("locations_type_idx").on(table.geographicType),
    index("locations_fips_idx").on(table.fipsCode),
    index("locations_parent_idx").on(table.parentLocationId),
    index("locations_lookup_idx").on(table.normalizedLookup),
  ],
);

export const personGeographicRelationships = sqliteTable(
  "person_geographic_relationships",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    locationId: text("location_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    evidenceClaimId: text("evidence_claim_id"),
    relationshipDate: text("relationship_date"),
    confidence: integer("confidence").notNull().default(65),
    publicVisibility: integer("public_visibility", { mode: "boolean" })
      .notNull()
      .default(true),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("person_geo_unique_idx").on(
      table.personId,
      table.locationId,
      table.relationshipType,
      table.evidenceClaimId,
    ),
    index("person_geo_person_idx").on(table.personId, table.relationshipType),
    index("person_geo_location_idx").on(
      table.locationId,
      table.relationshipType,
    ),
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

export const sourceRecords = sqliteTable(
  "source_records",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    externalRecordId: text("external_record_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    retrievedAt: text("retrieved_at").notNull(),
    publishedAt: text("published_at"),
    eventDate: text("event_date"),
    eventType: text("event_type").notNull(),
    eventStage: text("event_stage").notNull(),
    rawTitle: text("raw_title").notNull(),
    rawText: text("raw_text"),
    sellerEntity: text("seller_entity"),
    buyerEntity: text("buyer_entity"),
    subjectPerson: text("subject_person"),
    subjectCompany: text("subject_company"),
    asset: text("asset"),
    location: text("location"),
    reportedTransactionValue: integer("reported_transaction_value"),
    currency: text("currency").notNull().default("USD"),
    ownershipPercentageLow: real("ownership_percentage_low"),
    ownershipPercentageHigh: real("ownership_percentage_high"),
    status: text("status").notNull(),
    metadata: text("metadata"),
    rawPayloadHash: text("raw_payload_hash").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("source_records_external_idx").on(
      table.sourceId,
      table.externalRecordId,
    ),
    index("source_records_event_idx").on(
      table.eventType,
      table.eventStage,
      table.eventDate,
    ),
    index("source_records_hash_idx").on(table.rawPayloadHash),
  ],
);

export const entities = sqliteTable(
  "entities",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    entityType: text("entity_type").notNull(),
    marketClassification: text("market_classification")
      .notNull()
      .default("UNKNOWN"),
    industry: text("industry"),
    primaryLocationId: text("primary_location_id"),
    suppressionStatus: text("suppression_status").notNull().default("active"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("entities_slug_idx").on(table.slug),
    index("entities_name_idx").on(table.normalizedName),
    index("entities_type_idx").on(table.entityType),
  ],
);

export const entityAliases = sqliteTable(
  "entity_aliases",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id").notNull(),
    alias: text("alias").notNull(),
    normalizedAlias: text("normalized_alias").notNull(),
    aliasType: text("alias_type").notNull(),
    sourceRecordId: text("source_record_id"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("entity_alias_unique_idx").on(
      table.entityId,
      table.normalizedAlias,
      table.aliasType,
    ),
    index("entity_alias_lookup_idx").on(table.normalizedAlias),
  ],
);

export const personEntityRoles = sqliteTable(
  "person_entity_roles",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").notNull(),
    entityId: text("entity_id").notNull(),
    role: text("role").notNull(),
    ownershipPercentageLow: real("ownership_percentage_low"),
    ownershipPercentageHigh: real("ownership_percentage_high"),
    effectiveFrom: text("effective_from"),
    effectiveThrough: text("effective_through"),
    evidenceClaimId: text("evidence_claim_id"),
    confidence: integer("confidence").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("person_entity_person_idx").on(table.personId),
    index("person_entity_entity_idx").on(table.entityId),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    clusterKey: text("cluster_key").notNull(),
    eventType: text("event_type").notNull(),
    eventStage: text("event_stage").notNull(),
    eventDate: text("event_date").notNull(),
    announcedAt: text("announced_at"),
    closedAt: text("closed_at"),
    title: text("title").notNull(),
    summary: text("summary"),
    asset: text("asset"),
    locationId: text("location_id"),
    currency: text("currency").notNull().default("USD"),
    reportedValueLow: integer("reported_value_low"),
    reportedValueHigh: integer("reported_value_high"),
    valueClassification: text("value_classification")
      .notNull()
      .default("UNKNOWN"),
    confidence: integer("confidence").notNull(),
    publicationState: text("publication_state").notNull().default("draft"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("transactions_cluster_idx").on(table.clusterKey),
    index("transactions_stage_date_idx").on(table.eventStage, table.eventDate),
    index("transactions_type_idx").on(table.eventType),
  ],
);

export const transactionParties = sqliteTable(
  "transaction_parties",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    entityId: text("entity_id"),
    personId: text("person_id"),
    partyName: text("party_name").notNull(),
    partyRole: text("party_role").notNull(),
    identityClassification: text("identity_classification")
      .notNull()
      .default("UNKNOWN"),
    confidence: integer("confidence").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("transaction_parties_transaction_idx").on(table.transactionId),
    index("transaction_parties_entity_idx").on(table.entityId),
    index("transaction_parties_person_idx").on(table.personId),
  ],
);

export const ownershipEvidence = sqliteTable(
  "ownership_evidence",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    personId: text("person_id"),
    entityId: text("entity_id"),
    ownershipLow: real("ownership_low"),
    ownershipHigh: real("ownership_high"),
    classification: text("classification").notNull(),
    methodology: text("methodology").notNull(),
    sourceRecordId: text("source_record_id").notNull(),
    confidence: integer("confidence").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("ownership_transaction_idx").on(table.transactionId),
    index("ownership_person_idx").on(table.personId),
  ],
);

export const valuationEvidence = sqliteTable(
  "valuation_evidence",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id").notNull(),
    amountLow: integer("amount_low"),
    amountHigh: integer("amount_high"),
    currency: text("currency").notNull().default("USD"),
    classification: text("classification").notNull(),
    methodology: text("methodology").notNull(),
    calculation: text("calculation"),
    sourceRecordId: text("source_record_id").notNull(),
    confidence: integer("confidence").notNull(),
    ...auditColumns,
  },
  (table) => [index("valuation_transaction_idx").on(table.transactionId)],
);

export const signalEvents = sqliteTable(
  "signal_events",
  {
    id: text("id").primaryKey(),
    transactionId: text("transaction_id"),
    sourceRecordId: text("source_record_id").notNull(),
    signalType: text("signal_type").notNull(),
    signalStage: text("signal_stage").notNull(),
    occurredAt: text("occurred_at").notNull(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    confidence: integer("confidence").notNull(),
    ...auditColumns,
  },
  (table) => [
    index("signal_events_stage_idx").on(table.signalStage, table.occurredAt),
    index("signal_events_transaction_idx").on(table.transactionId),
  ],
);

export const evidenceLinks = sqliteTable(
  "evidence_links",
  {
    id: text("id").primaryKey(),
    sourceRecordId: text("source_record_id").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    relationship: text("relationship").notNull(),
    classification: text("classification").notNull(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("evidence_links_unique_idx").on(
      table.sourceRecordId,
      table.subjectType,
      table.subjectId,
      table.relationship,
    ),
    index("evidence_links_subject_idx").on(table.subjectType, table.subjectId),
  ],
);

export const entityMatches = sqliteTable(
  "entity_matches",
  {
    id: text("id").primaryKey(),
    sourceRecordId: text("source_record_id").notNull(),
    sourceName: text("source_name").notNull(),
    matchedEntityId: text("matched_entity_id"),
    matchedPersonId: text("matched_person_id"),
    matchMethod: text("match_method").notNull(),
    matchScore: integer("match_score").notNull(),
    matchStatus: text("match_status").notNull(),
    explanation: text("explanation").notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    ...auditColumns,
  },
  (table) => [
    index("entity_matches_source_idx").on(table.sourceRecordId),
    index("entity_matches_status_idx").on(table.matchStatus, table.matchScore),
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
    index("events_person_region_idx").on(table.personId, table.eventLocationId),
    index("events_org_region_idx").on(
      table.organizationId,
      table.eventLocationId,
    ),
    index("events_type_status_idx").on(table.eventType, table.status),
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
    transactionId: text("transaction_id"),
    grossAttributableLow: integer("gross_attributable_low"),
    grossAttributableHigh: integer("gross_attributable_high"),
    potentiallyDeployableLow: integer("potentially_deployable_low"),
    potentiallyDeployableHigh: integer("potentially_deployable_high"),
    classification: text("classification"),
    methodology: text("methodology"),
    calculation: text("calculation"),
    uncertainty: text("uncertainty"),
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
    index("estimates_transaction_idx").on(table.transactionId),
    index("estimates_median_idx").on(table.remainingMedian),
    index("estimates_confidence_idx").on(table.confidenceScore),
  ],
);

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull(),
  seats: integer("seats").notNull(),
  homeRegionId: text("home_region_id"),
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
    regionId: text("region_id"),
    status: text("status").notNull().default("active"),
    ...auditColumns,
  },
  (table) => [
    index("workspace_records_owner_idx").on(
      table.workspaceId,
      table.recordType,
    ),
    index("workspace_records_user_idx").on(table.userEmail),
    index("workspace_records_region_idx").on(
      table.workspaceId,
      table.userEmail,
      table.regionId,
    ),
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

export const ingestionRuns = sqliteTable(
  "ingestion_runs",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    status: text("status").notNull(),
    inputCursor: text("input_cursor"),
    inputHash: text("input_hash"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsAccepted: integer("records_accepted").notNull().default(0),
    recordsRejected: integer("records_rejected").notNull().default(0),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    errorInformation: text("error_information"),
    ...auditColumns,
  },
  (table) => [
    index("ingestion_runs_source_idx").on(table.sourceId, table.startedAt),
    uniqueIndex("ingestion_runs_idempotency_idx").on(
      table.sourceId,
      table.inputHash,
    ),
  ],
);

export const sourceHealth = sqliteTable(
  "source_health",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id").notNull(),
    mode: text("mode").notNull(),
    cadence: text("cadence").notNull(),
    lastAttemptAt: text("last_attempt_at"),
    lastSuccessAt: text("last_success_at"),
    recordsSeen: integer("records_seen").notNull().default(0),
    recordsAccepted: integer("records_accepted").notNull().default(0),
    recordsRejected: integer("records_rejected").notNull().default(0),
    latencyMs: integer("latency_ms"),
    currentError: text("current_error"),
    disabledReason: text("disabled_reason"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("source_health_source_idx").on(table.sourceId),
    index("source_health_mode_idx").on(table.mode),
  ],
);
