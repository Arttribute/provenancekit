# Shared embedding contract

ProvenanceKit consumers should compute an embedding once and index it wherever
their authorization and query boundaries require. A vector is reusable only
when all of these fields match:

- content digest (`sha256` over the normalized input bytes)
- provider and model/version
- dimensions
- normalization pipeline/version
- resource kind and modality

The stable cache identity is the SHA-256 digest of those fields. Importers must
validate the vector length, finite numeric values, content digest, and vector
commitment before storage. An absent, incompatible, or untrusted envelope falls
back to the configured embedding provider.

The provenance record contains the descriptor, computing entity, cache key,
and vector commitment—not the raw vector. Separate indexes remain valid for
tenant isolation, retention, regional residency, and workload-specific query
performance; they should store the verified vector rather than recompute it.

Agent Commons is the default computing authority for its permission-scoped
Library chunks. ProvenanceKit is the default for artifacts first uploaded to
its API and for image/audio/video inputs its universal provider normalizes.
Either provider is replaceable through the same descriptor contract.
