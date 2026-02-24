import { describe, it, expect } from "vitest";
import type { Action, Entity } from "@provenancekit/eaa-types";
import {
  AI_NAMESPACE,
  AIToolExtension,
  AIAgentExtension,
  withAITool,
  withAIAgent,
  getAITool,
  getAIAgent,
  usedAITool,
  isAIAgent,
  getToolModel,
  getAgentModel,
  createAIAgent,
  addCollaborators,
  setAgentSession,
} from "../src/ai";

const createAction = (type: string = "create"): Action => ({
  type,
  performedBy: "did:key:alice",
  timestamp: new Date().toISOString(),
  inputs: [],
  outputs: [],
});

const createEntity = (role: "human" | "ai" | "organization" = "human"): Entity => ({
  id: "test-entity",
  name: "Test Entity",
  role,
});

describe("ai extension", () => {
  describe("AI_NAMESPACE", () => {
    it("has correct value", () => {
      expect(AI_NAMESPACE).toBe("ext:ai@1.0.0");
    });
  });

  describe("AIToolExtension schema", () => {
    it("validates minimal tool config", () => {
      const result = AIToolExtension.safeParse({
        provider: "anthropic",
        model: "claude-3-opus",
      });
      expect(result.success).toBe(true);
    });

    it("validates full tool config", () => {
      const result = AIToolExtension.safeParse({
        provider: "anthropic",
        model: "claude-3-opus",
        version: "20240229",
        promptHash: "sha256:abc123",
        prompt: "Write a haiku",
        systemPrompt: "You are a poet",
        parameters: { temperature: 0.7 },
        tokensUsed: 150,
        generationTime: 2500,
        seed: 42,
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing required fields", () => {
      const result = AIToolExtension.safeParse({
        provider: "anthropic",
        // missing model
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AIAgentExtension schema", () => {
    it("validates minimal agent config", () => {
      const result = AIAgentExtension.safeParse({});
      expect(result.success).toBe(true);
    });

    it("validates full agent config", () => {
      const result = AIAgentExtension.safeParse({
        model: {
          provider: "anthropic",
          model: "claude-3-opus",
          version: "20240229",
        },
        framework: "langchain",
        delegatedBy: "did:key:alice",
        autonomyLevel: "supervised",
        capabilities: ["code", "write", "research"],
        sessionId: "session-123",
        collaborators: ["agent-b", "agent-c"],
        agentRole: "coordinator",
        config: { maxTokens: 4096 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("withAITool", () => {
    it("adds AI tool extension to action", () => {
      const action = createAction();
      const result = withAITool(action, {
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(result.extensions?.[AI_NAMESPACE]).toBeDefined();
      expect(result.extensions?.[AI_NAMESPACE]).toHaveProperty("tool");
    });

    it("preserves existing action properties", () => {
      const action = createAction("transform");
      const result = withAITool(action, {
        provider: "openai",
        model: "gpt-4",
      });

      expect(result.type).toBe("transform");
      expect(result.performedBy).toBe("did:key:alice");
    });

    it("preserves existing extensions", () => {
      const action: Action = {
        ...createAction(),
        extensions: { "ext:other": { value: 42 } },
      };
      const result = withAITool(action, {
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(result.extensions?.["ext:other"]).toEqual({ value: 42 });
    });

    it("validates input", () => {
      const action = createAction();
      expect(() =>
        withAITool(action, { provider: "test" } as any)
      ).toThrow();
    });
  });

  describe("withAIAgent", () => {
    it("adds AI agent extension to entity", () => {
      const entity = createEntity("ai");
      const result = withAIAgent(entity, {
        model: { provider: "anthropic", model: "claude-3-opus" },
        autonomyLevel: "supervised",
      });

      expect(result.extensions?.[AI_NAMESPACE]).toBeDefined();
      expect(result.extensions?.[AI_NAMESPACE]).toHaveProperty("agent");
    });

    it("preserves existing entity properties", () => {
      const entity = createEntity("ai");
      const result = withAIAgent(entity, {
        framework: "autogen",
      });

      expect(result.id).toBe("test-entity");
      expect(result.name).toBe("Test Entity");
      expect(result.role).toBe("ai");
    });
  });

  describe("getAITool", () => {
    it("returns tool extension when present", () => {
      const action = withAITool(createAction(), {
        provider: "anthropic",
        model: "claude-3-opus",
        tokensUsed: 100,
      });

      const tool = getAITool(action);

      expect(tool).toBeDefined();
      expect(tool?.provider).toBe("anthropic");
      expect(tool?.model).toBe("claude-3-opus");
      expect(tool?.tokensUsed).toBe(100);
    });

    it("returns undefined when not present", () => {
      const action = createAction();
      expect(getAITool(action)).toBeUndefined();
    });
  });

  describe("getAIAgent", () => {
    it("returns agent extension when present", () => {
      const entity = withAIAgent(createEntity("ai"), {
        model: { provider: "anthropic", model: "claude-3-opus" },
        autonomyLevel: "full",
      });

      const agent = getAIAgent(entity);

      expect(agent).toBeDefined();
      expect(agent?.model?.provider).toBe("anthropic");
      expect(agent?.autonomyLevel).toBe("full");
    });

    it("returns undefined when not present", () => {
      const entity = createEntity("ai");
      expect(getAIAgent(entity)).toBeUndefined();
    });
  });

  describe("usedAITool", () => {
    it("returns true when action used AI tool", () => {
      const action = withAITool(createAction(), {
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(usedAITool(action)).toBe(true);
    });

    it("returns false when action did not use AI tool", () => {
      expect(usedAITool(createAction())).toBe(false);
    });
  });

  describe("isAIAgent", () => {
    it("returns true when entity has AI agent extension", () => {
      const entity = withAIAgent(createEntity("ai"), {
        model: { provider: "anthropic", model: "claude-3-opus" },
      });

      expect(isAIAgent(entity)).toBe(true);
    });

    it("returns true when entity role is ai", () => {
      const entity = createEntity("ai");
      expect(isAIAgent(entity)).toBe(true);
    });

    it("returns false for human entity without extension", () => {
      const entity = createEntity("human");
      expect(isAIAgent(entity)).toBe(false);
    });
  });

  describe("getToolModel", () => {
    it("returns model identifier from AI tool", () => {
      const action = withAITool(createAction(), {
        provider: "anthropic",
        model: "claude-3-opus",
      });

      expect(getToolModel(action)).toBe("claude-3-opus");
    });

    it("returns undefined when no AI tool", () => {
      expect(getToolModel(createAction())).toBeUndefined();
    });
  });

  describe("getAgentModel", () => {
    it("returns model identifier from AI agent", () => {
      const entity = withAIAgent(createEntity("ai"), {
        model: { provider: "anthropic", model: "claude-3-opus" },
      });

      expect(getAgentModel(entity)).toBe("claude-3-opus");
    });

    it("returns undefined when no model specified", () => {
      const entity = withAIAgent(createEntity("ai"), {
        framework: "langchain",
      });

      expect(getAgentModel(entity)).toBeUndefined();
    });

    it("returns undefined when not an AI agent", () => {
      expect(getAgentModel(createEntity("human"))).toBeUndefined();
    });
  });

  describe("createAIAgent", () => {
    it("creates AI agent entity with full options", () => {
      const agent = createAIAgent("agent:coordinator", {
        name: "Task Coordinator",
        model: { provider: "anthropic", model: "claude-3-opus" },
        framework: "autogen",
        delegatedBy: "did:key:alice",
        autonomyLevel: "supervised",
        capabilities: ["code", "research"],
        sessionId: "session-123",
        collaborators: ["agent-b"],
        agentRole: "coordinator",
      });

      expect(agent.id).toBe("agent:coordinator");
      expect(agent.name).toBe("Task Coordinator");
      expect(agent.role).toBe("ai");

      const agentExt = getAIAgent(agent);
      expect(agentExt?.model?.model).toBe("claude-3-opus");
      expect(agentExt?.framework).toBe("autogen");
      expect(agentExt?.delegatedBy).toBe("did:key:alice");
      expect(agentExt?.autonomyLevel).toBe("supervised");
      expect(agentExt?.capabilities).toEqual(["code", "research"]);
    });

    it("creates minimal AI agent with defaults", () => {
      const agent = createAIAgent("agent:minimal", {});

      expect(agent.id).toBe("agent:minimal");
      expect(agent.name).toBe("agent:minimal"); // Defaults to ID
      expect(agent.role).toBe("ai");
    });
  });

  describe("addCollaborators", () => {
    it("adds collaborators to existing agent", () => {
      const agent = createAIAgent("agent:a", {
        collaborators: ["agent:b"],
      });

      const updated = addCollaborators(agent, ["agent:c", "agent:d"]);
      const agentExt = getAIAgent(updated);

      expect(agentExt?.collaborators).toContain("agent:b");
      expect(agentExt?.collaborators).toContain("agent:c");
      expect(agentExt?.collaborators).toContain("agent:d");
    });

    it("deduplicates collaborators", () => {
      const agent = createAIAgent("agent:a", {
        collaborators: ["agent:b"],
      });

      const updated = addCollaborators(agent, ["agent:b", "agent:c"]);
      const agentExt = getAIAgent(updated);

      expect(agentExt?.collaborators?.filter((c) => c === "agent:b").length).toBe(1);
    });

    it("works on agent without existing collaborators", () => {
      const agent = createAIAgent("agent:a", {});
      const updated = addCollaborators(agent, ["agent:b"]);
      const agentExt = getAIAgent(updated);

      expect(agentExt?.collaborators).toEqual(["agent:b"]);
    });
  });

  describe("setAgentSession", () => {
    it("sets session ID on agent", () => {
      const agent = createAIAgent("agent:a", {});
      const updated = setAgentSession(agent, "session-456");
      const agentExt = getAIAgent(updated);

      expect(agentExt?.sessionId).toBe("session-456");
    });

    it("preserves other agent properties", () => {
      const agent = createAIAgent("agent:a", {
        model: { provider: "anthropic", model: "claude-3-opus" },
        framework: "langchain",
      });

      const updated = setAgentSession(agent, "session-789");
      const agentExt = getAIAgent(updated);

      expect(agentExt?.model?.model).toBe("claude-3-opus");
      expect(agentExt?.framework).toBe("langchain");
      expect(agentExt?.sessionId).toBe("session-789");
    });
  });
});
