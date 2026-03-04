/**
 * Ownership Handler
 *
 * REST API endpoints for ownership claims and transfers.
 *
 * Three routes:
 *
 *   GET  /resource/:cid/ownership
 *     Returns the current ownership state for a resource plus the
 *     full ownership history (all claim and transfer Actions).
 *
 *   POST /resource/:cid/ownership/claim
 *     Record an ownership claim. Does NOT change ownership state.
 *     Any entity can file a claim. Trust level is conveyed by the
 *     ext:verification@1.0.0 on the returned Action.
 *
 *   POST /resource/:cid/ownership/transfer
 *     Transfer ownership to a new entity. DOES update ownership state.
 *     Permissive: any entity can submit. The returned Action carries
 *     ext:verification@1.0.0 showing whether the submitter is the
 *     current owner and whether a valid proof was provided.
 */

import { Hono } from "hono";
import { getContext } from "../context.js";
import { ProvenanceKitError } from "../errors.js";
import {
  recordOwnershipClaim,
  executeOwnershipTransfer,
} from "../services/ownership.service.js";

const r = new Hono();

/*──────────────────────────────────────────────────────────────*\
 | GET /resource/:cid/ownership                                   |
\*──────────────────────────────────────────────────────────────*/

/**
 * Get the current ownership state and full history for a resource.
 *
 * Response:
 * {
 *   resourceRef: string,
 *   registrant: Entity,           // created_by — who uploaded; immutable
 *   currentOwner: Entity,         // current authoritative owner
 *   neverTransferred: boolean,    // true if still with original registrant
 *   lastTransfer: Action | null,  // most recent transfer Action, if any
 *   history: Action[],            // all claim + transfer Actions, oldest first
 * }
 */
r.get("/resource/:cid/ownership", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "CID is required", {
      recovery: "Provide the resource CID in the URL path.",
    });
  }

  const { dbStorage } = getContext();

  // Ensure resource exists
  const resource = await dbStorage.getResource(cid);
  if (!resource) {
    throw new ProvenanceKitError("NotFound", `Resource not found: ${cid}`);
  }

  // Get ownership state (may be null for resources created before migration 002)
  const ownershipState = await dbStorage.getOwnershipState(cid);
  const currentOwnerId = ownershipState?.currentOwnerId ?? resource.createdBy;

  // Fetch entities
  const [registrant, currentOwner] = await Promise.all([
    dbStorage.getEntity(resource.createdBy as string),
    currentOwnerId !== resource.createdBy
      ? dbStorage.getEntity(currentOwnerId as string)
      : null,
  ]);

  // Fetch ownership history (all claim + transfer Actions)
  const history = await dbStorage.getOwnershipHistory(cid);

  // Fetch the last transfer Action if there is one
  let lastTransfer = null;
  if (ownershipState?.lastTransferId) {
    lastTransfer = await dbStorage.getAction(ownershipState.lastTransferId);
  }

  return c.json({
    resourceRef: cid,
    registrant,
    currentOwner: currentOwner ?? registrant,
    neverTransferred: !ownershipState?.lastTransferId,
    lastTransfer,
    history,
  });
});

/*──────────────────────────────────────────────────────────────*\
 | POST /resource/:cid/ownership/claim                           |
\*──────────────────────────────────────────────────────────────*/

/**
 * Record an ownership claim for a resource.
 *
 * Body:
 * {
 *   entity: {
 *     id?: string,
 *     role?: string,         // default: "human"
 *     name?: string,
 *     publicKey?: string,
 *     registrationSignature?: string,
 *   },
 *   evidenceType: "self-declaration" | "signed-content" |
 *                 "external-timestamp" | "legal-document" |
 *                 "third-party-attestation",
 *   evidenceRef?: string,   // hash, URL, or opaque reference
 *   proof?: {               // optional crypto proof
 *     algorithm: "Ed25519" | "ECDSA-secp256k1",
 *     publicKey: string,
 *     signature: string,
 *     timestamp: string,
 *   },
 *   note?: string,
 * }
 *
 * Returns 201 with the claim Action record.
 * Does NOT modify ownership state.
 * ext:verification@1.0.0 on the Action shows the trust level.
 */
