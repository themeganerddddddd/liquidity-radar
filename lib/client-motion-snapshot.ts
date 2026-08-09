import type {
  ActionabilityBreakdown,
  MoneyMotionSnapshot,
  MotionEvidence,
} from "./money-in-motion";

function compactActionability(
  actionability: ActionabilityBreakdown,
): ActionabilityBreakdown {
  return { ...actionability, explanation: [] };
}

function oneEvidenceItemPerSource(evidence: MotionEvidence[]) {
  const sources = new Set<string>();
  return evidence.filter((item) => {
    if (sources.has(item.sourceId)) return false;
    sources.add(item.sourceId);
    return true;
  });
}

export function buildClientMotionSnapshot(
  snapshot: MoneyMotionSnapshot,
): MoneyMotionSnapshot {
  return {
    ...snapshot,
    records: snapshot.records.map((record) => ({
      ...record,
      clusterKey: "",
      publishedAt: "",
      personRole: "",
      firstReportedAt: "",
      latestReportedAt: "",
      sourceEventIds: [],
      location: { ...record.location, basis: "" },
      actionability: compactActionability(record.actionability),
      evidence: oneEvidenceItemPerSource(record.evidence).map((item) => ({
        ...item,
        retrievedAt: "",
        excerpt: "",
      })),
    })),
    peopleInMotion: snapshot.peopleInMotion.map((person) => ({
      ...person,
      firstSignalAt: "",
      latestCloseAt: "",
      actionability: compactActionability(person.actionability),
      evidence: oneEvidenceItemPerSource(person.evidence).map((item) => ({
        ...item,
        retrievedAt: "",
        excerpt: "",
      })),
    })),
  };
}
