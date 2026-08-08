import fs from "node:fs/promises";
import path from "node:path";
import type { MoneyMotionSnapshot } from "../lib/money-in-motion";

const root = process.cwd();
const snapshot = JSON.parse(
  await fs.readFile(
    path.join(root, "public", "data", "money-in-motion.json"),
    "utf8",
  ),
) as MoneyMotionSnapshot;

const estimated = snapshot.records.filter(
  (record) => record.estimate.potentiallyDeployableHigh !== null,
);
const violations = {
  personalEstimateWithoutOwnership: estimated.filter(
    (record) => record.person && !record.ownershipEvidence,
  ),
  gdeltNamedPeople: snapshot.records.filter(
    (record) =>
      record.person &&
      record.evidence.some((evidence) => evidence.sourceId === "gdelt"),
  ),
  duplicateSourceEvents:
    [...new Set(snapshot.records.flatMap((record) => record.sourceEventIds))]
      .length !==
    snapshot.records.flatMap((record) => record.sourceEventIds).length,
  invalidConfidence: snapshot.records.filter(
    (record) => record.confidence.total < 0 || record.confidence.total > 100,
  ),
  invalidActionability: snapshot.records.filter(
    (record) =>
      record.actionability.total < 0 || record.actionability.total > 100,
  ),
};

const sourceRows = snapshot.sourceHealth
  .map(
    (source) =>
      `| ${source.name} | ${source.mode} | ${source.recordsAccepted.toLocaleString()} | ${source.value.uniqueTransactionClusters.toLocaleString()} | ${source.value.namedPeopleResolved.toLocaleString()} | ${source.value.eventsWithOwnershipEvidence.toLocaleString()} | ${source.value.eventsWithReportedValuation.toLocaleString()} | ${source.value.liquidityEstimatesGenerated.toLocaleString()} | ${source.value.preLiquiditySignals.toLocaleString()} | ${source.value.medianLeadDays ?? "—"} |`,
  )
  .join("\n");

const unmet = [
  snapshot.stats.secEstimateShare < 0.5
    ? "SEC share target met: fewer than half of supported estimates rely on SEC evidence."
    : `SEC remains ${(snapshot.stats.secEstimateShare * 100).toFixed(1)}% of supported estimates; the <50% target is not met because non-SEC sources do not yet provide enough transaction-value plus ownership evidence.`,
  snapshot.stats.estimates >= 2_000
    ? "2,000 supported estimates reached."
    : `${snapshot.stats.estimates.toLocaleString()} supported estimates are available; the 2,000 target is not met and no lower-confidence or synthetic estimates were added.`,
];

const report = `# Money in Motion validation report

Generated: ${snapshot.generatedAt}

## Outcome

- ${snapshot.stats.records.toLocaleString()} deduplicated transaction signals
- ${snapshot.peopleInMotion.length.toLocaleString()} named people in the person-first view
- ${snapshot.stats.privateCompanyEvents.toLocaleString()} private-company events
- ${snapshot.stats.preCloseSignals.toLocaleString()} pre-close signals
- ${snapshot.stats.knownOrReportedValues.toLocaleString()} known or reported transaction values
- ${snapshot.stats.estimates.toLocaleString()} evidence-linked personal liquidity estimates
- ${snapshot.stats.highConfidenceEstimates.toLocaleString()} high-confidence estimates
- ${(snapshot.stats.secEstimateShare * 100).toFixed(1)}% of supported estimates include SEC evidence

${unmet.map((item) => `- ${item}`).join("\n")}

## Source business-value scorecard

| Source | State | Accepted | Clusters | People | Ownership | Values | Estimates | Pre-close | Median lead days |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${sourceRows}

## Integrity checks

- Personal estimate without ownership evidence: ${violations.personalEstimateWithoutOwnership.length}
- Named person inferred from GDELT news: ${violations.gdeltNamedPeople.length}
- Duplicate source-event assignment across clusters: ${violations.duplicateSourceEvents ? "FAIL" : "0"}
- Confidence outside 0–100: ${violations.invalidConfidence.length}
- Actionability outside 0–100: ${violations.invalidActionability.length}

## Evidence boundaries

- CMS owner records add named people only when the official all-owners dataset supplies a name. A personal liquidity estimate is not produced without transaction consideration.
- GDELT supplies discovery and timing evidence. A headline never creates a named-person estimate, and syndicated exact-title copies count once for corroboration.
- STB case-status records remain pending-regulatory until completion evidence is available.
- USPTO remains CONFIGURATION_REQUIRED unless \`USPTO_API_KEY\` is configured for the current Open Data Portal.
- FCC, FERC, state registries, commercial property, and broker feeds remain import-only until a documented public or licensed machine-readable feed is configured.
- No residential address is used for lead generation.
`;

await fs.writeFile(
  path.join(root, "docs", "money-in-motion-validation.md"),
  report,
  "utf8",
);

const failureCount =
  violations.personalEstimateWithoutOwnership.length +
  violations.gdeltNamedPeople.length +
  Number(violations.duplicateSourceEvents) +
  violations.invalidConfidence.length +
  violations.invalidActionability.length;
console.log(report);
if (failureCount) process.exitCode = 1;
