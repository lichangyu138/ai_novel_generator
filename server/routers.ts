import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import * as crypto from "crypto";
import { knowledgeExtractor } from "./services/knowledgeExtractor";
import { vectorDeduplicator } from "./services/vectorDeduplicator";
import { knowledgeRetriever } from "./services/knowledgeRetriever";
import { aiHumanizer } from "./services/aiHumanizer";
import * as jose from "jose";
import { chapterGenerationRouter } from "./routers/chapterGeneration";

// Password hashing utilities
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  console.log('[Password Verify] Starting password verification');
  console.log('[Password Verify] Password length:', password.length);
  console.log('[Password Verify] Stored hash length:', storedHash.length);
  console.log('[Password Verify] Stored hash preview:', storedHash.substring(0, 50) + '...');
  
  try {
    const parts = storedHash.split(':');
    console.log('[Password Verify] Hash parts count:', parts.length);
    
    if (parts.length !== 2) {
      console.error('[Password Verify] Invalid hash format: expected 2 parts, got', parts.length);
      return false;
    }
    
    const [salt, hash] = parts;
    console.log('[Password Verify] Salt length:', salt.length);
    console.log('[Password Verify] Hash length:', hash.length);
    
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    console.log('[Password Verify] Verify hash length:', verifyHash.length);
    console.log('[Password Verify] Hash match:', hash === verifyHash);
    
    const isValid = hash === verifyHash;
    console.log('[Password Verify] Password verification result:', isValid);
    
    return isValid;
  } catch (error) {
    console.error('[Password Verify] Error during verification:', error);
    return false;
  }
}

