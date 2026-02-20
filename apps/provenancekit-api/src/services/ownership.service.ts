/**
 * Ownership Service
 *
 * Business logic for ownership claims and transfers.
 *
 * Design principles (aligned with project vision):
 * - Permissive: Any entity can file a claim or submit a transfer.
 *   The system records events; it does not adjudicate disputes.
 * - Verifiable: ext:verification@1.0.0 on every ownership Action
 *   tells consumers how much to trust it:
 *     "verified"       → proof signed by the current owner's registered key
 *     "receipt-backed" → server recorded it; proof present but from a different key
 *     "unverified"     → no proof supplied; bare assertion
 * - Immutable audit trail: claims and transfers are Actions in the
 *   provenance chain and are never deleted.
 * - `created_by` never changes: it always identifies the registrant
 *   (uploader), even after ownership transfers.
 */

import { v4 as uuidv4 } from "uuid";
import { cidRef, type Action, type Attribution } from "@arttribute/eaa-types";
import {
  withOwnershipClaim,
  withOwnershipTransfer,
  withVerification,
  type ClaimStatus,
} from "@provenancekit/extensions";
import { verifyAction, type ActionSignPayload } from "@provenancekit/sdk";
import { supportsTransactions } from "@provenancekit/storage";
import { getContext } from "../context.js";
import { config } from "../config.js";
import { ProvenanceKitError } from "../errors.js";
import { registerOrUpdateEntity } from "./entity.service.js";

/*─────────────────────────────────────────────────────────────*\
 | Input Types                                                   |
\*─────────────────────────────────────────────────────────────*/

export interface RecordClaimInput {
  /** The CID of the resource being claimed */
  targetRef: string;
  /** The entity asserting ownership */
  entity: {
    id?: string;
    role?: string;
    name?: string;
    publicKey?: string;
    registrationSignature?: string;
  };
  /** Type of evidence being presented */
  evidenceType:
    | "self-declaration"
    | "signed-content"
    | "external-timestamp"
    | "legal-document"
    | "third-party-attestation";
  /** Opaque reference to the evidence (hash, URL, doc ID, …) */
  evidenceRef?: string;
  /** Optional cryptographic proof signed by the claimant's registered key */
  proof?: {
    algorithm: "Ed25519" | "ECDSA-secp256k1";
    publicKey: string;
    signature: string;
    timestamp: string;
  };
  /** Human-readable note */
  note?: string;
}

export interface ExecuteTransferInput {
  /** The CID of the resource being transferred */
  targetRef: string;
  /** The entity submitting this transfer (may or may not be current owner) */
  performedBy: {
    id?: string;
    role?: string;
    name?: string;
    publicKey?: string;
    registrationSignature?: string;
  };
  /** Entity ID of the new owner */
  toEntityId: string;
  /** Authority under which this transfer is happening */
  transferType: "voluntary" | "authorized" | "adjudicated";
  /** Optional reference to authorizing event (claim Action ID, doc hash, …) */
  authorizationRef?: string;
  /** Optional cryptographic proof signed by the submitter's key */
  proof?: {
    algorithm: "Ed25519" | "ECDSA-secp256k1";
    publicKey: string;
    signature: string;
    timestamp: string;
  };
  /** Human-readable note */
  note?: string;
}

/*─────────────────────────────────────────────────────────────*\
 | Shared Proof Verification Helper                              |
\*─────────────────────────────────────────────────────────────*/

/**
 * Verify a submitted proof against the entity's registered public key
 * and return the appropriate claim status.
 *
 * Mirrors the logic in activity.service.ts verifyActionProof() but
 * adapted for ownership actions (no outputs to bind).
 */
async function verifyOwnershipProof(
  proof:
    | { algorithm: string; publicKey: string; signature: string; timestamp: string }
    | undefined,
  entity: { id: string; publicKey?: string },
  actionType: string,
  inputCids: string[],
  timestamp: string
): Promise<{ status: ClaimStatus; detail?: string }> {
  if (config.proofPolicy === "off") {
    return { status: "skipped", detail: "proofPolicy=off" };
  }

  if (proof) {
    // Verify the proof key matches the entity's registered key (if set)
    if (entity.publicKey && proof.publicKey !== entity.publicKey) {
      return {
        status: "failed" as ClaimStatus,
        detail: "Proof public key does not match entity's registered public key",
      };
    }

    const payload: ActionSignPayload = {
      entityId: entity.id,
      actionType,
      inputs: inputCids,
      timestamp,
    };

    try {
      const valid = await verifyAction(payload, proof as Parameters<typeof verifyAction>[1]);
      if (valid) {
        return { status: "verified", detail: "Proof verified against registered key" };
      }
      return { status: "failed" as ClaimStatus, detail: "Proof signature invalid" };
    } catch {
      return { status: "failed" as ClaimStatus, detail: "Proof verification failed" };
    }
  }

  if (entity.publicKey) {
    if (config.proofPolicy === "enforce") {
      // In enforce mode, warn but don't reject (ownership actions are permissive by design)
      console.warn(
        `[proof-policy] Unsigned ownership action from entity ${entity.id} (has registered public key)`
      );
    }
    return {
      status: "unverified",
      detail: "Entity has publicKey but no proof provided",
    };
  }

  return { status: "unverified", detail: "No publicKey registered, no proof provided" };
}

