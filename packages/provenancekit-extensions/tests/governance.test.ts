import { describe, expect, it } from "vitest";
import { GOVERNANCE_NAMESPACE, getGovernance, hasGovernance, withGovernance } from "../src/governance";

describe("governance extension", () => {
  it("attaches and reads governance metadata", () => {
    const action = withGovernance({ id: "act-1", type: "generate" }, {
      workflow: "demo",
      roleInWorkflow: "derived-output",
      requirements: ["R1", "R2", "R3", "R4", "R5", "R6"],
      reviewStatus: "review-required",
      riskFlags: ["authorisation-review"],
    });

    expect(hasGovernance(action)).toBe(true);
    expect(action.extensions?.[GOVERNANCE_NAMESPACE]).toBeDefined();
    expect(getGovernance(action)?.requirements).toContain("R5");
  });
});
