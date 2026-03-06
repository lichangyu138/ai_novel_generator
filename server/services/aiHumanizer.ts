/**
 * AI Humanizer Service - Reduces AI detection rate
 */
import { ENV } from '../_core/env';

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

export class AIHumanizer {
  async humanizeText(text: string): Promise<string> {
    const prompt = `请将以下AI生成的文本改写，使其更加自然、人性化，降低AI特征：

原文：
${text}

要求：
1. 保持原意和故事情节不变
2. 增加更多细节描写和情感表达
3. 使用更多样化的句式结构
4. 添加一些口语化表达和自然的语言习惯
5. 减少过于工整、模板化的表达
6. 增加一些不完美的、更真实的描写
7. 保持段落结构，但可以调整句子长度和节奏
8. 不要添加任何说明，直接返回改写后的文本

改写后的文本：`;

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
        max_tokens: 8000,
        temperature: 0.9, // 提高温度增加随机性
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

      return text;
    } catch (error) {
      console.error('[AIHumanizer] Humanization failed:', error);
      return text;
    }
  }

  async humanizeInChunks(text: string, chunkSize: number = 2000): Promise<string> {
    // Split text into paragraphs
    const paragraphs = text.split('\n\n');
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + para).length > chunkSize && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = para;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + para;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    // Humanize each chunk
    const humanizedChunks = await Promise.all(
      chunks.map(chunk => this.humanizeText(chunk))
    );

    return humanizedChunks.join('\n\n');
  }
}

export const aiHumanizer = new AIHumanizer();

