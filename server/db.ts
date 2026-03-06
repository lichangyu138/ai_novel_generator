import { eq, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import mysql from "mysql2/promise";
import {
  InsertUser, users, User,
  novels, InsertNovel, Novel,
  characters, InsertCharacter, Character,
  characterRelationships, InsertCharacterRelationship, CharacterRelationship,
  outlines, InsertOutline, Outline,
  detailedOutlines, InsertDetailedOutline, DetailedOutline,
  chapters, InsertChapter, Chapter,
  generationHistory, InsertGenerationHistory, GenerationHistory,
  modelConfigs, InsertModelConfig, ModelConfig,
  knowledgeEntries, InsertKnowledgeEntry, KnowledgeEntry,
  storyEvents, InsertStoryEvent, StoryEvent,
  knowledgeGraphNodes, InsertKnowledgeGraphNode, KnowledgeGraphNode,
  knowledgeGraphEdges, InsertKnowledgeGraphEdge, KnowledgeGraphEdge,
  vectorDocuments, InsertVectorDocument, VectorDocument,
  contentVersions, InsertContentVersion, ContentVersion,
  chapterOutlines, InsertChapterOutline, ChapterOutline,
  chapterReviews, InsertChapterReview, ChapterReview,
  foreshadowing, InsertForeshadowing, Foreshadowing,
  worldbuildingLocations, WorldbuildingLocation,
  worldbuildingItems, WorldbuildingItem,
  worldbuildingOrganizations, WorldbuildingOrganization,
} from "../drizzle/schema";

let _db: any = null;

// Create MySQL pool from env vars (fallback to individual MYSQL_* vars)
function createPoolFromEnv() {
  // Prefer a single DATABASE_URL if provided (e.g., mysql://user:pass@host:port/db)
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log("[Database] Using DATABASE_URL");
    return mysql.createPool(databaseUrl);
  }

  // Fallback to individual MYSQL_* env vars
  const host = process.env.MYSQL_HOST || "10.8.6.45";
  const port = Number(process.env.MYSQL_PORT || 13306);
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "4BTFesFsCtjAWX5D";
  const database = process.env.MYSQL_DATABASE || "ai_novel_generator";

  console.log("[Database] Using fallback MYSQL_* env vars");
  console.log("[Database] Host:", host);
  console.log("[Database] Port:", port);
  console.log("[Database] User:", user);
  console.log("[Database] Database:", database);

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
  });
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db) {
    try {
      const pool = createPoolFromEnv();
      _db = drizzle(pool, {
        mode: 'default',
        schema: {
          users,
          novels,
          characters,
          characterRelationships,
          outlines,
          detailedOutlines,
          chapters,
          generationHistory,
          modelConfigs,
          knowledgeEntries,
          storyEvents,
          knowledgeGraphNodes,
          knowledgeGraphEdges,
          vectorDocuments,
          contentVersions,
          chapterOutlines,
          chapterReviews,
          foreshadowing,
          worldbuildingLocations,
          worldbuildingItems,
          worldbuildingOrganizations,
        }
      });
      console.log("[Database] Drizzle initialized successfully");
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== User Operations ====================

export async function createUser(user: InsertUser): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(users).values(user);
    const insertId = result[0].insertId;
    const created = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create user:", error);
    return null;
  }
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const db = await getDb();
  if (!db) {
    console.log("[DB Debug] Database connection not available");
    return null;
  }

  try {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    console.log("[DB Debug] Query result:", result.length > 0 ? "Found user" : "No user found");
    if (result.length > 0) {
      const user = result[0];
      console.log("[DB Debug] User object keys:", Object.keys(user));
      console.log("[DB Debug] User passwordHash:", user.passwordHash ? `${user.passwordHash.substring(0, 30)}...` : "undefined/null");
      console.log("[DB Debug] User passwordHash type:", typeof user.passwordHash);
    }
    return result[0] || null;
  } catch (error) {
    console.error("[DB Debug] Query error:", error);
    return null;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0] || null;
}

export async function updateUserLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(id: number, role: "user" | "admin"): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(users).set({ role }).where(eq(users.id, id));
  return await getUserById(id);
}

