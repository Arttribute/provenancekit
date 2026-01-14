export * from "./base";
export * from "./extensions";
export const VERSION = "0.0.2";

/*─────────────────────────────────────────────────────────────*\
 | Breaking Changes from v1                                      |
 |                                                               |
 | The following fields have been REMOVED from base types:       |
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
 |   - "remix" → "transform"                                     |
|   - "derive" → "transform"                                    |
 |   - "train" → use "ext:ml:train"                              |
 |   - "review" → "verify"                                       |
 |   - "assign" → removed (use extensions)                       |
 |   - "contribute" → removed (use extensions)                   |
 |                                                               |
 | AttributionRole enum simplified:                              |
 |   - "sourceMaterial" → "source"                               |
 |   - "reviewer" → removed (use extensions)                     |
 |                                                               |
 | ResourceType enum simplified:                                 |
 |   - "dataset" → "data"                                        |
 |   - "tool" → removed (use extensions)                         |
 |   - "composite" → removed (use extensions)                    |
 |                                                               |
 | See MIGRATION.md for upgrade guide.                           |
\*─────────────────────────────────────────────────────────────*/