/*─────────────────────────────────────────────────────────────*\
 | recordOwnershipClaim                                          |
\*─────────────────────────────────────────────────────────────*/

/**
 * Record an ownership claim for an existing resource.
 *
 * This does NOT change the ownership state — it creates an immutable
 * Action in the provenance chain that any external resolution process
 * can reference. The claim Action carries the claimant's evidence type
 * and an optional cryptographic proof.
 *
 * Any entity can file a claim. Trust is conveyed by ext:verification@1.0.0
 * on the returned Action.
 */
export async function recordOwnershipClaim(
  input: RecordClaimInput
): Promise<{ action: Action; attribution: Attribution }> {
  const { dbStorage } = getContext();

  // 1. Verify the resource exists
  const resource = await dbStorage.getResource(input.targetRef);
  if (!resource) {
    throw new ProvenanceKitError(
      "NotFound",
      `Resource not found: ${input.targetRef}`,
      { recovery: "Ensure the CID is correct and the resource has been uploaded." }
    );
  }

  // 2. Register or resolve the claimant entity
  const entityId = input.entity.id ?? uuidv4();
  const { entity: resolvedEntity } = await registerOrUpdateEntity({
    id: entityId,
    role: input.entity.role ?? "human",
    name: input.entity.name,
    publicKey: input.entity.publicKey,
    registrationSignature: input.entity.registrationSignature,
  });

  // 3. Verify proof (permissive — never rejects)
  const actionType = "ext:ownership:claim@1.0.0";
  const timestamp = new Date().toISOString();
  const actionId = uuidv4();

  const proofStatus = await verifyOwnershipProof(
    input.proof,
    { id: resolvedEntity.id as string, publicKey: resolvedEntity.publicKey },
    actionType,
    [input.targetRef],
    timestamp
  );

  // 4. Build claim Action
  let action: Action = {
    id: actionId,
    type: actionType,
    performedBy: resolvedEntity.id,
    timestamp,
    inputs: [cidRef(input.targetRef)],
    outputs: [],
  };

  // Attach ownership claim extension
  action = withOwnershipClaim(action, {
    targetRef: input.targetRef,
    evidenceType: input.evidenceType,
    evidenceRef: input.evidenceRef,
    note: input.note,
  });

  // Attach verification extension so consumers know the trust level
  action = withVerification(action, {
    status: proofStatus.status === "verified" ? "verified" : "unverified",
    claims: {
      identity: { status: "receipt-backed", detail: "Entity registered in system" },
      action: proofStatus,
      output: { status: "skipped", detail: "Claim actions produce no output" },
    },
    verifiedAt: timestamp,
    policyUsed: config.proofPolicy,
  });

  // 5. Persist the action — this is the immutable record
  await dbStorage.createAction(action);

  // 6. Record attribution linking the claimant to this claim action
  const attribution: Attribution = {
    id: uuidv4(),
    actionId,
    resourceRef: cidRef(input.targetRef),
    entityId: resolvedEntity.id,
    role: "ext:ownership:claimant@1.0.0" as Attribution["role"],
    note: input.note,
  };
  await dbStorage.createAttribution(attribution);

  return { action, attribution };
}

/*─────────────────────────────────────────────────────────────*\
 | executeOwnershipTransfer                                      |
\*─────────────────────────────────────────────────────────────*/

/**
 * Execute an ownership transfer for a resource.
 *
 * This IS a state-changing operation: it atomically creates a transfer
 * Action in the provenance chain AND updates pk_ownership_state.
 *
 * The transfer is permissive — any entity can submit one. Trust is
 * conveyed by ext:verification@1.0.0 on the returned Action:
 *
 *   "verified"       → proof was signed by the current owner's registered key
 *   "partial"        → proof present but from a non-owner key (e.g. adjudicator)
 *   "unverified"     → no proof; bare assertion
 *
 * Consumers (smart contracts, downstream systems) should inspect the
 * verification status to decide whether to honour the transfer.
 */