// Legacy function for OAuth compatibility
export async function upsertUser(user: InsertUser): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Check if user exists by username
    const existing = await getUserByUsername(user.username);
    if (existing) {
      // Update existing user
      await db.update(users).set({
        lastSignedIn: new Date(),
        name: user.name || existing.name,
        email: user.email || existing.email,
      }).where(eq(users.username, user.username));
    } else {
      // Create new user
      await db.insert(users).values({
        ...user,
        lastSignedIn: new Date(),
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

// ==================== Novel Operations ====================

export async function createNovel(novel: InsertNovel): Promise<Novel | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(novels).values(novel);
  const insertId = result[0].insertId;

  const created = await db.select().from(novels).where(eq(novels.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getNovelsByUserId(userId: number): Promise<Novel[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(novels).where(eq(novels.userId, userId)).orderBy(desc(novels.updatedAt));
}

export async function getNovelById(id: number, userId: number): Promise<Novel | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(novels).where(and(eq(novels.id, id), eq(novels.userId, userId))).limit(1);
  return result[0] || null;
}

export async function updateNovel(id: number, userId: number, data: Partial<InsertNovel>): Promise<Novel | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(novels).set(data).where(and(eq(novels.id, id), eq(novels.userId, userId)));
  return await getNovelById(id, userId);
}

export async function deleteNovel(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(novels).where(and(eq(novels.id, id), eq(novels.userId, userId)));
  return result[0].affectedRows > 0;
}

// ==================== Character Operations ====================

export async function createCharacter(character: InsertCharacter): Promise<Character | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(characters).values(character);
  const insertId = result[0].insertId;

  const created = await db.select().from(characters).where(eq(characters.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getCharactersByNovelId(novelId: number, userId: number): Promise<Character[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(characters).where(and(eq(characters.novelId, novelId), eq(characters.userId, userId)));
}

export async function getCharacterById(id: number, userId: number): Promise<Character | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(characters).where(and(eq(characters.id, id), eq(characters.userId, userId))).limit(1);
  return result[0] || null;
}

export async function updateCharacter(id: number, userId: number, data: Partial<InsertCharacter>): Promise<Character | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(characters).set(data).where(and(eq(characters.id, id), eq(characters.userId, userId)));
  return await getCharacterById(id, userId);
}

export async function deleteCharacter(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(characters).where(and(eq(characters.id, id), eq(characters.userId, userId)));
  return result[0].affectedRows > 0;
}

// ==================== Outline Operations ====================

export async function createOutline(outline: InsertOutline): Promise<Outline | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(outlines).values(outline);
  const insertId = result[0].insertId;

  const created = await db.select().from(outlines).where(eq(outlines.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getOutlinesByNovelId(novelId: number, userId: number): Promise<Outline[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(outlines).where(and(eq(outlines.novelId, novelId), eq(outlines.userId, userId))).orderBy(desc(outlines.version));
}

export async function getActiveOutline(novelId: number, userId: number): Promise<Outline | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(outlines).where(and(eq(outlines.novelId, novelId), eq(outlines.userId, userId), eq(outlines.isActive, 1))).limit(1);
  return result[0] || null;
}

export async function updateOutline(id: number, userId: number, data: Partial<InsertOutline>): Promise<Outline | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(outlines).set(data).where(and(eq(outlines.id, id), eq(outlines.userId, userId)));
  const result = await db.select().from(outlines).where(eq(outlines.id, id)).limit(1);
  return result[0] || null;
}

// ==================== Detailed Outline Operations ====================

export async function createDetailedOutline(detailedOutline: InsertDetailedOutline): Promise<DetailedOutline | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(detailedOutlines).values(detailedOutline);
  const insertId = result[0].insertId;

  const created = await db.select().from(detailedOutlines).where(eq(detailedOutlines.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getDetailedOutlinesByOutlineId(outlineId: number, userId: number): Promise<DetailedOutline[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(detailedOutlines).where(and(eq(detailedOutlines.outlineId, outlineId), eq(detailedOutlines.userId, userId))).orderBy(detailedOutlines.groupIndex);
}

export async function updateDetailedOutline(id: number, userId: number, data: Partial<InsertDetailedOutline>): Promise<DetailedOutline | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(detailedOutlines).set(data).where(and(eq(detailedOutlines.id, id), eq(detailedOutlines.userId, userId)));
  const result = await db.select().from(detailedOutlines).where(eq(detailedOutlines.id, id)).limit(1);
  return result[0] || null;
}

// ==================== Chapter Operations ====================

export async function createChapter(chapter: InsertChapter): Promise<Chapter | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(chapters).values(chapter);
  const insertId = result[0].insertId;

  const created = await db.select().from(chapters).where(eq(chapters.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getChaptersByNovelId(novelId: number, userId: number): Promise<Chapter[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(chapters).where(and(eq(chapters.novelId, novelId), eq(chapters.userId, userId))).orderBy(chapters.chapterNumber);
}

export async function getChapterById(id: number, userId: number): Promise<Chapter | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(chapters).where(and(eq(chapters.id, id), eq(chapters.userId, userId))).limit(1);
  return result[0] || null;
}

export async function updateChapter(id: number, userId: number, data: Partial<InsertChapter>): Promise<Chapter | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(chapters).set(data).where(and(eq(chapters.id, id), eq(chapters.userId, userId)));
  return await getChapterById(id, userId);
}

export async function deleteChapter(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(chapters).where(and(eq(chapters.id, id), eq(chapters.userId, userId)));
  return result[0].affectedRows > 0;
}

// ==================== Generation History Operations ====================

export async function createGenerationHistory(history: InsertGenerationHistory): Promise<GenerationHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(generationHistory).values(history);
  const insertId = result[0].insertId;

  const created = await db.select().from(generationHistory).where(eq(generationHistory.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getGenerationHistoryByNovelId(novelId: number, userId: number): Promise<GenerationHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(generationHistory).where(and(eq(generationHistory.novelId, novelId), eq(generationHistory.userId, userId))).orderBy(desc(generationHistory.createdAt));
}

export async function getGenerationHistoryByUserId(userId: number): Promise<GenerationHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(generationHistory).where(eq(generationHistory.userId, userId)).orderBy(desc(generationHistory.createdAt));
}

// ==================== Model Config Operations ====================

export async function createModelConfig(config: InsertModelConfig): Promise<ModelConfig | null> {
  const db = await getDb();
  if (!db) return null;

  // If this is set as default, unset other defaults first
  if (config.isDefault === 1) {
    await db.update(modelConfigs).set({ isDefault: 0 }).where(eq(modelConfigs.userId, config.userId));
  }

  const result = await db.insert(modelConfigs).values(config);
  const insertId = result[0].insertId;

  const created = await db.select().from(modelConfigs).where(eq(modelConfigs.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getModelConfigsByUserId(userId: number): Promise<ModelConfig[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(modelConfigs).where(eq(modelConfigs.userId, userId)).orderBy(desc(modelConfigs.isDefault));
}

export async function getModelConfigById(id: number, userId: number): Promise<ModelConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(modelConfigs).where(and(eq(modelConfigs.id, id), eq(modelConfigs.userId, userId))).limit(1);
  return result[0] || null;
}

export async function getDefaultModelConfig(userId: number): Promise<ModelConfig | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(modelConfigs).where(and(eq(modelConfigs.userId, userId), eq(modelConfigs.isDefault, 1))).limit(1);
  return result[0] || null;
}

export async function updateModelConfig(id: number, userId: number, data: Partial<InsertModelConfig>): Promise<ModelConfig | null> {
  const db = await getDb();
  if (!db) return null;

  // If setting as default, unset other defaults first
  if (data.isDefault === 1) {
    await db.update(modelConfigs).set({ isDefault: 0 }).where(eq(modelConfigs.userId, userId));
  }

  await db.update(modelConfigs).set(data).where(and(eq(modelConfigs.id, id), eq(modelConfigs.userId, userId)));
  return await getModelConfigById(id, userId);
}

export async function deleteModelConfig(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(modelConfigs).where(and(eq(modelConfigs.id, id), eq(modelConfigs.userId, userId)));
  return result[0].affectedRows > 0;
}


// ==================== Admin Stats Operations ====================

export async function getSystemStats(): Promise<{ users: number; novels: number; chapters: number; characters: number }> {
  const db = await getDb();
  if (!db) return { users: 0, novels: 0, chapters: 0, characters: 0 };

  const [usersCount, novelsCount, chaptersCount, charactersCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(novels),
    db.select({ count: sql<number>`count(*)` }).from(chapters),
    db.select({ count: sql<number>`count(*)` }).from(characters),
  ]);

  return {
    users: usersCount[0]?.count || 0,
    novels: novelsCount[0]?.count || 0,
    chapters: chaptersCount[0]?.count || 0,
    characters: charactersCount[0]?.count || 0,
  };
}


// ==================== Character Relationship Operations ====================

export async function createCharacterRelationship(relationship: InsertCharacterRelationship): Promise<CharacterRelationship | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.insert(characterRelationships).values(relationship);
  const insertId = result[0].insertId;

  const created = await db.select().from(characterRelationships).where(eq(characterRelationships.id, insertId)).limit(1);
  return created[0] || null;
}

export async function getCharacterRelationshipsByNovelId(novelId: number, userId: number): Promise<CharacterRelationship[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(characterRelationships).where(and(eq(characterRelationships.novelId, novelId), eq(characterRelationships.userId, userId)));
}

export async function getCharacterRelationshipsByCharacterId(characterId: number, userId: number): Promise<CharacterRelationship[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(characterRelationships).where(
    and(
      eq(characterRelationships.userId, userId),
      sql`(${characterRelationships.sourceCharacterId} = ${characterId} OR ${characterRelationships.targetCharacterId} = ${characterId})`
    )
  );
}

export async function updateCharacterRelationship(id: number, userId: number, data: Partial<InsertCharacterRelationship>): Promise<CharacterRelationship | null> {
  const db = await getDb();
  if (!db) return null;

  await db.update(characterRelationships).set(data).where(and(eq(characterRelationships.id, id), eq(characterRelationships.userId, userId)));
  const result = await db.select().from(characterRelationships).where(eq(characterRelationships.id, id)).limit(1);
  return result[0] || null;
}

export async function deleteCharacterRelationship(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const result = await db.delete(characterRelationships).where(and(eq(characterRelationships.id, id), eq(characterRelationships.userId, userId)));
  return result[0].affectedRows > 0;
}

export async function deleteCharacterRelationshipsByCharacterId(characterId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.delete(characterRelationships).where(
    and(
      eq(characterRelationships.userId, userId),
      sql`(${characterRelationships.sourceCharacterId} = ${characterId} OR ${characterRelationships.targetCharacterId} = ${characterId})`
    )
  );
  return true;
}

// ==================== Outline Clear Operations ====================

export async function deleteOutlinesByNovelId(novelId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.delete(outlines).where(and(eq(outlines.novelId, novelId), eq(outlines.userId, userId)));
  return true;
}

export async function deleteDetailedOutlinesByNovelId(novelId: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  await db.delete(detailedOutlines).where(and(eq(detailedOutlines.novelId, novelId), eq(detailedOutlines.userId, userId)));
  return true;
}

export async function getDetailedOutlinesByNovelId(novelId: number, userId: number): Promise<DetailedOutline[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(detailedOutlines).where(and(eq(detailedOutlines.novelId, novelId), eq(detailedOutlines.userId, userId))).orderBy(detailedOutlines.groupIndex);
}


// ==================== Knowledge Entry Operations ====================

export async function createKnowledgeEntry(entry: InsertKnowledgeEntry): Promise<KnowledgeEntry | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(knowledgeEntries).values(entry);
    const insertId = result[0].insertId;
    const created = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create knowledge entry:", error);
    return null;
  }
}

export async function getKnowledgeEntryById(id: number, userId: number): Promise<KnowledgeEntry | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId)))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get knowledge entry:", error);
    return null;
  }
}

