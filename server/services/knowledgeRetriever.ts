/**
 * Knowledge Retrieval Service
 * Retrieves relevant knowledge from knowledge base for chapter generation
 */
import * as db from '../db';
import { vectorDeduplicator } from './vectorDeduplicator';

interface RetrievalContext {
  characters: string[];
  locations: string[];
  items: string[];
  events: string[];
  organizations: string[];
}

export class KnowledgeRetriever {
  async retrieveForChapter(
    novelId: number,
    userId: number,
    chapterNumber: number,
    outlineContent: string
  ): Promise<RetrievalContext> {
    // Get all knowledge entries for this novel
    const allEntries = await db.getKnowledgeEntriesByNovelId(novelId, userId);

    // Generate embedding for the outline
    const outlineEmbedding = await vectorDeduplicator.generateEmbedding(outlineContent);

    // Score each entry by relevance
    const scoredEntries = await Promise.all(
      allEntries.map(async (entry) => {
        const entryEmbedding = await vectorDeduplicator.generateEmbedding(
          `${entry.name} ${entry.description || ''}`
        );
        const similarity = vectorDeduplicator.cosineSimilarity(outlineEmbedding, entryEmbedding);
        return { entry, similarity };
      })
    );

    // Filter by relevance threshold (>= 0.3)
    const relevantEntries = scoredEntries
      .filter(({ similarity }) => similarity >= 0.3)
      .sort((a, b) => b.similarity - a.similarity);

    // Group by type
    const context: RetrievalContext = {
      characters: [],
      locations: [],
      items: [],
      events: [],
      organizations: [],
    };

    for (const { entry } of relevantEntries) {
      const info = `${entry.name}: ${entry.description || ''}`;
      
      switch (entry.type) {
        case 'character':
          if (context.characters.length < 10) context.characters.push(info);
          break;
        case 'location':
          if (context.locations.length < 5) context.locations.push(info);
          break;
        case 'item':
          if (context.items.length < 5) context.items.push(info);
          break;
        case 'event':
          if (context.events.length < 10) context.events.push(info);
          break;
        case 'organization':
          if (context.organizations.length < 5) context.organizations.push(info);
          break;
      }
    }

    return context;
  }

  formatContextForPrompt(context: RetrievalContext): string {
    const sections: string[] = [];

    if (context.characters.length > 0) {
      sections.push(`**相关人物：**\n${context.characters.map(c => `- ${c}`).join('\n')}`);
    }

    if (context.locations.length > 0) {
      sections.push(`**相关地点：**\n${context.locations.map(l => `- ${l}`).join('\n')}`);
    }

    if (context.items.length > 0) {
      sections.push(`**相关物品：**\n${context.items.map(i => `- ${i}`).join('\n')}`);
    }

    if (context.events.length > 0) {
      sections.push(`**相关事件：**\n${context.events.map(e => `- ${e}`).join('\n')}`);
    }

    if (context.organizations.length > 0) {
      sections.push(`**相关组织：**\n${context.organizations.map(o => `- ${o}`).join('\n')}`);
    }

    if (sections.length === 0) {
      return '';
    }

    return `\n\n## 知识库上下文\n\n${sections.join('\n\n')}`;
  }
}

export const knowledgeRetriever = new KnowledgeRetriever();

