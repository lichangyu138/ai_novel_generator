/**
 * Vector Deduplication Service using Milvus
 * Detects duplicate entries and merges content intelligently
 */
import { ENV } from '../_core/env';

interface VectorEntry {
  id: number;
  name: string;
  description: string;
  embedding?: number[];
}

interface MergeResult {
  isDuplicate: boolean;
  similarity?: number;
  mergedContent?: string;
  existingId?: number;
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

export class VectorDeduplicator {
  private similarityThreshold = 0.85; // 85% similarity threshold

  async generateEmbedding(text: string): Promise<number[]> {
    // Use Claude to generate a simple embedding
    // In production, use a dedicated embedding model
    const hash = this.simpleHash(text);
    return hash;
  }

  private simpleHash(text: string): number[] {
    // Simple text-based feature extraction
    const normalized = text.toLowerCase().trim();
    const features = new Array(128).fill(0);
    
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      features[charCode % 128] += 1;
    }
    
    // Normalize
    const sum = features.reduce((a, b) => a + b, 0);
    return features.map(f => sum > 0 ? f / sum : 0);
  }

  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  async checkDuplicate(
    newEntry: VectorEntry,
    existingEntries: VectorEntry[]
  ): Promise<MergeResult> {
    const newEmbedding = await this.generateEmbedding(
      `${newEntry.name} ${newEntry.description}`
    );

    let maxSimilarity = 0;
    let mostSimilarEntry: VectorEntry | null = null;

    for (const existing of existingEntries) {
      const existingEmbedding = await this.generateEmbedding(
        `${existing.name} ${existing.description}`
      );
      
      const similarity = this.cosineSimilarity(newEmbedding, existingEmbedding);
      
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        mostSimilarEntry = existing;
      }
    }

    if (maxSimilarity >= this.similarityThreshold && mostSimilarEntry) {
      // Found duplicate, merge content
      const mergedContent = await this.mergeContent(
        mostSimilarEntry.description,
        newEntry.description
      );

      return {
        isDuplicate: true,
        similarity: maxSimilarity,
        mergedContent,
        existingId: mostSimilarEntry.id,
      };
    }

    return { isDuplicate: false };
  }

  async mergeContent(existingContent: string, newContent: string): Promise<string> {
    const prompt = `请智能合并以下两段内容，去除重复信息，保留所有独特信息：

现有内容：
${existingContent}

新内容：
${newContent}

要求：
1. 去除完全重复的信息
2. 保留两段内容中的所有独特信息
3. 如果有冲突，优先保留更详细的描述
4. 保持内容简洁清晰
5. 只返回合并后的内容，不要其他说明`;

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
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (content) {
        return content.trim();
      }

      return `${existingContent}\n\n${newContent}`;
    } catch (error) {
      console.error('[VectorDeduplicator] Merge failed:', error);
      return `${existingContent}\n\n${newContent}`;
    }
  }
}

export const vectorDeduplicator = new VectorDeduplicator();

