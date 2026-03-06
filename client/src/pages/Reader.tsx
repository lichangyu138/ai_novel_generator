/**
 * Reader Page - Immersive reading mode with export functionality
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Download,
  Moon,
  Sun,
  Loader2,
  List,
  X,
  Home,
  Type,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ThemeMode = 'light' | 'dark' | 'sepia';

const themeStyles: Record<ThemeMode, { bg: string; text: string; name: string }> = {
  light: { bg: 'bg-white', text: 'text-gray-900', name: '日间模式' },
  dark: { bg: 'bg-gray-900', text: 'text-gray-100', name: '夜间模式' },
  sepia: { bg: 'bg-amber-50', text: 'text-amber-900', name: '护眼模式' },
};

export default function Reader() {
  const params = useParams<{ id: string; chapterId?: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const novelId = parseInt(params.id || '0');
  const initialChapterId = params.chapterId ? parseInt(params.chapterId) : null;

  // Reading settings
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  // tRPC queries
  const novelQuery = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const chaptersQuery = trpc.chapters.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  // Find initial chapter index
  useEffect(() => {
    if (chaptersQuery.data && initialChapterId) {
      const index = chaptersQuery.data.findIndex(c => c.id === initialChapterId);
      if (index >= 0) setCurrentChapterIndex(index);
    }
  }, [chaptersQuery.data, initialChapterId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        goToPrevChapter();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        goToNextChapter();
      } else if (e.key === 'Escape') {
        if (isFullscreen) toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentChapterIndex, isFullscreen]);

  const chapters = chaptersQuery.data || [];
  const currentChapter = chapters[currentChapterIndex];

  const goToPrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      window.scrollTo(0, 0);
    }
  };

  const goToNextChapter = () => {
    if (currentChapterIndex < chapters.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      window.scrollTo(0, 0);
    }
  };

  const goToChapter = (index: number) => {
    setCurrentChapterIndex(index);
    setShowToc(false);
    window.scrollTo(0, 0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const exportToMarkdown = () => {
    if (!novelQuery.data || !chapters.length) return;

    const novel = novelQuery.data;
    let markdown = `# ${novel.title}\n\n`;
    
    if (novel.description) {
      markdown += `> ${novel.description}\n\n`;
    }

    markdown += `---\n\n`;

    chapters.forEach((chapter) => {
      markdown += `## ${chapter.title || `第${chapter.chapterNumber}章`}\n\n`;
      markdown += `${chapter.content || ''}\n\n`;
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novel.title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  const exportCurrentChapter = () => {
    if (!currentChapter || !novelQuery.data) return;

    const novel = novelQuery.data;
    let markdown = `# ${novel.title}\n\n`;
    markdown += `## ${currentChapter.title || `第${currentChapter.chapterNumber}章`}\n\n`;
    markdown += `${currentChapter.content || ''}\n`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novel.title}_${currentChapter.title || `第${currentChapter.chapterNumber}章`}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('章节导出成功');
  };

  // Loading state
  if (authLoading || novelQuery.isLoading || chaptersQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const novel = novelQuery.data;

  if (!novel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">小说不存在</p>
          <Link href="/novels">
            <Button>返回小说列表</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">暂无章节内容</p>
          <Link href={`/novels/${novelId}/chapters`}>
            <Button>前往添加章节</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentTheme = themeStyles[theme];

  return (
    <div className={`min-h-screen ${currentTheme.bg} ${currentTheme.text} transition-colors duration-300`}>
      {/* Top toolbar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-inherit border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/novels/${novelId}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                返回
              </Button>
            </Link>
            <h1 className="text-lg font-medium truncate max-w-[200px]">{novel.title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* TOC button */}
            <Sheet open={showToc} onOpenChange={setShowToc}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <List className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className={currentTheme.bg}>
                <SheetHeader>
                  <SheetTitle className={currentTheme.text}>目录</SheetTitle>
                </SheetHeader>
                <div className="mt-4 space-y-1 max-h-[80vh] overflow-y-auto">
                  {chapters.map((chapter, index) => (
                    <button
                      key={chapter.id}
                      onClick={() => goToChapter(index)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                        index === currentChapterIndex
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {chapter.title || `第${chapter.chapterNumber}章`}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Settings button */}
            <Sheet open={showSettings} onOpenChange={setShowSettings}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className={currentTheme.bg}>
                <SheetHeader>
                  <SheetTitle className={currentTheme.text}>阅读设置</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  {/* Theme selection */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">主题模式</label>
                    <div className="flex gap-2">
                      {(Object.keys(themeStyles) as ThemeMode[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTheme(t)}
                          className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                            theme === t
                              ? 'border-primary bg-primary/10'
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          {t === 'light' && <Sun className="h-4 w-4 mx-auto mb-1" />}
                          {t === 'dark' && <Moon className="h-4 w-4 mx-auto mb-1" />}
                          {t === 'sepia' && <Type className="h-4 w-4 mx-auto mb-1" />}
                          <span className="text-xs">{themeStyles[t].name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font size */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">
                      字体大小: {fontSize}px
                    </label>
                    <Slider
                      value={[fontSize]}
                      onValueChange={([v]) => setFontSize(v)}
                      min={14}
                      max={24}
                      step={1}
                    />
                  </div>

                  {/* Line height */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">
                      行间距: {lineHeight.toFixed(1)}
                    </label>
                    <Slider
                      value={[lineHeight * 10]}
                      onValueChange={([v]) => setLineHeight(v / 10)}
                      min={14}
                      max={24}
                      step={1}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Download className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportCurrentChapter}>
                  导出当前章节 (MD)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToMarkdown}>
                  导出全书 (MD)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen toggle */}
            <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="pt-20 pb-24 px-4">
        <article className="max-w-3xl mx-auto">
          {/* Chapter title */}
          <h2 className="text-2xl font-bold mb-8 text-center">
            {currentChapter?.title || `第${currentChapter?.chapterNumber}章`}
          </h2>

          {/* Chapter content */}
          <div
            className="prose prose-lg max-w-none"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: lineHeight,
            }}
          >
            {currentChapter?.content?.split('\n').map((paragraph, index) => (
              paragraph.trim() ? (
                <p key={index} className="mb-4 text-justify indent-8">
                  {paragraph}
                </p>
              ) : null
            ))}
          </div>

          {/* Word count */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            本章字数: {currentChapter?.content?.length || 0} 字
          </div>
        </article>
      </main>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-inherit border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={goToPrevChapter}
            disabled={currentChapterIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            上一章
          </Button>

          <span className="text-sm text-muted-foreground">
            {currentChapterIndex + 1} / {chapters.length}
          </span>

          <Button
            variant="ghost"
            onClick={goToNextChapter}
            disabled={currentChapterIndex === chapters.length - 1}
            className="gap-2"
          >
            下一章
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
