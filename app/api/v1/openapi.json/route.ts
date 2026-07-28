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
          parameters: [
            "q",
            "region",
            "relationshipType",
            "industry",
            "minLiquidity",
            "minConfidence",
            "affinityRegion",
            "minAffinity",
            "sort",
            "cursor",
            "limit",
          ].map((name) => ({
            name,
            in: "query",
            schema: {
              type: [
                "minLiquidity",
                "minConfidence",
                "minAffinity",
                "limit",
              ].includes(name)
                ? "number"
                : "string",
            },
          })),
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
          parameters: [
            "q",
            "region",
            "state",
            "metro",
            "county",
            "city",
            "industry",
            "naics",
            "eventType",
            "status",
            "dateFrom",
            "dateTo",
            "minAmount",
            "maxAmount",
            "minConfidence",
            "personRole",
            "organizationClass",
            "completion",
            "category",
            "sort",
            "cursor",
            "limit",
          ].map((name) => ({
            name,
            in: "query",
            schema: {
              type: [
                "minAmount",
                "maxAmount",
                "minConfidence",
                "limit",
              ].includes(name)
                ? "number"
                : "string",
            },
          })),
          responses: { "200": { description: "Liquidity events" } },
        },
      },
      "/regions": {
        get: {
          summary: "Retrieve regional aggregates",
          responses: { "200": { description: "Regions" } },
        },
      },
      "/regions/{slug}": {
        get: {
          summary: "Retrieve a regional dashboard",
          responses: { "200": { description: "Regional detail" } },
        },
      },
      "/regions/{slug}/people": {
        get: {
          summary: "Retrieve people connected to a region",
          responses: { "200": { description: "Region-relative people" } },
        },
      },
      "/regions/{slug}/events": {
        get: {
          summary: "Search events within a region",
          responses: { "200": { description: "Regional events" } },
        },
      },
      "/regions/{slug}/organizations": {
        get: {
          summary: "Retrieve organizations connected to a region",
          responses: { "200": { description: "Regional organizations" } },
        },
      },
      "/people/{id}/affinity": {
        get: {
          summary: "Calculate a person's affinity to a selected region",
          parameters: [
            {
              name: "region",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: { "200": { description: "Affinity component breakdown" } },
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