export async function getKnowledgeEntriesByNovelId(novelId: number, userId: number): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.novelId, novelId), eq(knowledgeEntries.userId, userId)))
      .orderBy(desc(knowledgeEntries.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get knowledge entries:", error);
    return [];
  }
}

export async function getKnowledgeEntriesByType(novelId: number, userId: number, type: string): Promise<KnowledgeEntry[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(knowledgeEntries)
      .where(and(
        eq(knowledgeEntries.novelId, novelId),
        eq(knowledgeEntries.userId, userId),
        eq(knowledgeEntries.type, type as any)
      ))
      .orderBy(desc(knowledgeEntries.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get knowledge entries by type:", error);
    return [];
  }
}

export async function updateKnowledgeEntry(id: number, userId: number, updates: Partial<InsertKnowledgeEntry>): Promise<KnowledgeEntry | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(knowledgeEntries)
      .set(updates)
      .where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId)));
    const updated = await db.select().from(knowledgeEntries).where(eq(knowledgeEntries.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update knowledge entry:", error);
    return null;
  }
}

export async function deleteKnowledgeEntry(id: number, userId: number): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "数据库连接失败" };

  try {
    const entry = await db.query.knowledgeEntries.findFirst({
      where: and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId))
    });

    if (!entry) {
      return { success: false, error: "条目不存在" };
    }

    await db.delete(knowledgeEntries).where(and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId)));
    return { success: true };
  } catch (error) {
    console.error("[Database] Failed to delete knowledge entry:", error);
    return { success: false, error: "删除失败" };
  }
}

