import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "Liquidity Radar API",
      version: "1.0.0",
      description:
        "Workspace-scoped access to published, evidence-linked private-capital intelligence.",
    },
    servers: [{ url: "/api/v1" }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API key" },
      },
      schemas: {
        MoneyRange: {
          type: "object",
          required: ["low", "median", "high", "currency"],
          properties: {
            low: { type: "number" },
            median: { type: "number" },
            high: { type: "number" },
            currency: { type: "string", example: "USD" },
          },
        },
      },
    },
    paths: {
      "/people": {
        get: {
          summary: "Search published people",
          responses: {
            "200": { description: "Paginated people" },
            "401": { description: "Invalid API key" },
          },
        },
      },
      "/people/{id}": {
        get: {
          summary: "Retrieve a person profile",
          responses: {
            "200": { description: "Evidence-linked person" },
            "404": { description: "Not found or suppressed" },
          },
        },
      },
      "/organizations": {
        get: {
          summary: "List organizations",
          responses: { "200": { description: "Organizations" } },
        },
      },
      "/events": {
        get: {
          summary: "Query liquidity events",
          responses: { "200": { description: "Liquidity events" } },
        },
      },
      "/regions": {
        get: {
          summary: "Retrieve regional aggregates",
          responses: { "200": { description: "Regions" } },
        },
      },
      "/rankings": {
        get: {
          summary: "Retrieve confidence-qualified rankings",
          responses: { "200": { description: "Rankings" } },
        },
      },
      "/search": {
        get: {
          summary: "Search across published entities",
          responses: { "200": { description: "Search results" } },
        },
      },
      "/matches": {
        post: {
          summary: "Score a capital opportunity",
          responses: { "200": { description: "Explained match results" } },
        },
      },
    },
  });
}
