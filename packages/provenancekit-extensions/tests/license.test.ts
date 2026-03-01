import { describe, it, expect } from "vitest";
import { cidRef, type Resource, type Attribution } from "@provenancekit/eaa-types";
import {
  LICENSE_NAMESPACE,
  LicenseExtension,
  withLicense,
  getLicense,
  hasLicense,
  isLicenseActive,
  hasAITrainingReservation,
  Licenses,
} from "../src/license";

const createResource = (): Resource => ({
  address: cidRef("bafytest123"),
  type: "image",
  locations: [],
  createdAt: "2024-01-15T10:00:00Z",
  createdBy: "alice",
  rootAction: "action-1",
});

const createAttribution = (): Attribution => ({
  resourceRef: cidRef("bafytest123"),
  entityId: "alice",
  role: "creator",
});

describe("license extension", () => {
  describe("LicenseExtension schema", () => {
    it("validates valid license data", () => {
      const result = LicenseExtension.safeParse({
        type: "CC-BY-4.0",
        commercial: true,
        derivatives: true,
        attribution: "required",
      });
      expect(result.success).toBe(true);
    });

    it("requires type field", () => {
      const result = LicenseExtension.safeParse({ commercial: true });
      expect(result.success).toBe(false);
    });

    it("validates termsUrl as URL", () => {
      const result = LicenseExtension.safeParse({
        type: "MIT",
        termsUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid termsUrl", () => {
      const result = LicenseExtension.parse({
        type: "MIT",
        termsUrl: "https://opensource.org/licenses/MIT",
      });
      expect(result.termsUrl).toBe("https://opensource.org/licenses/MIT");
    });
  });

  describe("withLicense", () => {
    it("adds license to resource", () => {
      const resource = createResource();
      const result = withLicense(resource, Licenses.CC_BY);

      expect(result.extensions?.[LICENSE_NAMESPACE]).toBeDefined();
      expect(result.type).toBe("image");
    });

    it("adds license to attribution", () => {
      const attr = createAttribution();
      const result = withLicense(attr, { type: "proprietary" });

      expect(result.extensions?.[LICENSE_NAMESPACE]).toBeDefined();
    });

    it("preserves existing extensions", () => {
      const resource: Resource = {
        ...createResource(),
        extensions: { "ext:other@1.0.0": { foo: "bar" } },
      };
      const result = withLicense(resource, Licenses.MIT);

      expect(result.extensions?.["ext:other@1.0.0"]).toEqual({ foo: "bar" });
    });
  });

  describe("getLicense", () => {
    it("returns license data when present", () => {
      const resource = withLicense(createResource(), Licenses.CC_BY);
      const license = getLicense(resource);

      expect(license?.type).toBe("CC-BY-4.0");
      expect(license?.commercial).toBe(true);
    });

    it("returns undefined when not present", () => {
      const resource = createResource();
      expect(getLicense(resource)).toBeUndefined();
    });
  });

  describe("hasLicense", () => {
    it("returns true when extension exists", () => {
      const resource = withLicense(createResource(), Licenses.MIT);
      expect(hasLicense(resource)).toBe(true);
    });

    it("returns false when extension missing", () => {
      const resource = createResource();
      expect(hasLicense(resource)).toBe(false);
    });
  });

  describe("grant fields", () => {
    it("accepts grantedBy, grantType, transactionRef", () => {
      const result = LicenseExtension.safeParse({
        type: "commercial-license",
        commercial: true,
        grantedBy: "alice",
        grantType: "purchase",
        transactionRef: "0xabc123",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.grantedBy).toBe("alice");
        expect(result.data.grantType).toBe("purchase");
        expect(result.data.transactionRef).toBe("0xabc123");
      }
    });

    it("rejects invalid grantType", () => {
      const result = LicenseExtension.safeParse({
        type: "custom",
        grantType: "stolen",
      });
      expect(result.success).toBe(false);
    });

    it("models a per-entity grant on an attribution", () => {
      const attr: Attribution = {
        resourceRef: cidRef("bafyimage123"),
        entityId: "bob",
        role: "licensee",
      };
      const granted = withLicense(attr, {
        type: "commercial-license",
        commercial: true,
        derivatives: true,
        grantedBy: "alice",
        grantType: "purchase",
        transactionRef: "inv-2025-001",
        expires: "2026-01-01T00:00:00Z",
      });

      const license = getLicense(granted);
      expect(license?.grantedBy).toBe("alice");
      expect(license?.grantType).toBe("purchase");
      expect(license?.transactionRef).toBe("inv-2025-001");
      expect(granted.role).toBe("licensee");
    });
  });

  describe("isLicenseActive", () => {
    it("returns true for license without expiry", () => {
      const resource = withLicense(createResource(), Licenses.CC_BY);
      expect(isLicenseActive(resource)).toBe(true);
    });

    it("returns true for license not yet expired", () => {
      const resource = withLicense(createResource(), {
        type: "custom",
        expires: "2099-12-31T23:59:59Z",
      });
      expect(isLicenseActive(resource)).toBe(true);
    });

    it("returns false for expired license", () => {
      const resource = withLicense(createResource(), {
        type: "custom",
        expires: "2020-01-01T00:00:00Z",
      });
      expect(isLicenseActive(resource)).toBe(false);
    });

    it("returns false when no license exists", () => {
      expect(isLicenseActive(createResource())).toBe(false);
    });

    it("accepts custom reference date", () => {
      const attr = withLicense(createAttribution(), {
        type: "time-limited",
        expires: "2025-06-01T00:00:00Z",
      });
      expect(isLicenseActive(attr, new Date("2025-01-01"))).toBe(true);
      expect(isLicenseActive(attr, new Date("2025-07-01"))).toBe(false);
    });
  });

  describe("aiTraining field (DSM Art. 4(3))", () => {
    it("accepts 'permitted' value", () => {
      const result = LicenseExtension.safeParse({
        type: "CC-BY-4.0",
        aiTraining: "permitted",
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.aiTraining).toBe("permitted");
    });

    it("accepts 'reserved' value", () => {
      const result = LicenseExtension.safeParse({
        type: "CC-BY-4.0",
        aiTraining: "reserved",
      });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.aiTraining).toBe("reserved");
    });

    it("accepts 'unspecified' value", () => {
      const result = LicenseExtension.safeParse({
        type: "MIT",
        aiTraining: "unspecified",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid aiTraining value", () => {
      const result = LicenseExtension.safeParse({
        type: "MIT",
        aiTraining: "forbidden",
      });
      expect(result.success).toBe(false);
    });

    it("is optional — omitting it succeeds", () => {
      const result = LicenseExtension.safeParse({ type: "MIT" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.aiTraining).toBeUndefined();
    });
  });

  describe("hasAITrainingReservation", () => {
    it("returns true when aiTraining is 'reserved'", () => {
      const resource = withLicense(createResource(), {
        type: "CC-BY-4.0",
        aiTraining: "reserved",
      });
      expect(hasAITrainingReservation(resource)).toBe(true);
    });

    it("returns false when aiTraining is 'permitted'", () => {
      const resource = withLicense(createResource(), {
        type: "CC-BY-4.0",
        aiTraining: "permitted",
      });
      expect(hasAITrainingReservation(resource)).toBe(false);
    });

    it("returns false when aiTraining is 'unspecified'", () => {
      const resource = withLicense(createResource(), {
        type: "MIT",
        aiTraining: "unspecified",
      });
      expect(hasAITrainingReservation(resource)).toBe(false);
    });

    it("returns false when aiTraining field is absent", () => {
      const resource = withLicense(createResource(), Licenses.CC_BY);
      expect(hasAITrainingReservation(resource)).toBe(false);
    });

    it("returns false when no license extension present", () => {
      expect(hasAITrainingReservation(createResource())).toBe(false);
    });

    it("works on attributions", () => {
      const attr = withLicense(createAttribution(), {
        type: "proprietary",
        aiTraining: "reserved",
      });
      expect(hasAITrainingReservation(attr)).toBe(true);
    });
  });

  describe("Licenses presets", () => {
    it("has CC0 preset", () => {
      expect(Licenses.CC0.type).toBe("CC0-1.0");
      expect(Licenses.CC0.attribution).toBe("none");
    });

    it("has CC_BY preset", () => {
      expect(Licenses.CC_BY.type).toBe("CC-BY-4.0");
      expect(Licenses.CC_BY.attribution).toBe("required");
    });

    it("has MIT preset", () => {
      expect(Licenses.MIT.type).toBe("MIT");
      expect(Licenses.MIT.commercial).toBe(true);
    });

    it("has PROPRIETARY preset", () => {
      expect(Licenses.PROPRIETARY.commercial).toBe(false);
      expect(Licenses.PROPRIETARY.derivatives).toBe(false);
    });
  });
});
