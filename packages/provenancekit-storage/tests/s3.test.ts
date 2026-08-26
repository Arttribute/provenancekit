import { describe, expect, it } from "vitest";
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { S3Storage } from "../src/adapters/files/s3";

function fakeS3() {
  const objects = new Map<string, Buffer>();
  const client = {
    async send(command: unknown) {
      if (command instanceof HeadBucketCommand) return {};
      if (command instanceof PutObjectCommand) {
        objects.set(command.input.Key!, Buffer.from(command.input.Body as Uint8Array));
        return {};
      }
      if (command instanceof HeadObjectCommand) {
        if (!objects.has(command.input.Key!)) {
          throw { name: "NotFound", $metadata: { httpStatusCode: 404 } };
        }
        return {};
      }
      if (command instanceof GetObjectCommand) {
        const body = objects.get(command.input.Key!);
        if (!body) throw { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } };
        return { Body: { transformToByteArray: async () => body } };
      }
      throw new Error("Unexpected S3 command");
    },
    destroy() {},
  } as unknown as S3Client;
  return { client, objects };
}

describe("S3Storage", () => {
  it("stores and retrieves content by a stable SHA-256 reference", async () => {
    const { client, objects } = fakeS3();
    const storage = new S3Storage({ bucket: "test-bucket", region: "eu-west-1", client });
    await storage.initialize();

    const first = await storage.upload(Buffer.from("provenance"), { mimeType: "text/plain" });
    const second = await storage.upload(Buffer.from("provenance"));

    expect(first.ref.ref).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(second.ref.ref).toBe(first.ref.ref);
    expect(objects.size).toBe(1);
    expect(await storage.exists(first.ref.ref)).toBe(true);
    expect((await storage.retrieve(first.ref.ref)).toString()).toBe("provenance");
  });
});
