import type { PublicDataSnapshot } from "./public-data";

export type FilingPriceBasis =
  | "reported_per_share"
  | "derived_from_reported_aggregate"
  | "normalized_filing_decimal";

export type NormalizedTransactionValue = {
  pricePerShare: number;
  grossAmount: number;
  priceBasis: FilingPriceBasis;
  correctionNote: string;
};

type TransactionValueInput = {
  accession: string;
  issuerCik: string;
  shares: number;
  reportedPrice: number;
};

const aggregateValueAccessions = new Set([
  "0001969452-26-000010",
  "0001493152-25-016457",
  "0001493152-25-016459",
  "0001493152-25-017353",
  "0001493152-25-017354",
  "0001493152-25-017818",
  "0001493152-25-018524",
  "0001493152-25-018526",
  "0001493152-25-019135",
  "0001493152-25-019919",
  "0001493152-25-020469",
  "0001493152-25-020475",
  "0001493152-25-021327",
  "0001493152-25-021328",
  "0001493152-25-023660",
  "0001493152-25-023667",
  "0001493152-25-024711",
  "0001493152-25-024715",
  "0001493152-25-025207",
  "0001493152-25-025210",
  "0001493152-26-008430",
]);

const decimalCorrections = new Map<
  string,
  Array<{ reportedPrice: number; divisor: number }>
>([
  [
    "0000316011-25-000073",
    [
      { reportedPrice: 1_031_414, divisor: 1_000 },
      { reportedPrice: 1_032_319, divisor: 1_000 },
    ],
  ],
  ["0001193125-25-316075", [{ reportedPrice: 79_198, divisor: 1_000 }]],
  ["0001823400-26-000002", [{ reportedPrice: 4_015, divisor: 100 }]],
]);

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(0.000001, Math.abs(right) * 1e-9);
}

/**
 * Applies only source-verified filing corrections. This intentionally avoids
 * guessing from a high share price alone because legitimate securities can
 * trade at thousands of dollars per share.
 */
export function normalizeReportedTransactionValue({
  accession,
  shares,
  reportedPrice,
}: TransactionValueInput): NormalizedTransactionValue {
  if (
    shares > 0 &&
    reportedPrice >= 1_000 &&
    aggregateValueAccessions.has(accession)
  ) {
    return {
      pricePerShare: reportedPrice / shares,
      grossAmount: reportedPrice,
      priceBasis: "derived_from_reported_aggregate",
      correctionNote:
        "The filer placed the aggregate transaction value in the per-share field; the per-share amount is derived as aggregate value divided by reported shares.",
    };
  }

  const decimalCorrection = decimalCorrections
    .get(accession)
    ?.find((candidate) =>
      approximatelyEqual(candidate.reportedPrice, reportedPrice),
    );
  if (decimalCorrection) {
    const pricePerShare = reportedPrice / decimalCorrection.divisor;
    return {
      pricePerShare,
      grossAmount: shares * pricePerShare,
      priceBasis: "normalized_filing_decimal",
      correctionNote:
        "The filing data omitted a decimal separator in this transaction price; the normalized price is corroborated by the filing footnote or same-filing transaction range.",
    };
  }

  return {
    pricePerShare: reportedPrice,
    grossAmount: shares * reportedPrice,
    priceBasis: "reported_per_share",
    correctionNote: "",
  };
}

export type ValuationAudit = {
  errors: string[];
  warnings: string[];
  totals: {
    events: number;
    holdings: number;
    completedExits: number;
    correctedEvents: number;
    correctedHoldings: number;
    jointEvents: number;
    jointHoldings: number;
  };
};

function isFiniteNonNegative(value: number | null) {
  return value === null || (Number.isFinite(value) && value >= 0);
}

