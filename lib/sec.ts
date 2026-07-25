import { createHash } from "node:crypto";

function text(xml: string, tag: string) {
  return xml
    .match(
      new RegExp(`<${tag}>(?:<value>)?([^<]+)(?:</value>)?</${tag}>`, "i"),
    )?.[1]
    ?.trim();
}

function blocks(xml: string, tag: string) {
  return Array.from(
    xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi")),
  ).map((match) => match[1]);
}

export type Form4Transaction = {
  transactionDate: string;
  transactionCode: string;
  securityTitle: string;
  shares: number;
  price: number | null;
  acquiredDisposed: string;
  directIndirect: string;
  grossProceeds: number | null;
  likelyLiquidity: boolean;
};

export function parseForm4(xml: string) {
  if (
    !xml.includes("<ownershipDocument") ||
    !xml.includes("</ownershipDocument>")
  ) {
    throw new Error("Invalid Form 4 XML");
  }
  const issuerBlock = blocks(xml, "issuer")[0] || "";
  const ownerBlock = blocks(xml, "reportingOwner")[0] || "";
  const transactions = blocks(xml, "nonDerivativeTransaction").map(
    (block): Form4Transaction => {
      const shares = Number(text(block, "transactionShares") || 0);
      const rawPrice = text(block, "transactionPricePerShare");
      const price = rawPrice ? Number(rawPrice) : null;
      const transactionCode = text(block, "transactionCode") || "";
      const acquiredDisposed =
        text(block, "transactionAcquiredDisposedCode") || "";
      const likelyLiquidity =
        transactionCode === "S" &&
        acquiredDisposed === "D" &&
        shares > 0 &&
        price !== null &&
        price > 0;
      return {
        transactionDate: text(block, "transactionDate") || "",
        transactionCode,
        securityTitle: text(block, "securityTitle") || "",
        shares,
        price,
        acquiredDisposed,
        directIndirect: text(block, "directOrIndirectOwnership") || "",
        grossProceeds: likelyLiquidity ? shares * price : null,
        likelyLiquidity,
      };
    },
  );
  return {
    form: text(xml, "documentType") || "4",
    issuer: {
      cik: text(issuerBlock, "issuerCik") || "",
      name: text(issuerBlock, "issuerName") || "",
    },
    owner: {
      cik: text(ownerBlock, "rptOwnerCik") || "",
      name: text(ownerBlock, "rptOwnerName") || "",
      isDirector: text(ownerBlock, "isDirector") === "1",
      isOfficer: text(ownerBlock, "isOfficer") === "1",
    },
    transactions,
    liquidityTransactions: transactions.filter(
      (transaction) => transaction.likelyLiquidity,
    ),
    contentHash: createHash("sha256").update(xml).digest("hex"),
  };
}

export function parseForm144(xml: string) {
  if (!xml.match(/<formData|<submission/i))
    throw new Error("Invalid Form 144 XML");
  const securities = Number(
    text(xml, "noOfUnitsSold") || text(xml, "securitiesToBeSold") || 0,
  );
  const marketValue = Number(text(xml, "aggregateMarketValue") || 0);
  return {
    form: "144",
    seller:
      text(xml, "nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold") ||
      text(xml, "sellerName") ||
      "",
    issuer: text(xml, "issuerName") || "",
    broker: text(xml, "brokerName") || "",
    approximateSaleDate: text(xml, "approxSaleDate") || "",
    securitiesProposed: securities,
    aggregateMarketValue: marketValue,
    eventType: "proposed_public_share_sale",
    status: "proposed",
    completed: false,
    contentHash: createHash("sha256").update(xml).digest("hex"),
  };
}

export function idempotencyKey(accession: string, contentHash: string) {
  return createHash("sha256")
    .update(`${accession}:${contentHash}`)
    .digest("hex");
}
