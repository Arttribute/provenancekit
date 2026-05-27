import { z } from "zod";

/**
 * Namespace for governance demonstration/evaluation metadata.
 * @example "ext:governance@1.0.0"
 */
export const GOVERNANCE_NAMESPACE = "ext:governance@1.0.0" as const;

export const GovernanceRequirement = z.enum(["R1", "R2", "R3", "R4", "R5", "R6"]);
export type GovernanceRequirement = z.infer<typeof GovernanceRequirement>;

export const GovernanceExtension = z.object({
  workflow: z.string().optional(),
  purpose: z.string().optional(),
  roleInWorkflow: z
    .enum(["source", "prompt", "generated-output", "derived-output", "reference", "final-output"])
    .optional(),
  disclosure: z
    .object({
      aiInvolved: z.boolean().optional(),
      humanContribution: z.string().optional(),
      aiContribution: z.string().optional(),
      publicSummary: z.string().optional(),
    })
    .optional(),
  requirements: z.array(GovernanceRequirement).default([]),
  policyBasis: z.array(z.string()).optional(),
  riskFlags: z.array(z.string()).optional(),
  reviewStatus: z.enum(["not-reviewed", "review-required", "reviewed", "approved"]).optional(),
  note: z.string().optional(),
});

export type GovernanceExtension = z.infer<typeof GovernanceExtension>;

type Extensible = { extensions?: Record<string, unknown> };

export function withGovernance<T extends Extensible>(
  obj: T,
  governance: z.input<typeof GovernanceExtension>
): T {
  const validated = GovernanceExtension.parse(governance);
  return {
    ...obj,
    extensions: {
      ...obj.extensions,
      [GOVERNANCE_NAMESPACE]: validated,
    },
  };
}

export function getGovernance(obj: Extensible): GovernanceExtension | undefined {
  const data = obj.extensions?.[GOVERNANCE_NAMESPACE];
  if (!data) return undefined;
  return GovernanceExtension.parse(data);
}

export function hasGovernance(obj: Extensible): boolean {
  return obj.extensions?.[GOVERNANCE_NAMESPACE] !== undefined;
}