function materiallyDifferent(left: number, right: number) {
  return Math.abs(left - right) > Math.max(0.02, Math.abs(right) * 1e-8);
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function underlyingTransactionKey(
  event: PublicDataSnapshot["liquidity"]["events"][number],
) {
  const ownerSuffix = event.reportingPartyCik
    ? `-${event.reportingPartyCik}`
    : "";
  return event.id.startsWith("sec345-") &&
    ownerSuffix &&
    event.id.endsWith(ownerSuffix)
    ? event.id.slice(0, -ownerSuffix.length)
    : event.id;
}

export function uniqueCompletedSaleGross(
  events: PublicDataSnapshot["liquidity"]["events"],
) {
  const transactions = new Map<string, number>();
  for (const event of events) {
    if (event.eventType !== "completed_public_share_sale") continue;
    const key = underlyingTransactionKey(event);
    if (!transactions.has(key)) transactions.set(key, event.grossAmount);
  }
  return [...transactions.values()].reduce(
    (sum, grossAmount) => sum + grossAmount,
    0,
  );
}

export function auditPublicValuations(
  snapshot: PublicDataSnapshot,
): ValuationAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const pricesByIssuer = new Map<string, number[]>();
  let correctedEvents = 0;
  let correctedHoldings = 0;
  let jointEvents = 0;
  let jointHoldings = 0;
  const transactions = new Map<
    string,
    PublicDataSnapshot["liquidity"]["events"]
  >();
  const holdingGroups = new Map<
    string,
    PublicDataSnapshot["liquidity"]["holdings"]
  >();

  for (const event of snapshot.liquidity.events) {
    if (
      !Number.isFinite(event.shares) ||
      event.shares <= 0 ||
      !Number.isFinite(event.pricePerShare) ||
      event.pricePerShare <= 0 ||
      !Number.isFinite(event.grossAmount) ||
      event.grossAmount <= 0
    ) {
      errors.push(`${event.id}: invalid transaction amount.`);
      continue;
    }
    const expectedGross = event.shares * event.pricePerShare;
    if (materiallyDifferent(event.grossAmount, expectedGross)) {
      errors.push(
        `${event.id}: gross amount ${event.grossAmount} does not equal shares multiplied by normalized price ${expectedGross}.`,
      );
    }
    const normalized = normalizeReportedTransactionValue({
      accession: event.accession,
      issuerCik: event.issuerCik,
      shares: event.shares,
      reportedPrice: event.pricePerShare,
    });
    if (normalized.priceBasis !== "reported_per_share") {
      errors.push(
        `${event.id}: a verified filing correction is still pending.`,
      );
    }
    if (event.priceBasis && event.priceBasis !== "reported_per_share") {
      correctedEvents += 1;
    }
    if (event.attributionBasis === "joint_filing_unallocated") {
      jointEvents += 1;
    }
    const transactionKey = underlyingTransactionKey(event);
    const transactionGroup = transactions.get(transactionKey) ?? [];
    transactionGroup.push(event);
    transactions.set(transactionKey, transactionGroup);
    if (event.form === "Form 4") {
      const issuerKey = event.issuerCik || event.issuer.toLocaleLowerCase();
      const current = pricesByIssuer.get(issuerKey) ?? [];
      current.push(event.pricePerShare);
      pricesByIssuer.set(issuerKey, current);
    }
    if (
      event.issuerSymbol &&
      event.issuerSymbol !== "[none]" &&
      event.pricePerShare > 25_000 &&
      event.shares > 100 &&
      event.grossAmount > 5_000_000_000
    ) {
      warnings.push(
        `${event.id}: unusually high public-security price and gross amount require source review.`,
      );
    }
  }

  for (const [transactionKey, transactionEvents] of transactions) {
    const owners = new Set(
      transactionEvents.map(
        (event) => event.reportingPartyCik || event.reportingParty,
      ),
    );
    if (
      owners.size > 1 &&
      transactionEvents.some(
        (event) => event.attributionBasis !== "joint_filing_unallocated",
      )
    ) {
      errors.push(
        `${transactionKey}: joint filing transaction is not marked as unallocated.`,
      );
    }
  }

  for (const [issuer, prices] of pricesByIssuer) {
    if (prices.length < 3) continue;
    const center = median(prices);
    const maximum = Math.max(...prices);
    if (center > 0 && maximum / center > 50) {
      errors.push(
        `${issuer}: transaction price ${maximum} is more than 50 times the issuer median ${center}.`,
      );
    }
  }

  for (const holding of snapshot.liquidity.holdings) {
    const holdingKey = [
      holding.accession,
      holding.issuerCik,
      holding.securityTitle,
      holding.shares.toFixed(6),
      holding.directOrIndirect,
      holding.referencePrice?.toFixed(6) ?? "",
    ].join("|");
    const holdingGroup = holdingGroups.get(holdingKey) ?? [];
    holdingGroup.push(holding);
    holdingGroups.set(holdingKey, holdingGroup);
    if (
      !Number.isFinite(holding.shares) ||
      holding.shares < 0 ||
      !isFiniteNonNegative(holding.referencePrice) ||
      !isFiniteNonNegative(holding.estimatedValue)
    ) {
      errors.push(`${holding.id}: invalid holding valuation.`);
      continue;
    }
    if (
      holding.referencePrice !== null &&
      holding.estimatedValue !== null &&
      materiallyDifferent(
        holding.estimatedValue,
        holding.shares * holding.referencePrice,
      )
    ) {
      errors.push(
        `${holding.id}: holding value does not equal shares multiplied by normalized transaction-implied price.`,
      );
    }
    if (holding.priceBasis && holding.priceBasis !== "reported_per_share") {
      correctedHoldings += 1;
    }
    if (holding.attributionBasis === "joint_filing_unallocated") {
      jointHoldings += 1;
    }
  }

  for (const [holdingKey, holdings] of holdingGroups) {
    const owners = new Set(
      holdings.map(
        (holding) => holding.reportingPartyCik || holding.reportingParty,
      ),
    );
    if (
      owners.size > 1 &&
      holdings.some(
        (holding) => holding.attributionBasis !== "joint_filing_unallocated",
      )
    ) {
      errors.push(
        `${holdingKey}: joint filing holding is not marked as unallocated.`,
      );
    }
  }

  for (const exit of snapshot.completedExits?.records ?? []) {
    const consideration = exit.consideration;
    for (const amount of [
      consideration.cashAmount,
      consideration.totalAmount,
      consideration.cashPerShare,
      consideration.contingentAmount,
    ]) {
      if (!isFiniteNonNegative(amount)) {
        errors.push(`${exit.id}: invalid disclosed consideration.`);
      }
    }
    if (
      consideration.cashAmount !== null &&
      consideration.totalAmount !== null &&
      consideration.cashAmount > consideration.totalAmount * 1.000001
    ) {
      errors.push(
        `${exit.id}: cash consideration exceeds total consideration.`,
      );
    }
    for (const owner of exit.ownerAttributions) {
      if (
        owner.attributedShares !== null &&
        owner.cashPerShare !== null &&
        owner.attributedCash !== null &&
        materiallyDifferent(
          owner.attributedCash,
          owner.attributedShares * owner.cashPerShare,
        )
      ) {
        errors.push(
          `${exit.id}/${owner.name}: attributed cash does not equal shares multiplied by cash per share.`,
        );
      }
    }
  }

  return {
    errors,
    warnings,
    totals: {
      events: snapshot.liquidity.events.length,
      holdings: snapshot.liquidity.holdings.length,
      completedExits: snapshot.completedExits?.records.length ?? 0,
      correctedEvents,
      correctedHoldings,
      jointEvents,
      jointHoldings,
    },
  };
}
