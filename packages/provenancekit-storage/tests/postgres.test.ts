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
    expect(statements).toContain("ELSE '[]'::jsonb");
  });
});
