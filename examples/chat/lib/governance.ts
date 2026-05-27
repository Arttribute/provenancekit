import type { AttachmentGovernance, AttachmentGovernanceStatus } from "@/types";

export const GOVERNANCE_NAMESPACE = "ext:governance@1.0.0";
export const AUTHORIZATION_NAMESPACE = "ext:authorization@1.0.0";
export const LICENSE_NAMESPACE = "ext:license@1.0.0";

export const GOVERNANCE_REQUIREMENTS = ["R1", "R2", "R3", "R4", "R5", "R6"] as const;

export function defaultAttachmentGovernance(status: AttachmentGovernanceStatus): AttachmentGovernance {
  if (status === "own-original") {
    return {
      status,
      licenseType: "CC-BY-4.0",
      authorizationStatus: "authorized",
      scope: "User-created source material contributed to this Human-AI workflow.",
      aiTraining: "reserved",
      contributorRole: "creator",
      contributionWeight: 4000,
      note: "Human-origin input; AI training rights reserved by default for the demo.",
    };
  }

  if (status === "licensed-source") {
    return {
      status,
      licenseType: "CC-BY-4.0",
      authorizationStatus: "authorized",
      scope: "Licensed third-party source used for summarisation, transformation, or reference.",
      aiTraining: "reserved",
      contributorRole: "source",
      contributionWeight: 2500,
      note: "External source with declared licence and attribution requirement.",
    };
  }

  return {
    status,
    licenseType: "Proprietary",
    authorizationStatus: "pending",
    scope: "Restricted external source; review authorisation before publication or redistribution.",
    aiTraining: "reserved",
    contributorRole: "reference",
    contributionWeight: 1000,
    note: "Governance risk: source may require consent, licence review, or redaction.",
  };
}

export function buildGovernanceExtensions(opts: {
  governance: AttachmentGovernance;
  userId: string;
  fileName?: string;
  roleInWorkflow: "source" | "prompt" | "generated-output" | "derived-output" | "reference" | "final-output";
}) {
  const now = new Date().toISOString();
  const { governance, userId, fileName, roleInWorkflow } = opts;

  return {
    authorization: {
      status: governance.authorizationStatus,
      authorizedBy: governance.authorizationStatus === "authorized" ? userId : undefined,
      authorizedAt: governance.authorizationStatus === "authorized" ? now : undefined,
      scope: governance.scope,
      reference: `chat-demo:${governance.status}:${fileName ?? "attachment"}`,
    },
    governance: {
      workflow: "Human-AI governance demo chat",
      purpose: "Demonstrate attribution, rights, authorisation, AI disclosure, derivation, and selective disclosure readiness.",
      roleInWorkflow,
      requirements: ["R1", "R2", "R3", "R5", "R6"],
      policyBasis: [
        "Copyright authorship: human contribution and transformation history",
        "DSM Art. 4(3): machine-readable AI training rights reservation",
        "EU AI Act Art. 50: AI involvement disclosure",
        "GDPR/data governance: consent and scoped disclosure",
      ],
      riskFlags: governance.status === "restricted-source" ? ["authorisation-review", "rights-restricted"] : [],
      reviewStatus: governance.status === "restricted-source" ? "review-required" : "reviewed",
      note: governance.note,
    },
  };
}
