import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as db from "./db";

// Mock the database module
vi.mock("./db", () => ({
  getNovelsByUserId: vi.fn(),
  getNovelById: vi.fn(),
  createNovel: vi.fn(),
  updateNovel: vi.fn(),
  deleteNovel: vi.fn(),
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

describe("novels router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("novels.list", () => {
    it("returns list of novels for authenticated user", async () => {
      const mockNovels = [
        {
          id: 1,
          userId: 1,
          title: "Test Novel",
          genre: "玄幻",
          style: "热血",
          description: "A test novel",
          prompt: null,
          worldSetting: null,
          status: "draft" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.mocked(db.getNovelsByUserId).mockResolvedValue(mockNovels);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.novels.list();

      expect(result).toEqual(mockNovels);
      expect(db.getNovelsByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe("novels.create", () => {
    it("creates a new novel", async () => {
      const newNovel = {
        id: 1,
        userId: 1,
        title: "New Novel",
        genre: "奇幻",
        style: "轻松",
        description: "A new novel",
        prompt: null,
        worldSetting: null,
        status: "draft" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.createNovel).mockResolvedValue(newNovel);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.novels.create({
        title: "New Novel",
        genre: "奇幻",
        style: "轻松",
        description: "A new novel",
      });

      expect(result).toEqual(newNovel);
      expect(db.createNovel).toHaveBeenCalledWith({
        title: "New Novel",
        genre: "奇幻",
        style: "轻松",
        description: "A new novel",
        userId: 1,
      });
    });
  });

  describe("novels.get", () => {
    it("returns a specific novel by id", async () => {
      const mockNovel = {
        id: 1,
        userId: 1,
        title: "Test Novel",
        genre: "玄幻",
        style: "热血",
        description: "A test novel",
        prompt: null,
        worldSetting: null,
        status: "draft" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.getNovelById).mockResolvedValue(mockNovel);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.novels.get({ id: 1 });

      expect(result).toEqual(mockNovel);
      expect(db.getNovelById).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("novels.delete", () => {
    it("deletes a novel", async () => {
      vi.mocked(db.deleteNovel).mockResolvedValue(true);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.novels.delete({ id: 1 });

      expect(result).toBe(true);
      expect(db.deleteNovel).toHaveBeenCalledWith(1, 1);
    });
  });
});