// ==================== Story Event Operations ====================

export async function createStoryEvent(event: InsertStoryEvent): Promise<StoryEvent | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(storyEvents).values(event);
    const insertId = result[0].insertId;
    const created = await db.select().from(storyEvents).where(eq(storyEvents.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create story event:", error);
    return null;
  }
}

export async function getStoryEventsByNovelId(novelId: number, userId: number): Promise<StoryEvent[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(storyEvents)
      .where(and(eq(storyEvents.novelId, novelId), eq(storyEvents.userId, userId)))
      .orderBy(storyEvents.chapterId);
  } catch (error) {
    console.error("[Database] Failed to get story events:", error);
    return [];
  }
}

export async function updateStoryEvent(id: number, userId: number, updates: Partial<InsertStoryEvent>): Promise<StoryEvent | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(storyEvents)
      .set(updates)
      .where(and(eq(storyEvents.id, id), eq(storyEvents.userId, userId)));
    const updated = await db.select().from(storyEvents).where(eq(storyEvents.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update story event:", error);
    return null;
  }
}

export async function deleteStoryEvent(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(storyEvents).where(and(eq(storyEvents.id, id), eq(storyEvents.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete story event:", error);
    return false;
  }
}

// ==================== Knowledge Graph Operations ====================

export async function createKnowledgeGraphNode(node: InsertKnowledgeGraphNode): Promise<KnowledgeGraphNode | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(knowledgeGraphNodes).values(node);
    const insertId = result[0].insertId;
    const created = await db.select().from(knowledgeGraphNodes).where(eq(knowledgeGraphNodes.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create knowledge graph node:", error);
    return null;
  }
}

export async function createKnowledgeGraphEdge(edge: InsertKnowledgeGraphEdge): Promise<KnowledgeGraphEdge | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(knowledgeGraphEdges).values(edge);
    const insertId = result[0].insertId;
    const created = await db.select().from(knowledgeGraphEdges).where(eq(knowledgeGraphEdges.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create knowledge graph edge:", error);
    return null;
  }
}

export async function createVectorDocument(doc: InsertVectorDocument): Promise<VectorDocument | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(vectorDocuments).values(doc);
    const insertId = result[0].insertId;
    const created = await db.select().from(vectorDocuments).where(eq(vectorDocuments.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create vector document:", error);
    return null;
  }
}

// ==================== Content Version Operations ====================

export async function createContentVersion(version: InsertContentVersion): Promise<ContentVersion | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(contentVersions).values(version);
    const insertId = result[0].insertId;
    const created = await db.select().from(contentVersions).where(eq(contentVersions.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create content version:", error);
    return null;
  }
}

export async function getContentVersions(novelId: number, userId: number, contentType: string, contentId: number): Promise<ContentVersion[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(contentVersions)
      .where(and(
        eq(contentVersions.novelId, novelId),
        eq(contentVersions.userId, userId),
        eq(contentVersions.contentType, contentType as any),
        eq(contentVersions.contentId, contentId)
      ))
      .orderBy(desc(contentVersions.version));
  } catch (error) {
    console.error("[Database] Failed to get content versions:", error);
    return [];
  }
}

export async function getContentVersionById(id: number, userId: number): Promise<ContentVersion | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(contentVersions)
      .where(and(eq(contentVersions.id, id), eq(contentVersions.userId, userId)))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get content version:", error);
    return null;
  }
}

