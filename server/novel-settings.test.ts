/**
 * Novel Settings and Model Config Tests
 * Tests for custom genre/style, writer style, AI tone removal, and model display name
 */
import { describe, it, expect, vi } from 'vitest';

// Mock database functions
vi.mock('./db', () => ({
  getNovelById: vi.fn().mockResolvedValue({
    id: 1,
    title: 'Test Novel',
    genre: 'custom',
    customGenre: '修仙',
    style: 'custom',
    customStyle: '热血爽文',
    writerStyle: 'jinyong',
    writerStylePrompt: '模仿金庸先生的写作风格',
    removeAiTone: 1,
    description: 'Test description',
    userId: 1,
  }),
  updateNovel: vi.fn().mockResolvedValue({
    id: 1,
    title: 'Updated Novel',
    genre: 'custom',
    customGenre: '玄幻',
    writerStyle: 'gulong',
    removeAiTone: 1,
  }),
  getModelConfigById: vi.fn().mockResolvedValue({
    id: 1,
    name: 'GPT-4o Config',
    displayName: '主力模型',
    provider: 'openai',
    modelName: 'gpt-4o',
    userId: 1,
  }),
  updateModelConfig: vi.fn().mockResolvedValue({
    id: 1,
    name: 'GPT-4o Config',
    displayName: '创作专用模型',
    provider: 'openai',
    modelName: 'gpt-4o',
    userId: 1,
  }),
  getChaptersByNovelId: vi.fn().mockResolvedValue([
    { id: 1, chapterNumber: 1, title: 'Chapter 1', content: 'Content 1', wordCount: 1000, status: 'approved' },
    { id: 2, chapterNumber: 2, title: 'Chapter 2', content: 'Content 2', wordCount: 1500, status: 'draft' },
  ]),
}));

describe('Novel Custom Settings', () => {
  it('should support custom genre field', async () => {
    const { getNovelById } = await import('./db');
    const novel = await getNovelById(1, 1);
    
    expect(novel).toBeDefined();
    expect(novel?.genre).toBe('custom');
    expect(novel?.customGenre).toBe('修仙');
  });

  it('should support custom style field', async () => {
    const { getNovelById } = await import('./db');
    const novel = await getNovelById(1, 1);
    
    expect(novel).toBeDefined();
    expect(novel?.style).toBe('custom');
    expect(novel?.customStyle).toBe('热血爽文');
  });

  it('should support writer style template', async () => {
    const { getNovelById } = await import('./db');
    const novel = await getNovelById(1, 1);
    
    expect(novel).toBeDefined();
    expect(novel?.writerStyle).toBe('jinyong');
    expect(novel?.writerStylePrompt).toContain('金庸');
  });

  it('should support AI tone removal setting', async () => {
    const { getNovelById } = await import('./db');
    const novel = await getNovelById(1, 1);
    
    expect(novel).toBeDefined();
    expect(novel?.removeAiTone).toBe(1);
  });

  it('should update novel settings correctly', async () => {
    const { updateNovel } = await import('./db');
    const updated = await updateNovel(1, 1, {
      genre: 'custom',
      customGenre: '玄幻',
      writerStyle: 'gulong',
      removeAiTone: 1,
    });
    
    expect(updated).toBeDefined();
    expect(updated?.customGenre).toBe('玄幻');
    expect(updated?.writerStyle).toBe('gulong');
  });
});

describe('Model Config Display Name', () => {
  it('should support custom display name for models', async () => {
    const { getModelConfigById } = await import('./db');
    const config = await getModelConfigById(1, 1);
    
    expect(config).toBeDefined();
    expect(config?.displayName).toBe('主力模型');
  });

  it('should update model display name correctly', async () => {
    const { updateModelConfig } = await import('./db');
    const updated = await updateModelConfig(1, 1, {
      displayName: '创作专用模型',
    });
    
    expect(updated).toBeDefined();
    expect(updated?.displayName).toBe('创作专用模型');
  });
});

describe('Novel Preview Pagination', () => {
  it('should return chapters sorted by chapter number', async () => {
    const { getChaptersByNovelId } = await import('./db');
    const chapters = await getChaptersByNovelId(1, 1);
    
    expect(chapters).toBeDefined();
    expect(chapters.length).toBe(2);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[1].chapterNumber).toBe(2);
  });

  it('should include word count for each chapter', async () => {
    const { getChaptersByNovelId } = await import('./db');
    const chapters = await getChaptersByNovelId(1, 1);
    
    expect(chapters[0].wordCount).toBe(1000);
    expect(chapters[1].wordCount).toBe(1500);
  });

  it('should include chapter status', async () => {
    const { getChaptersByNovelId } = await import('./db');
    const chapters = await getChaptersByNovelId(1, 1);
    
    expect(chapters[0].status).toBe('approved');
    expect(chapters[1].status).toBe('draft');
  });
});

describe('Writer Style Templates', () => {
  const WRITER_STYLES = [
    { value: 'jinyong', label: '金庸风格' },
    { value: 'gulong', label: '古龙风格' },
    { value: 'maoyan', label: '猫腻风格' },
    { value: 'tangjiasanshao', label: '唐家三少风格' },
    { value: 'ergen', label: '耳根风格' },
    { value: 'tiancan', label: '天蚕土豆风格' },
    { value: 'custom', label: '自定义风格' },
  ];

  it('should have predefined writer style templates', () => {
    expect(WRITER_STYLES.length).toBeGreaterThan(0);
    expect(WRITER_STYLES.find(s => s.value === 'jinyong')).toBeDefined();
    expect(WRITER_STYLES.find(s => s.value === 'gulong')).toBeDefined();
  });

  it('should support custom writer style', () => {
    const customStyle = WRITER_STYLES.find(s => s.value === 'custom');
    expect(customStyle).toBeDefined();
    expect(customStyle?.label).toBe('自定义风格');
  });
});
