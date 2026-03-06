/**
 * Export utilities for chapters
 */

export function exportChapterToTxt(chapter: any): void {
  const content = `${chapter.title || `第${chapter.chapterNumber}章`}\n\n${chapter.content || ''}`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `第${chapter.chapterNumber}章-${chapter.title || '未命名'}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAllChaptersToTxt(chapters: any[], novelTitle: string): void {
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  
  const content = sortedChapters
    .map(chapter => {
      const title = chapter.title || `第${chapter.chapterNumber}章`;
      return `${title}\n\n${chapter.content || ''}\n\n`;
    })
    .join('\n');

  const fullContent = `${novelTitle}\n${'='.repeat(novelTitle.length * 2)}\n\n${content}`;
  
  const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${novelTitle}-全文.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportSelectedChaptersToTxt(chapters: any[], novelTitle: string): void {
  const sortedChapters = [...chapters].sort((a, b) => a.chapterNumber - b.chapterNumber);
  
  const content = sortedChapters
    .map(chapter => {
      const title = chapter.title || `第${chapter.chapterNumber}章`;
      return `${title}\n\n${chapter.content || ''}\n\n`;
    })
    .join('\n');

  const fullContent = `${novelTitle}\n${'='.repeat(novelTitle.length * 2)}\n\n${content}`;
  
  const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  link.download = `${novelTitle}-选中章节.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportAllOutlinesToTxt(outlines: any[], novelTitle: string): void {
  const sortedOutlines = [...outlines].sort((a, b) => a.chapterNumber - b.chapterNumber);

  const content = sortedOutlines
    .map(outline => {
      let text = `第${outline.chapterNumber}章 细纲\n${'='.repeat(20)}\n\n`;

      if (outline.previousSummary) {
        text += `【前文总结】\n${outline.previousSummary}\n\n`;
      }
      if (outline.plotDevelopment) {
        text += `【剧情发展】\n${outline.plotDevelopment}\n\n`;
      }
      if (outline.characterDynamics) {
        text += `【人物动态】\n${outline.characterDynamics}\n\n`;
      }
      if (outline.sceneDescription) {
        text += `【场景描述】\n${outline.sceneDescription}\n\n`;
      }
      if (outline.keyPoints) {
        text += `【关键要点】\n${outline.keyPoints}\n\n`;
      }
      if (outline.fullContent) {
        text += `【完整细纲】\n${outline.fullContent}\n\n`;
      }

      return text;
    })
    .join('\n' + '='.repeat(50) + '\n\n');

  const fullContent = `${novelTitle} - 章节细纲\n${'='.repeat(novelTitle.length * 2 + 10)}\n\n${content}`;

  const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${novelTitle}-全部细纲.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

