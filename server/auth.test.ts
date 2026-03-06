import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock db module
vi.mock("./db", () => ({
  getUserByUsername: vi.fn(),
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUserLastSignedIn: vi.fn(),
}));

import * as db from "./db";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createPublicContext(): { ctx: TrpcContext; setCookies: CookieCall[]; clearedCookies: CookieCall[] } {
  const setCookies: CookieCall[] = [];
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, setCookies, clearedCookies };
}

describe("auth.register", () => {
  it("should register a new user successfully", async () => {
    const { ctx, setCookies } = createPublicContext();
    
    // Mock: user doesn't exist
    vi.mocked(db.getUserByUsername).mockResolvedValue(null);
    
    // Mock: create user returns new user
    vi.mocked(db.createUser).mockResolvedValue({
      id: 1,
      username: "testuser",
      passwordHash: "hashed",
      name: "Test User",
      email: "test@example.com",
      openId: null,
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.register({
      username: "testuser",
      password: "password123",
      name: "Test User",
      email: "test@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.user.username).toBe("testuser");
    expect(setCookies.length).toBe(1);
  });

  it("should reject duplicate username", async () => {
    const { ctx } = createPublicContext();
    
    // Mock: user already exists
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 1,
      username: "existinguser",
      passwordHash: "hashed",
      name: "Existing User",
      email: null,
      openId: null,
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.auth.register({
      username: "existinguser",
      password: "password123",
    })).rejects.toThrow("用户名已存在");
  });
});

describe("auth.login", () => {
  it("should login successfully with correct credentials", async () => {
    const { ctx, setCookies } = createPublicContext();
    
    // Create a password hash for "password123"
    const crypto = await import("crypto");
    const salt = "testsalt1234567890";
    const hash = crypto.pbkdf2Sync("password123", salt, 1000, 64, 'sha512').toString('hex');
    const storedHash = `${salt}:${hash}`;
    
    // Mock: user exists with correct password
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      passwordHash: storedHash,
      name: "Test User",
      email: "test@example.com",
      openId: null,
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
    
    vi.mocked(db.updateUserLastSignedIn).mockResolvedValue();

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.login({
      username: "testuser",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.user.username).toBe("testuser");
    expect(setCookies.length).toBe(1);
  });

  it("should reject incorrect password", async () => {
    const { ctx } = createPublicContext();
    
    // Mock: user exists but password is wrong
    vi.mocked(db.getUserByUsername).mockResolvedValue({
      id: 1,
      username: "testuser",
      passwordHash: "wrongsalt:wronghash",
      name: "Test User",
      email: null,
      openId: null,
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });

    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.auth.login({
      username: "testuser",
      password: "wrongpassword",
    })).rejects.toThrow("用户名或密码错误");
  });

  it("should reject non-existent user", async () => {
    const { ctx } = createPublicContext();
    
    // Mock: user doesn't exist
    vi.mocked(db.getUserByUsername).mockResolvedValue(null);

    const caller = appRouter.createCaller(ctx);
    
    await expect(caller.auth.login({
      username: "nonexistent",
      password: "password123",
    })).rejects.toThrow("用户名或密码错误");
  });
});

describe("auth.logout", () => {
  it("should clear session cookie", async () => {
    const { ctx, clearedCookies } = createPublicContext();
    
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result.success).toBe(true);
    expect(clearedCookies.length).toBe(1);
  });
});
