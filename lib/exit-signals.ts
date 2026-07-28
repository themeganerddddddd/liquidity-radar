import type { PublicExitSignal } from "./public-data";

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fieldItems(article: string, fieldName: string) {
  const block = article.match(
    new RegExp(
      `field--name-${fieldName}[^>]*>([\\s\\S]*?)(?=<div[^>]*class="[^"]*field--name-|<\\/article>)`,
    ),
  )?.[1];
  if (!block) return [];
  return [
    ...block.matchAll(
      /<div[^>]*class="[^"]*field__item[^"]*"[^>]*>([\s\S]*?)<\/div>/g,
    ),
  ]
    .map((match) => decodeHtml(match[1]))
    .filter(Boolean);
}

export function parseFtcExitSignals(html: string) {
  const records: PublicExitSignal[] = [];
  for (const match of html.matchAll(
    /<article about="(\/legal-library\/browse\/early-termination-notices\/(\d+))"[\s\S]*?<\/article>/g,
  )) {
    const article = match[0];
    const acquiringParty = fieldItems(article, "field-acquiring-party")[0];
    const acquiredParty = fieldItems(article, "field-acquired-party")[0];
    const date = article.match(/<time datetime="(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!acquiringParty || !acquiredParty || !date) continue;
    records.push({
      id: match[2],
      date,
      acquiringParty,
      acquiredParty,
      acquiredEntities: fieldItems(article, "field-other-entities"),
      sourceUrl: `https://www.ftc.gov${match[1]}`,
      status: "cleared_to_close",
      note: "FTC early termination means the HSR waiting period ended early. It is a deal signal, not proof that the transaction closed or that a person received cash.",
    });
  }
  return records;
}