// JWT utilities
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-change-in-production');
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function createToken(userId: number, username: string): Promise<string> {
  return await new jose.SignJWT({ userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(JWT_SECRET);
}

export const appRouter = router({
  system: systemRouter,
  
  // Independent auth routes (no Manus OAuth)
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    register: publicProcedure
      .input(z.object({
        username: z.string().min(3).max(64),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Check if username already exists
        const existingUser = await db.getUserByUsername(input.username);
        if (existingUser) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '用户名已存在',
          });
        }

        // Hash password and create user
        const passwordHash = hashPassword(input.password);
        const user = await db.createUser({
          username: input.username,
          passwordHash,
          name: input.name || input.username,
          email: input.email || null,
          loginMethod: 'local',
          role: 'user',
        });

        if (!user) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '创建用户失败',
          });
        }

        // Create session token
        const token = await createToken(user.id, user.username);
        
        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
      }),

    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        console.log("=".repeat(70));
        console.log("[Login] ========== Login Request Started ==========");
        console.log("[Login] Username:", input.username);
        console.log("[Login] Password length:", input.password.length);
        console.log("[Login] Timestamp:", new Date().toISOString());
        console.log("=".repeat(70));
        
        // Find user
        console.log("[Login] Step 1: Querying user from database...");
        const user = await db.getUserByUsername(input.username);
        
        // Debug logging
        console.log("[Login] Step 2: User query result:");
        console.log("[Login]   - User found:", !!user);
        if (user) {
          console.log("[Login]   - User ID:", user.id);
          console.log("[Login]   - Username:", user.username);
          console.log("[Login]   - Email:", user.email);
          console.log("[Login]   - Role:", user.role);
          console.log("[Login]   - PasswordHash exists:", !!user.passwordHash);
          console.log("[Login]   - PasswordHash type:", typeof user.passwordHash);
          console.log("[Login]   - PasswordHash length:", user.passwordHash ? user.passwordHash.length : 0);
          console.log("[Login]   - PasswordHash preview:", user.passwordHash ? `${user.passwordHash.substring(0, 50)}...` : "null");
          console.log("[Login]   - User object keys:", Object.keys(user));
          console.log("[Login]   - Full user object:", JSON.stringify(user, null, 2));
        } else {
          console.log("[Login]   - User not found in database");
        }
        
        if (!user || !user.passwordHash) {
          console.log("[Login] Step 3: Validation failed - User not found or passwordHash is null");
          console.log("[Login] ========== Login Failed: User Not Found ==========");
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '用户名或密码错误',
          });
        }

        // Verify password
        console.log("[Login] Step 3: Verifying password...");
        const passwordValid = verifyPassword(input.password, user.passwordHash);
        console.log("[Login] Step 4: Password verification result:", passwordValid);
        
        if (!passwordValid) {
          console.log("[Login] ========== Login Failed: Invalid Password ==========");
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '用户名或密码错误',
          });
        }

        // Update last signed in
        console.log("[Login] Step 5: Updating last signed in timestamp...");
        await db.updateUserLastSignedIn(user.id);

        // Create session token
        console.log("[Login] Step 6: Creating session token...");
        const token = await createToken(user.id, user.username);
        console.log("[Login]   - Token created (length):", token.length);
        
        // Set cookie
        console.log("[Login] Step 7: Setting session cookie...");
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        console.log("[Login]   - Cookie set successfully");

        const response = {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        };
        
        console.log("[Login] Step 8: Login successful!");
        console.log("[Login] Response:", JSON.stringify(response, null, 2));
        console.log("[Login] ========== Login Success ==========");
        console.log("=".repeat(70));
        
        return response;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        email: z.string().email().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db2 = await import("./db");
        const drizzleDb = await db2.getDb();
        if (!drizzleDb) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '数据库连接失败',
          });
        }
        
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        await drizzleDb.update(users).set({
          name: input.name,
          email: input.email,
        }).where(eq(users.id, ctx.user.id));

        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(6),
      }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserById(ctx.user.id);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '用户不存在',
          });
        }

        // Verify current password
        if (!verifyPassword(input.currentPassword, user.passwordHash)) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '当前密码错误',
          });
        }

        // Update password
        const newPasswordHash = hashPassword(input.newPassword);
        const db2 = await import("./db");
        const drizzleDb = await db2.getDb();
        if (!drizzleDb) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: '数据库连接失败',
          });
        }
        
        const { users } = await import("../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        
        await drizzleDb.update(users).set({
          passwordHash: newPasswordHash,
        }).where(eq(users.id, ctx.user.id));

        return { success: true };
      }),
  }),

  // Novel routes
  novels: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getNovelsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getNovelById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1),
        genre: z.string().optional(),
        customGenre: z.string().optional(),
        style: z.string().optional(),
        customStyle: z.string().optional(),
        writerStyle: z.string().optional(),
        writerStylePrompt: z.string().optional(),
        removeAiTone: z.number().optional(),
        description: z.string().optional(),
        prompt: z.string().optional(),
        worldSetting: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 过滤掉数据库中不存在的字段
        const { customGenre, customStyle, writerStylePrompt, ...validInput } = input;
        return await db.createNovel({
          ...validInput,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        genre: z.string().optional(),
        customGenre: z.string().optional(),
        style: z.string().optional(),
        customStyle: z.string().optional(),
        writerStyle: z.string().optional(),
        writerStylePrompt: z.string().optional(),
        removeAiTone: z.number().optional(),
        description: z.string().optional(),
        prompt: z.string().optional(),
        worldSetting: z.string().optional(),
        status: z.enum(["draft", "writing", "completed"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, customGenre, customStyle, writerStylePrompt, ...data } = input;
        // 过滤掉数据库中不存在的字段
        return await db.updateNovel(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteNovel(input.id, ctx.user.id);
      }),
  }),

  // Character routes
  characters: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getCharactersByNovelId(input.novelId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getCharacterById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        name: z.string().min(1),
        gender: z.enum(["male", "female", "other"]).optional(),
        role: z.string().optional(),
        personality: z.string().optional(),
        background: z.string().optional(),
        appearance: z.string().optional(),
        abilities: z.string().optional(),
        relationships: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createCharacter({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        gender: z.enum(["male", "female", "other"]).optional(),
        role: z.string().optional(),
        personality: z.string().optional(),
        background: z.string().optional(),
        appearance: z.string().optional(),
        abilities: z.string().optional(),
        relationships: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return await db.updateCharacter(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Also delete related relationships
        await db.deleteCharacterRelationshipsByCharacterId(input.id, ctx.user.id);
        return await db.deleteCharacter(input.id, ctx.user.id);
      }),

    // Character relationships
    listRelationships: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getCharacterRelationshipsByNovelId(input.novelId, ctx.user.id);
      }),

    getRelationshipsByCharacter: protectedProcedure
      .input(z.object({ characterId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getCharacterRelationshipsByCharacterId(input.characterId, ctx.user.id);
      }),

    createRelationship: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        sourceCharacterId: z.number(),
        targetCharacterId: z.number(),
        relationshipType: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createCharacterRelationship({
          ...input,
          userId: ctx.user.id,
        });
      }),

    updateRelationship: protectedProcedure
      .input(z.object({
        id: z.number(),
        relationshipType: z.string().optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return await db.updateCharacterRelationship(id, ctx.user.id, data);
      }),

    deleteRelationship: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteCharacterRelationship(input.id, ctx.user.id);
      }),
  }),

  // Outline routes
  outlines: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getOutlinesByNovelId(input.novelId, ctx.user.id);
      }),

    getActive: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getActiveOutline(input.novelId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        content: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Get current max version
        const existingOutlines = await db.getOutlinesByNovelId(input.novelId, ctx.user.id);
        const maxVersion = existingOutlines.length > 0 ? Math.max(...existingOutlines.map(o => o.version)) : 0;
        
        // Deactivate all existing outlines
        for (const outline of existingOutlines) {
          await db.updateOutline(outline.id, ctx.user.id, { isActive: 0 });
        }

        return await db.createOutline({
          novelId: input.novelId,
          userId: ctx.user.id,
          content: input.content,
          version: maxVersion + 1,
          isActive: 1,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
        isActive: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return await db.updateOutline(id, ctx.user.id, data);
      }),

    clear: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Delete all detailed outlines first
        await db.deleteDetailedOutlinesByNovelId(input.novelId, ctx.user.id);
        // Delete all outlines
        await db.deleteOutlinesByNovelId(input.novelId, ctx.user.id);
        return { success: true };
      }),
  }),

  // Detailed outline routes
  detailedOutlines: router({
    list: protectedProcedure
      .input(z.object({ outlineId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getDetailedOutlinesByOutlineId(input.outlineId, ctx.user.id);
      }),

    listByNovel: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getDetailedOutlinesByNovelId(input.novelId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        outlineId: z.number(),
        groupIndex: z.number(),
        startChapter: z.number(),
        endChapter: z.number(),
        content: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createDetailedOutline({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return await db.updateDetailedOutline(id, ctx.user.id, data);
      }),
  }),

  // Chapter routes
  chapters: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChaptersByNovelId(input.novelId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChapterById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const wordCount = input.content ? input.content.length : 0;
        const chapter = await db.createChapter({
          ...input,
          userId: ctx.user.id,
          wordCount,
        });

        // Auto-extract knowledge from chapter content
        if (chapter && input.content && input.content.length > 100) {
          try {
            const extraction = await knowledgeExtractor.extractFromChapter(
              input.content,
              input.chapterNumber
            );
            await knowledgeExtractor.saveToKnowledgeBase(
              input.novelId,
              ctx.user.id,
              chapter.id,
              extraction
            );
          } catch (error) {
            console.error('[Chapters.create] Knowledge extraction failed:', error);
            // Don't fail the chapter creation if extraction fails
          }
        }

        return chapter;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["draft", "pending_review", "approved", "rejected"]).optional(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        if (data.content) {
          (data as any).wordCount = data.content.length;
        }
        const chapter = await db.updateChapter(id, ctx.user.id, data);

        // Re-extract knowledge if content was updated
        if (chapter && data.content && data.content.length > 100) {
          try {
            const extraction = await knowledgeExtractor.extractFromChapter(
              data.content,
              chapter.chapterNumber
            );
            // Delete old auto-extracted entries for this chapter
            const oldEntries = await db.getKnowledgeEntriesByNovelId(chapter.novelId, ctx.user.id);
            for (const entry of oldEntries) {
              if (entry.sourceChapterId === chapter.id && entry.isAutoExtracted === 1) {
                await db.deleteKnowledgeEntry(entry.id, ctx.user.id);
              }
            }
            // Save new extraction
            await knowledgeExtractor.saveToKnowledgeBase(
              chapter.novelId,
              ctx.user.id,
              chapter.id,
              extraction
            );
          } catch (error) {
            console.error('[Chapters.update] Knowledge extraction failed:', error);
          }
        }

        return chapter;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteChapter(input.id, ctx.user.id);
      }),

    humanize: protectedProcedure
      .input(z.object({
        id: z.number(),
        chunkSize: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const chapter = await db.getChapterById(input.id, ctx.user.id);
        if (!chapter || !chapter.content) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '章节不存在或无内容' });
        }

        const humanizedContent = await aiHumanizer.humanizeInChunks(
          chapter.content,
          input.chunkSize || 2000
        );

        const updated = await db.updateChapter(input.id, ctx.user.id, {
          content: humanizedContent,
          wordCount: humanizedContent.length,
        });

        return updated;
      }),
  }),

  // Generation history routes
  generationHistory: router({
    listByNovel: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getGenerationHistoryByNovelId(input.novelId, ctx.user.id);
      }),

    listByUser: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const history = await db.getGenerationHistoryByUserId(ctx.user.id);
        return history.slice(0, input.limit || 50);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        type: z.enum(["outline", "detailed_outline", "chapter", "revision"]),
        targetId: z.number().optional(),
        prompt: z.string().optional(),
        result: z.string().optional(),
        modelUsed: z.string().optional(),
        tokensUsed: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createGenerationHistory({
          ...input,
          userId: ctx.user.id,
        });
      }),
  }),

  // Model config routes
  modelConfigs: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getModelConfigsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getModelConfigById(input.id, ctx.user.id);
      }),

    getDefault: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDefaultModelConfig(ctx.user.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        displayName: z.string().optional(),
        provider: z.string(),
        apiKey: z.string().optional(),
        apiBase: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.string().optional(),
        topP: z.string().optional(),
        maxTokens: z.number().optional(),
        isDefault: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createModelConfig({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        displayName: z.string().optional(),
        provider: z.string().optional(),
        apiKey: z.string().optional(),
        apiBase: z.string().optional(),
        modelName: z.string().optional(),
        temperature: z.string().optional(),
        topP: z.string().optional(),
        maxTokens: z.number().optional(),
        isDefault: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        return await db.updateModelConfig(id, ctx.user.id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteModelConfig(input.id, ctx.user.id);
      }),

    setDefault: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.updateModelConfig(input.id, ctx.user.id, { isDefault: 1 });
      }),
  }),

  // AI Generation routes
  ai: router({
    // Generate character description
    generateCharacterDescription: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        characterId: z.number().optional(), // 角色ID（可选，用于排除自己）
        name: z.string(), // 角色名称
        gender: z.enum(["male", "female", "other"]).optional(), // 性别
        role: z.string().optional(), // 角色定位
        existingInfo: z.string().optional(), // 已有人物信息（性格/背景等）
        extraRequirements: z.string().optional(), // 额外要求（自由输入）
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Get novel info for context
        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        if (!novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        // Get active outline for character requirements
        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);

        // Get other characters for reference
        const characters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);
        const otherChars = characters.filter(c => c.id !== input.characterId);

        // Get organizations/worldbuilding context (from knowledge base)
        const knowledgeEntries = await db.getKnowledgeEntriesByNovelId(input.novelId, ctx.user.id);
        const organizations = knowledgeEntries
          .filter((k) => k.type === 'organization')
          .slice(0, 15)
          .map((o) => `- ${o.name}：${(o.description || '').slice(0, 300)}`)
          .join('\n');

        const genderText = input.gender === 'male' ? '男性' : input.gender === 'female' ? '女性' : '其他';
        
        const prompt = `你是一位专业的小说人物设定专家。请为以下角色生成**系统化的人物设定**，并严格遵守大纲中的人物要求和用户的附加要求，重点补全：三观、成长线、人物弧光、感情/后宫属性。
【务必遵守】从大纲与世界观设定（尤其是组织/势力）中提取与该角色相关的设定/阵营/关系/初次出场章节/人物走向；如大纲未提及某项，保持“未设定”或留白，禁止臆造。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
- 世界观：${novel.worldSetting || '未设定'}

${outline ? `当前小说大纲（节选，包含可能的人物要求、阵营划分和剧情定位；若包含当前角色，请严格复用相关设定）：
${outline.content?.slice(0, 1500)}...
` : ''}

${organizations ? `世界观-组织/势力（来自知识库，供阵营/立场/资源/冲突设定参考；若与该角色无关可忽略）：
${organizations}
` : ''}

角色基本信息：
- 姓名：${input.name}
- 性别：${genderText}
- 角色定位：${input.role || '未设定'}
${input.existingInfo ? `- 已有信息：${input.existingInfo}` : ''}

${input.extraRequirements ? `附加要求（务必满足，可以包含三观、成长线、人物弧光、感情线/后宫倾向等）：${input.extraRequirements}` : ''}

${otherChars.length > 0 ? `其他角色参考：
${otherChars.map(c => `- ${c.name}：${c.role || '未设定'}`).join('\n')}` : ''}

请生成以下内容（使用JSON格式返回）：
1. personality: 性格特点（100-200字）
2. background: 背景故事（150-300字）
3. appearance: 外貌描述（100-200字）
4. abilities: 能力特长（50-150字）
5. worldview: 三观与价值观（100-150字，说明其价值观、道德观、人生观）
6. growthArc: 成长线（150-250字，说明从故事开头到结尾，大致会经历怎样的成长与变化）
7. characterArc: 人物弧光（150-250字，更侧重心理变化、内在弧光和关键转折节点）
8. romanceAndHarem: 感情与后宫属性（100-200字，说明是否有后宫倾向、在感情线中的核心定位、可能的多角关系）
9. notes: 其他补充说明（50-100字，可补充与阵营、立场、世界观冲突等有关的信息）`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说人物设定专家，擅长创建立体丰满的角色。请始终返回JSON格式。' },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'character_description',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  personality: { type: 'string', description: '性格特点' },
                  background: { type: 'string', description: '背景故事' },
                  appearance: { type: 'string', description: '外貌描述' },
                  abilities: { type: 'string', description: '能力特长' },
                  worldview: { type: 'string', description: '三观与价值观' },
                  growthArc: { type: 'string', description: '成长线' },
                  characterArc: { type: 'string', description: '人物弧光' },
                  romanceAndHarem: { type: 'string', description: '感情与后宫属性' },
                  notes: { type: 'string', description: '其他补充' },
                },
                required: [
                  'personality',
                  'background',
                  'appearance',
                  'abilities',
                  'worldview',
                  'growthArc',
                  'characterArc',
                  'romanceAndHarem',
                  'notes',
                ],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          return JSON.parse(content);
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
      }),

    // Generate world setting from outline
    generateWorldSetting: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        additionalPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");

        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        if (!novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        if (!outline || !outline.content) {
          throw new TRPCError({ code: 'FAILED_PRECONDITION', message: '请先创建并激活大纲，再生成世界观' });
        }

        const prompt = `你是一位世界观设定专家。请基于下方小说大纲，提炼一份可直接用于创作的世界观设定。
务必只根据大纲内容，不要臆造大纲中不存在的设定；若缺少信息可标记“未设定”。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}

大纲（节选，最多2000字）：
${outline.content.slice(0, 2000)}

${input.additionalPrompt ? `用户额外要求：${input.additionalPrompt}` : ''}

请输出分段清晰的世界观说明，建议包含：时代背景/科技或魔法体系、地理与势力、种族/阶层、政治经济、宗教/信仰/禁忌、冲突与规则、关键地点、重要组织或阵营、关键资源、社会风貌与文化、创作约束或基调。`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一名资深的世界观构建者，请输出清晰、可用于后续创作的世界观设定文本。' },
            { role: 'user', content: prompt },
          ],
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
        }

        await db.updateNovel(input.novelId, ctx.user.id, { worldSetting: content });

        return { content };
      }),

    // 从大纲初始化人物及关系
    initializeCharactersFromOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");

        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        if (!novel) {
          throw new TRPCError({ code: "NOT_FOUND", message: "小说不存在" });
        }

        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        if (!outline || !outline.content) {
          throw new TRPCError({ code: "FAILED_PRECONDITION", message: "请先创建并激活大纲" });
        }

        const existingCharacters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);

        const prompt = `你是一名专业的小说人物设定与关系抽取助手。

请从下面这本小说的大纲中，**只做信息抽取**，不要自行创作，提取已经出现或可以明确推断的主要人物及其关系。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || "未设定"}
- 风格：${novel.style || "未设定"}

大纲内容（节选，最多4000字）：
${outline.content.slice(0, 4000)}

【重要要求】
- 只根据大纲文字中的“明确信息”提取人物和关系，避免脑补；
- 不要重复创建明显相同的角色，如有别名或称号，请合并为同一人物；
- 关系可以包括亲属、师徒、上下级、同门、恋爱/暧昧、敌对、盟友等。

请返回 JSON，格式为：
{
  "characters": [
    {
      "name": "角色名",
      "gender": "male|female|other",
      "role": "角色定位（如主角/反派/导师等）",
      "personality": "性格特点（可简要概括）",
      "background": "背景/来历（可简要概括）",
      "appearance": "外貌特征（可选）",
      "abilities": "能力/长处（可选）",
      "notes": "其他与大纲强相关的设定，如阵营、初次出现章节等"
    }
  ],
  "relationships": [
    {
      "sourceName": "角色A名字",
      "targetName": "角色B名字",
      "relationshipType": "关系类型（如师徒/恋人/宿敌等）",
      "description": "简要说明这段关系"
    }
  ]
}

如果信息不足，请使用空数组，禁止输出 JSON 以外的说明文字。`;

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content:
                "你是一个信息抽取助手，只从给定的大纲中提取人物与人物关系，并返回严格的 JSON。",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        });

        const raw = result.choices[0]?.message?.content;
        if (typeof raw !== "string") {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回为空" });
        }

        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch (e) {
          console.error("[AI.initializeCharactersFromOutline] 解析失败:", e, raw.slice(0, 200));
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI 返回格式解析失败" });
        }

        let charactersCreated = 0;
        let charactersUpdated = 0;
        let relationshipsCreated = 0;

        const nameToId = new Map<string, number>();

        if (Array.isArray(parsed.characters)) {
          for (const ch of parsed.characters) {
            if (!ch?.name) continue;
            const name = String(ch.name);
            const existing = existingCharacters.find((c) => c.name === name);

            const payload = {
              novelId: input.novelId,
              userId: ctx.user.id,
              name,
              gender:
                ch.gender === "female" || ch.gender === "other" ? ch.gender : ("male" as const),
              role: ch.role || undefined,
              personality: ch.personality || undefined,
              background: ch.background || undefined,
              appearance: ch.appearance || undefined,
              abilities: ch.abilities || undefined,
              relationships: undefined as string | undefined,
              notes: ch.notes || undefined,
            };

            if (existing) {
              const updated = await db.updateCharacter(existing.id, ctx.user.id, payload);
              if (updated) {
                nameToId.set(name, updated.id);
                charactersUpdated += 1;
              }
            } else {
              const created = await db.createCharacter(payload);
              if (created) {
                nameToId.set(name, created.id);
                charactersCreated += 1;
              }
            }
          }
        }

        // 合并已有角色的名字映射
        for (const c of existingCharacters) {
          if (!nameToId.has(c.name)) {
            nameToId.set(c.name, c.id);
          }
        }

        if (Array.isArray(parsed.relationships)) {
          for (const rel of parsed.relationships) {
            if (!rel?.sourceName || !rel?.targetName) continue;
            const sourceId = nameToId.get(String(rel.sourceName));
            const targetId = nameToId.get(String(rel.targetName));
            if (!sourceId || !targetId) continue;

            const created = await db.createCharacterRelationship({
              novelId: input.novelId,
              userId: ctx.user.id,
              sourceCharacterId: sourceId,
              targetCharacterId: targetId,
              relationshipType: String(rel.relationshipType || "关系"),
              description: rel.description || undefined,
            });
            if (created) {
              relationshipsCreated += 1;
            }
          }
        }

        return { charactersCreated, charactersUpdated, relationshipsCreated };
      }),

    // Generate outline
    generateOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        additionalPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        if (!novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const characters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);

        const prompt = `你是一位专业的小说大纲编写专家。请根据以下信息生成一份详细的小说大纲。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
- 简介：${novel.description || '未设定'}
- 世界观：${novel.worldSetting || '未设定'}
- 创作提示词：${novel.prompt || '未设定'}

${characters.length > 0 ? `主要角色：
${characters.map(c => `- ${c.name}（${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}）：${c.role || '未设定'}
  性格：${c.personality || '未设定'}
  背景：${c.background || '未设定'}`).join('\n\n')}` : ''}

${input.additionalPrompt ? `额外要求：${input.additionalPrompt}` : ''}

请生成一份完整的小说大纲，包括：
1. 故事概述（200-300字）
2. 主线情节发展（分为开端、发展、高潮、结局四个部分）
3. 各部分的详细情节要点
4. 重要伏笔和转折点
5. 预计章节划分建议`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说大纲编写专家，擅长构建引人入胜的故事架构。' },
            { role: 'user', content: prompt },
          ],
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          // Save to database
          const outline = await db.createOutline({
            novelId: input.novelId,
            userId: ctx.user.id,
            content,
            version: 1,
            isActive: 1,
          });

          // Record generation history
          await db.createGenerationHistory({
            novelId: input.novelId,
            userId: ctx.user.id,
            type: 'outline',
            targetId: outline?.id,
            prompt,
            result: content,
            modelUsed: 'gemini-3-pro-preview',
            tokensUsed: result.usage?.total_tokens,
          });

          return { content, outline };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
      }),

    // Modify outline with AI
    modifyOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        outlineId: z.number(),
        currentContent: z.string(),
        modifyRequest: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        const prompt = `请根据以下要求修改小说大纲：

当前大纲：
${input.currentContent}

修改要求：
${input.modifyRequest}

请输出修改后的完整大纲内容。`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说编辑，擅长根据要求修改和完善大纲。' },
            { role: 'user', content: prompt },
          ],
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          await db.updateOutline(input.outlineId, ctx.user.id, { content });
          return { content };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI修改失败' });
      }),

    // Generate detailed outline
    generateDetailedOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        outlineId: z.number(),
        groupIndex: z.number(),
        startChapter: z.number(),
        endChapter: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        const characters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);

        if (!novel || !outline) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说或大纲不存在' });
        }

        const prompt = `请根据以下信息生成第${input.startChapter}-${input.endChapter}章的细纲。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}

总大纲：
${outline.content}

${characters.length > 0 ? `主要角色：
${characters.map(c => `- ${c.name}：${c.personality || ''}`).join('\n')}` : ''}

请为每一章生成详细的内容要点，包括：
1. 章节标题
2. 主要情节
3. 出场人物
4. 场景描述
5. 情节转折点
6. 与前后章节的衔接`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说细纲编写专家。' },
            { role: 'user', content: prompt },
          ],
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          const detailedOutline = await db.createDetailedOutline({
            novelId: input.novelId,
            userId: ctx.user.id,
            outlineId: input.outlineId,
            groupIndex: input.groupIndex,
            startChapter: input.startChapter,
            endChapter: input.endChapter,
            content,
          });

          await db.createGenerationHistory({
            novelId: input.novelId,
            userId: ctx.user.id,
            type: 'detailed_outline',
            targetId: detailedOutline?.id,
            prompt,
            result: content,
            modelUsed: 'gemini-3-pro-preview',
            tokensUsed: result.usage?.total_tokens,
          });

          return { content, detailedOutline };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
      }),

    // Generate chapter content
    generateChapter: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        title: z.string().optional(),
        detailedOutlineContent: z.string().optional(),
        targetWordCount: z.number().default(3000),
        humanize: z.boolean().optional().default(true), // 默认进行“去AI味”改写
        humanizeLevel: z.number().int().min(1).max(3).optional().default(3), // 1温和 2中等 3强力（默认）
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        const characters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);
        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        
        // Get previous chapters for context
        const allChapters = await db.getChaptersByNovelId(input.novelId, ctx.user.id);
        const prevChapters = allChapters.filter(c => c.chapterNumber < input.chapterNumber).slice(-2);

        if (!novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const prompt = `请根据以下信息生成第${input.chapterNumber}章的内容。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
- 创作提示词：${novel.prompt || '未设定'}

${outline ? `总大纲：
${outline.content}` : ''}

${input.detailedOutlineContent ? `本章细纲：
${input.detailedOutlineContent}` : ''}

${characters.length > 0 ? `主要角色：
${characters.map(c => `- ${c.name}（${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}）：${c.personality || ''}`).join('\n')}` : ''}

${prevChapters.length > 0 ? `前文摘要：
${prevChapters.map(c => `第${c.chapterNumber}章 ${c.title || ''}：${(c.content || '').slice(0, 500)}...`).join('\n\n')}` : ''}

要求：
1. 字数约${input.targetWordCount}字
2. 保持与前文的连贯性
3. 符合小说风格和类型
4. 包含对话、动作、心理描写
5. 章节结尾要有吸引力
6. 输出必须是**纯文本（TXT）**：不要使用Markdown，不要出现加粗（如 **文本**）、标题、分隔线、列表符号（-/*/1.）、代码块等排版

${input.title ? `章节标题：${input.title}` : '请同时生成一个合适的章节标题'}`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说作家，擅长创作引人入胜的故事。' },
            { role: 'user', content: prompt },
          ],
        });

        const draft = result.choices[0]?.message?.content;
        if (typeof draft === 'string') {
          // 去AI味：强力两段式人类化（不改变剧情与事实）
          let finalContent = draft;
          if (input.humanize) {
            const level = input.humanizeLevel ?? 3;
            const strengthText =
              level === 1
                ? '温和：轻微口语化与节奏调整，尽量保持原句式'
                : level === 2
                ? '中等：明显减少解释腔与套话，增加动作与细节，句式更灵活'
                : '强力：显著打散规整结构、增强人写质感（口语/停顿/留白/误判），但绝不改剧情事实';

            const disruptPrompt = `你是一名资深小说编辑，现在对一段小说正文做“强力去AI味”的结构打散与人类化改写。

【改写强度】${strengthText}

【硬约束（必须遵守）】
- 绝不改变人物姓名、设定、事件因果、时间顺序、关键情节；不新增关键剧情，不删掉关键剧情。
- 不允许出现任何元叙事或机器口吻（例如：作为AI/我将/以下是/总结/总之/希望你喜欢）。
- 不要说明文/大纲腔；不要“首先/其次/最后”等结构提示语。
- 输出必须是纯文本（TXT），禁止Markdown/加粗/标题/分隔线/列表/代码块。

【强力反AI策略（出现就必须改掉）】
- 砍掉空泛评价/大道理总结/段末总结陈词。
- 避免高频套话与口癖：不禁/不由得/仿佛/似乎/刹那间/这一刻/与此同时/可就在这时/空气仿佛凝固/时间仿佛停止/一切才刚刚开始……
- 避免“解释人物心理”的上帝视角：用动作、对话、停顿、细节来呈现（show, don't tell）。
- 节奏要不规整：强制出现长短段落混合；允许 1-2 处“半句停顿/断句/留白式短段”（例如“他张了张嘴。”、“门外一声轻响。”），但不要滥用。
- 对话更像人：允许打断、含糊、反问、话没说完；减少论述式长句。
- 具象细节落地：用声音/触感/光影/衣料/器物/气味承载氛围，但不要堆砌形容词。

【小说信息（保持风格一致）】
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
${novel.writerStyle ? `- 作家风格：${novel.writerStyle}` : ''}
${novel.writerStylePrompt ? `- 风格描述：${novel.writerStylePrompt}` : ''}

【需要改写的正文】
${draft}

请直接输出“打散结构+人类化”的版本（纯文本）：`;

            const disruptResult = await invokeLLM({
              messages: [
                {
                  role: 'system',
                  content:
                    '你是小说编辑，擅长强力去AI味：打散规整结构、去套话、减解释腔、增强口语与细节。只输出纯文本正文。',
                },
                { role: 'user', content: disruptPrompt },
              ],
            });
            const disrupted = disruptResult.choices[0]?.message?.content;

            const baseForPolish =
              typeof disrupted === 'string' && disrupted.trim().length > 200 ? disrupted : draft;

            const humanizePrompt = `你是一名资深小说编辑，现在要对一段小说正文进行最终润色，使其更像“人写的”。

【绝对约束（必须遵守）】
- 不允许添加“作为AI/我将/以下是/总结/总之/希望你喜欢”等任何元叙事或机器口吻；
- 不要模板化段落（如“首先/其次/最后”这种说明式结构），不要像大纲或说明文；
- 不要堆砌形容词、空泛抽象词、重复句式；避免机械排比；
- 允许适度口语化与细节化，但不要改变人物姓名、设定、事件因果、时间顺序与关键情节；
- 保持章节连贯性，符合原文风格与类型；
- 输出必须是“可直接发布的小说正文”，不要输出任何解释、注释或标题标签。
- 输出必须是**纯文本（TXT）**：不要使用Markdown，不要出现加粗（如 **文本**）、标题、分隔线、列表符号（-/*/1.）、代码块等排版。

【反AI表达（强制规避）】
- 删除或改写任何“泛化叙述/空泛评价/大道理总结”句子；不要在段末做总结陈词。
- 避免高频 AI 口癖与套话（出现就必须改掉），包括但不限于：
  “不禁…/不由得…/仿佛…/似乎…/刹那间…/这一刻…/然而…/与此同时…/可就在这时…/空气仿佛凝固…/时间仿佛停止…/他/她知道…一切才刚刚开始…”
- 避免“过度解释人物心理”的旁白腔，改成用动作、对话、细节来呈现（show, don’t tell）。
- 句式节奏要有变化：短句推进、长句收束；避免每段都同一种结构。
- 细节要落地：用可感知的声音/触感/光影/气味/环境物件来承载氛围，但不要硬凑堆砌。
- 对话要像人说话：少用书面论述句，多用含蓄、打断、停顿、潜台词。

【小说信息（用于保持风格一致）】
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
${novel.writerStyle ? `- 作家风格：${novel.writerStyle}` : ''}
${novel.writerStylePrompt ? `- 风格描述：${novel.writerStylePrompt}` : ''}

【需要润色的正文】
${baseForPolish}

请输出润色后的最终正文：`;

            const humanizeResult = await invokeLLM({
              messages: [
                {
                  role: 'system',
                  content:
                    '你是小说润色编辑，目标是显著降低AI痕迹：去套话、去解释腔、加具象细节与节奏变化。只输出润色后的正文（纯文本TXT），禁止任何Markdown/加粗/列表/标题格式。',
                },
                { role: 'user', content: humanizePrompt },
              ],
            });
            const rewritten = humanizeResult.choices[0]?.message?.content;
            if (typeof rewritten === 'string' && rewritten.trim().length > 200) {
              finalContent = rewritten;
            }
          }

          const chapter = await db.createChapter({
            novelId: input.novelId,
            userId: ctx.user.id,
            chapterNumber: input.chapterNumber,
            title: input.title || `第${input.chapterNumber}章`,
            content: finalContent,
            wordCount: finalContent.length,
          });

          await db.createGenerationHistory({
            novelId: input.novelId,
            userId: ctx.user.id,
            type: 'chapter',
            targetId: chapter?.id,
            prompt,
            result: finalContent,
            modelUsed: 'gemini-3-pro-preview',
            tokensUsed: result.usage?.total_tokens,
          });

          // Auto-extract knowledge from generated chapter
          // 注意：抽取结果不再写入“世界观/时间线”，而是写入“知识图谱 + 向量文档”，用于后续检索/向量库同步
          try {
            const extractPrompt = `请从以下小说章节中提取关键信息，返回JSON格式：

章节内容：
${finalContent.slice(0, 3000)}

请提取：
1. 新出现的人物及其特征
2. 重要事件
3. 新出现的地点
4. 重要物品

返回格式：
{
  "characters": [{"name": "", "description": ""}],
  "events": [{"name": "", "description": "", "type": "plot|character|world|conflict|resolution"}],
  "locations": [{"name": "", "description": ""}],
  "items": [{"name": "", "description": ""}]
}

如果某个类别没有内容，返回空数组。`;

            const extractResult = await invokeLLM({
              messages: [
                { role: 'system', content: '你是一个信息提取助手，专门从小说中提取关键信息。只返回JSON，不要其他内容。' },
                { role: 'user', content: extractPrompt },
              ],
              response_format: { type: 'json_object' },
            });

            const extractedContent = extractResult.choices[0]?.message?.content;
            if (typeof extractedContent === 'string') {
              try {
                const extracted = JSON.parse(extractedContent);
                
                const sourceChapterId = chapter?.id;
                const commonMeta = {
                  novelId: input.novelId,
                  userId: ctx.user.id,
                  sourceChapterId,
                };

                // Save extracted characters -> Knowledge Graph Nodes
                if (extracted.characters?.length) {
                  for (const char of extracted.characters) {
                    const node = await db.createKnowledgeGraphNode({
                      ...commonMeta,
                      nodeType: 'character',
                      name: char.name,
                      content: char.description,
                    });
                    if (node) {
                      await db.createVectorDocument({
                        novelId: input.novelId,
                        userId: ctx.user.id,
                        sourceType: 'kg_node',
                        sourceId: node.id,
                        text: `${node.name}\n${node.content || ''}`.trim(),
                        metadata: JSON.stringify({ nodeType: node.nodeType, sourceChapterId }),
                      });
                    }
                  }
                }

                // Save extracted events -> Knowledge Graph Nodes (NOT storyEvents)
                if (extracted.events?.length) {
                  for (const event of extracted.events) {
                    const node = await db.createKnowledgeGraphNode({
                      ...commonMeta,
                      nodeType: 'event',
                      name: event.name,
                      content: JSON.stringify({
                        description: event.description,
                        type: event.type,
                        timePoint: `第${input.chapterNumber}章`,
                      }),
                    });
                    if (node) {
                      await db.createVectorDocument({
                        novelId: input.novelId,
                        userId: ctx.user.id,
                        sourceType: 'kg_node',
                        sourceId: node.id,
                        text: `${event.name}\n${event.description || ''}`.trim(),
                        metadata: JSON.stringify({
                          nodeType: 'event',
                          eventType: event.type,
                          timePoint: `第${input.chapterNumber}章`,
                          sourceChapterId,
                        }),
                      });
                    }
                  }
                }

                // Save extracted locations -> Knowledge Graph Nodes
                if (extracted.locations?.length) {
                  for (const loc of extracted.locations) {
                    const node = await db.createKnowledgeGraphNode({
                      ...commonMeta,
                      nodeType: 'location',
                      name: loc.name,
                      content: loc.description,
                    });
                    if (node) {
                      await db.createVectorDocument({
                        novelId: input.novelId,
                        userId: ctx.user.id,
                        sourceType: 'kg_node',
                        sourceId: node.id,
                        text: `${node.name}\n${node.content || ''}`.trim(),
                        metadata: JSON.stringify({ nodeType: 'location', sourceChapterId }),
                      });
                    }
                  }
                }

                // Save extracted items -> Knowledge Graph Nodes
                if (extracted.items?.length) {
                  for (const item of extracted.items) {
                    const node = await db.createKnowledgeGraphNode({
                      ...commonMeta,
                      nodeType: 'item',
                      name: item.name,
                      content: item.description,
                    });
                    if (node) {
                      await db.createVectorDocument({
                        novelId: input.novelId,
                        userId: ctx.user.id,
                        sourceType: 'kg_node',
                        sourceId: node.id,
                        text: `${node.name}\n${node.content || ''}`.trim(),
                        metadata: JSON.stringify({ nodeType: 'item', sourceChapterId }),
                      });
                    }
                  }
                }
              } catch (parseError) {
                console.error('Failed to parse extracted knowledge:', parseError);
              }
            }
          } catch (extractError) {
            console.error('Failed to extract knowledge:', extractError);
          }

          return { content: finalContent, chapter };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
      }),

    // Modify chapter with AI dialog
    modifyChapter: protectedProcedure
      .input(z.object({
        chapterId: z.number(),
        currentContent: z.string(),
        modifyRequest: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        const chapter = await db.getChapterById(input.chapterId, ctx.user.id);
        if (!chapter) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '章节不存在' });
        }

        const prompt = `请根据以下要求修改章节内容：

当前内容：
${input.currentContent}

修改要求：
${input.modifyRequest}

请输出修改后的完整章节内容。`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一位专业的小说编辑，擅长根据要求修改和完善文章。' },
            { role: 'user', content: prompt },
          ],
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          await db.updateChapter(input.chapterId, ctx.user.id, { 
            content,
            wordCount: content.length,
          });

          await db.createGenerationHistory({
            novelId: chapter.novelId,
            userId: ctx.user.id,
            type: 'revision',
            targetId: chapter.id,
            prompt: input.modifyRequest,
            result: content,
            modelUsed: 'gemini-3-pro-preview',
            tokensUsed: result.usage?.total_tokens,
          });

          return { content };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI修改失败' });
      }),
  }),

  // Admin routes
  admin: router({
    listUsers: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '需要管理员权限',
        });
      }
      return await db.getAllUsers();
    }),

    getStats: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: '需要管理员权限',
        });
      }
      return await db.getSystemStats();
    }),

    updateUser: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]).optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '需要管理员权限',
          });
        }
        if (input.role) {
          return await db.updateUserRole(input.userId, input.role);
        }
        // Note: isActive is not in current schema, just return success
        return { success: true };
      }),

    updateUserRole: protectedProcedure
      .input(z.object({
        userId: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: '需要管理员权限',
          });
        }
        return await db.updateUserRole(input.userId, input.role);
      }),
  }),

  // Knowledge entries router
  knowledge: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number(), type: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        if (input.type) {
          return await db.getKnowledgeEntriesByType(input.novelId, ctx.user.id, input.type);
        }
        return await db.getKnowledgeEntriesByNovelId(input.novelId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        type: z.enum(["character", "relationship", "event", "location", "item", "organization", "setting", "other"]),
        name: z.string(),
        description: z.string().optional(),
        sourceChapterId: z.number().optional(),
        relatedCharacterIds: z.string().optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createKnowledgeEntry({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        relatedCharacterIds: z.string().optional(),
        metadata: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        return await db.updateKnowledgeEntry(id, ctx.user.id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.deleteKnowledgeEntry(input.id, ctx.user.id);
        if (!result.success) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: result.error || '删除失败' });
        }
        return { success: true };
      }),

    retrieveContext: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        outlineContent: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        const context = await knowledgeRetriever.retrieveForChapter(
          input.novelId,
          ctx.user.id,
          input.chapterNumber,
          input.outlineContent
        );
        const formatted = knowledgeRetriever.formatContextForPrompt(context);
        return { context, formatted };
      }),

    syncToWorldbuilding: protectedProcedure
      .input(z.object({
        id: z.number(),
        targetType: z.enum(['location', 'item', 'organization']),
      }))
      .mutation(async ({ ctx, input }) => {
        const entry = await db.getKnowledgeEntryById(input.id, ctx.user.id);
        if (!entry) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '知识库条目不存在' });
        }

        let created;
        let existing;

        // 根据目标类型创建世界观条目
        if (input.targetType === 'location') {
          // 检查是否已存在同名地点
          existing = await db.getWorldbuildingLocationsByNovelId(entry.novelId, ctx.user.id);
          const duplicate = existing.find(e => e.name === entry.name);

          if (duplicate) {
            // 合并描述
            const mergedDesc = duplicate.description
              ? `${duplicate.description}\n\n[来自知识库]\n${entry.description || ''}`
              : entry.description;

            await db.updateWorldbuildingLocation(duplicate.id, ctx.user.id, {
              description: mergedDesc
            });

            return {
              success: true,
              merged: true,
              id: duplicate.id,
              message: `已合并到现有地点"${duplicate.name}"`
            };
          }

          created = await db.createWorldbuildingLocation({
            novelId: entry.novelId,
            userId: ctx.user.id,
            name: entry.name,
            description: entry.description || undefined,
          });
        } else if (input.targetType === 'item') {
          existing = await db.getWorldbuildingItemsByNovelId(entry.novelId, ctx.user.id);
          const duplicate = existing.find(e => e.name === entry.name);

          if (duplicate) {
            const mergedDesc = duplicate.description
              ? `${duplicate.description}\n\n[来自知识库]\n${entry.description || ''}`
              : entry.description;

            await db.updateWorldbuildingItem(duplicate.id, ctx.user.id, {
              description: mergedDesc
            });

            return {
              success: true,
              merged: true,
              id: duplicate.id,
              message: `已合并到现有物品"${duplicate.name}"`
            };
          }

          created = await db.createWorldbuildingItem({
            novelId: entry.novelId,
            userId: ctx.user.id,
            name: entry.name,
            description: entry.description || undefined,
          });
        } else {
          existing = await db.getWorldbuildingOrganizationsByNovelId(entry.novelId, ctx.user.id);
          const duplicate = existing.find(e => e.name === entry.name);

          if (duplicate) {
            const mergedDesc = duplicate.description
              ? `${duplicate.description}\n\n[来自知识库]\n${entry.description || ''}`
              : entry.description;

            await db.updateWorldbuildingOrganization(duplicate.id, ctx.user.id, {
              description: mergedDesc
            });

            return {
              success: true,
              merged: true,
              id: duplicate.id,
              message: `已合并到现有组织"${duplicate.name}"`
            };
          }

          created = await db.createWorldbuildingOrganization({
            novelId: entry.novelId,
            userId: ctx.user.id,
            name: entry.name,
            description: entry.description || undefined,
          });
        }

        if (!created) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '同步失败' });
        }

        return {
          success: true,
          merged: false,
          id: created.id,
          message: `已创建新${input.targetType === 'location' ? '地点' : input.targetType === 'item' ? '物品' : '组织'}"${entry.name}"`
        };
      }),
  }),

  // Story events router
  events: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getStoryEventsByNovelId(input.novelId, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        timePoint: z.string().optional(),
        chapterId: z.number().optional(),
        relatedCharacterIds: z.string().optional(),
        eventType: z.enum(["plot", "character", "world", "conflict", "resolution"]).optional(),
        importance: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.createStoryEvent({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        timePoint: z.string().optional(),
        relatedCharacterIds: z.string().optional(),
        eventType: z.enum(["plot", "character", "world", "conflict", "resolution"]).optional(),
        importance: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        return await db.updateStoryEvent(id, ctx.user.id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteStoryEvent(input.id, ctx.user.id);
      }),
  }),

  // Content versions router
  versions: router({
    list: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        contentType: z.enum(["chapter", "outline", "detailed_outline"]),
        contentId: z.number(),
      }))
      .query(async ({ ctx, input }) => {
        return await db.getContentVersions(input.novelId, ctx.user.id, input.contentType, input.contentId);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getContentVersionById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        contentType: z.enum(["chapter", "outline", "detailed_outline"]),
        contentId: z.number(),
        content: z.string(),
        changeDescription: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const latestVersion = await db.getLatestVersionNumber(
          input.novelId, ctx.user.id, input.contentType, input.contentId
        );
        return await db.createContentVersion({
          ...input,
          userId: ctx.user.id,
          version: latestVersion + 1,
        });
      }),
  }),

  // Chapter Outlines (细纲) router
  chapterOutlines: router({
    list: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const all = await db.getChapterOutlinesByNovel(input.novelId);
        console.log('[ChapterOutlines.list] Query result:', {
          novelId: input.novelId,
          count: all.length,
          items: all.map(o => ({ id: o.id, chapterNumber: o.chapterNumber })),
        });

        // If no pagination params, return all data as array
        if (!input.page && !input.pageSize) {
          return all;
        }

        // Otherwise return paginated response
        const page = input.page || 1;
        const pageSize = input.pageSize || 10;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
          data: all.slice(start, end),
          total: all.length,
          page,
          pageSize,
          totalPages: Math.ceil(all.length / pageSize),
        };
      }),

    get: protectedProcedure
      .input(z.object({ novelId: z.number(), chapterNumber: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChapterOutlineByChapter(input.novelId, input.chapterNumber);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        previousSummary: z.string().optional(),
        plotDevelopment: z.string().optional(),
        characterDynamics: z.string().optional(),
        sceneDescription: z.string().optional(),
        dialoguePoints: z.string().optional(),
        foreshadowing: z.string().optional(),
        fullContent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // wordCount 字段已从数据库移除，不再使用
        return await db.createChapterOutline({
          ...input,
          userId: ctx.user.id,
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        previousSummary: z.string().optional(),
        plotDevelopment: z.string().optional(),
        characterDynamics: z.string().optional(),
        sceneDescription: z.string().optional(),
        dialoguePoints: z.string().optional(),
        foreshadowing: z.string().optional(),
        fullContent: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        // wordCount 字段已从数据库移除，不再使用
        return await db.updateChapterOutline(id, updates);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return await db.deleteChapterOutline(input.id);
      }),

    // AI修改细纲（支持上下文对话）
    modify: protectedProcedure
      .input(z.object({
        id: z.number(),
        modifyRequest: z.string(),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        const { eq } = await import("drizzle-orm");
        const { chapterOutlines } = await import("../drizzle/schema");
        const dbModule = await import("./db");
        const db = await dbModule.getDb();
        
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库连接失败' });
        }
        
        const existing = await db.select().from(chapterOutlines).where(eq(chapterOutlines.id, input.id)).limit(1);
        if (!existing[0]) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '细纲不存在' });
        }
        const currentOutline = existing[0];
        
        // 构建对话历史
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          {
            role: 'system',
            content: `你是一位专业的小说细纲修改专家。请根据用户的要求修改细纲内容，保持风格一致，返回完整的修改后的细纲JSON。

重要：你必须返回有效的JSON格式，遵循以下规则：
1. 所有字符串值中的换行符必须用\\n表示
2. 所有引号必须转义为\\"
3. 不要在字符串中使用未转义的特殊字符
4. 确保JSON格式完整，所有括号正确闭合`
          },
          {
            role: 'user',
            content: `当前细纲内容：
前文总结：${currentOutline.previousSummary || ''}
剧情发展：${currentOutline.plotDevelopment || ''}
人物动态：${currentOutline.characterDynamics || ''}
场景描述：${currentOutline.sceneDescription || ''}
关键对话：${currentOutline.dialoguePoints || ''}
伏笔设置：${currentOutline.foreshadowing || ''}
完整内容：${currentOutline.fullContent || ''}

修改要求：${input.modifyRequest}`
          }
        ];
        
        // 添加对话历史
        if (input.conversationHistory && input.conversationHistory.length > 0) {
          input.conversationHistory.forEach(msg => {
            messages.push({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            });
          });
        }
        
        const result = await invokeLLM({
          messages,
          response_format: { type: 'json_object' },
        });
        
        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          let jsonStr = content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }

          let parsed;
          try {
            parsed = JSON.parse(jsonStr);
          } catch (parseError: any) {
            try {
              console.log('[ChapterOutlines.modify] Attempting to fix JSON...');
              console.log('[ChapterOutlines.modify] Raw content:', jsonStr.slice(0, 1000));

              let fixed = jsonStr
                .trim()
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .replace(/,(\s*[}\]])/g, '$1')
                .replace(/"\s*$/, '"}')
                .replace(/([^"]),\s*$/, '$1}');

              const openBraces = (fixed.match(/{/g) || []).length;
              const closeBraces = (fixed.match(/}/g) || []).length;
              if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
              }

              const openBrackets = (fixed.match(/\[/g) || []).length;
              const closeBrackets = (fixed.match(/\]/g) || []).length;
              if (openBrackets > closeBrackets) {
                fixed += ']'.repeat(openBrackets - closeBrackets);
              }

              parsed = JSON.parse(fixed);
              console.log('[ChapterOutlines.modify] Fixed and parsed JSON successfully');
            } catch (fixError) {
              console.error('[ChapterOutlines.modify] Parse failed:', parseError.message);
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `AI返回的JSON格式错误，请重试`
              });
            }
          }

          const updated = await dbModule.updateChapterOutline(input.id, {
            ...parsed,
            version: currentOutline.version + 1,
          });
          return { ...parsed, id: updated?.id };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI修改失败' });
      }),

    // Generate single chapter outline with AI
    generate: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        inspiration: z.string().optional(), // 灵感输入
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");
        
        // Get full context for generation
        const context = await db.getNovelContextForGeneration(input.novelId, input.chapterNumber);
        console.log('[ChapterOutlines.generate] Context:', {
          hasContext: !!context,
          hasNovel: !!context?.novel,
          novelId: input.novelId,
          chapterNumber: input.chapterNumber,
        });
        if (!context || !context.novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const { novel, outline, characters, previousChapters, pendingForeshadowing, knowledgeEntries, storyEvents } = context;

        // Build previous summary
        let previousSummaryText = '';
        if (previousChapters.length > 0) {
          previousSummaryText = previousChapters.map(c => 
            `第${c.chapterNumber}章 ${c.title || ''}：${(c.content || '').slice(0, 800)}...`
          ).join('\n\n');
        }

        // Build character info
        const characterInfo = characters.map(c => 
          `- ${c.name}（${c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'}）：${c.role || '未设定'}
  性格：${c.personality || '未设定'}
  背景：${c.background || '未设定'}`
        ).join('\n\n');

        // Build knowledge context（世界观：地点 / 物品 / 组织等，与本章相关优先）
        const relatedKnowledge = knowledgeEntries.filter((k) =>
          typeof (k as any).sourceChapterId === 'number'
            ? Math.abs((k as any).sourceChapterId - input.chapterNumber) <= 2
            : false
        );
        const globalKnowledge = knowledgeEntries.filter(
          (k) => (k as any).sourceChapterId == null
        );
        const orderedKnowledge = [
          ...relatedKnowledge,
          ...globalKnowledge,
        ].slice(0, 20);

        const knowledgeContext = orderedKnowledge
          .map((k) => `- [${k.type}] ${k.name}：${k.description || ''}`)
          .join('\n');

        // Build timeline context（时间线：与当前章节相关的事件）
        const relevantEvents = (storyEvents || []).filter(ev => {
          if (!ev.chapterId && !ev.timePoint) return false;
          const chapterFromId = ev.chapterId || undefined;
          let chapterFromTimePoint: number | undefined;
          if (ev.timePoint) {
            const m = ev.timePoint.match(/第(\d+)(?:-(\d+))?章/);
            if (m) {
              const start = parseInt(m[1], 10);
              const end = m[2] ? parseInt(m[2], 10) : start;
              if (input.chapterNumber >= start && input.chapterNumber <= end) {
                chapterFromTimePoint = start;
              }
            }
          }
          const chapter = chapterFromId ?? chapterFromTimePoint;
          if (!chapter) return false;
          return Math.abs(chapter - input.chapterNumber) <= 2;
        });

        const timelineContext = relevantEvents.map(ev =>
          `- [${ev.timePoint || (ev.chapterId ? `第${ev.chapterId}章` : '全书阶段')}] ${ev.name}：${ev.description || ''}`
        ).join('\n');

        // Build foreshadowing context
        const foreshadowingContext = pendingForeshadowing.map(f => 
          `- 伏笔：${f.content}（设置于第${f.setupChapterId}章，计划在第${f.plannedResolutionChapter || '?'}章回收）`
        ).join('\n');

        const prompt = `你是一位专业的小说细纲编写专家。你需要先**分析本章需要依赖哪些世界观 / 时间线 / 人物 / 伏笔信息**，再基于提供的资料生成细纲。

请在内部推理中先完成两步（无需单独输出推理过程）：
1. 浏览下方提供的【世界观 / 时间线 / 人物 / 伏笔 / 前文摘要】信息，整理出与你要写的这一章最相关的要点（例如：需要用到哪些地点/组织/道具、当前处于哪一段时间线、哪些伏笔需要铺垫或回收、哪些人物弧光/关系要推进）。
2. 在脑海中形成一份“信息使用计划”：本章会在哪些桥段用到哪些设定，然后据此编写细纲。

最终输出仍然只需要给出结构化细纲 JSON，不要单独输出分析过程。

现在，请为第${input.chapterNumber}章生成详细的细纲（严格要求：约2000字，不要超过2000字）。

${input.inspiration ? `创作灵感：
${input.inspiration}

请根据以上灵感，结合以下信息生成细纲：` : ''}

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}
- 世界观：${novel.worldSetting || '未设定'}
${novel.writerStyle ? `- 作家风格：${novel.writerStyle}` : ''}
${novel.writerStylePrompt ? `- 风格描述：${novel.writerStylePrompt}` : ''}

${outline ? `总大纲：
${outline.content}` : ''}

${characterInfo ? `主要角色：
${characterInfo}` : ''}

${timelineContext ? `时间线相关事件（与本章相关）：
${timelineContext}` : ''}

${previousSummaryText ? `前文摘要：
${previousSummaryText}` : '这是第一章，没有前文。'}

${knowledgeContext ? `知识库参考：
${knowledgeContext}` : ''}

${foreshadowingContext ? `待回收的伏笔：
${foreshadowingContext}

重要提示：如果本章是合适的时机，请在细纲中安排回收相应的伏笔。回收伏笔时要自然合理，与剧情发展相符。` : ''}

请生成详细的细纲，包含以下部分（使用JSON格式返回）：
1. previousSummary: 前文总结（300-500字，概括前面章节的主要内容和当前剧情进展）
2. plotDevelopment: 本章剧情发展（500-800字，详细描述本章的主要情节、冲突和转折）
3. characterDynamics: 人物动态（300-400字，描述本章中各角色的行为、心理变化和人物关系发展）
4. sceneDescription: 场景描述（200-300字，描述本章的主要场景和氛围）
5. dialoguePoints: 关键对话要点（200-300字，列出本章重要对话的要点和目的）
6. foreshadowing: 伏笔设置（100-200字，本章要设置的新伏笔，或要回收的伏笔及如何回收）
7. fullContent: 完整细纲内容（将以上内容整合成连贯的细纲文本，严格要求约2000字，不要超过2000字）`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: `你是一位专业的小说细纲编写专家，擅长构建详细的章节细纲。

重要：你必须返回有效的JSON格式，遵循以下规则：
1. 所有字符串值中的换行符必须用\\n表示
2. 所有引号必须转义为\\"
3. 不要在字符串中使用未转义的特殊字符
4. 确保JSON格式完整，所有括号正确闭合
5. 每个字段的内容可以很长，但必须是单行字符串（使用\\n表示换行）` },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });

        const content = result.choices[0]?.message?.content;
        console.log('[ChapterOutlines.generate] AI Response length:', content?.length);
        console.log('[ChapterOutlines.generate] AI Response preview:', content?.slice(0, 500));
        if (typeof content === 'string') {
          // Extract JSON from markdown code blocks if present
          let jsonStr = content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            console.log('[ChapterOutlines.generate] Extracted JSON from markdown');
            jsonStr = jsonMatch[1].trim();
          }
          console.log('[ChapterOutlines.generate] JSON to parse:', jsonStr.slice(0, 500));

          let parsed;
          try {
            parsed = JSON.parse(jsonStr);
            console.log('[ChapterOutlines.generate] Parsed successfully, keys:', Object.keys(parsed));
          } catch (parseError: any) {
            // Try to fix common JSON issues
            try {
              console.log('[ChapterOutlines.generate] Attempting to fix JSON...');
              console.log('[ChapterOutlines.generate] Raw content:', jsonStr.slice(0, 1000));

              let fixed = jsonStr
                .trim()
                .replace(/^```json\s*/i, '')  // Remove markdown code block
                .replace(/^```\s*/i, '')
                .replace(/\s*```$/i, '')
                .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
                .replace(/"\s*$/, '"}')  // Close incomplete strings
                .replace(/([^"]),\s*$/, '$1}');  // Close incomplete objects

              // Close incomplete objects/arrays
              const openBraces = (fixed.match(/{/g) || []).length;
              const closeBraces = (fixed.match(/}/g) || []).length;
              if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
              }

              const openBrackets = (fixed.match(/\[/g) || []).length;
              const closeBrackets = (fixed.match(/\]/g) || []).length;
              if (openBrackets > closeBrackets) {
                fixed += ']'.repeat(openBrackets - closeBrackets);
              }

              parsed = JSON.parse(fixed);
              console.log('[ChapterOutlines.generate] Fixed and parsed JSON successfully');
            } catch (fixError) {
              console.error('[ChapterOutlines.generate] Parse failed:', parseError.message);
              console.error('[ChapterOutlines.generate] Content preview:', jsonStr.slice(0, 500));
              throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `AI返回的JSON格式错误，请重试`
              });
            }
          }
          
          // 检查并截断fullContent到2000字
          if (parsed.fullContent && parsed.fullContent.length > 2000) {
            console.log(`[ChapterOutlines.generate] 细纲过长 (${parsed.fullContent.length}字)，截断到2000字`);
            parsed.fullContent = parsed.fullContent.substring(0, 2000);
          }
          
          // Check if outline exists, update or create
          const existing = await db.getChapterOutlineByChapter(input.novelId, input.chapterNumber);
          console.log('[ChapterOutlines.generate] Existing outline:', existing?.id);

          if (existing) {
            const updated = await db.updateChapterOutline(existing.id, {
              ...parsed,
              // wordCount 字段已从数据库移除，不再使用
              version: existing.version + 1,
            });
            console.log('[ChapterOutlines.generate] Updated outline:', {
              id: updated?.id,
              novelId: input.novelId,
              chapterNumber: input.chapterNumber,
            });
            return { ...parsed, id: updated?.id, isNew: false };
          } else {
            const created = await db.createChapterOutline({
              novelId: input.novelId,
              userId: ctx.user.id,
              chapterNumber: input.chapterNumber,
              ...parsed,
              // wordCount 字段已从数据库移除，不再使用
            });
            console.log('[ChapterOutlines.generate] Created outline:', {
              id: created?.id,
              novelId: input.novelId,
              chapterNumber: input.chapterNumber,
            });
            return { ...parsed, id: created?.id, isNew: true };
          }
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI生成失败' });
      }),
  }),

  // Chapter Reviews (AI评论) router
  chapterReviews: router({
    get: protectedProcedure
      .input(z.object({ chapterId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChapterReviewByChapter(input.chapterId);
      }),

    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getChapterReviewsByNovel(input.novelId);
      }),

    // Generate AI summary for a chapter
    generate: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");

        // Get chapter
        const chapter = await db.getChapterById(input.chapterId, ctx.user.id);
        if (!chapter) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '章节不存在' });
        }
        if (chapter.novelId !== input.novelId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        // Get context
        const context = await db.getNovelContextForGeneration(chapter.novelId, chapter.chapterNumber);
        if (!context) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const { novel, outline, chapterOutline, previousChapters, pendingForeshadowing, characters } = context;

        // Build previous chapters context
        let previousContext = '';
        if (previousChapters.length > 0) {
          previousContext = previousChapters.map(c =>
            `第${c.chapterNumber}章 ${c.title || ''}：${(c.content || '').slice(0, 500)}...`
          ).join('\n\n');
        }

        const prompt = `你是一位专业的小说编辑。请对以下章节进行详细总结和分析。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}

${outline ? `总大纲：
${outline.content?.slice(0, 1000)}` : ''}

${previousContext ? `前文回顾：
${previousContext}` : '这是第一章'}

${chapterOutline ? `本章细纲：
${chapterOutline.fullContent?.slice(0, 1000)}` : ''}

本章内容（第${chapter.chapterNumber}章）：
${chapter.content}

${pendingForeshadowing.length > 0 ? `待回收伏笔：
${pendingForeshadowing.map(f => `- ${f.content}`).join('\n')}` : ''}

${characters.length > 0 ? `主要角色：
${characters.map(c => `- ${c.name}：${c.personality || ''}`).join('\n')}` : ''}

请进行以下总结和分析（使用JSON格式返回）：

1. **plotSummary**: 剧情总结（300-500字）
   - 简要概括本章的主要剧情发展
   - 包含关键事件和转折点

2. **openingDescription**: 开头描述（150-200字）
   - 本章如何开始
   - 开场的场景、人物、氛围
   - 与前文的衔接方式

3. **middleDescription**: 中间发展（200-300字）
   - 主要情节如何推进
   - 关键冲突和矛盾
   - 人物行为和心理变化

4. **endingDescription**: 结尾描述（150-200字）
   - 本章如何收尾
   - 是否留下悬念或伏笔
   - 为下一章做了什么铺垫

5. **keyIssues**: 重点问题描述（200-300字）
   - 本章存在的主要问题（如有）
   - 与大纲/细纲的偏差
   - 人物行为是否合理
   - 情节逻辑是否连贯
   - 与前文是否矛盾

6. **qualityScore**: 章节质量评分（1-10）

7. **foreshadowingMarkers**: 本章设置的伏笔（字符串，列出新伏笔）

8. **resolvedForeshadowing**: 已回收的伏笔（字符串，列出回收的伏笔）

9. **overallComment**: 整体评价（200-300字的综合评价）

注意：所有字符串字段中的换行请使用\\n表示，确保返回有效的JSON格式。`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: `你是一位专业的小说编辑，擅长总结和分析小说章节。

你的任务是：
1. 总结本章的剧情要点（开头、中间、结尾）
2. 结合前文上下文，分析剧情连贯性
3. 指出存在的问题和不合理之处
4. 识别伏笔的设置和回收

重要：返回有效的JSON格式，所有字符串中的换行使用\\n表示。` },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === 'string') {
          // Extract JSON from markdown code blocks if present
          let jsonStr = content.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          const parsed = JSON.parse(jsonStr);
          
          // Save review
          const review = await db.createChapterReview({
            novelId: input.novelId,
            userId: ctx.user.id,
            chapterId: input.chapterId,
            ...parsed,
          });

          // Auto-save new foreshadowing if detected
          if (parsed.foreshadowingMarkers) {
            const foreshadowingText = typeof parsed.foreshadowingMarkers === 'string'
              ? parsed.foreshadowingMarkers
              : Array.isArray(parsed.foreshadowingMarkers)
                ? parsed.foreshadowingMarkers.join('\n')
                : String(parsed.foreshadowingMarkers);

            if (foreshadowingText.trim()) {
              await db.createForeshadowing({
                novelId: input.novelId,
                userId: ctx.user.id,
                content: foreshadowingText,
                setupChapterId: input.chapterId,
                status: 'pending',
              });
            }
          }

          return { ...parsed, id: review?.id };
        }
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI评论生成失败' });
      }),
  }),

  // Foreshadowing (伏笔) router
  foreshadowing: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getForeshadowingByNovel(input.novelId);
      }),

    pending: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(async ({ ctx, input }) => {
        return await db.getPendingForeshadowing(input.novelId);
      }),

    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        content: z.string(),
        setupChapterId: z.number(),
        plannedResolutionChapter: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const created = await db.createForeshadowing({
          ...input,
          userId: ctx.user.id,
          status: 'pending',
        });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '伏笔创建失败' });
          }
          return created;
        } catch (error: any) {
          console.error('[Foreshadowing] Create error:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `伏笔创建失败: ${error?.message || '数据库写入失败'}`,
          });
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().optional(),
        plannedResolutionChapter: z.number().optional(),
        importance: z.number().optional(),
        status: z.enum(['pending', 'resolved', 'abandoned']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        return await db.updateForeshadowing(id, updates);
      }),

    resolve: protectedProcedure
      .input(z.object({
        id: z.number(),
        chapterId: z.number(),
        resolutionContent: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await db.resolveForeshadowing(input.id, input.chapterId, input.resolutionContent);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const dbModule = await import("./db");
        const db = await dbModule.getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库连接失败' });
        }
        const { eq } = await import("drizzle-orm");
        const { foreshadowing } = await import("../drizzle/schema");
        await db.delete(foreshadowing).where(eq(foreshadowing.id, input.id));
        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const dbModule = await import("./db");
        const db = await dbModule.getDb();
        if (!db) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '数据库连接失败' });
        }
        const { eq } = await import("drizzle-orm");
        const { foreshadowing } = await import("../drizzle/schema");
        const result = await db.select().from(foreshadowing).where(eq(foreshadowing.id, input.id)).limit(1);
        return result[0] || null;
      }),
  }),

  // Worldbuilding (世界观构建) router
  worldbuilding: router({
    // 同步到向量库
    syncToVectorDB: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const characters = await db.getCharactersByNovelId(input.novelId, ctx.user.id);
        const locations = await db.getWorldbuildingLocationsByNovelId(input.novelId, ctx.user.id);
        const items = await db.getWorldbuildingItemsByNovelId(input.novelId, ctx.user.id);
        const organizations = await db.getWorldbuildingOrganizationsByNovelId(input.novelId, ctx.user.id);

        const syncItems = [];

        // 准备人物数据
        for (const character of characters) {
          const content = `人物名称：${character.name}\n角色：${character.role || ''}\n性别：${character.gender || ''}\n年龄：${character.age || ''}\n性格：${character.personality || ''}\n背景：${character.background || ''}\n外貌：${character.appearance || ''}\n能力：${character.abilities || ''}`;
          syncItems.push({
            source_type: 'character',
            source_id: character.id,
            name: character.name,
            content
          });
        }

        // 准备地点数据
        for (const location of locations) {
          const content = `地点名称：${location.name}\n描述：${location.description || ''}`;
          syncItems.push({
            source_type: 'location',
            source_id: location.id,
            name: location.name,
            content
          });
        }

        // 准备物品数据
        for (const item of items) {
          const content = `物品名称：${item.name}\n描述：${item.description || ''}`;
          syncItems.push({
            source_type: 'item',
            source_id: item.id,
            name: item.name,
            content
          });
        }

        // 准备组织数据
        for (const org of organizations) {
          const content = `组织名称：${org.name}\n描述：${org.description || ''}`;
          syncItems.push({
            source_type: 'organization',
            source_id: org.id,
            name: org.name,
            content
          });
        }

        // 调用Python API同步到Milvus
        try {
          const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';

          // 获取当前用户信息
          const currentUser = ctx.user;
          if (!currentUser) {
            throw new Error('用户未登录');
          }

          // 使用用户名和密码获取Python后端的JWT token
          // 注意：这里需要用户的密码，但我们没有存储明文密码
          // 更好的方案是：在Python后端添加一个接受Node.js session的认证端点
          // 或者：在数据库中存储Python JWT token

          // 临时方案：直接使用用户ID作为认证（需要Python后端支持）
          const response = await fetch(`${pythonApiUrl}/api/vector/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': currentUser.id.toString(),
              'X-Username': currentUser.username
            },
            body: JSON.stringify({
              novel_id: input.novelId,
              items: syncItems
            })
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Python API error: ${error}`);
          }

          const result = await response.json();

          // 构建详细的同步消息
          let message = `已同步 ${result.synced_count}/${result.total} 条数据到向量库`;
          if (result.deleted_count > 0) {
            message += `（更新了 ${result.deleted_count} 条）`;
          }

          console.log(`[SyncToVectorDB] ${message}`);

          return {
            success: true,
            syncedCount: result.synced_count,
            total: result.total,
            deletedCount: result.deleted_count || 0,
            updatedCount: result.updated_count || 0,
            message
          };
        } catch (error) {
          console.error('[SyncToVectorDB] Failed:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `向量库同步失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
        }
      }),

    // AI 初始化：从大纲中提取地点/物品/组织
    initializeFromOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        scope: z.enum(['locations', 'items', 'organizations', 'all']).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");

        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        if (!novel) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
        }

        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        if (!outline || !outline.content) {
          throw new TRPCError({ code: 'FAILED_PRECONDITION', message: '请先创建并激活大纲' });
        }

        const prompt = `你是一名资深的世界观构建助手，请从下面这本小说的大纲中**提取**已经出现的世界要素，只做信息抽取，不要自行创作。

小说信息：
- 标题：${novel.title}
- 类型：${novel.genre || '未设定'}
- 风格：${novel.style || '未设定'}

大纲内容（节选，最多3000字）：
${outline.content.slice(0, 3000)}

请基于以上内容，提取三类信息：地点场景、物品道具、组织势力。严格只使用大纲里已经写出来的信息。

返回 JSON，格式为：
{
  "locations": [
    { "name": "地点名", "type": "类型/分类", "description": "一句话概括位置与功能", "features": "可选：环境/气氛/特殊之处", "importance": "high|medium|low" }
  ],
  "items": [
    { "name": "物品名", "type": "类型/品级", "description": "一句话概括外观和来历", "abilities": "能力/效果", "owner": "持有者（若已明确）" }
  ],
  "organizations": [
    { "name": "组织名", "type": "门派/势力/家族等", "description": "一句话概括定位", "leader": "领袖（若已明确）", "members": "主要成员或阵营", "goals": "目标或宗旨" }
  ]
}

如果某一类没有信息，请返回空数组。禁止返回 JSON 之外的任何文字。`;

        const result = await invokeLLM({
          messages: [
            { role: 'system', content: '你是一个信息抽取助手，只从给定文本中抽取地点/物品/组织，不要虚构。只返回JSON。' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        });

        const raw = result.choices[0]?.message?.content;
        if (typeof raw !== 'string') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 返回内容为空' });
        }

        let parsed: any;
        try {
          // Extract JSON from markdown code blocks if present
          let jsonStr = raw.trim();
          const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
          if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
          }
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          console.error('[Worldbuilding] 初始化解析失败:', e, raw.slice(0, 200));
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 返回格式解析失败' });
        }

        const scope = input.scope || 'all';

        const created = {
          locations: 0,
          items: 0,
          organizations: 0,
        };

        // 保存地点
        if ((scope === 'all' || scope === 'locations') && Array.isArray(parsed.locations)) {
          for (const loc of parsed.locations) {
            if (!loc?.name) continue;
            const descParts: string[] = [];
            if (loc.description) descParts.push(String(loc.description));
            if (loc.features) descParts.push(`特点：${loc.features}`);
            if (loc.importance) descParts.push(`重要性：${loc.importance}`);
            const description = descParts.join('\n');
            await db.createWorldbuildingLocation({
              novelId: input.novelId,
              userId: ctx.user.id,
              name: String(loc.name),
              description: description || undefined,
            });
            created.locations += 1;
          }
        }

        // 保存物品
        if ((scope === 'all' || scope === 'items') && Array.isArray(parsed.items)) {
          for (const item of parsed.items) {
            if (!item?.name) continue;
            const descParts: string[] = [];
            if (item.description) descParts.push(String(item.description));
            if (item.abilities) descParts.push(`能力：${item.abilities}`);
            if (item.owner) descParts.push(`持有者：${item.owner}`);
            const description = descParts.join('\n');
            await db.createWorldbuildingItem({
              novelId: input.novelId,
              userId: ctx.user.id,
              name: String(item.name),
              description: description || undefined,
            });
            created.items += 1;
          }
        }

        // 保存组织
        if ((scope === 'all' || scope === 'organizations') && Array.isArray(parsed.organizations)) {
          for (const org of parsed.organizations) {
            if (!org?.name) continue;
            const descParts: string[] = [];
            if (org.description) descParts.push(String(org.description));
            if (org.leader) descParts.push(`领袖：${org.leader}`);
            if (org.members) descParts.push(`成员：${org.members}`);
            if (org.goals) descParts.push(`目标：${org.goals}`);
            const description = descParts.join('\n');
            await db.createWorldbuildingOrganization({
              novelId: input.novelId,
              userId: ctx.user.id,
              name: String(org.name),
              description: description || undefined,
            });
            created.organizations += 1;
          }
        }

        return created;
      }),

    // AI：从大纲/章节内容提取人物设定（由 Python 后端执行并写入数据库）
    extractCharacters: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        sourceType: z.enum(['outline', 'chapter', 'all_chapters']),
        sourceId: z.number().optional(),
        additionalPrompt: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
        const currentUser = ctx.user;
        if (!currentUser) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: '用户未登录' });
        }

        const response = await fetch(
          `${pythonApiUrl}/api/worldbuilding/novels/${input.novelId}/extract-characters`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': currentUser.id.toString(),
              'X-Username': currentUser.username,
            },
            body: JSON.stringify({
              source_type: input.sourceType,
              source_id: input.sourceId,
              additional_prompt: input.additionalPrompt,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `AI 提取人物失败: ${errorText || response.statusText}`,
          });
        }

        return await response.json();
      }),

    // AI 修改人物/地点/物品/组织/时间线事件描述（带上下文）
    refineEntry: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        type: z.enum(['character', 'location', 'item', 'organization', 'timeline']),
        name: z.string(),
        currentDescription: z.string().optional(),
        userRequest: z.string(),
        conversationHistory: z.array(z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { invokeLLM } = await import("./_core/llm");

        const novel = await db.getNovelById(input.novelId, ctx.user.id);
        const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
        const knowledgeEntries = await db.getKnowledgeEntriesByNovelId(input.novelId, ctx.user.id);
        const storyEvents = await db.getStoryEventsByNovelId(input.novelId, ctx.user.id);

        const briefWorldbuilding = knowledgeEntries
          .slice(0, 30)
          .map((k) => `${k.type}｜${k.name}：${(k.description || "").slice(0, 40)}...`)
          .join("\n");

        const briefTimeline = storyEvents
          .slice(0, 30)
          .map((e) => `${e.timePoint || "全书阶段"}｜${e.name}：${(e.description || "").slice(0, 40)}...`)
          .join("\n");

        const typeLabelMap: Record<string, string> = {
          character: "人物角色",
          location: "地点/场景",
          item: "物品/道具",
          organization: "组织/势力",
          timeline: "时间线事件",
        };

        let basePrompt = '';

        if (input.type === 'character') {
          basePrompt = `你是一名小说人物设定助手，现在要帮助作者**润色和优化**一个人物角色的设定。

小说：《${novel?.title || '未命名'}》
类型：${novel?.genre || '未设定'}

${outline?.content ? `当前大纲（节选）：
${outline.content.slice(0, 1500)}
` : ''}

角色名称：${input.name}
当前设定：
${input.currentDescription || '（暂无设定，请根据大纲和常识适度补全）'}

作者的本轮修改要求：
${input.userRequest}

请在尊重大纲和既有设定的前提下，生成优化后的人物设定。请按以下格式输出（每个字段一行）：
角色：[角色定位，如主角/配角/反派]
性别：[男/女/其他]
性格：[性格特点描述]
背景：[背景故事]
外貌：[外貌描述]
能力：[能力技能]`;
        } else {
          basePrompt = `你是一名小说世界观设定助手，现在要帮助作者**润色和优化**一个世界观条目。

小说：《${novel?.title || '未命名'}》
类型：${novel?.genre || '未设定'}

${outline?.content ? `当前大纲（节选）：
${outline.content.slice(0, 1500)}
` : ''}

世界观要素速览（地点/物品/组织，截断展示）：
${briefWorldbuilding || "（暂无已录入的世界观条目）"}

故事时间线速览（事件，截断展示）：
${briefTimeline || "（暂无已录入的时间线事件）"}

条目类型：${typeLabelMap[input.type]}
条目名称：${input.name}
当前描述：${input.currentDescription || '（暂无描述，请根据大纲和常识适度补全）'}

作者的本轮修改要求：
${input.userRequest}

请在尊重大纲和既有设定的前提下，生成一段更清晰、可直接用于创作的描述文本（300字以内）。`;
        }

        const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
          {
            role: 'system',
            content: '你是一名小说世界观构建与润色助手，回答时只输出新的描述文本本身，不要解释。',
          },
          { role: 'user', content: basePrompt },
        ];

        if (input.conversationHistory && input.conversationHistory.length > 0) {
          input.conversationHistory.forEach(msg => {
            messages.push({
              role: msg.role,
              content: msg.content,
            } as any);
          });
        }

        const result = await invokeLLM({ messages });
        const content = result.choices[0]?.message?.content;
        if (typeof content !== 'string') {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 修改失败' });
        }

        return { refinedDescription: content.trim() };
      }),

    // Locations (地点)
    locations: router({
      list: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .query(async ({ ctx, input }) => {
          return await db.getWorldbuildingLocationsByNovelId(input.novelId, ctx.user.id);
        }),

      create: protectedProcedure
        .input(z.object({
          novelId: z.number(),
          name: z.string(),
          type: z.string().optional(),
          description: z.string().optional(),
          features: z.string().optional(),
          importance: z.enum(['high', 'medium', 'low']).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { importance, features, ...rest } = input;
          let fullDescription = input.description || '';
          if (features) {
            fullDescription += (fullDescription ? '\n\n特点：' : '特点：') + features;
          }
          if (importance) {
            fullDescription += (fullDescription ? '\n\n重要性：' : '重要性：') + importance;
          }

          const created = await db.createWorldbuildingLocation({
            novelId: input.novelId,
            userId: ctx.user.id,
            name: input.name,
            description: fullDescription || undefined,
          });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '地点创建失败' });
          }
          return created;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          type: z.string().optional(),
          description: z.string().optional(),
          features: z.string().optional(),
          importance: z.enum(['high', 'medium', 'low']).optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { id, importance, features, ...rest } = input;
          let fullDescription = input.description || '';
          if (features) {
            fullDescription += (fullDescription ? '\n\n特点：' : '特点：') + features;
          }
          if (importance) {
            fullDescription += (fullDescription ? '\n\n重要性：' : '重要性：') + importance;
          }

          const updated = await db.updateWorldbuildingLocation(id, ctx.user.id, {
            ...(input.name && { name: input.name }),
            ...(fullDescription && { description: fullDescription }),
          });
          if (!updated) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '地点不存在' });
          }
          return updated;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const success = await db.deleteWorldbuildingLocation(input.id, ctx.user.id);
          if (!success) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '地点不存在' });
          }
          return { success: true };
        }),
    }),

    // Items (物品)
    items: router({
      list: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .query(async ({ ctx, input }) => {
          return await db.getWorldbuildingItemsByNovelId(input.novelId, ctx.user.id);
        }),

      create: protectedProcedure
        .input(z.object({
          novelId: z.number(),
          name: z.string(),
          type: z.string().optional(),
          description: z.string().optional(),
          abilities: z.string().optional(),
          owner: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { abilities, owner, ...rest } = input;
          let fullDescription = input.description || '';
          if (abilities) {
            fullDescription += (fullDescription ? '\n\n能力：' : '能力：') + abilities;
          }
          if (owner) {
            fullDescription += (fullDescription ? '\n\n持有者：' : '持有者：') + owner;
          }

          const created = await db.createWorldbuildingItem({
            novelId: input.novelId,
            userId: ctx.user.id,
            name: input.name,
            description: fullDescription || undefined,
          });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '物品创建失败' });
          }
          return created;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          type: z.string().optional(),
          description: z.string().optional(),
          abilities: z.string().optional(),
          owner: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { id, abilities, owner, ...rest } = input;
          let fullDescription = input.description || '';
          if (abilities) {
            fullDescription += (fullDescription ? '\n\n能力：' : '能力：') + abilities;
          }
          if (owner) {
            fullDescription += (fullDescription ? '\n\n持有者：' : '持有者：') + owner;
          }

          const updated = await db.updateWorldbuildingItem(id, ctx.user.id, {
            ...(input.name && { name: input.name }),
            ...(fullDescription && { description: fullDescription }),
          });
          if (!updated) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '物品不存在' });
          }
          return updated;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const success = await db.deleteWorldbuildingItem(input.id, ctx.user.id);
          if (!success) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '物品不存在' });
          }
          return { success: true };
        }),
    }),

    // Organizations (组织)
    organizations: router({
      list: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .query(async ({ ctx, input }) => {
          return await db.getWorldbuildingOrganizationsByNovelId(input.novelId, ctx.user.id);
        }),

      create: protectedProcedure
        .input(z.object({
          novelId: z.number(),
          name: z.string(),
          type: z.string().optional(),
          description: z.string().optional(),
          leader: z.string().optional(),
          members: z.string().optional(),
          goals: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { leader, members, goals, ...rest } = input;
          let fullDescription = input.description || '';
          if (leader) {
            fullDescription += (fullDescription ? '\n\n领袖：' : '领袖：') + leader;
          }
          if (members) {
            fullDescription += (fullDescription ? '\n\n成员：' : '成员：') + members;
          }
          if (goals) {
            fullDescription += (fullDescription ? '\n\n目标：' : '目标：') + goals;
          }

          const created = await db.createWorldbuildingOrganization({
            novelId: input.novelId,
            userId: ctx.user.id,
            name: input.name,
            description: fullDescription || undefined,
          });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '组织创建失败' });
          }
          return created;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          name: z.string().optional(),
          type: z.string().optional(),
          description: z.string().optional(),
          leader: z.string().optional(),
          members: z.string().optional(),
          goals: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { id, leader, members, goals, ...rest } = input;
          let fullDescription = input.description || '';
          if (leader) {
            fullDescription += (fullDescription ? '\n\n领袖：' : '领袖：') + leader;
          }
          if (members) {
            fullDescription += (fullDescription ? '\n\n成员：' : '成员：') + members;
          }
          if (goals) {
            fullDescription += (fullDescription ? '\n\n目标：' : '目标：') + goals;
          }

          const updated = await db.updateWorldbuildingOrganization(id, ctx.user.id, {
            ...(input.name && { name: input.name }),
            ...(fullDescription && { description: fullDescription }),
          });
          if (!updated) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '组织不存在' });
          }
          return updated;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const success = await db.deleteWorldbuildingOrganization(input.id, ctx.user.id);
          if (!success) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '组织不存在' });
          }
          return { success: true };
        }),
    }),

    // Timeline (时间线) - 使用 storyEvents 表
    timeline: router({
      list: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .query(async ({ ctx, input }) => {
          return await db.getStoryEventsByNovelId(input.novelId, ctx.user.id);
        }),

      // 从大纲中提取全局时间线事件（主线阶段）
      initializeFromOutline: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const { invokeLLM } = await import("./_core/llm");

          const novel = await db.getNovelById(input.novelId, ctx.user.id);
          if (!novel) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
          }

          const outline = await db.getActiveOutline(input.novelId, ctx.user.id);
          if (!outline || !outline.content) {
            throw new TRPCError({ code: 'FAILED_PRECONDITION', message: '请先创建并激活大纲' });
          }

          const prompt = `你是一名故事结构专家，请从下面这本小说的大纲中，抽取可以放入“故事时间线”的关键阶段事件。

小说：《${novel.title}》
类型：${novel.genre || '未设定'}

大纲内容（节选，最多4000字）：
${outline.content.slice(0, 4000)}

请只做信息提取，不要改写大纲内容。
返回 JSON，格式：
{
  "events": [
    {
      "name": "事件标题（简短）",
      "description": "这一阶段发生了什么、对故事有什么影响（1-3句）",
      "type": "plot|character|world|conflict|resolution",
      "startChapter": 1,
      "endChapter": 5
    }
  ]
}

如果无法确定具体章节范围，可以大致估计；如果实在没有信息，请返回 "events": []。`;

          const result = await invokeLLM({
            messages: [
              { role: 'system', content: '你是一个时间线信息抽取助手，只从给定大纲中提取关键阶段事件，并严格返回JSON。' },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
          });

          const raw = result.choices[0]?.message?.content;
          if (typeof raw !== 'string') {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 返回为空' });
          }

          let eventsCreated = 0;
          try {
            // 清理JSON
            let jsonStr = raw.trim();
            const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
              jsonStr = jsonMatch[1].trim();
            }

            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed.events)) {
              for (const ev of parsed.events) {
                if (!ev?.name) continue;
                const start = typeof ev.startChapter === 'number' ? Math.max(1, Math.floor(ev.startChapter)) : undefined;
                const end = typeof ev.endChapter === 'number' ? Math.max(1, Math.floor(ev.endChapter)) : undefined;
                const timePoint =
                  start && end && end !== start
                    ? `第${start}-${end}章`
                    : start
                    ? `第${start}章`
                    : ev.timePoint || '全书阶段';

                await db.createStoryEvent({
                  novelId: input.novelId,
                  userId: ctx.user.id,
                  name: String(ev.name),
                  description: ev.description || undefined,
                  timePoint,
                  eventType: ev.type || 'plot',
                  chapterId: start || undefined,
                });
                eventsCreated += 1;
              }
            }
          } catch (e) {
            console.error('[Worldbuilding.timeline.initializeFromOutline] 解析失败:', e, raw.slice(0, 200));
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'AI 时间线解析失败' });
          }

          return { eventsCreated };
        }),

      // 从已有章节内容中批量提取时间线事件
      initializeFromChapters: protectedProcedure
        .input(z.object({ novelId: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const { invokeLLM } = await import("./_core/llm");

          const novel = await db.getNovelById(input.novelId, ctx.user.id);
          if (!novel) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '小说不存在' });
          }

          const chapters = await db.getChaptersByNovelId(input.novelId, ctx.user.id);
          if (!chapters.length) {
            throw new TRPCError({ code: 'FAILED_PRECONDITION', message: '当前小说还没有章节内容' });
          }

          let eventsCreated = 0;
          let chaptersProcessed = 0;

          for (const chapter of chapters) {
            if (!chapter.content || !chapter.content.trim()) continue;
            chaptersProcessed += 1;

            const extractPrompt = `请从下面这一章小说内容中，提取可以放入“故事时间线”的关键事件。

小说：《${novel.title}》
章节：第${chapter.chapterNumber}章

章节内容（节选，最多3000字）：
${chapter.content.slice(0, 3000)}

请只做信息提取，不要进行续写或改写。
返回 JSON，格式：
{
  "events": [
    { "name": "事件标题（简短）", "description": "事件发生的过程和意义（1-2句）", "type": "plot|character|world|conflict|resolution" }
  ]
}

如果没有合适的事件，请返回 "events": []。`;

            const result = await invokeLLM({
              messages: [
                { role: 'system', content: '你是一个时间线信息抽取助手，只从给定章节中提取关键事件，并返回JSON。' },
                { role: 'user', content: extractPrompt },
              ],
              response_format: { type: 'json_object' },
            });

            const raw = result.choices[0]?.message?.content;
            if (typeof raw !== 'string') continue;

            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed.events)) {
                for (const ev of parsed.events) {
                  if (!ev?.name) continue;
                  await db.createStoryEvent({
                    novelId: input.novelId,
                    userId: ctx.user.id,
                    name: String(ev.name),
                    description: ev.description || undefined,
                    timePoint: `第${chapter.chapterNumber}章`,
                    chapterId: chapter.id,
                    eventType: ev.type || 'plot',
                  });
                  eventsCreated += 1;
                }
              }
            } catch (e) {
              console.error('[Worldbuilding.timeline.initializeFromChapters] 解析失败:', e, raw.slice(0, 200));
              continue;
            }
          }

          return { chaptersProcessed, eventsCreated };
        }),

      create: protectedProcedure
        .input(z.object({
          novelId: z.number(),
          title: z.string(),
          description: z.string().optional(),
          eventTime: z.string().optional(),
          eventType: z.string().optional(),
          chapterNumber: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const created = await db.createStoryEvent({
            novelId: input.novelId,
            userId: ctx.user.id,
            name: input.title,
            description: input.description || undefined,
            timePoint: input.eventTime || undefined,
            eventType: input.eventType || undefined,
            chapterId: input.chapterNumber || undefined,
          });
          if (!created) {
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '事件创建失败' });
          }
          return created;
        }),

      update: protectedProcedure
        .input(z.object({
          id: z.number(),
          title: z.string().optional(),
          description: z.string().optional(),
          eventTime: z.string().optional(),
          eventType: z.string().optional(),
          chapterNumber: z.number().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
          const { id, title, chapterNumber, ...rest } = input;
          const updated = await db.updateStoryEvent(id, ctx.user.id, {
            ...(title && { name: title }),
            ...(chapterNumber && { chapterId: chapterNumber }),
            ...rest,
          });
          if (!updated) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '事件不存在' });
          }
          return updated;
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
          const success = await db.deleteStoryEvent(input.id, ctx.user.id);
          if (!success) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '事件不存在' });
          }
          return { success: true };
        }),
    }),
  }),

  // Chapter Generation (LangGraph)
  chapterGeneration: chapterGenerationRouter,
});

export type AppRouter = typeof appRouter;
