import { describe, it, expect } from "vitest";
import {
  withExtension,
  getExtension,
  hasExtension,
  withoutExtension,
  getExtensionKeys,
  withExtensions,
  copyExtensions,
  isValidNamespace,
} from "../src/utils";

describe("utils", () => {
  describe("withExtension", () => {
    it("adds extension to object", () => {
      const obj = { id: "test" };
      const result = withExtension(obj, "ext:custom@1.0.0", { foo: "bar" });

      expect(result.extensions?.["ext:custom@1.0.0"]).toEqual({ foo: "bar" });
      expect(result.id).toBe("test");
    });

    it("preserves existing extensions", () => {
      const obj = { extensions: { "ext:existing@1.0.0": { a: 1 } } };
      const result = withExtension(obj, "ext:new@1.0.0", { b: 2 });

      expect(result.extensions?.["ext:existing@1.0.0"]).toEqual({ a: 1 });
      expect(result.extensions?.["ext:new@1.0.0"]).toEqual({ b: 2 });
    });
  });

  describe("getExtension", () => {
    it("returns extension data", () => {
      const obj = { extensions: { "ext:test@1.0.0": { value: 42 } } };
      const result = getExtension<{ value: number }>(obj, "ext:test@1.0.0");

      expect(result?.value).toBe(42);
    });

    it("returns undefined for missing extension", () => {
      const obj = { extensions: {} };
      expect(getExtension(obj, "ext:missing@1.0.0")).toBeUndefined();
    });

    it("returns undefined for missing extensions object", () => {
      const obj = {};
      expect(getExtension(obj, "ext:test@1.0.0")).toBeUndefined();
    });
  });

  describe("hasExtension", () => {
    it("returns true when extension exists", () => {
      const obj = { extensions: { "ext:test@1.0.0": {} } };
      expect(hasExtension(obj, "ext:test@1.0.0")).toBe(true);
    });

    it("returns false when extension missing", () => {
      const obj = { extensions: {} };
      expect(hasExtension(obj, "ext:test@1.0.0")).toBe(false);
    });
  });

  describe("withoutExtension", () => {
    it("removes extension", () => {
      const obj = {
        extensions: {
          "ext:keep@1.0.0": { a: 1 },
          "ext:remove@1.0.0": { b: 2 },
        },
      };
      const result = withoutExtension(obj, "ext:remove@1.0.0");

      expect(result.extensions?.["ext:keep@1.0.0"]).toEqual({ a: 1 });
      expect(result.extensions?.["ext:remove@1.0.0"]).toBeUndefined();
    });

    it("returns unchanged if extension not present", () => {
      const obj = { extensions: { "ext:keep@1.0.0": { a: 1 } } };
      const result = withoutExtension(obj, "ext:missing@1.0.0");

      expect(result).toEqual(obj);
    });
  });

  describe("getExtensionKeys", () => {
    it("returns all extension namespaces", () => {
      const obj = {
        extensions: {
          "ext:a@1.0.0": {},
          "ext:b@1.0.0": {},
        },
      };

      const keys = getExtensionKeys(obj);
      expect(keys).toContain("ext:a@1.0.0");
      expect(keys).toContain("ext:b@1.0.0");
    });

    it("returns empty array for no extensions", () => {
      const obj = {};
      expect(getExtensionKeys(obj)).toEqual([]);
    });
  });

  describe("withExtensions", () => {
    it("adds multiple extensions at once", () => {
      const obj = { id: "test" };
      const result = withExtensions(obj, {
        "ext:a@1.0.0": { a: 1 },
        "ext:b@1.0.0": { b: 2 },
      });

      expect(result.extensions?.["ext:a@1.0.0"]).toEqual({ a: 1 });
      expect(result.extensions?.["ext:b@1.0.0"]).toEqual({ b: 2 });
    });
  });

  describe("copyExtensions", () => {
    it("copies all extensions", () => {
      const from = {
        extensions: {
          "ext:a@1.0.0": { a: 1 },
          "ext:b@1.0.0": { b: 2 },
        },
      };
      const to = { id: "target" };

      const result = copyExtensions(from, to);

      expect(result.extensions?.["ext:a@1.0.0"]).toEqual({ a: 1 });
      expect(result.extensions?.["ext:b@1.0.0"]).toEqual({ b: 2 });
    });

    it("copies only specified namespaces", () => {
      const from = {
        extensions: {
          "ext:a@1.0.0": { a: 1 },
          "ext:b@1.0.0": { b: 2 },
        },
      };
      const to = { id: "target" };

      const result = copyExtensions(from, to, ["ext:a@1.0.0"]);

      expect(result.extensions?.["ext:a@1.0.0"]).toEqual({ a: 1 });
      expect(result.extensions?.["ext:b@1.0.0"]).toBeUndefined();
    });
  });

  describe("isValidNamespace", () => {
    it("accepts valid namespaces", () => {
      expect(isValidNamespace("ext:contrib@1.0.0")).toBe(true);
      expect(isValidNamespace("ext:myorg:custom@1.0.0")).toBe(true);
      expect(isValidNamespace("ext:simple")).toBe(true);
      expect(isValidNamespace("ext:a123")).toBe(true);
    });

    it("rejects invalid namespaces", () => {
      expect(isValidNamespace("invalid")).toBe(false);
      expect(isValidNamespace("contrib@1.0.0")).toBe(false);
      expect(isValidNamespace("ext:")).toBe(false);
      expect(isValidNamespace("ext:123invalid")).toBe(false);
    });
  });
});