export async function getLatestVersionNumber(novelId: number, userId: number, contentType: string, contentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ maxVersion: sql<number>`MAX(${contentVersions.version})` })
      .from(contentVersions)
      .where(and(
        eq(contentVersions.novelId, novelId),
        eq(contentVersions.userId, userId),
        eq(contentVersions.contentType, contentType as any),
        eq(contentVersions.contentId, contentId)
      ));
    return result[0]?.maxVersion || 0;
  } catch (error) {
    console.error("[Database] Failed to get latest version number:", error);
    return 0;
  }
}


// ==================== Chapter Outline (细纲) Operations ====================

export async function createChapterOutline(outline: InsertChapterOutline): Promise<ChapterOutline | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(chapterOutlines).values(outline);
    const insertId = result[0].insertId;
    const created = await db.select().from(chapterOutlines).where(eq(chapterOutlines.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create chapter outline:", error);
    return null;
  }
}

export async function getChapterOutlineByChapter(novelId: number, chapterNumber: number): Promise<ChapterOutline | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(chapterOutlines)
      .where(and(eq(chapterOutlines.novelId, novelId), eq(chapterOutlines.chapterNumber, chapterNumber)))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get chapter outline:", error);
    return null;
  }
}

export async function getChapterOutlinesByNovel(novelId: number): Promise<ChapterOutline[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(chapterOutlines)
      .where(eq(chapterOutlines.novelId, novelId))
      .orderBy(chapterOutlines.chapterNumber);
  } catch (error) {
    console.error("[Database] Failed to get chapter outlines:", error);
    return [];
  }
}