export async function executeOwnershipTransfer(
  input: ExecuteTransferInput
): Promise<{ action: Action; attribution: Attribution }> {
  const { dbStorage } = getContext();

  // 1. Verify the resource exists
  const resource = await dbStorage.getResource(input.targetRef);
  if (!resource) {
    throw new ProvenanceKitError(
      "NotFound",
      `Resource not found: ${input.targetRef}`,
      { recovery: "Ensure the CID is correct and the resource has been uploaded." }
    );
  }

  // 2. Get current ownership state
  const ownershipState = await dbStorage.getOwnershipState(input.targetRef);
  const currentOwnerId = ownershipState?.currentOwnerId ?? resource.createdBy;

  // 3. Verify the toEntityId exists
  const newOwner = await dbStorage.getEntity(input.toEntityId);
  if (!newOwner) {
    throw new ProvenanceKitError(
      "NotFound",
      `New owner entity not found: ${input.toEntityId}`,
      { recovery: "Register the new owner entity before transferring ownership to them." }
    );
  }

  // 4. Register or resolve the submitting entity
  const performedById = input.performedBy.id ?? uuidv4();
  const { entity: performer } = await registerOrUpdateEntity({
    id: performedById,
    role: input.performedBy.role ?? "human",
    name: input.performedBy.name,
    publicKey: input.performedBy.publicKey,
    registrationSignature: input.performedBy.registrationSignature,
  });

  // 5. Verify proof — determines trust level of this transfer
  const actionType = "ext:ownership:transfer@1.0.0";
  const timestamp = new Date().toISOString();
  const actionId = uuidv4();

  const proofStatus = await verifyOwnershipProof(
    input.proof,
    { id: performer.id as string, publicKey: performer.publicKey },
    actionType,
    [input.targetRef],
    timestamp
  );

  // Determine whether the submitter IS the current owner (for verification labelling)
  const isCurrentOwner = performer.id === currentOwnerId;
  const verificationStatus =
    proofStatus.status === "verified" && isCurrentOwner
      ? "verified"     // Current owner signed it — fully trustworthy
      : proofStatus.status === "verified"
      ? "partial"      // Someone else signed, but with a valid key
      : "unverified";  // No cryptographic proof

  // 6. Build transfer Action
  let action: Action = {
    id: actionId,
    type: actionType,
    performedBy: performer.id,
    timestamp,
    // inputs = the resource being transferred; outputs = same resource (new owner)
    inputs: [cidRef(input.targetRef)],
    outputs: [cidRef(input.targetRef)],
  };

  // Attach ownership transfer extension
  action = withOwnershipTransfer(action, {
    targetRef: input.targetRef,
    fromEntityId: currentOwnerId as string,
    toEntityId: input.toEntityId,
    transferType: input.transferType,
    authorizationRef: input.authorizationRef,
    note: input.note,
  });

  // Attach verification extension
  action = withVerification(action, {
    status: verificationStatus,
    claims: {
      identity: {
        status: "receipt-backed",
        detail: isCurrentOwner
          ? "Performer is the current owner"
          : `Performer (${performer.id}) is NOT the current owner (${currentOwnerId})`,
      },
      action: proofStatus,
      output: { status: "receipt-backed", detail: "Transfer recorded by server" },
    },
    verifiedAt: timestamp,
    policyUsed: config.proofPolicy,
  });

  // 7. Atomically persist action + update ownership state
  // Use transaction if available, fall back to sequential operations
  if (supportsTransactions(dbStorage)) {
    await dbStorage.transaction(async (tx) => {
      await tx.createAction(action);
      await tx.transferOwnershipState(input.targetRef, input.toEntityId, actionId);
    });
  } else {
    await dbStorage.createAction(action);
    await dbStorage.transferOwnershipState(input.targetRef, input.toEntityId, actionId);
  }

  // 8. Record attribution for the new owner
  const attribution: Attribution = {
    id: uuidv4(),
    actionId,
    resourceRef: cidRef(input.targetRef),
    entityId: input.toEntityId,
    role: "ext:ownership:owner@1.0.0" as Attribution["role"],
    note: input.note,
  };
  await dbStorage.createAttribution(attribution);

  return { action, attribution };
}
