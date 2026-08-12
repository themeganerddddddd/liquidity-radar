import type { SellerManualRecord } from "./seller-intelligence";

type ManualRow = {
  id: string;
  seller_key: string;
  entity_legal_name: string;
  illinois_file_number: string | null;
  entity_type: string | null;
  entity_status: string | null;
  formation_date: string | null;
  president: string | null;
  secretary: string | null;
  managers_json: string;
  registered_agent: string | null;
  source_url: string;
  lookup_date: string;
  checked_by: string;
  created_at: string;
  updated_at: string;
};

function toRecord(row: ManualRow): SellerManualRecord {
  let managers: string[] = [];
  try {
    const value: unknown = JSON.parse(row.managers_json);
    if (Array.isArray(value)) managers = value.map(String).filter(Boolean);
  } catch {
    managers = [];
  }
  return {
    id: row.id,
    sellerKey: row.seller_key,
    entityLegalName: row.entity_legal_name,
    illinoisFileNumber: row.illinois_file_number || "",
    entityType: row.entity_type || "",
    entityStatus: row.entity_status || "",
    formationDate: row.formation_date || "",
    president: row.president || "",
    secretary: row.secretary || "",
    managers,
    registeredAgent: row.registered_agent || "",
    sourceUrl: row.source_url,
    lookupDate: row.lookup_date,
    checkedBy: row.checked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function sellerDatabase() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("Seller Intelligence database is unavailable.");
  return env.DB;
}

export async function listSellerManualRecords(sellerKey?: string) {
  const database = await sellerDatabase();
  const statement = sellerKey
    ? database
        .prepare(
          "SELECT * FROM seller_manual_records WHERE seller_key = ? AND deleted_at IS NULL ORDER BY lookup_date DESC",
        )
        .bind(sellerKey)
    : database.prepare(
        "SELECT * FROM seller_manual_records WHERE deleted_at IS NULL ORDER BY lookup_date DESC",
      );
  const result = await statement.all<ManualRow>();
  return (result.results ?? []).map(toRecord);
}

export async function saveSellerManualRecord(record: SellerManualRecord) {
  const database = await sellerDatabase();
  await database
    .prepare(
      `INSERT INTO seller_manual_records (
      id, seller_key, entity_legal_name, illinois_file_number, entity_type,
      entity_status, formation_date, president, secretary, managers_json,
      registered_agent, source_url, lookup_date, checked_by, created_at,
      updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .bind(
      record.id,
      record.sellerKey,
      record.entityLegalName,
      record.illinoisFileNumber || null,
      record.entityType || null,
      record.entityStatus || null,
      record.formationDate || null,
      record.president || null,
      record.secretary || null,
      JSON.stringify(record.managers),
      record.registeredAgent || null,
      record.sourceUrl,
      record.lookupDate,
      record.checkedBy,
      record.createdAt,
      record.updatedAt,
    )
    .run();
  return record;
}
