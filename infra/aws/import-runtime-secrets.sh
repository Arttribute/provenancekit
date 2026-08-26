#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <source-env-file> <aws-secret-id>" >&2
  exit 64
fi

source_env="$1"
secret_id="$2"
region="${AWS_REGION:-eu-west-1}"

if [ ! -f "$source_env" ]; then
  echo "Environment file not found: $source_env" >&2
  exit 66
fi

# Local production secrets must never be group/world-readable.
chmod 600 "$source_env"

transfer_dir=$(mktemp -d)
secret_json="$transfer_dir/runtime.json"
trap 'rm -f "$secret_json"; rmdir "$transfer_dir" 2>/dev/null || true' EXIT

SOURCE_ENV="$source_env" SECRET_JSON="$secret_json" node --input-type=module <<'NODE'
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, chmodSync } from "node:fs";

const parsed = {};
for (const rawLine of readFileSync(process.env.SOURCE_ENV, "utf8").split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const separator = line.indexOf("=");
  if (separator < 1) continue;
  const key = line.slice(0, separator).trim();
  let value = line.slice(separator + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  parsed[key] = value;
}

const required = [
  "DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_KEY",
  "PINATA_JWT", "PINATA_GATEWAY", "MANAGEMENT_API_KEY",
  "SERVER_SIGNING_KEY", "BLOCKCHAIN_RPC_URL", "BLOCKCHAIN_CHAIN_ID",
  "BLOCKCHAIN_CHAIN_NAME", "BLOCKCHAIN_CONTRACT_ADDRESS", "BLOCKCHAIN_PRIVATE_KEY",
];
const missing = required.filter((key) => !parsed[key]);
if (missing.length) throw new Error(`Missing required production keys: ${missing.join(", ")}`);

if (!parsed.API_KEYS) parsed.API_KEYS = `pk_live_${randomBytes(32).toString("hex")}`;
const selected = Object.fromEntries([...required, "API_KEYS"].map((key) => [key, parsed[key]]));
selected.CONFIG_FINGERPRINT = createHash("sha256")
  .update(JSON.stringify(Object.keys(selected).sort()))
  .digest("hex");
writeFileSync(process.env.SECRET_JSON, JSON.stringify(selected), { mode: 0o600 });
chmodSync(process.env.SECRET_JSON, 0o600);
NODE

aws secretsmanager put-secret-value \
  --secret-id "$secret_id" \
  --secret-string "file://$secret_json" \
  --region "$region" \
  --query '{ARN:ARN,VersionId:VersionId}' \
  --output json

echo "Imported validated ProvenanceKit runtime keys into AWS Secrets Manager."
