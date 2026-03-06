import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock the database module
vi.mock("./db", () => ({
  getModelConfigsByUserId: vi.fn(),
  getDefaultModelConfig: vi.fn(),
  createModelConfig: vi.fn(),
  updateModelConfig: vi.fn(),
  deleteModelConfig: vi.fn(),
  setDefaultModelConfig: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("modelConfigs router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("modelConfigs.list", () => {
    it("returns list of model configs for authenticated user", async () => {
      const mockConfigs = [
        {
          id: 1,
          userId: 1,
          name: "GPT-4o Config",
          provider: "openai",
          apiKey: "sk-xxx",
          apiBase: "https://api.openai.com/v1",
          modelName: "gpt-4o",
          temperature: "0.7",
          topP: "0.9",
          maxTokens: 4096,
          isDefault: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getModelConfigsByUserId).mockResolvedValue(mockConfigs);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.modelConfigs.list();

      expect(result).toEqual(mockConfigs);
      expect(db.getModelConfigsByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe("modelConfigs.create", () => {
    it("creates a new model config with custom baseUrl", async () => {
      const newConfig = {
        id: 1,
        userId: 1,
        name: "Custom API",
        provider: "custom",
        apiKey: "custom-key",
        apiBase: "https://my-custom-api.com/v1",
        modelName: "custom-model",
        temperature: "0.8",
        topP: "0.95",
        maxTokens: 8192,
        isDefault: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.createModelConfig).mockResolvedValue(newConfig);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.modelConfigs.create({
        name: "Custom API",
        provider: "custom",
        apiKey: "custom-key",
        apiBase: "https://my-custom-api.com/v1",
        modelName: "custom-model",
        temperature: "0.8",
        topP: "0.95",
        maxTokens: 8192,
      });

      expect(result).toEqual(newConfig);
      expect(db.createModelConfig).toHaveBeenCalledWith({
        name: "Custom API",
        provider: "custom",
        apiKey: "custom-key",
        apiBase: "https://my-custom-api.com/v1",
        modelName: "custom-model",
        temperature: "0.8",
        topP: "0.95",
        maxTokens: 8192,
        userId: 1,
      });
    });
  });

  describe("modelConfigs.setDefault", () => {
    it("sets a config as default", async () => {
      // Now uses updateModelConfig instead of setDefaultModelConfig
      vi.mocked(db.updateModelConfig).mockResolvedValue({
        id: 1,
        userId: 1,
        name: "Test Config",
        provider: "openai",
        apiKey: "test-key",
        apiBase: null,
        modelName: "gpt-4",
        temperature: "0.7",
        topP: null,
        maxTokens: null,
        isDefault: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.modelConfigs.setDefault({ id: 1 });

      expect(result?.isDefault).toBe(1);
      expect(db.updateModelConfig).toHaveBeenCalledWith(1, 1, { isDefault: 1 });
    });
  });

  describe("modelConfigs.delete", () => {
    it("deletes a model config", async () => {
      vi.mocked(db.deleteModelConfig).mockResolvedValue(true);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.modelConfigs.delete({ id: 1 });

      expect(result).toBe(true);
      expect(db.deleteModelConfig).toHaveBeenCalledWith(1, 1);
    });
  });
});