export async function updateChapterOutline(id: number, data: Partial<InsertChapterOutline>): Promise<ChapterOutline | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(chapterOutlines).set(data).where(eq(chapterOutlines.id, id));
    const updated = await db.select().from(chapterOutlines).where(eq(chapterOutlines.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update chapter outline:", error);
    return null;
  }
}

export async function deleteChapterOutline(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(chapterOutlines).where(eq(chapterOutlines.id, id));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete chapter outline:", error);
    return false;
  }
}

// ==================== Chapter Review (AI评论) Operations ====================

export async function createChapterReview(review: InsertChapterReview): Promise<ChapterReview | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(chapterReviews).values(review);
    const insertId = result[0].insertId;
    const created = await db.select().from(chapterReviews).where(eq(chapterReviews.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create chapter review:", error);
    return null;
  }
}

export async function getChapterReviewByChapter(chapterId: number): Promise<ChapterReview | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(chapterReviews)
      .where(eq(chapterReviews.chapterId, chapterId))
      .orderBy(desc(chapterReviews.createdAt))
      .limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[Database] Failed to get chapter review:", error);
    return null;
  }
}

export async function getChapterReviewsByNovel(novelId: number): Promise<ChapterReview[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(chapterReviews)
      .where(eq(chapterReviews.novelId, novelId))
      .orderBy(desc(chapterReviews.createdAt));
  } catch (error) {
    console.error("[Database] Failed to get chapter reviews:", error);
    return [];
  }
}

export async function updateChapterReview(id: number, data: Partial<InsertChapterReview>): Promise<ChapterReview | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(chapterReviews).set(data).where(eq(chapterReviews.id, id));
    const updated = await db.select().from(chapterReviews).where(eq(chapterReviews.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update chapter review:", error);
    return null;
  }
}

// ==================== Foreshadowing (伏笔) Operations ====================

export async function createForeshadowing(item: InsertForeshadowing): Promise<Foreshadowing | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.insert(foreshadowing).values(item);
    const insertId = result[0].insertId;
    const created = await db.select().from(foreshadowing).where(eq(foreshadowing.id, insertId)).limit(1);
    return created[0] || null;
  } catch (error) {
    console.error("[Database] Failed to create foreshadowing:", error);
    // 将错误继续抛出，让上层路由捕获并返回给前端
    throw error;
  }
}

export async function getForeshadowingByNovel(novelId: number): Promise<Foreshadowing[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(foreshadowing)
      .where(eq(foreshadowing.novelId, novelId))
      .orderBy(foreshadowing.setupChapterId);
  } catch (error) {
    console.error("[Database] Failed to get foreshadowing:", error);
    return [];
  }
}

