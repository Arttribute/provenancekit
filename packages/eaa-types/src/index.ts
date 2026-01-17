export * from "./base";
export * from "./extensions";
export const VERSION = "0.0.3";

/*─────────────────────────────────────────────────────────────*\
 | Breaking Changes in v2 (Context URI v2)                       |
 |                                                               |
 | CONTENT ADDRESSING (NEW):                                     |
 |   - ContentAddress type REMOVED                               |
 |   - ContentReference type ADDED (flexible addressing)         |
 |   - Supports: cid (IPFS), ar (Arweave), http, hash            |
 |   - CID scheme is STRONGLY RECOMMENDED (self-verifying)       |
 |   - Custom schemes via ext:namespace pattern                  |
 |   - Helper functions: cidRef(), httpRef(), arRef()            |
 |                                                               |
 | Resource:                                                     |
 |   - address: ContentAddress -> ContentReference               |
 |   - locations: now optional (default [])                      |
 |                                                               |
 | Action:                                                       |
 |   - inputs: string[] (CIDs) -> ContentReference[]             |
 |   - outputs: string[] (CIDs) -> ContentReference[]            |
 |                                                               |
 | Attribution:                                                  |
 |   - resourceCid: string -> resourceRef: ContentReference      |
 |   - resourceRef is now OPTIONAL (if actionId provided)        |
 |   - actionId: string ADDED (for action-level attribution)     |
 |   - id: string ADDED (optional identifier)                    |
 |   - At least one of resourceRef or actionId required          |
 |                                                               |
 |---------------------------------------------------------------|
 | Previous Breaking Changes (v1):                               |
 |                                                               |
 | Attribution:                                                  |
 |   - weight (use ext:contrib extension)                        |
 |   - includedInRevenue (use ext:x402 extension)                |
 |   - includedInAttribution (redundant - use note field)        |
 |                                                               |
 | Resource:                                                     |
 |   - license (use ext:licensing extension)                     |
 |                                                               |
 | Action:                                                       |
 |   - assignedByEntity (use extensions)                         |
 |   - reviewedByEntity (use extensions)                         |
 |   - reviewOutcome (use extensions)                            |
 |   - toolUsed (use extensions)                                 |
 |   - inputCids renamed to inputs                               |
 |   - outputCids renamed to outputs                             |
 |                                                               |
 | ActionType enum simplified:                                   |
 |   - "remix" -> "transform"                                    |
 |   - "derive" -> "transform"                                   |
 |   - "train" -> use "ext:ml:train"                             |
 |   - "review" -> "verify"                                      |
 |   - "assign" -> removed (use extensions)                      |
 |   - "contribute" -> removed (use extensions)                  |
 |                                                               |
 | AttributionRole enum simplified:                              |
 |   - "sourceMaterial" -> "source"                              |
 |   - "reviewer" -> removed (use extensions)                    |
 |                                                               |
 | ResourceType enum simplified:                                 |
 |   - "tool" -> removed (use extensions)                        |
 |   - "composite" -> removed (use extensions)                   |
 |                                                               |
 | See MIGRATION.md for upgrade guide.                           |
\*─────────────────────────────────────────────────────────────*/
