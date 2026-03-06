/**
 * Novel Preview Dialog Component
 * Supports pagination and single chapter reading mode
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  List,
  Settings,
  Sun,
  Moon,
  Eye,
  X,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

interface NovelPreviewDialogProps {
  novelId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialChapter?: number;
}

type ReadingTheme = 'light' | 'dark' | 'sepia';

const THEMES: Record<ReadingTheme, { bg: string; text: string; label: string }> = {
  light: { bg: 'bg-white', text: 'text-gray-900', label: '日间' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', label: '夜间' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900', label: '护眼' },
};

export function NovelPreviewDialog({
  novelId,
  open,
  onOpenChange,
  initialChapter = 1,
}: NovelPreviewDialogProps) {
  const [currentChapter, setCurrentChapter] = useState(initialChapter);
  const [viewMode, setViewMode] = useState<'single' | 'list'>('single');
  const [theme, setTheme] = useState<ReadingTheme>('light');
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [showSettings, setShowSettings] = useState(false);

  const { data: novel } = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: open }
  );

  const { data: chapters } = trpc.chapters.list.useQuery(
    { novelId },
    { enabled: open }
  );

  const sortedChapters = chapters?.slice().sort((a: { chapterNumber: number }, b: { chapterNumber: number }) => a.chapterNumber - b.chapterNumber) || [];
  const currentChapterData = sortedChapters.find((c: { chapterNumber: number }) => c.chapterNumber === currentChapter);
  const totalChapters = sortedChapters.length;

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevChapter();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextChapter();
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentChapter, totalChapters]);

  const goToPrevChapter = () => {
    if (currentChapter > 1) {
      setCurrentChapter(currentChapter - 1);
    }
  };

  const goToNextChapter = () => {
    if (currentChapter < totalChapters) {
      setCurrentChapter(currentChapter + 1);
    }
  };

  const themeStyle = THEMES[theme];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        "max-w-4xl h-[90vh] p-0 overflow-hidden",
        themeStyle.bg,
        themeStyle.text
      )}>
        <VisuallyHidden>
          <DialogHeader>
            <DialogTitle>{novel?.title || '小说预览'}</DialogTitle>
            <DialogDescription>阅读小说内容</DialogDescription>
          </DialogHeader>
        </VisuallyHidden>
        {/* Header */}
        <div className={cn(
          "flex items-center justify-between px-6 py-4 border-b",
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-4">
            <BookOpen className="h-5 w-5" />
            <div>
              <h2 className="font-semibold">{novel?.title || '小说预览'}</h2>
              {currentChapterData && viewMode === 'single' && (
                <p className="text-sm opacity-70">
                  第 {currentChapter} 章 {currentChapterData.title || ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-none h-8",
                  viewMode === 'single' && 'bg-primary/10'
                )}
                onClick={() => setViewMode('single')}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-none h-8",
                  viewMode === 'list' && 'bg-primary/10'
                )}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Settings Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className={cn(
            "px-6 py-4 border-b",
            theme === 'dark' ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'
          )}>
            <div className="flex flex-wrap items-center gap-6">
              {/* Theme Selection */}
              <div className="flex items-center gap-2">
                <span className="text-sm">主题：</span>
                <div className="flex gap-1">
                  {(Object.keys(THEMES) as ReadingTheme[]).map((t) => (
                    <Button
                      key={t}
                      variant={theme === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme(t)}
                      className="h-8"
                    >
                      {t === 'light' && <Sun className="h-3 w-3 mr-1" />}
                      {t === 'dark' && <Moon className="h-3 w-3 mr-1" />}
                      {THEMES[t].label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <div className="flex items-center gap-2">
                <span className="text-sm">字号：</span>
                <Slider
                  value={[fontSize]}
                  onValueChange={([v]) => setFontSize(v)}
                  min={12}
                  max={24}
                  step={1}
                  className="w-24"
                />
                <span className="text-sm w-8">{fontSize}</span>
              </div>

              {/* Line Height */}
              <div className="flex items-center gap-2">
                <span className="text-sm">行距：</span>
                <Slider
                  value={[lineHeight]}
                  onValueChange={([v]) => setLineHeight(v)}
                  min={1.2}
                  max={2.5}
                  step={0.1}
                  className="w-24"
                />
                <span className="text-sm w-8">{lineHeight.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'single' ? (
            /* Single Chapter View */
            <div className="h-full flex flex-col">
              <ScrollArea className="flex-1 px-8 py-6">
                {currentChapterData ? (
                  <div
                    className="max-w-2xl mx-auto"
                    style={{ fontSize: `${fontSize}px`, lineHeight }}
                  >
                    <h3 className="text-xl font-bold mb-6 text-center">
                      第 {currentChapter} 章 {currentChapterData.title || ''}
                    </h3>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {currentChapterData.content || '暂无内容'}
                    </div>
                    {currentChapterData.wordCount && (
                      <div className="mt-8 text-center opacity-50 text-sm">
                        本章共 {currentChapterData.wordCount} 字
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full opacity-50">
                    {totalChapters === 0 ? '暂无章节' : '请选择章节'}
                  </div>
                )}
              </ScrollArea>

              {/* Pagination */}
              <div className={cn(
                "flex items-center justify-between px-6 py-4 border-t",
                theme === 'dark' ? 'border-gray-700' : 'border-gray-200'
              )}>
                <Button
                  variant="outline"
                  onClick={goToPrevChapter}
                  disabled={currentChapter <= 1}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一章
                </Button>

                <div className="flex items-center gap-2">
                  <Select
                    value={currentChapter.toString()}
                    onValueChange={(v) => setCurrentChapter(parseInt(v))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedChapters.map((chapter: { id: number; chapterNumber: number; title?: string | null; content?: string | null; wordCount?: number | null; status: string }) => (
                        <SelectItem
                          key={chapter.id}
                          value={chapter.chapterNumber.toString()}
                        >
                          第 {chapter.chapterNumber} 章
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm opacity-70">
                    / {totalChapters} 章
                  </span>
                </div>

                <Button
                  variant="outline"
                  onClick={goToNextChapter}
                  disabled={currentChapter >= totalChapters}
                  className="gap-2"
                >
                  下一章
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            /* Chapter List View */
            <ScrollArea className="h-full px-6 py-4">
              <div className="space-y-2">
                {sortedChapters.length === 0 ? (
                  <div className="text-center py-8 opacity-50">暂无章节</div>
                ) : (
                  sortedChapters.map((chapter: { id: number; chapterNumber: number; title?: string | null; content?: string | null; wordCount?: number | null; status: string }) => (
                    <div
                      key={chapter.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg cursor-pointer transition-colors",
                        theme === 'dark'
                          ? 'hover:bg-gray-800'
                          : theme === 'sepia'
                          ? 'hover:bg-amber-100'
                          : 'hover:bg-gray-100',
                        currentChapter === chapter.chapterNumber && (
                          theme === 'dark'
                            ? 'bg-gray-800'
                            : theme === 'sepia'
                            ? 'bg-amber-100'
                            : 'bg-gray-100'
                        )
                      )}
                      onClick={() => {
                        setCurrentChapter(chapter.chapterNumber);
                        setViewMode('single');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">
                          第 {chapter.chapterNumber} 章
                        </Badge>
                        <span className="font-medium">
                          {chapter.title || '未命名章节'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm opacity-70">
                        <span>{chapter.wordCount || 0} 字</span>
                        <Badge
                          variant={
                            chapter.status === 'approved'
                              ? 'default'
                              : chapter.status === 'pending_review'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {chapter.status === 'approved'
                            ? '已完成'
                            : chapter.status === 'pending_review'
                            ? '待审核'
                            : '草稿'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
