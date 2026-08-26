import { describe, expect, it, vi } from "vitest";
import { PostgresStorage } from "../src/adapters/db/postgres.js";

describe("PostgresStorage legacy JSON compatibility", () => {
  it("guards lineage lookups from scalar inputs and outputs", async () => {
    const query = vi.fn(async () => []);
    const storage = new PostgresStorage({ query, autoMigrate: false });
    await storage.initialize();

    await storage.getActionsByOutput("sha256:output");
    await storage.getActionsByInput("sha256:input");

    const statements = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(statements).toContain("jsonb_typeof(outputs) = 'array'");
    expect(statements).toContain("jsonb_typeof(inputs) = 'array'");
    expect(statements).toContain("jsonb_typeof(outputs) = 'object'");
    expect(statements).toContain("jsonb_typeof(outputs) = 'string'");
    expect(statements).toContain("jsonb_typeof(inputs) = 'object'");
    expect(statements).toContain("jsonb_typeof(inputs) = 'string'");
  });

  it("decodes double-encoded action JSON from PostgreSQL clients", async () => {
    const query = vi.fn(async (statement: string) =>
      statement.includes("WHERE id = $1")
        ? [
            {
              id: "action:legacy",
              type: "transform",
              performed_by: "agent:test",
              timestamp: "2026-08-26T00:00:00.000Z",
              inputs: "[]",
              outputs: '[{"ref":"sha256:output","scheme":"hash"}]',
              proof: null,
              extensions: '{"ext:test":{"ok":true}}',
            },
          ]
        : [],
    );
    const storage = new PostgresStorage({ query, autoMigrate: false });
    await storage.initialize();

    const action = await storage.getAction("action:legacy");
    expect(action?.outputs).toEqual([
      { ref: "sha256:output", scheme: "hash" },
    ]);
    expect(action?.extensions).toEqual({ "ext:test": { ok: true } });
  });
});
