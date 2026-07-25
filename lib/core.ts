import type { MoneyRange } from "../app/data";

export function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function addRanges(a: MoneyRange, b: MoneyRange): MoneyRange {
  return {
    low: a.low + b.low,
    median: a.median + b.median,
    high: a.high + b.high,
  };
}

export function subtractRanges(a: MoneyRange, b: MoneyRange): MoneyRange {
  return {
    low: Math.max(0, a.low - b.high),
    median: Math.max(0, a.median - b.median),
    high: Math.max(0, a.high - b.low),
  };
}

export function confidenceScore(components: {
  sourceReliability: number;
  transactionCertainty: number;
  identityCertainty: number;
  ownershipCertainty: number;
  considerationCertainty: number;
  completionCertainty: number;
  taxCertainty: number;
  deploymentCoverage: number;
  recency: number;
}) {
  const weighted =
    components.sourceReliability * 0.2 +
    components.transactionCertainty * 0.15 +
    components.identityCertainty * 0.15 +
    components.ownershipCertainty * 0.15 +
    components.considerationCertainty * 0.1 +
    components.completionCertainty * 0.1 +
    components.taxCertainty * 0.05 +
    components.deploymentCoverage * 0.05 +
    components.recency * 0.05;
  return Math.round(clamp(weighted / 100) * 100);
}

export function recencyScore(daysSinceEvent: number, halfLifeDays = 365) {
  return Math.round(
    100 * Math.pow(0.5, Math.max(0, daysSinceEvent) / halfLifeDays),
  );
}

export function radarScore(input: {
  remainingMedian: number;
  confidence: number;
  recency: number;
  uncommittedProbability: number;
  deploymentPropensity: number;
  actionability: number;
}) {
  const liquidity = clamp(Math.log10(Math.max(1, input.remainingMedian)) / 10);
  const score =
    liquidity * 0.3 +
    (input.confidence / 100) * 0.2 +
    (input.recency / 100) * 0.12 +
    input.uncommittedProbability * 0.16 +
    input.deploymentPropensity * 0.12 +
    (input.actionability / 100) * 0.1;
  return Math.round(clamp(score) * 100);
}

export function matchScore(input: {
  capacity: number;
  confidence: number;
  sectorAffinity: number;
  geographicAffinity: number;
  checkSizeFit: number;
  deploymentPropensity: number;
  recency: number;
}) {
  const factors = [
    input.capacity,
    input.confidence,
    input.sectorAffinity,
    input.geographicAffinity,
    input.checkSizeFit,
    input.deploymentPropensity,
    input.recency,
  ].map((value) => clamp(value));
  const geometricMean = Math.pow(
    factors.reduce((product, value) => product * Math.max(0.01, value), 1),
    1 / factors.length,
  );
  return Math.round(geometricMean * 100);
}

export function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleTriangular(
  random: () => number,
  minimum: number,
  mode: number,
  maximum: number,
) {
  const value = random();
  const threshold = (mode - minimum) / (maximum - minimum);
  if (value < threshold) {
    return minimum + Math.sqrt(value * (maximum - minimum) * (mode - minimum));
  }
  return (
    maximum - Math.sqrt((1 - value) * (maximum - minimum) * (maximum - mode))
  );
}

export function privateExitEstimate(
  seed: number,
  sampleCount: number,
  input: {
    enterpriseValue: MoneyRange;
    debt: MoneyRange;
    cash: MoneyRange;
    ownership: MoneyRange;
    cashConsideration: MoneyRange;
    deductions: MoneyRange;
  },
): MoneyRange {
  const random = mulberry32(seed);
  const samples = Array.from({ length: sampleCount }, () => {
    const enterpriseValue = sampleTriangular(
      random,
      input.enterpriseValue.low,
      input.enterpriseValue.median,
      input.enterpriseValue.high,
    );
    const debt = sampleTriangular(
      random,
      input.debt.low,
      input.debt.median,
      input.debt.high,
    );
    const cash = sampleTriangular(
      random,
      input.cash.low,
      input.cash.median,
      input.cash.high,
    );
    const ownership = sampleTriangular(
      random,
      input.ownership.low,
      input.ownership.median,
      input.ownership.high,
    );
    const consideration = sampleTriangular(
      random,
      input.cashConsideration.low,
      input.cashConsideration.median,
      input.cashConsideration.high,
    );
    const deductions = sampleTriangular(
      random,
      input.deductions.low,
      input.deductions.median,
      input.deductions.high,
    );
    return Math.max(
      0,
      (enterpriseValue - debt + cash) * ownership * consideration - deductions,
    );
  }).sort((a, b) => a - b);
  const percentile = (value: number) =>
    samples[Math.floor((samples.length - 1) * value)];
  return {
    low: percentile(0.1),
    median: percentile(0.5),
    high: percentile(0.9),
  };
}

export function publicSaleEstimate(
  shares: number,
  price: number,
  taxLow: number,
  taxHigh: number,
) {
  const gross = shares * price;
  return {
    gross,
    net: {
      low: gross * (1 - taxHigh),
      median: gross * (1 - (taxLow + taxHigh) / 2),
      high: gross * (1 - taxLow),
    },
  };
}

export function normalizeEntityName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(incorporated|inc|llc|ltd|corporation|corp|company|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function restrictedUseAllowed(useCase: string) {
  const normalized = useCase.toLowerCase();
  return ![
    "credit eligibility",
    "employment screening",
    "insurance eligibility",
    "tenant screening",
    "housing screening",
    "harassment",
    "stalking",
    "adverse action",
  ].some((restricted) => normalized.includes(restricted));
}