export async function getPendingForeshadowing(novelId: number): Promise<Foreshadowing[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.select().from(foreshadowing)
      .where(and(eq(foreshadowing.novelId, novelId), eq(foreshadowing.status, "pending")))
      .orderBy(foreshadowing.setupChapterId);
  } catch (error) {
    console.error("[Database] Failed to get pending foreshadowing:", error);
    return [];
  }
}

export async function updateForeshadowing(id: number, data: Partial<InsertForeshadowing>): Promise<Foreshadowing | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(foreshadowing).set(data).where(eq(foreshadowing.id, id));
    const updated = await db.select().from(foreshadowing).where(eq(foreshadowing.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to update foreshadowing:", error);
    return null;
  }
}

export async function resolveForeshadowing(id: number, chapterId: number, resolutionContent: string): Promise<Foreshadowing | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(foreshadowing).set({
      status: "resolved",
      actualResolutionChapterId: chapterId,
      resolutionContent: resolutionContent,
    }).where(eq(foreshadowing.id, id));
    const updated = await db.select().from(foreshadowing).where(eq(foreshadowing.id, id)).limit(1);
    return updated[0] || null;
  } catch (error) {
    console.error("[Database] Failed to resolve foreshadowing:", error);
    return null;
  }
}

// ==================== Helper: Get Previous Chapters Summary ====================

export async function getPreviousChaptersSummary(novelId: number, beforeChapter: number, limit: number = 5): Promise<{ chapterNumber: number; title: string | null; content: string | null }[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select({
      chapterNumber: chapters.chapterNumber,
      title: chapters.title,
      content: chapters.content,
    }).from(chapters)
      .where(and(
        eq(chapters.novelId, novelId),
        sql`${chapters.chapterNumber} < ${beforeChapter}`
      ))
      .orderBy(desc(chapters.chapterNumber))
      .limit(limit);
    return result.reverse();
  } catch (error) {
    console.error("[Database] Failed to get previous chapters:", error);
    return [];
  }
}

// ==================== Helper: Get Novel Context for Generation ====================

export async function getNovelContextForGeneration(novelId: number, chapterNumber: number) {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get novel info
    const novelResult = await db.select().from(novels).where(eq(novels.id, novelId)).limit(1);
    const novel = novelResult[0];
    if (!novel) return null;

    // Get active outline
    const outlineResult = await db.select().from(outlines)
      .where(and(eq(outlines.novelId, novelId), eq(outlines.isActive, 1)))
      .limit(1);
    const outline = outlineResult[0];

    // Get characters
    const characterList = await db.select().from(characters)
      .where(eq(characters.novelId, novelId));

    // Get chapter outline if exists（当前章节已保存的细纲）
    const chapterOutlineResult = await db.select().from(chapterOutlines)
      .where(and(eq(chapterOutlines.novelId, novelId), eq(chapterOutlines.chapterNumber, chapterNumber)))
      .limit(1);
    const chapterOutline = chapterOutlineResult[0];

    // Get previous chapters (last 10)
    const previousChapters = await getPreviousChaptersSummary(novelId, chapterNumber, 10);

    // Get pending foreshadowing
    const pendingForeshadowingList = await getPendingForeshadowing(novelId);

    // Get knowledge entries（世界观：地点/物品/组织等）
    const knowledgeList = await db.select().from(knowledgeEntries)
      .where(eq(knowledgeEntries.novelId, novelId))
      .orderBy(desc(knowledgeEntries.updatedAt))
      .limit(50);

    // Get story events（时间线）
    const storyEventList = await db.select().from(storyEvents)
      .where(eq(storyEvents.novelId, novelId))
      .orderBy(storyEvents.chapterId);

    return {
      novel,
      outline,
      characters: characterList,
      chapterOutline,
      previousChapters,
      pendingForeshadowing: pendingForeshadowingList,
      storyEvents: storyEventList,
    };
  } catch (error) {
    console.error("[Database] Failed to get chapter context:", error);
    throw error;
  }
}

// ==================== Worldbuilding Operations (Separate from Knowledge Base) ====================

export async function getWorldbuildingLocationsByNovelId(novelId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.query.worldbuildingLocations.findMany({
      where: and(eq(worldbuildingLocations.novelId, novelId), eq(worldbuildingLocations.userId, userId)),
      orderBy: [worldbuildingLocations.createdAt]
    });
  } catch (error) {
    console.error("[Database] Failed to get worldbuilding locations:", error);
    return [];
  }
}

