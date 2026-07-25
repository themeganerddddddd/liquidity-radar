import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { z } from "zod";

const workspaceRecord = z.object({
  type: z.enum(["saved_search", "alert", "report", "list", "audit_event"]),
  title: z.string().trim().min(1).max(160),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const parsed = workspaceRecord.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          details: parsed.error.flatten(),
          request_id: requestId,
        },
      },
      { status: 400, headers: { "x-request-id": requestId } },
    );
  }
  const id = crypto.randomUUID();
  const email =
    request.headers.get("oai-authenticated-user-email") ||
    "customer@liquidityradar.local";
  await env.DB.prepare(
    `INSERT INTO workspace_records
      (id, workspace_id, user_email, record_type, title, payload, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))`,
  )
    .bind(
      id,
      "workspace_northstar",
      email,
      parsed.data.type,
      parsed.data.title,
      JSON.stringify(parsed.data.payload),
    )
    .run();
  await env.DB.prepare(
    `INSERT INTO audit_logs
      (id, workspace_id, actor_email, action, entity_type, entity_id, request_id, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      crypto.randomUUID(),
      "workspace_northstar",
      email,
      "workspace_record.created",
      parsed.data.type,
      id,
      requestId,
      JSON.stringify({ title: parsed.data.title }),
    )
    .run();
  return NextResponse.json(
    { data: { id, ...parsed.data }, request_id: requestId },
    { status: 201, headers: { "x-request-id": requestId } },
  );
}

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
  const email =
    request.headers.get("oai-authenticated-user-email") ||
    "customer@liquidityradar.local";
  const results = await env.DB.prepare(
    `SELECT id, record_type, title, payload, status, created_at, updated_at
     FROM workspace_records
     WHERE workspace_id = ? AND user_email = ? AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind("workspace_northstar", email)
    .all();
  return NextResponse.json(
    { data: results.results, request_id: requestId },
    { headers: { "x-request-id": requestId } },
  );
}
