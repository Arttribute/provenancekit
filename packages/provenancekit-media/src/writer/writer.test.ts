/**
 * Tests for writer module.
 *
 * Note: Many tests require c2pa-node which is an optional dependency.
 * Tests that require c2pa-node are skipped when it's not available.
 */

import { describe, it, expect } from "vitest";
import { MediaError } from "../types.js";
import { isC2PAAvailable } from "../reader/index.js";
import type { SignerConfig } from "../types.js";

/*─────────────────────────────────────────────────────────────*\
 | Test Fixtures                                                |
\*─────────────────────────────────────────────────────────────*/

function createMockSignerConfig(): SignerConfig {
  return {
    certificate: Buffer.from("mock-certificate"),
    privateKey: Buffer.from("mock-private-key"),
    algorithm: "es256",
    tsaUrl: "https://timestamp.example.com",
  };
}

/*─────────────────────────────────────────────────────────────*\
 | writeManifest Tests                                          |
\*─────────────────────────────────────────────────────────────*/

describe("writeManifest", () => {
  it("should throw MediaError when c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { writeManifest } = await import("./index.js");

      await expect(
        writeManifest("/input.jpg", "/output.jpg", {
          signer: createMockSignerConfig(),
          title: "Test",
        })
      ).rejects.toThrow(MediaError);

      await expect(
        writeManifest("/input.jpg", "/output.jpg", {
          signer: createMockSignerConfig(),
          title: "Test",
        })
      ).rejects.toThrow("c2pa-node is not available");
    }
  });

  it("should throw for non-existent input file when c2pa available", async () => {
    const available = await isC2PAAvailable();

    if (available) {
      const { writeManifest } = await import("./index.js");

      await expect(
        writeManifest("/non/existent/file.jpg", "/output.jpg", {
          signer: createMockSignerConfig(),
          title: "Test",
        })
      ).rejects.toThrow(MediaError);

      await expect(
        writeManifest("/non/existent/file.jpg", "/output.jpg", {
          signer: createMockSignerConfig(),
          title: "Test",
        })
      ).rejects.toThrow("not found");
    }
  });
});

/*─────────────────────────────────────────────────────────────*\
 | writeManifestFromEAA Tests                                   |
\*─────────────────────────────────────────────────────────────*/

describe("writeManifestFromEAA", () => {
  it("should throw MediaError when c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { writeManifestFromEAA } = await import("./index.js");

      await expect(
        writeManifestFromEAA(
          "/input.jpg",
          "/output.jpg",
          {
            resource: {
              id: "test",
              type: "image",
              contentRef: { ref: "test", scheme: "hash" },
            },
          },
          createMockSignerConfig()
        )
      ).rejects.toThrow(MediaError);
    }
  });
});

/*─────────────────────────────────────────────────────────────*\
 | removeManifest Tests                                         |
\*─────────────────────────────────────────────────────────────*/

describe("removeManifest", () => {
  it("should throw not implemented error", async () => {
    const { removeManifest } = await import("./index.js");

    await expect(
      removeManifest("/input.jpg", "/output.jpg")
    ).rejects.toThrow(MediaError);

    await expect(
      removeManifest("/input.jpg", "/output.jpg")
    ).rejects.toThrow("not yet implemented");
  });
});

/*─────────────────────────────────────────────────────────────*\
 | updateManifest Tests                                         |
\*─────────────────────────────────────────────────────────────*/

describe("updateManifest", () => {
  it("should throw when c2pa-node not available", async () => {
    const available = await isC2PAAvailable();

    if (!available) {
      const { updateManifest } = await import("./index.js");

      await expect(
        updateManifest(
          "/input.jpg",
          "/output.jpg",
          { title: "New Title" },
          createMockSignerConfig()
        )
      ).rejects.toThrow(MediaError);
    }
  });
});

/*─────────────────────────────────────────────────────────────*\
 | SignerConfig Tests                                           |
\*─────────────────────────────────────────────────────────────*/

describe("SignerConfig types", () => {
  it("should accept all valid algorithms", () => {
    const algorithms = ["es256", "es384", "es512", "ps256", "ps384", "ps512", "ed25519"] as const;

    for (const alg of algorithms) {
      const config: SignerConfig = {
        certificate: Buffer.from("cert"),
        privateKey: Buffer.from("key"),
        algorithm: alg,
      };

      expect(config.algorithm).toBe(alg);
    }
  });

  it("should accept string certificate and key", () => {
    const config: SignerConfig = {
      certificate: "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
      privateKey: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
      algorithm: "es256",
    };

    expect(typeof config.certificate).toBe("string");
    expect(typeof config.privateKey).toBe("string");
  });

  it("should accept Buffer certificate and key", () => {
    const config: SignerConfig = {
      certificate: Buffer.from("binary cert data"),
      privateKey: Buffer.from("binary key data"),
      algorithm: "ps256",
    };

    expect(config.certificate).toBeInstanceOf(Buffer);
    expect(config.privateKey).toBeInstanceOf(Buffer);
  });

  it("should accept optional tsaUrl", () => {
    const withTsa: SignerConfig = {
      certificate: "cert",
      privateKey: "key",
      algorithm: "es256",
      tsaUrl: "https://timestamp.digicert.com",
    };

    const withoutTsa: SignerConfig = {
      certificate: "cert",
      privateKey: "key",
      algorithm: "es256",
    };

    expect(withTsa.tsaUrl).toBe("https://timestamp.digicert.com");
    expect(withoutTsa.tsaUrl).toBeUndefined();
  });
});

/*─────────────────────────────────────────────────────────────*\
 | Format Validation Tests                                      |
\*─────────────────────────────────────────────────────────────*/

describe("format validation", () => {
  it("should reject unsupported formats when c2pa available", async () => {
    const available = await isC2PAAvailable();

    if (available) {
      const { writeManifest } = await import("./index.js");
      const fs = await import("fs");

      // Create a temp file with unsupported extension
      const tempPath = "/tmp/test-media-unsupported.txt";
      fs.writeFileSync(tempPath, "test content");

      try {
        await expect(
          writeManifest(tempPath, "/output.txt", {
            signer: createMockSignerConfig(),
            title: "Test",
          })
        ).rejects.toThrow(MediaError);

        await expect(
          writeManifest(tempPath, "/output.txt", {
            signer: createMockSignerConfig(),
            title: "Test",
          })
        ).rejects.toThrow("Unsupported");
      } finally {
        fs.unlinkSync(tempPath);
      }
    }
  });
});