export async function createWorldbuildingLocation(data: { novelId: number; userId: number; name: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [created] = await db.insert(worldbuildingLocations).values(data);
    return await db.query.worldbuildingLocations.findFirst({
      where: eq(worldbuildingLocations.id, Number(created.insertId))
    });
  } catch (error) {
    console.error("[Database] Failed to create worldbuilding location:", error);
    return null;
  }
}

export async function updateWorldbuildingLocation(id: number, userId: number, data: { name?: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(worldbuildingLocations)
      .set(data)
      .where(and(eq(worldbuildingLocations.id, id), eq(worldbuildingLocations.userId, userId)));

    return await db.query.worldbuildingLocations.findFirst({
      where: eq(worldbuildingLocations.id, id)
    });
  } catch (error) {
    console.error("[Database] Failed to update worldbuilding location:", error);
    return null;
  }
}

export async function deleteWorldbuildingLocation(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(worldbuildingLocations).where(and(eq(worldbuildingLocations.id, id), eq(worldbuildingLocations.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete worldbuilding location:", error);
    return false;
  }
}

// Items
export async function getWorldbuildingItemsByNovelId(novelId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.query.worldbuildingItems.findMany({
      where: and(eq(worldbuildingItems.novelId, novelId), eq(worldbuildingItems.userId, userId)),
      orderBy: [worldbuildingItems.createdAt]
    });
  } catch (error) {
    console.error("[Database] Failed to get worldbuilding items:", error);
    return [];
  }
}

export async function createWorldbuildingItem(data: { novelId: number; userId: number; name: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [created] = await db.insert(worldbuildingItems).values(data);
    return await db.query.worldbuildingItems.findFirst({
      where: eq(worldbuildingItems.id, Number(created.insertId))
    });
  } catch (error) {
    console.error("[Database] Failed to create worldbuilding item:", error);
    return null;
  }
}

export async function updateWorldbuildingItem(id: number, userId: number, data: { name?: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(worldbuildingItems)
      .set(data)
      .where(and(eq(worldbuildingItems.id, id), eq(worldbuildingItems.userId, userId)));

    return await db.query.worldbuildingItems.findFirst({
      where: eq(worldbuildingItems.id, id)
    });
  } catch (error) {
    console.error("[Database] Failed to update worldbuilding item:", error);
    return null;
  }
}

export async function deleteWorldbuildingItem(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(worldbuildingItems).where(and(eq(worldbuildingItems.id, id), eq(worldbuildingItems.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete worldbuilding item:", error);
    return false;
  }
}

// Organizations
export async function getWorldbuildingOrganizationsByNovelId(novelId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db.query.worldbuildingOrganizations.findMany({
      where: and(eq(worldbuildingOrganizations.novelId, novelId), eq(worldbuildingOrganizations.userId, userId)),
      orderBy: [worldbuildingOrganizations.createdAt]
    });
  } catch (error) {
    console.error("[Database] Failed to get worldbuilding organizations:", error);
    return [];
  }
}

export async function createWorldbuildingOrganization(data: { novelId: number; userId: number; name: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    const [created] = await db.insert(worldbuildingOrganizations).values(data);
    return await db.query.worldbuildingOrganizations.findFirst({
      where: eq(worldbuildingOrganizations.id, Number(created.insertId))
    });
  } catch (error) {
    console.error("[Database] Failed to create worldbuilding organization:", error);
    return null;
  }
}

export async function updateWorldbuildingOrganization(id: number, userId: number, data: { name?: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;

  try {
    await db.update(worldbuildingOrganizations)
      .set(data)
      .where(and(eq(worldbuildingOrganizations.id, id), eq(worldbuildingOrganizations.userId, userId)));

    return await db.query.worldbuildingOrganizations.findFirst({
      where: eq(worldbuildingOrganizations.id, id)
    });
  } catch (error) {
    console.error("[Database] Failed to update worldbuilding organization:", error);
    return null;
  }
}

export async function deleteWorldbuildingOrganization(id: number, userId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db.delete(worldbuildingOrganizations).where(and(eq(worldbuildingOrganizations.id, id), eq(worldbuildingOrganizations.userId, userId)));
    return true;
  } catch (error) {
    console.error("[Database] Failed to delete worldbuilding organization:", error);
    return false;
  }
}
