import { describe, it, expect } from "vitest";
import { cidRef, type Resource, type Attribution } from "@arttribute/eaa-types";
import {
  LICENSE_NAMESPACE,
  LicenseExtension,
  withLicense,
  getLicense,
  hasLicense,
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
