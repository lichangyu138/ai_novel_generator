/**
 * Tests for knowledge, events, and versions routes
 */
import { describe, it, expect } from 'vitest';
import * as db from './db';

describe('Knowledge and Events API', () => {
  // Test database functions directly since they are the core of the API
  
  describe('Knowledge Entries', () => {
    it('should have createKnowledgeEntry function', () => {
      expect(typeof db.createKnowledgeEntry).toBe('function');
    });

    it('should have getKnowledgeEntriesByNovelId function', () => {
      expect(typeof db.getKnowledgeEntriesByNovelId).toBe('function');
    });

    it('should have getKnowledgeEntriesByType function', () => {
      expect(typeof db.getKnowledgeEntriesByType).toBe('function');
    });

    it('should have updateKnowledgeEntry function', () => {
      expect(typeof db.updateKnowledgeEntry).toBe('function');
    });

    it('should have deleteKnowledgeEntry function', () => {
      expect(typeof db.deleteKnowledgeEntry).toBe('function');
    });
  });

  describe('Story Events', () => {
    it('should have createStoryEvent function', () => {
      expect(typeof db.createStoryEvent).toBe('function');
    });

    it('should have getStoryEventsByNovelId function', () => {
      expect(typeof db.getStoryEventsByNovelId).toBe('function');
    });

    it('should have updateStoryEvent function', () => {
      expect(typeof db.updateStoryEvent).toBe('function');
    });

    it('should have deleteStoryEvent function', () => {
      expect(typeof db.deleteStoryEvent).toBe('function');
    });
  });

  describe('Content Versions', () => {
    it('should have createContentVersion function', () => {
      expect(typeof db.createContentVersion).toBe('function');
    });

    it('should have getContentVersions function', () => {
      expect(typeof db.getContentVersions).toBe('function');
    });

    it('should have getContentVersionById function', () => {
      expect(typeof db.getContentVersionById).toBe('function');
    });

    it('should have getLatestVersionNumber function', () => {
      expect(typeof db.getLatestVersionNumber).toBe('function');
    });
  });

  describe('Character Relationships', () => {
    it('should have createCharacterRelationship function', () => {
      expect(typeof db.createCharacterRelationship).toBe('function');
    });

    it('should have getCharacterRelationshipsByNovelId function', () => {
      expect(typeof db.getCharacterRelationshipsByNovelId).toBe('function');
    });

    it('should have deleteCharacterRelationship function', () => {
      expect(typeof db.deleteCharacterRelationship).toBe('function');
    });
  });
});

describe('Database Schema', () => {
  it('should have knowledgeEntries table', async () => {
    // Import schema to verify table exists
    const schema = await import('../drizzle/schema');
    expect(schema.knowledgeEntries).toBeDefined();
  });

  it('should have storyEvents table', async () => {
    const schema = await import('../drizzle/schema');
    expect(schema.storyEvents).toBeDefined();
  });

  it('should have contentVersions table', async () => {
    const schema = await import('../drizzle/schema');
    expect(schema.contentVersions).toBeDefined();
  });

  it('should have characterRelationships table', async () => {
    const schema = await import('../drizzle/schema');
    expect(schema.characterRelationships).toBeDefined();
  });
});
