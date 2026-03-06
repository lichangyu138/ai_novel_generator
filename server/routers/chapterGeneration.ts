/**
 * Chapter Generation tRPC Router (LangGraph)
 */
import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { COOKIE_NAME } from '@shared/const';

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

// Log configuration on module load
console.log('[ChapterGeneration] Python API URL:', PYTHON_API_URL);

export const chapterGenerationRouter = router({
  // 生成细纲
  generateOutline: protectedProcedure
    .input(z.object({
      novelId: z.number(),
      chapterNumber: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 从 cookie 中获取 token
      const cookies = ctx.req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) || {};

      const token = cookies[COOKIE_NAME];

      let response: Response;
      try {
        response = await fetch(`${PYTHON_API_URL}/api/chapter-generation/outline`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            novel_id: input.novelId,
            chapter_number: input.chapterNumber,
          }),
        });
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error 
          ? fetchError.message 
          : '网络连接失败';
        console.error('[ChapterGeneration] Fetch error:', {
          url: `${PYTHON_API_URL}/api/chapter-generation/outline`,
          error: errorMessage,
          novelId: input.novelId,
          chapterNumber: input.chapterNumber,
        });
        throw new Error(
          `无法连接到Python后端服务 (${PYTHON_API_URL})。请确保Python后端正在运行。错误: ${errorMessage}`
        );
      }

      if (!response.ok) {
        let errorMessage = '细纲生成失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = `细纲生成失败 (${response.status}): ${text.slice(0, 200)}`;
          }
        } catch (e) {
          errorMessage = `细纲生成失败 (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    }),

  // 生成章节内容
  generateContent: protectedProcedure
    .input(z.object({
      novelId: z.number(),
      chapterNumber: z.number(),
      targetWordCount: z.number().default(5000),
    }))
    .mutation(async ({ input, ctx }) => {
      // 从 cookie 中获取 token
      const cookies = ctx.req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) || {};

      const token = cookies[COOKIE_NAME];

      let response: Response;
      try {
        response = await fetch(`${PYTHON_API_URL}/api/chapter-generation/content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            novel_id: input.novelId,
            chapter_number: input.chapterNumber,
            target_word_count: input.targetWordCount,
          }),
        });
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error 
          ? fetchError.message 
          : '网络连接失败';
        console.error('[ChapterGeneration] Fetch error:', {
          url: `${PYTHON_API_URL}/api/chapter-generation/content`,
          error: errorMessage,
          novelId: input.novelId,
          chapterNumber: input.chapterNumber,
        });
        throw new Error(
          `无法连接到Python后端服务 (${PYTHON_API_URL})。请确保Python后端正在运行。错误: ${errorMessage}`
        );
      }

      if (!response.ok) {
        let errorMessage = '章节生成失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = `章节生成失败 (${response.status}): ${text.slice(0, 200)}`;
          }
        } catch (e) {
          errorMessage = `章节生成失败 (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    }),

  // 批量生成细纲
  batchGenerateOutlines: protectedProcedure
    .input(z.object({
      novelId: z.number(),
      startChapter: z.number(),
      endChapter: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookies = ctx.req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) || {};

      const token = cookies[COOKIE_NAME];

      let response: Response;
      try {
        response = await fetch(`${PYTHON_API_URL}/api/chapter-generation/batch-outlines`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            novel_id: input.novelId,
            start_chapter: input.startChapter,
            end_chapter: input.endChapter,
          }),
        });
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error 
          ? fetchError.message 
          : '网络连接失败';
        console.error('[ChapterGeneration] Fetch error:', {
          url: `${PYTHON_API_URL}/api/chapter-generation/batch-outlines`,
          error: errorMessage,
          novelId: input.novelId,
          startChapter: input.startChapter,
          endChapter: input.endChapter,
        });
        throw new Error(
          `无法连接到Python后端服务 (${PYTHON_API_URL})。请确保Python后端正在运行。错误: ${errorMessage}`
        );
      }

      if (!response.ok) {
        let errorMessage = '批量生成细纲失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = `批量生成细纲失败 (${response.status}): ${text.slice(0, 200)}`;
          }
        } catch (e) {
          errorMessage = `批量生成细纲失败 (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    }),

  // 批量生成章节内容
  batchGenerateContent: protectedProcedure
    .input(z.object({
      novelId: z.number(),
      startChapter: z.number(),
      endChapter: z.number(),
      targetWordCount: z.number().default(5000),
    }))
    .mutation(async ({ input, ctx }) => {
      const cookies = ctx.req.headers.cookie?.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>) || {};

      const token = cookies[COOKIE_NAME];

      let response: Response;
      try {
        response = await fetch(`${PYTHON_API_URL}/api/chapter-generation/batch-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            novel_id: input.novelId,
            start_chapter: input.startChapter,
            end_chapter: input.endChapter,
            target_word_count: input.targetWordCount,
          }),
        });
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error 
          ? fetchError.message 
          : '网络连接失败';
        console.error('[ChapterGeneration] Fetch error:', {
          url: `${PYTHON_API_URL}/api/chapter-generation/batch-content`,
          error: errorMessage,
          novelId: input.novelId,
          startChapter: input.startChapter,
          endChapter: input.endChapter,
        });
        throw new Error(
          `无法连接到Python后端服务 (${PYTHON_API_URL})。请确保Python后端正在运行。错误: ${errorMessage}`
        );
      }

      if (!response.ok) {
        let errorMessage = '批量生成章节内容失败';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            errorMessage = error.detail || error.message || errorMessage;
          } else {
            const text = await response.text();
            errorMessage = `批量生成章节内容失败 (${response.status}): ${text.slice(0, 200)}`;
          }
        } catch (e) {
          errorMessage = `批量生成章节内容失败 (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      return await response.json();
    }),
});

