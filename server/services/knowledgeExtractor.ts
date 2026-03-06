/**
 * Knowledge Extractor Service
 * Automatically extracts entities from generated chapters
 */
import { ENV } from '../_core/env';
import * as db from '../db';

interface ExtractedEntity {
  type: 'character' | 'location' | 'item' | 'event' | 'organization';
  name: string;
  description: string;
  mentions: string[];
}

interface ExtractionResult {
  characters: ExtractedEntity[];
  locations: ExtractedEntity[];
  items: ExtractedEntity[];
  events: ExtractedEntity[];
  organizations: ExtractedEntity[];
}

const resolveApiUrl = () => {
  const base = (ENV.forgeApiUrl || "").trim();
  if (!base) {
    return "https://forge.manus.im/v1/chat/completions";
  }
  if (/chat\/completions$/i.test(base)) {
    return base;
  }
  return `${base.replace(/\/$/, "")}/v1/chat/completions`;
};

export class KnowledgeExtractor {

  async extractFromChapter(
    chapterContent: string,
    chapterNumber: number
  ): Promise<ExtractionResult> {
    const prompt = `请从以下章节内容中提取关键信息，以JSON格式返回：

章节内容：
${chapterContent}

请提取：
1. 人物（characters）：出现的人物名称、简短描述、在文中的提及片段
2. 地点（locations）：出现的地点名称、描述、提及片段
3. 物品（items）：重要物品名称、描述、提及片段
4. 事件（events）：重要事件名称、描述、提及片段
5. 组织（organizations）：组织/势力名称、描述、提及片段

返回格式：
{
  "characters": [{"name": "张三", "description": "主角，年轻剑客", "mentions": ["张三拔出长剑"]}],
  "locations": [{"name": "青云山", "description": "修仙圣地", "mentions": ["来到青云山脚下"]}],
  "items": [{"name": "玄铁剑", "description": "神兵利器", "mentions": ["手持玄铁剑"]}],
  "events": [{"name": "比武大会", "description": "年度盛事", "mentions": ["参加比武大会"]}],
  "organizations": [{"name": "青云门", "description": "修仙门派", "mentions": ["青云门弟子"]}]
}

只返回JSON，不要其他说明。`;

    try {
      const response = await fetch(resolveApiUrl(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-3-pro-preview",
          messages: [
            {
          role: 'user',
          content: prompt
            }
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return this.getEmptyResult();
    } catch (error) {
      console.error('[KnowledgeExtractor] Extraction failed:', error);
      return this.getEmptyResult();
    }
  }

  async saveToKnowledgeBase(
    novelId: number,
    userId: number,
    chapterId: number,
    extraction: ExtractionResult
  ): Promise<void> {
    const allEntities = [
      ...extraction.characters.map(e => ({ ...e, type: 'character' as const })),
      ...extraction.locations.map(e => ({ ...e, type: 'location' as const })),
      ...extraction.items.map(e => ({ ...e, type: 'item' as const })),
      ...extraction.events.map(e => ({ ...e, type: 'event' as const })),
      ...extraction.organizations.map(e => ({ ...e, type: 'organization' as const })),
    ];

    for (const entity of allEntities) {
      try {
        await db.createKnowledgeEntry({
          novelId,
          userId,
          type: entity.type,
          name: entity.name,
          description: entity.description,
          sourceChapterId: chapterId,
          isAutoExtracted: 1,
          metadata: JSON.stringify({
            mentions: entity.mentions,
            extractedAt: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error(`[KnowledgeExtractor] Failed to save ${entity.type} ${entity.name}:`, error);
      }
    }
  }

  private getEmptyResult(): ExtractionResult {
    return {
      characters: [],
      locations: [],
      items: [],
      events: [],
      organizations: [],
    };
  }
}

export const knowledgeExtractor = new KnowledgeExtractor();

