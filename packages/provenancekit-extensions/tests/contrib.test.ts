import { describe, it, expect } from "vitest";
import { cidRef, type Attribution } from "@arttribute/eaa-types";
import {
  CONTRIB_NAMESPACE,
  ContribExtension,
  withContrib,
  getContrib,
  hasContrib,
  getContribBps,
} from "../src/contrib";

const createAttribution = (entityId: string): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId,
  role: "creator",
});

describe("contrib extension", () => {
  describe("ContribExtension schema", () => {
    it("validates valid contribution data", () => {
      const result = ContribExtension.safeParse({
        weight: 6000,
        basis: "points",
        source: "agreed",
      });
      expect(result.success).toBe(true);
    });

    it("applies default basis", () => {
      const result = ContribExtension.parse({ weight: 5000 });
      expect(result.basis).toBe("points");
    });

    it("rejects negative weight", () => {
      const result = ContribExtension.safeParse({ weight: -100 });
      expect(result.success).toBe(false);
    });

    it("accepts optional fields", () => {
      const result = ContribExtension.parse({
        weight: 3000,
        source: "calculated",
        category: "design",
        note: "UI work",
        verifiedBy: "did:key:auditor",
        verifiedAt: "2024-01-15T10:00:00Z",
      });
      expect(result.category).toBe("design");
      expect(result.note).toBe("UI work");
    });
  });

  describe("withContrib", () => {
    it("adds contribution extension to attribution", () => {
      const attr = createAttribution("alice");
      const result = withContrib(attr, { weight: 6000 });

      expect(result.extensions?.[CONTRIB_NAMESPACE]).toBeDefined();
      expect(result.entityId).toBe("alice");
    });

    it("preserves existing extensions", () => {
      const attr: Attribution = {
        ...createAttribution("alice"),
        extensions: { "ext:other@1.0.0": { foo: "bar" } },
      };
      const result = withContrib(attr, { weight: 5000 });

      expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
      expect(result.extensions?.[CONTRIB_NAMESPACE]).toBeDefined();
    });
  });

  describe("getContrib", () => {
    it("returns contribution data when present", () => {
      const attr = withContrib(createAttribution("alice"), {
        weight: 6000,
        source: "agreed",
      });

      const contrib = getContrib(attr);
      expect(contrib?.weight).toBe(6000);
      expect(contrib?.source).toBe("agreed");
    });

    it("returns undefined when not present", () => {
      const attr = createAttribution("alice");
      expect(getContrib(attr)).toBeUndefined();
    });
  });

  describe("hasContrib", () => {
    it("returns true when extension exists", () => {
      const attr = withContrib(createAttribution("alice"), { weight: 5000 });
      expect(hasContrib(attr)).toBe(true);
    });

    it("returns false when extension missing", () => {
      const attr = createAttribution("alice");
      expect(hasContrib(attr)).toBe(false);
    });
  });

  describe("getContribBps", () => {
    it("returns weight for points basis", () => {
      const attr = withContrib(createAttribution("alice"), {
        weight: 6000,
        basis: "points",
      });
      expect(getContribBps(attr)).toBe(6000);
    });

    it("converts percentage to points", () => {
      const attr = withContrib(createAttribution("alice"), {
        weight: 60,
        basis: "percentage",
      });
      expect(getContribBps(attr)).toBe(6000);
    });

    it("returns weight for absolute basis", () => {
      const attr = withContrib(createAttribution("alice"), {
        weight: 3000,
        basis: "absolute",
      });
      expect(getContribBps(attr)).toBe(3000);
    });

    it("returns 0 when no contribution", () => {
      const attr = createAttribution("alice");
      expect(getContribBps(attr)).toBe(0);
    });
  });
});
