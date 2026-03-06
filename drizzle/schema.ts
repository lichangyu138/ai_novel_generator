import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Username for local authentication */
  username: varchar("username", { length: 64 }).notNull().unique(),
  /** Password hash for local authentication */
  passwordHash: varchar("password_hash", { length: 255 }),
  /** Manus OAuth identifier (openId) - optional for OAuth users */
  openId: varchar("open_id", { length: 64 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Novels table - stores novel projects
 */
export const novels = mysqlTable("novels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  genre: varchar("genre", { length: 64 }),
  style: varchar("style", { length: 64 }),
  description: text("description"),
  prompt: text("prompt"),
  worldSetting: text("world_setting"),
  writerStyle: text("writer_style"), // 作家描写风格 (数据库中是 text 类型)
  removeAiTone: int("remove_ai_taste").default(0), // 去AI味开关
  status: mysqlEnum("status", ["draft", "writing", "completed"]).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Novel = typeof novels.$inferSelect;
export type InsertNovel = typeof novels.$inferInsert;

/**
 * Characters table - stores character settings
 */
/**
 * CharacterRelationships table - stores relationships between characters
 */
export const characterRelationships = mysqlTable("characterrelationships", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  sourceCharacterId: int("source_character_id").notNull(),
  targetCharacterId: int("target_character_id").notNull(),
  relationshipType: varchar("relationship_type", { length: 64 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type CharacterRelationship = typeof characterRelationships.$inferSelect;
export type InsertCharacterRelationship = typeof characterRelationships.$inferInsert;

/**
 * Characters table - stores character settings
 */
export const characters = mysqlTable("characters", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  gender: mysqlEnum("gender", ["male", "female", "other"]).default("male"),
  role: varchar("role", { length: 64 }),
  personality: text("personality"),
  background: text("background"),
  appearance: text("appearance"),
  abilities: text("abilities"),
  relationships: text("relationships"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = typeof characters.$inferInsert;

/**
 * Outlines table - stores novel outlines
 */
export const outlines = mysqlTable("outlines", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  version: int("version").default(1).notNull(),
  content: text("content"),
  isActive: int("is_active").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Outline = typeof outlines.$inferSelect;
export type InsertOutline = typeof outlines.$inferInsert;

/**
 * DetailedOutlines table - stores detailed outlines (5 chapters per group)
 */
export const detailedOutlines = mysqlTable("detailedoutlines", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  outlineId: int("outline_id").notNull(),
  groupIndex: int("group_index").notNull(),
  startChapter: int("start_chapter").notNull(),
  endChapter: int("end_chapter").notNull(),
  content: text("content"),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type DetailedOutline = typeof detailedOutlines.$inferSelect;
export type InsertDetailedOutline = typeof detailedOutlines.$inferInsert;

/**
 * Chapters table - stores chapter content
 */
export const chapters = mysqlTable("chapters", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  chapterNumber: int("chapter_number").notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  wordCount: int("word_count").default(0),
  status: mysqlEnum("status", ["draft", "pending_review", "approved", "rejected"]).default("draft").notNull(),
  reviewNotes: text("review_notes"),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;

/**
 * GenerationHistory table - stores all AI generation history
 */
export const generationHistory = mysqlTable("generationhistory", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  type: mysqlEnum("type", ["outline", "detailed_outline", "chapter", "revision"]).notNull(),
  targetId: int("target_id"),
  prompt: text("prompt"),
  result: text("result"),
  modelUsed: varchar("model_used", { length: 128 }),
  tokensUsed: int("tokens_used"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GenerationHistory = typeof generationHistory.$inferSelect;
export type InsertGenerationHistory = typeof generationHistory.$inferInsert;

/**
 * ModelConfigs table - stores AI model configurations
 */
export const modelConfigs = mysqlTable("modelconfigs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  displayName: varchar("display_name", { length: 128 }), // 自定义显示名称
  provider: varchar("provider", { length: 64 }).notNull(),
  apiKey: text("api_key"),
  apiBase: varchar("api_base", { length: 512 }),
  modelName: varchar("model_name", { length: 128 }),
  temperature: varchar("temperature", { length: 10 }).default("0.7"),
  topP: varchar("top_p", { length: 10 }).default("0.9"),
  maxTokens: int("max_tokens").default(4096),
  isDefault: int("is_default").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type InsertModelConfig = typeof modelConfigs.$inferInsert;


/**
 * KnowledgeEntries table - stores knowledge base entries extracted from chapters
 */
export const knowledgeEntries = mysqlTable("knowledgeentries", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  type: varchar("category", { length: 64 }).notNull(), // 数据库字段名是 category
  name: varchar("title", { length: 255 }).notNull(), // 数据库字段名是 title
  description: text("content"), // 数据库字段名是 content
  sourceChapterId: int("source_chapter_id"),
  isAutoExtracted: int("is_auto_extracted").default(0), // 数据库字段名是 is_auto_extracted
  syncedToWorldbuilding: int("synced_to_worldbuilding").default(0),
  worldbuildingId: int("worldbuilding_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type InsertKnowledgeEntry = typeof knowledgeEntries.$inferInsert;

/**
 * StoryEvents table - stores story events for timeline
 */
export const storyEvents = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  timePoint: varchar("event_time", { length: 128 }), // e.g., "Chapter 1", "Day 1", etc.
  chapterId: int("chapter_id"),
  relatedCharacterIds: text("related_character_ids"), // JSON array of character IDs
  eventType: varchar("event_type", { length: 50 }), // 数据库中没有 enum，使用 varchar
  importance: int("importance").default(1), // 1-5 scale
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type StoryEvent = typeof storyEvents.$inferSelect;
export type InsertStoryEvent = typeof storyEvents.$inferInsert;

/**
 * Knowledge Graph Nodes - stores extracted knowledge graph entities (separate from worldbuilding)
 */
export const knowledgeGraphNodes = mysqlTable("knowledge_graph_nodes", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  nodeType: varchar("node_type", { length: 64 }).notNull(), // character|location|item|organization|event|...
  name: varchar("name", { length: 255 }).notNull(),
  content: text("content"), // description / extra info
  sourceChapterId: int("source_chapter_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeGraphNode = typeof knowledgeGraphNodes.$inferSelect;
export type InsertKnowledgeGraphNode = typeof knowledgeGraphNodes.$inferInsert;

/**
 * Knowledge Graph Edges - stores relationships between entities
 */
export const knowledgeGraphEdges = mysqlTable("knowledge_graph_edges", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  sourceNodeId: int("source_node_id").notNull(),
  targetNodeId: int("target_node_id").notNull(),
  relationType: varchar("relation_type", { length: 64 }).notNull(),
  description: text("description"),
  sourceChapterId: int("source_chapter_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeGraphEdge = typeof knowledgeGraphEdges.$inferSelect;
export type InsertKnowledgeGraphEdge = typeof knowledgeGraphEdges.$inferInsert;

/**
 * Vector Documents - raw texts for vector DB ingestion (store now, embed later)
 */
export const vectorDocuments = mysqlTable("vector_documents", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  sourceType: varchar("source_type", { length: 64 }).notNull(), // kg_node|kg_edge|chapter|outline|...
  sourceId: int("source_id"),
  text: text("text").notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type VectorDocument = typeof vectorDocuments.$inferSelect;
export type InsertVectorDocument = typeof vectorDocuments.$inferInsert;

/**
 * ContentVersions table - stores version history for chapters and outlines
 */
export const contentVersions = mysqlTable("content_versions", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  contentType: varchar("content_type", { length: 50 }).notNull(), // 数据库中是 varchar，不是 enum
  contentId: int("content_id").notNull(),
  version: int("version_number").notNull(),
  content: text("content"),
  changeDescription: varchar("change_summary", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContentVersion = typeof contentVersions.$inferSelect;
export type InsertContentVersion = typeof contentVersions.$inferInsert;


/**
 * ChapterOutlines table - stores individual chapter outlines (细纲)
 * Each chapter has its own detailed outline with ~2000 words
 */
export const chapterOutlines = mysqlTable("chapteroutlines", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novelId").notNull(), // 数据库中使用驼峰
  userId: int("userId").notNull(), // 数据库中使用驼峰
  chapterNumber: int("chapterNumber").notNull(), // 数据库中使用驼峰
  // 前文总结
  previousSummary: text("previousSummary"), // 数据库中使用驼峰
  // 本章剧情发展
  plotDevelopment: text("plotDevelopment"), // 数据库中使用驼峰
  // 人物动态
  characterDynamics: text("characterDynamics"), // 数据库中使用驼峰
  // 场景描述
  sceneDescription: text("sceneDescription"), // 数据库中使用驼峰
  // 关键对话要点
  dialoguePoints: text("keyPoints"), // 数据库字段名是 keyPoints
  // 伏笔设置 - 数据库中没有此字段
  foreshadowing: text("foreshadowing"), // 保留但不使用
  // 完整细纲内容
  fullContent: text("fullContent"), // 数据库中使用驼峰
  // wordCount 字段已从数据库移除，不再使用
  version: int("version").default(1).notNull(), // 数据库中使用驼峰
  createdAt: timestamp("createdAt").defaultNow().notNull(), // 数据库中使用驼峰
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), // 数据库中使用驼峰
});

export type ChapterOutline = typeof chapterOutlines.$inferSelect;
export type InsertChapterOutline = typeof chapterOutlines.$inferInsert;

/**
 * ChapterReviews table - stores AI reviews for generated chapters
 */
export const chapterReviews = mysqlTable("chapterreviews", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novelId").notNull(),
  userId: int("userId").notNull(),
  chapterId: int("chapterId").notNull(),
  qualityScore: int("qualityScore").default(0),
  plotSummary: text("plotSummary"),
  openingDescription: text("openingDescription"),
  middleDescription: text("middleDescription"),
  endingDescription: text("endingDescription"),
  keyIssues: text("keyIssues"),
  qualityComment: text("qualityAnalysis"),
  outlineDeviationAnalysis: text("outlineDeviation"),
  chapterOutlineDeviationAnalysis: text("detailedOutlineDeviation"),
  futureSuggestions: text("futureSuggestions"),
  foreshadowingMarkers: text("foreshadowingNotes"),
  overallComment: text("overallComment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ChapterReview = typeof chapterReviews.$inferSelect;
export type InsertChapterReview = typeof chapterReviews.$inferInsert;

/**
 * Foreshadowing table - tracks foreshadowing elements across chapters
 */
export const foreshadowing = mysqlTable("foreshadowing", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  // 伏笔内容
  content: text("description").notNull(), // 数据库字段名是 description
  // 设置章节
  setupChapterId: int("chapter_id").notNull(), // 数据库字段名是 chapter_id
  // 计划回收章节 - 数据库中没有此字段
  plannedResolutionChapter: int("plannedResolutionChapter"), // 保留但不使用
  // 实际回收章节
  actualResolutionChapterId: int("resolved_chapter_id"), // 数据库字段名是 resolved_chapter_id
  // 回收内容
  resolutionContent: text("resolved_description"), // 数据库字段名是 resolved_description
  // 状态
  status: mysqlEnum("status", ["pending", "resolved"]).default("pending").notNull(), // 数据库中没有 abandoned
  // importance 字段已从数据库移除，不再使用
  // relatedCharacterIds 字段已从数据库移除，不再使用
  // 标题 - 数据库中有此字段
  title: varchar("title", { length: 255 }), // 添加数据库中的 title 字段
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

/**
 * Worldbuilding tables - separate from knowledge base
 */
export const worldbuildingLocations = mysqlTable("worldbuilding_locations", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const worldbuildingItems = mysqlTable("worldbuilding_items", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const worldbuildingOrganizations = mysqlTable("worldbuilding_organizations", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novel_id").notNull(),
  userId: int("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type WorldbuildingLocation = typeof worldbuildingLocations.$inferSelect;
export type WorldbuildingItem = typeof worldbuildingItems.$inferSelect;
export type WorldbuildingOrganization = typeof worldbuildingOrganizations.$inferSelect;
export type Foreshadowing = typeof foreshadowing.$inferSelect;
export type InsertForeshadowing = typeof foreshadowing.$inferInsert;