r.post("/resource/:cid/ownership/claim", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "CID is required", {
      recovery: "Provide the resource CID in the URL path.",
    });
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    entity?: {
      id?: string;
      role?: string;
      name?: string;
      publicKey?: string;
      registrationSignature?: string;
    };
    evidenceType?: string;
    evidenceRef?: string;
    proof?: {
      algorithm: "Ed25519" | "ECDSA-secp256k1";
      publicKey: string;
      signature: string;
      timestamp: string;
    };
    note?: string;
  };

  if (!body.entity) {
    throw new ProvenanceKitError("MissingField", "`entity` is required", {
      recovery: "Provide an entity object with at least a role.",
    });
  }

  if (!body.evidenceType) {
    throw new ProvenanceKitError("MissingField", "`evidenceType` is required", {
      recovery:
        "Provide evidenceType: self-declaration | signed-content | external-timestamp | legal-document | third-party-attestation",
    });
  }

  const validEvidenceTypes = [
    "self-declaration",
    "signed-content",
    "external-timestamp",
    "legal-document",
    "third-party-attestation",
  ];
  if (!validEvidenceTypes.includes(body.evidenceType)) {
    throw new ProvenanceKitError(
      "InvalidField",
      `Invalid evidenceType: ${body.evidenceType}`,
      { recovery: `Use one of: ${validEvidenceTypes.join(", ")}` }
    );
  }

  const { action, attribution } = await recordOwnershipClaim({
    targetRef: cid,
    entity: body.entity,
    evidenceType: body.evidenceType as RecordClaimInputEvidenceType,
    evidenceRef: body.evidenceRef,
    proof: body.proof,
    note: body.note,
  });

  return c.json({ action, attribution }, 201);
});

type RecordClaimInputEvidenceType =
  | "self-declaration"
  | "signed-content"
  | "external-timestamp"
  | "legal-document"
  | "third-party-attestation";

/*──────────────────────────────────────────────────────────────*\
 | POST /resource/:cid/ownership/transfer                        |
\*──────────────────────────────────────────────────────────────*/

/**
 * Transfer ownership of a resource to a new entity.
 *
 * Body:
 * {
 *   performedBy: {           // entity submitting this transfer
 *     id?: string,
 *     role?: string,
 *     name?: string,
 *     publicKey?: string,
 *     registrationSignature?: string,
 *   },
 *   toEntityId: string,      // ID of the new owner (must already exist)
 *   transferType: "voluntary" | "authorized" | "adjudicated",
 *   authorizationRef?: string,  // action ID of a prior claim, or external ref
 *   proof?: {                   // optional crypto proof from the submitter
 *     algorithm: "Ed25519" | "ECDSA-secp256k1",
 *     publicKey: string,
 *     signature: string,
 *     timestamp: string,
 *   },
 *   note?: string,
 * }
 *
 * Returns 200 with the transfer Action record.
 * ALWAYS updates ownership state.
 * ext:verification@1.0.0 on the Action shows trust level:
 *   "verified"   = submitter IS the current owner AND provided valid proof
 *   "partial"    = valid proof but submitter is NOT current owner
 *   "unverified" = no proof provided
 */
r.post("/resource/:cid/ownership/transfer", async (c) => {
  const cid = c.req.param("cid");
  if (!cid) {
    throw new ProvenanceKitError("MissingField", "CID is required", {
      recovery: "Provide the resource CID in the URL path.",
    });
  }

  const body = (await c.req.json().catch(() => ({}))) as {
    performedBy?: {
      id?: string;
      role?: string;
      name?: string;
      publicKey?: string;
      registrationSignature?: string;
    };
    toEntityId?: string;
    transferType?: string;
    authorizationRef?: string;
    proof?: {
      algorithm: "Ed25519" | "ECDSA-secp256k1";
      publicKey: string;
      signature: string;
      timestamp: string;
    };
    note?: string;
  };

  if (!body.performedBy) {
    throw new ProvenanceKitError("MissingField", "`performedBy` is required", {
      recovery: "Provide a performedBy entity object.",
    });
  }

  if (!body.toEntityId) {
    throw new ProvenanceKitError("MissingField", "`toEntityId` is required", {
      recovery: "Provide the entity ID of the new owner.",
    });
  }

  const validTransferTypes = ["voluntary", "authorized", "adjudicated"];
  if (!body.transferType || !validTransferTypes.includes(body.transferType)) {
    throw new ProvenanceKitError(
      "InvalidField",
      `Invalid or missing transferType: ${body.transferType}`,
      { recovery: `Use one of: ${validTransferTypes.join(", ")}` }
    );
  }

  const { action, attribution } = await executeOwnershipTransfer({
    targetRef: cid,
    performedBy: body.performedBy,
    toEntityId: body.toEntityId,
    transferType: body.transferType as "voluntary" | "authorized" | "adjudicated",
    authorizationRef: body.authorizationRef,
    proof: body.proof,
    note: body.note,
  });

  return c.json({ action, attribution });
});

export default r;
