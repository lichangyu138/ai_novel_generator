/**
 * Chapters Page - Generate and manage novel chapters with AI
 * Features: Single chapter generation, chapter outlines, AI reviews, foreshadowing
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { PaginatedList } from '@/components/PaginatedList';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  FileText,
  Loader2,
  Sparkles,
  CheckCircle,
  MessageSquare,
  Eye,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  BookOpen,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  History,
  Star,
  Target,
  Users,
  MapPin,
  Clock,
  Wand2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { exportChapterToTxt, exportAllChaptersToTxt, exportSelectedChaptersToTxt, exportAllOutlinesToTxt } from '@/utils/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ChapterFormData {
  title: string;
  chapterNumber: number;
  content: string;
  status: string;
}

const emptyForm: ChapterFormData = {
  title: '',
  chapterNumber: 1,
  content: '',
  status: 'draft',
};

const WORD_COUNT_OPTIONS = [
  { value: 1500, label: '1500字（短章）' },
  { value: 2000, label: '2000字' },
  { value: 2500, label: '2500字' },
  { value: 3000, label: '3000字（标准）' },
  { value: 4000, label: '4000字' },
  { value: 5000, label: '5000字（长章）' },
];

export default function Chapters() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const novelId = parseInt(params.id || '0');
  

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [outlineDialogOpen, setOutlineDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [foreshadowingDialogOpen, setForeshadowingDialogOpen] = useState(false);
  const [createForeshadowingDialogOpen, setCreateForeshadowingDialogOpen] = useState(false);
  const [editForeshadowingDialogOpen, setEditForeshadowingDialogOpen] = useState(false);
  const [editingForeshadowing, setEditingForeshadowing] = useState<any>(null);
  const [foreshadowingSearch, setForeshadowingSearch] = useState('');
  const [foreshadowingFilter, setForeshadowingFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [foreshadowingPage, setForeshadowingPage] = useState(1);
  const [foreshadowingPageSize] = useState(10);
  
  // Form states
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingChapter, setViewingChapter] = useState<any>(null);
  const [formData, setFormData] = useState<ChapterFormData>(emptyForm);
  const [modifyRequest, setModifyRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isModifying, setIsModifying] = useState(false);
  const [targetWordCount, setTargetWordCount] = useState(3000);
  const [selectedChapterNumber, setSelectedChapterNumber] = useState(1);
  const [currentReview, setCurrentReview] = useState<any>(null);
  const [currentOutline, setCurrentOutline] = useState<any>(null);
  const [generatingOutline, setGeneratingOutline] = useState(false);
  const [generatingReview, setGeneratingReview] = useState(false);
  const [outlinePage, setOutlinePage] = useState(1);
  const outlinesPerPage = 10;
  const [reviewPage, setReviewPage] = useState(1);
  const reviewsPerPage = 10;
  
  // 细纲相关对话框状态
  const [generateOutlineDialogOpen, setGenerateOutlineDialogOpen] = useState(false);
  const [outlineInspiration, setOutlineInspiration] = useState('');
  const [selectedChapterForOutline, setSelectedChapterForOutline] = useState(1);
  const [editOutlineDialogOpen, setEditOutlineDialogOpen] = useState(false);
  const [editingOutline, setEditingOutline] = useState<any>(null);
  const [aiModifyOutlineDialogOpen, setAiModifyOutlineDialogOpen] = useState(false);
  const [aiModifyOutlineRequest, setAiModifyOutlineRequest] = useState('');
  const [aiModifyOutlineConversation, setAiModifyOutlineConversation] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [modifyingOutline, setModifyingOutline] = useState(false);

  // 批量生成相关状态
  const [batchGenerateOutlinesDialogOpen, setBatchGenerateOutlinesDialogOpen] = useState(false);
  const [batchGenerateContentDialogOpen, setBatchGenerateContentDialogOpen] = useState(false);
  const [batchStartChapter, setBatchStartChapter] = useState(1);
  const [batchEndChapter, setBatchEndChapter] = useState(50);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  // tRPC queries
  const novelQuery = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const chaptersQuery = trpc.chapters.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const chapterOutlinesQuery = trpc.chapterOutlines.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const foreshadowingQuery = trpc.foreshadowing.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const pendingForeshadowingQuery = trpc.foreshadowing.pending.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const reviewsQuery = trpc.chapterReviews.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  // tRPC mutations
  const createChapter = trpc.chapters.create.useMutation({
    onSuccess: () => {
      chaptersQuery.refetch();
      setDialogOpen(false);
      resetForm();
      toast.success('章节创建成功');
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateChapter = trpc.chapters.update.useMutation({
    onSuccess: () => {
      chaptersQuery.refetch();
      setDialogOpen(false);
      resetForm();
      toast.success('章节更新成功');
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteChapter = trpc.chapters.delete.useMutation({
    onSuccess: () => {
      chaptersQuery.refetch();
      toast.success('章节删除成功');
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const humanizeChapter = trpc.chapters.humanize.useMutation({
    onSuccess: () => {
      chaptersQuery.refetch();
      toast.success('章节已降低AI特征');
    },
    onError: (error) => {
      toast.error(`降低AI率失败: ${error.message}`);
    },
  });

  const generateChapter = trpc.chapterGeneration.generateContent.useMutation({
    onSuccess: (data) => {
      chaptersQuery.refetch();
      setGenerating(false);
      setGenerateDialogOpen(false);
      toast.success(data.message || '章节生成成功');
      // 刷新相关数据
      chapterOutlinesQuery.refetch();
      reviewsQuery.refetch();
      foreshadowingQuery.refetch();
    },
    onError: (error) => {
      setGenerating(false);
      toast.error(`生成失败: ${error.message}`);
    },
  });

  const modifyChapter = trpc.ai.modifyChapter.useMutation({
    onSuccess: () => {
      chaptersQuery.refetch();
      setIsModifying(false);
      setModifyDialogOpen(false);
      setModifyRequest('');
      toast.success('章节修改成功');
    },
    onError: (error) => {
      setIsModifying(false);
      toast.error(`修改失败: ${error.message}`);
    },
  });


  const generateOutlineMutation = trpc.chapterGeneration.generateOutline.useMutation({
    onSuccess: (data) => {
      chapterOutlinesQuery.refetch();
      setGeneratingOutline(false);
      setGenerateOutlineDialogOpen(false);
      setOutlineInspiration('');
      // data 包含 chapter_outline 对象
      if (data.chapter_outline) {
        setCurrentOutline(data.chapter_outline);
      }
      toast.success(data.message || '细纲生成成功');
    },
    onError: (error) => {
      setGeneratingOutline(false);
      toast.error(`细纲生成失败: ${error.message}`);
    },
  });

  const updateOutlineMutation = trpc.chapterOutlines.update.useMutation({
    onSuccess: () => {
      chapterOutlinesQuery.refetch();
      setEditOutlineDialogOpen(false);
      setEditingOutline(null);
      toast.success('细纲更新成功');
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteOutlineMutation = trpc.chapterOutlines.delete.useMutation({
    onSuccess: () => {
      chapterOutlinesQuery.refetch();
      toast.success('细纲删除成功');
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const modifyOutlineMutation = trpc.chapterOutlines.modify.useMutation({
    onSuccess: (data) => {
      chapterOutlinesQuery.refetch();
      setModifyingOutline(false);
      // 添加AI回复到对话历史
      setAiModifyOutlineConversation(prev => [
        ...prev,
        { role: 'assistant', content: '细纲已根据您的要求修改完成。' }
      ]);
      setAiModifyOutlineRequest('');
      toast.success('细纲修改成功');
    },
    onError: (error) => {
      setModifyingOutline(false);
      toast.error(`修改失败: ${error.message}`);
    },
  });

  const batchGenerateOutlinesMutation = trpc.chapterGeneration.batchGenerateOutlines.useMutation({
    onSuccess: (data) => {
      setBatchGenerating(false);
      setBatchProgress(null);
      setBatchGenerateOutlinesDialogOpen(false);
      chapterOutlinesQuery.refetch();
      toast.success(data.message || `批量生成完成：成功${data.succeeded}章，失败${data.failed}章`);
    },
    onError: (error) => {
      setBatchGenerating(false);
      setBatchProgress(null);
      toast.error(`批量生成失败: ${error.message}`);
    },
  });

  const batchGenerateContentMutation = trpc.chapterGeneration.batchGenerateContent.useMutation({
    onSuccess: (data) => {
      setBatchGenerating(false);
      setBatchProgress(null);
      setBatchGenerateContentDialogOpen(false);
      chaptersQuery.refetch();
      chapterOutlinesQuery.refetch();
      reviewsQuery.refetch();
      toast.success(data.message || `批量生成完成：成功${data.succeeded}章，失败${data.failed}章`);
    },
    onError: (error) => {
      setBatchGenerating(false);
      setBatchProgress(null);
      toast.error(`批量生成失败: ${error.message}`);
    },
  });

  const generateReviewMutation = trpc.chapterReviews.generate.useMutation({
    onSuccess: (data) => {
      setGeneratingReview(false);
      setCurrentReview(data);
      reviewsQuery.refetch();
      foreshadowingQuery.refetch();
      pendingForeshadowingQuery.refetch();
      toast.success('AI总结生成成功');
    },
    onError: (error) => {
      setGeneratingReview(false);
      toast.error(`总结生成失败: ${error.message}`);
    },
  });

  const createForeshadowing = trpc.foreshadowing.create.useMutation({
    onSuccess: () => {
      foreshadowingQuery.refetch();
      pendingForeshadowingQuery.refetch();
      setCreateForeshadowingDialogOpen(false);
      setEditingForeshadowing(null);
      toast.success('伏笔创建成功');
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const resolveForeshadowing = trpc.foreshadowing.resolve.useMutation({
    onSuccess: () => {
      foreshadowingQuery.refetch();
      pendingForeshadowingQuery.refetch();
      toast.success('伏笔已回收');
    },
  });

  const updateForeshadowing = trpc.foreshadowing.update.useMutation({
    onSuccess: () => {
      foreshadowingQuery.refetch();
      pendingForeshadowingQuery.refetch();
      setEditForeshadowingDialogOpen(false);
      setEditingForeshadowing(null);
      toast.success('伏笔更新成功');
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteForeshadowing = trpc.foreshadowing.delete.useMutation({
    onSuccess: () => {
      foreshadowingQuery.refetch();
      pendingForeshadowingQuery.refetch();
      toast.success('伏笔删除成功');
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast.error('请输入章节标题');
      return;
    }

    if (editingId) {
      updateChapter.mutate({
        id: editingId,
        title: formData.title,
        content: formData.content,
        status: formData.status as "draft" | "pending_review" | "approved" | "rejected",
      });
    } else {
      createChapter.mutate({
        novelId,
        chapterNumber: formData.chapterNumber,
        title: formData.title,
        content: formData.content,
      });
    }
  };

  const handleEdit = (chapter: any) => {
    setFormData({
      title: chapter.title || '',
      chapterNumber: chapter.chapterNumber,
      content: chapter.content || '',
      status: chapter.status || 'draft',
    });
    setEditingId(chapter.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('确定要删除这个章节吗？')) {
      deleteChapter.mutate({ id });
    }
  };

  const handleGenerate = () => {
    setGenerating(true);
    generateChapter.mutate({
      novelId,
      chapterNumber: selectedChapterNumber,
    });
  };

  const handleModify = () => {
    if (!viewingChapter || !modifyRequest.trim()) return;
    setIsModifying(true);
    modifyChapter.mutate({
      chapterId: viewingChapter.id,
      currentContent: viewingChapter.content || '',
      modifyRequest,
    });
  };

  const handleGenerateOutline = (chapterNumber: number) => {
    setSelectedChapterForOutline(chapterNumber);
    setGenerateOutlineDialogOpen(true);
  };

  const handleConfirmGenerateOutline = () => {
    setGeneratingOutline(true);
    generateOutlineMutation.mutate({
      novelId,
      chapterNumber: selectedChapterForOutline,
    });
  };

  const handleEditOutline = (outline: any) => {
    setEditingOutline(outline);
    setEditOutlineDialogOpen(true);
  };

  const handleSaveOutline = () => {
    if (!editingOutline) return;
    updateOutlineMutation.mutate({
      id: editingOutline.id,
      previousSummary: editingOutline.previousSummary,
      plotDevelopment: editingOutline.plotDevelopment,
      characterDynamics: editingOutline.characterDynamics,
      sceneDescription: editingOutline.sceneDescription,
      dialoguePoints: editingOutline.dialoguePoints,
      foreshadowing: editingOutline.foreshadowing,
      fullContent: editingOutline.fullContent,
    });
  };

  const handleDeleteOutline = (id: number) => {
    if (confirm('确定要删除这个细纲吗？')) {
      deleteOutlineMutation.mutate({ id });
    }
  };

  const handleAiModifyOutline = (outline: any) => {
    setEditingOutline(outline);
    setAiModifyOutlineConversation([]);
    setAiModifyOutlineRequest('');
    setAiModifyOutlineDialogOpen(true);
  };

  const handleConfirmAiModifyOutline = () => {
    if (!editingOutline || !aiModifyOutlineRequest.trim()) return;
    setModifyingOutline(true);
    // 添加用户消息到对话历史
    const userMessage = { role: 'user' as const, content: aiModifyOutlineRequest };
    setAiModifyOutlineConversation(prev => [...prev, userMessage]);
    
    modifyOutlineMutation.mutate({
      id: editingOutline.id,
      modifyRequest: aiModifyOutlineRequest,
      conversationHistory: [...aiModifyOutlineConversation, userMessage],
    });
  };

  const handleGenerateReview = (chapter: any) => {
    setViewingChapter(chapter);
    setGeneratingReview(true);
    generateReviewMutation.mutate({
      novelId,
      chapterId: chapter.id,
    });
  };

  const handleViewChapter = (chapter: any) => {
    setViewingChapter(chapter);
    setViewDialogOpen(true);
    // Load review if exists
    const review = trpc.chapterReviews.get.useQuery({ chapterId: chapter.id });
  };

  const handleExportChapter = (chapter: any) => {
    const content = `# ${chapter.title || `第${chapter.chapterNumber}章`}\n\n${chapter.content || ''}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${novelQuery.data?.title || '小说'}_第${chapter.chapterNumber}章.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('导出成功');
  };

  // Auth check
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const chapters = chaptersQuery.data || [];
  const chapterOutlines = Array.isArray(chapterOutlinesQuery.data)
    ? chapterOutlinesQuery.data
    : [];
  console.log('[Chapters] chapterOutlines:', chapterOutlines.length, chapterOutlines);
  const allForeshadowing = foreshadowingQuery.data || [];
  const pendingForeshadowing = pendingForeshadowingQuery.data || [];
  const allReviews = reviewsQuery.data || [];
  console.log('[Chapters] allForeshadowing:', allForeshadowing);
  console.log('[Chapters] pendingForeshadowing:', pendingForeshadowing);
  console.log('[Chapters] allReviews:', allReviews);
  console.log('[Chapters] reviewsQuery.isLoading:', reviewsQuery.isLoading);
  console.log('[Chapters] reviewsQuery.error:', reviewsQuery.error);

  // Pagination for outlines
  const outlinePagination = {
    total: chapterOutlines.length,
    page: outlinePage,
    totalPages: Math.ceil(chapterOutlines.length / outlinesPerPage),
  };

  // Pagination for reviews
  const reviewPagination = {
    total: allReviews.length,
    page: reviewPage,
    totalPages: Math.ceil(allReviews.length / reviewsPerPage),
  };

  const paginatedReviews = allReviews.slice(
    (reviewPage - 1) * reviewsPerPage,
    reviewPage * reviewsPerPage
  );
  
  // 筛选和搜索伏笔
  const filteredForeshadowing = allForeshadowing.filter(f => {
    // 状态筛选
    if (foreshadowingFilter === 'pending' && f.status !== 'pending') return false;
    if (foreshadowingFilter === 'resolved' && f.status !== 'resolved') return false;
    
    // 搜索筛选
    if (foreshadowingSearch.trim()) {
      const searchLower = foreshadowingSearch.toLowerCase();
      return (
        f.content?.toLowerCase().includes(searchLower) ||
        f.title?.toLowerCase().includes(searchLower) ||
        false
      );
    }
    
    return true;
  });
  
  // 分页
  const paginatedForeshadowing = filteredForeshadowing.slice(
    (foreshadowingPage - 1) * foreshadowingPageSize,
    foreshadowingPage * foreshadowingPageSize
  );
  const totalForeshadowingPages = Math.ceil(filteredForeshadowing.length / foreshadowingPageSize);
  
  const nextChapterNumber = chapters.length > 0 
    ? Math.max(...chapters.map((c) => c.chapterNumber)) + 1 
    : 1;

  return (
    <NovelDashboardLayout novelId={novelId}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">章节管理</h1>
            <p className="text-muted-foreground">
              {novelQuery.data?.title} · 共 {chapters.length} 章
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setForeshadowingDialogOpen(true)}
            >
              <Lightbulb className="h-4 w-4 mr-2" />
              伏笔管理
              {pendingForeshadowing.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingForeshadowing.length}
                </Badge>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  导出
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => exportAllChaptersToTxt(chapters, novelQuery.data?.title || '小说')}>
                  导出全部章节
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              onClick={() => setBatchGenerateContentDialogOpen(true)}
              disabled={batchGenerating}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              批量生成章节
            </Button>
            <Button onClick={() => {
              setSelectedChapterNumber(nextChapterNumber);
              setGenerateDialogOpen(true);
            }}>
              <Sparkles className="h-4 w-4 mr-2" />
              AI生成章节
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="chapters" className="space-y-4">
          <TabsList>
            <TabsTrigger value="chapters">章节列表</TabsTrigger>
            <TabsTrigger value="outlines">细纲管理</TabsTrigger>
            <TabsTrigger value="reviews">AI总结</TabsTrigger>
          </TabsList>

          {/* Chapters Tab */}
          <TabsContent value="chapters" className="space-y-4">
            {chapters.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">还没有章节</h3>
                  <p className="text-muted-foreground mb-4">
                    开始创作您的第一个章节吧
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFormData({ ...emptyForm, chapterNumber: 1 });
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      手动创建
                    </Button>
                    <Button onClick={() => setGenerateDialogOpen(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      AI生成
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <PaginatedList
                items={chapters}
                pageSize={10}
                getItemId={(ch) => ch.id}
                onBatchDelete={async (ids) => {
                  if (confirm(`确定要删除选中的 ${ids.length} 个章节吗？`)) {
                    await Promise.all(ids.map(id => deleteChapter.mutateAsync({ id })));
                  }
                }}
                renderItem={(chapter, isSelected, onToggle) => {
                  const outline = chapterOutlines.find(
                    (o) => o.chapterNumber === chapter.chapterNumber
                  );
                  return (
                    <Card key={chapter.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <Checkbox checked={isSelected} onCheckedChange={onToggle} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">
                                第{chapter.chapterNumber}章
                              </Badge>
                              <h3 className="font-medium">
                                {chapter.title || '无标题'}
                              </h3>
                              {chapter.status === 'approved' && (
                                <Badge variant="default">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  已发布
                                </Badge>
                              )}
                              {outline && (
                                <Badge variant="secondary">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  有细纲
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {chapter.content?.slice(0, 150) || '暂无内容'}...
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{chapter.wordCount || 0} 字</span>
                              <span>
                                更新于{' '}
                                {new Date(chapter.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewChapter(chapter)}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEdit(chapter)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setViewingChapter(chapter);
                                  setModifyDialogOpen(true);
                                }}
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                AI修改
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleGenerateReview(chapter)}
                              >
                                <Star className="h-4 w-4 mr-2" />
                                生成AI总结
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleGenerateOutline(chapter.chapterNumber)}
                              >
                                <BookOpen className="h-4 w-4 mr-2" />
                                生成细纲
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => exportChapterToTxt(chapter)}>
                                <Download className="h-4 w-4 mr-2" />
                                导出TXT
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportChapter(chapter)}>
                                <Download className="h-4 w-4 mr-2" />
                                导出MD
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm('确定要降低此章节的AI特征吗？这将重写章节内容。')) {
                                    humanizeChapter.mutate({ id: chapter.id });
                                  }
                                }}
                                disabled={humanizeChapter.isPending}
                              >
                                <Wand2 className="h-4 w-4 mr-2" />
                                降低AI率
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(chapter.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }}
              />
            )}
          </TabsContent>

          {/* Outlines Tab */}
          <TabsContent value="outlines" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                <CardTitle>章节细纲</CardTitle>
                <CardDescription>
                  每章约2000字的详细细纲，包含前文总结、剧情发展、人物动态等
                </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {chapterOutlines.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportAllOutlinesToTxt(chapterOutlines, novelQuery.data?.title || '小说')}
                      >
                        <Download className="h-3 w-3 mr-2" />
                        导出全部细纲
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBatchGenerateOutlinesDialogOpen(true)}
                      disabled={batchGenerating}
                    >
                      <Sparkles className="h-3 w-3 mr-2" />
                      批量生成细纲
                    </Button>
                    <Label className="text-sm text-muted-foreground">
                      生成章节
                    </Label>
                    <Input
                      type="number"
                      className="w-20 h-8"
                      min={1}
                      value={selectedChapterForOutline}
                      onChange={(e) => {
                        const value = parseInt(e.target.value || '1', 10);
                        setSelectedChapterForOutline(
                          isNaN(value) || value < 1 ? 1 : value
                        );
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleGenerateOutline(selectedChapterForOutline)}
                      disabled={generatingOutline}
                    >
                      {generatingOutline ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3 w-3 mr-2" />
                          生成细纲
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {chapterOutlines.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>还没有生成细纲</p>
                    <Button
                      className="mt-4"
                      onClick={() => handleGenerateOutline(1)}
                      disabled={generatingOutline}
                    >
                      {generatingOutline ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                      生成第1章细纲
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <>
                  <Accordion type="single" collapsible className="space-y-2">
                    {chapterOutlines
                      .slice((outlinePage - 1) * outlinesPerPage, outlinePage * outlinesPerPage)
                      .map((outline) => (
                      <AccordionItem
                        key={outline.id}
                        value={`outline-${outline.id}`}
                        className="border rounded-lg px-4"
                      >
                        <div className="flex items-center justify-between py-4">
                          <AccordionTrigger className="hover:no-underline flex-1">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">第{outline.chapterNumber}章</Badge>
                              <span className="text-sm text-muted-foreground">
                                {outline.fullContent ? `${outline.fullContent.length}字` : '0字'}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditOutline(outline)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                修改
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAiModifyOutline(outline)}>
                                <MessageSquare className="h-4 w-4 mr-2" />
                                AI修改
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteOutline(outline.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <AccordionContent className="space-y-4 pt-4">
                          {outline.previousSummary && (
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-2">
                                <History className="h-4 w-4" />
                                前文总结
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {outline.previousSummary}
                              </p>
                            </div>
                          )}
                          {outline.plotDevelopment && (
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-2">
                                <Target className="h-4 w-4" />
                                剧情发展
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {outline.plotDevelopment}
                              </p>
                            </div>
                          )}
                          {outline.characterDynamics && (
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4" />
                                人物动态
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {outline.characterDynamics}
                              </p>
                            </div>
                          )}
                          {outline.sceneDescription && (
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-2">
                                <MapPin className="h-4 w-4" />
                                场景描述
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {outline.sceneDescription}
                              </p>
                            </div>
                          )}
                          {outline.foreshadowing && (
                            <div>
                              <h4 className="font-medium flex items-center gap-2 mb-2">
                                <Lightbulb className="h-4 w-4" />
                                伏笔设置
                              </h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {outline.foreshadowing}
                              </p>
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>

                  {/* 分页 */}
                  {outlinePagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="text-sm text-muted-foreground">
                        共 {outlinePagination.total} 条，第 {outlinePagination.page} / {outlinePagination.totalPages} 页
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOutlinePage(p => Math.max(1, p - 1))}
                          disabled={outlinePage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setOutlinePage(p => Math.min(outlinePagination.totalPages, p + 1))}
                          disabled={outlinePage === outlinePagination.totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
                
                
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI章节总结</CardTitle>
                <CardDescription>
                  AI总结每章的开头、中间情节、结尾内容，以及重点问题分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                {allReviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>还没有章节总结</p>
                  </div>
                ) : (
                  <>
                    <Accordion type="single" collapsible className="space-y-2">
                      {paginatedReviews?.map((review) => {
                        const chapter = chapters.find(c => c.id === review.chapterId);
                        return (
                          <AccordionItem key={review.id} value={`review-${review.id}`} className="border rounded-lg px-4">
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">第{chapter?.chapterNumber || '?'}章</Badge>
                                <span className="text-sm font-medium">{chapter?.title || '未命名'}</span>
                                <Badge variant="secondary">{review.qualityScore}/10</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {review.plotSummary && (
                                <div>
                                  <h4 className="font-medium mb-2">剧情总结</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.plotSummary}</p>
                                </div>
                              )}
                              {review.openingDescription && (
                                <div>
                                  <h4 className="font-medium mb-2">开头</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.openingDescription}</p>
                                </div>
                              )}
                              {review.middleDescription && (
                                <div>
                                  <h4 className="font-medium mb-2">中间</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.middleDescription}</p>
                                </div>
                              )}
                              {review.endingDescription && (
                                <div>
                                  <h4 className="font-medium mb-2">结尾</h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.endingDescription}</p>
                                </div>
                              )}
                              {review.keyIssues && (
                                <div>
                                  <h4 className="font-medium flex items-center gap-2 mb-2">
                                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                    重点问题
                                  </h4>
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.keyIssues}</p>
                                </div>
                              )}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                    {reviewPagination.totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                          disabled={reviewPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          上一页
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          第 {reviewPage} / {reviewPagination.totalPages} 页
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReviewPage(p => Math.min(reviewPagination.totalPages, p + 1))}
                          disabled={reviewPage === reviewPagination.totalPages}
                        >
                          下一页
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Generate Chapter Dialog */}
        <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>AI生成章节</DialogTitle>
              <DialogDescription>
                基于大纲、细纲、人物设定和知识库生成章节内容
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>章节序号</Label>
                <Select
                  value={selectedChapterNumber.toString()}
                  onValueChange={(v) => setSelectedChapterNumber(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.max(nextChapterNumber, 10) }, (_, i) => i + 1).map(
                      (num) => (
                        <SelectItem key={num} value={num.toString()}>
                          第{num}章
                          {chapters.find((c) => c.chapterNumber === num) && ' (已存在)'}
                          {chapterOutlines.find((o) => o.chapterNumber === num) && ' ✓细纲'}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>目标字数</Label>
                <Select
                  value={targetWordCount.toString()}
                  onValueChange={(v) => setTargetWordCount(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORD_COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Context Info */}
              <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                <h4 className="font-medium text-sm">生成上下文</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• 将自动查询知识库和知识图谱获取历史信息</p>
                  <p>• 将参考大纲、人物设定、前文内容</p>
                  {chapterOutlines.find((o) => o.chapterNumber === selectedChapterNumber) && (
                    <p className="text-green-600">• ✓ 已有第{selectedChapterNumber}章细纲</p>
                  )}
                  {pendingForeshadowing.length > 0 && (
                    <p className="text-amber-600">
                      • 有 {pendingForeshadowing.length} 个待回收伏笔
                    </p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {/* View Chapter Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                第{viewingChapter?.chapterNumber}章 {viewingChapter?.title}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {viewingChapter?.content || '暂无内容'}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                关闭
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setViewDialogOpen(false);
                  setModifyDialogOpen(true);
                }}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                AI修改
              </Button>
              <Button onClick={() => handleEdit(viewingChapter)}>
                <Pencil className="h-4 w-4 mr-2" />
                编辑
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modify Chapter Dialog */}
        <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>AI修改章节</DialogTitle>
              <DialogDescription>
                描述您想要的修改，AI将根据您的要求调整章节内容
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>修改要求</Label>
                <Textarea
                  placeholder="例如：增加更多对话、加强情感描写、调整节奏、修改结尾..."
                  value={modifyRequest}
                  onChange={(e) => setModifyRequest(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModifyDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleModify} disabled={isModifying || !modifyRequest.trim()}>
                {isModifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    修改中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始修改
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Foreshadowing Dialog */}
        <Dialog open={foreshadowingDialogOpen} onOpenChange={setForeshadowingDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>伏笔管理</DialogTitle>
              <DialogDescription>
                管理小说中的伏笔，跟踪设置和回收情况
              </DialogDescription>
            </DialogHeader>
            
            {/* 搜索和筛选栏 */}
            <div className="flex items-center gap-2 py-2">
              <Input
                placeholder="搜索伏笔内容..."
                value={foreshadowingSearch}
                onChange={(e) => {
                  setForeshadowingSearch(e.target.value);
                  setForeshadowingPage(1); // 重置到第一页
                }}
                className="flex-1"
              />
              <div className="flex gap-1">
                <Button
                  variant={foreshadowingFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setForeshadowingFilter('all');
                    setForeshadowingPage(1);
                  }}
                >
                  全部
                </Button>
                <Button
                  variant={foreshadowingFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setForeshadowingFilter('pending');
                    setForeshadowingPage(1);
                  }}
                >
                  待回收 ({pendingForeshadowing.length})
                </Button>
                <Button
                  variant={foreshadowingFilter === 'resolved' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setForeshadowingFilter('resolved');
                    setForeshadowingPage(1);
                  }}
                >
                  已回收
                </Button>
                              </div>
              <Button
                onClick={() => {
                  setEditingForeshadowing({
                    content: '',
                    setupChapterId: 1,
                    plannedResolutionChapter: undefined,
                  });
                  setCreateForeshadowingDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                新建
              </Button>
                            </div>

            <ScrollArea className="h-[50vh] pr-4">
              <div className="space-y-2">
                {paginatedForeshadowing.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>暂无伏笔记录</p>
                    {foreshadowingSearch && (
                      <p className="text-xs mt-2">尝试调整搜索条件</p>
                  )}
                </div>
                ) : (
                  paginatedForeshadowing.map((f) => (
                        <Card key={f.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {f.title && (
                              <h4 className="font-medium text-sm mb-1">{f.title}</h4>
                            )}
                                <p className="text-sm">{f.content}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>设置于第{f.setupChapterId}章</span>
                              {f.plannedResolutionChapter && (
                                <span>· 计划在第{f.plannedResolutionChapter}章回收</span>
                              )}
                              {f.actualResolutionChapterId && (
                                <span>· 已在第{f.actualResolutionChapterId}章回收</span>
                              )}
                            </div>
                            {f.resolutionContent && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                回收内容：{f.resolutionContent}
                              </p>
                            )}
                              </div>
                          <div className="flex items-center gap-2">
                              <Badge
                                variant={f.status === 'resolved' ? 'default' : 'secondary'}
                              >
                                {f.status === 'resolved' ? '已回收' : '待回收'}
                              </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  setEditingForeshadowing(f);
                                  setEditForeshadowingDialogOpen(true);
                                }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  编辑
                                </DropdownMenuItem>
                                {f.status === 'pending' && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const chapterId = prompt('请输入回收章节ID:');
                                      const resolutionContent = prompt('请输入回收内容:');
                                      if (chapterId && resolutionContent) {
                                        resolveForeshadowing.mutate({
                                          id: f.id,
                                          chapterId: parseInt(chapterId),
                                          resolutionContent,
                                        });
                                      }
                                    }}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    标记为已回收
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    if (confirm('确定要删除这个伏笔吗？')) {
                                      deleteForeshadowing.mutate({ id: f.id });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  删除
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                            </div>
                          </CardContent>
                        </Card>
                  ))
                  )}
              </div>
            </ScrollArea>

            {/* 分页 */}
            {totalForeshadowingPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-sm text-muted-foreground">
                  共 {filteredForeshadowing.length} 条，第 {foreshadowingPage} / {totalForeshadowingPages} 页
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForeshadowingPage(p => Math.max(1, p - 1))}
                    disabled={foreshadowingPage === 1}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setForeshadowingPage(p => Math.min(totalForeshadowingPages, p + 1))}
                    disabled={foreshadowingPage === totalForeshadowingPages}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setForeshadowingDialogOpen(false);
                setForeshadowingSearch('');
                setForeshadowingFilter('all');
                setForeshadowingPage(1);
              }}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 创建/编辑伏笔对话框 */}
        <Dialog open={createForeshadowingDialogOpen || editForeshadowingDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setCreateForeshadowingDialogOpen(false);
            setEditForeshadowingDialogOpen(false);
            setEditingForeshadowing(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingForeshadowing ? '编辑伏笔' : '新建伏笔'}</DialogTitle>
              <DialogDescription>
                {editingForeshadowing ? '修改伏笔信息' : '创建一个新的伏笔'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>标题（可选）</Label>
                <Input
                  placeholder="伏笔标题..."
                  value={editingForeshadowing?.title || ''}
                  onChange={(e) => setEditingForeshadowing({ ...editingForeshadowing, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>伏笔内容 *</Label>
                <Textarea
                  placeholder="描述这个伏笔的内容..."
                  value={editingForeshadowing?.content || ''}
                  onChange={(e) => setEditingForeshadowing({ ...editingForeshadowing, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>设置于第几章 *</Label>
                  <Input
                    type="number"
                    placeholder="章节号"
                    value={editingForeshadowing?.setupChapterId || ''}
                    onChange={(e) => setEditingForeshadowing({ ...editingForeshadowing, setupChapterId: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>计划回收章节（可选）</Label>
                  <Input
                    type="number"
                    placeholder="章节号"
                    value={editingForeshadowing?.plannedResolutionChapter || ''}
                    onChange={(e) => setEditingForeshadowing({ ...editingForeshadowing, plannedResolutionChapter: parseInt(e.target.value) || undefined })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateForeshadowingDialogOpen(false);
                  setEditForeshadowingDialogOpen(false);
                  setEditingForeshadowing(null);
                }}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  if (editForeshadowingDialogOpen && editingForeshadowing?.id) {
                    // 编辑
                    updateForeshadowing.mutate({
                      id: editingForeshadowing.id,
                      content: editingForeshadowing.content,
                      plannedResolutionChapter: editingForeshadowing.plannedResolutionChapter,
                    });
                  } else if (createForeshadowingDialogOpen && editingForeshadowing) {
                    // 创建
                    createForeshadowing.mutate({
                      novelId,
                      content: editingForeshadowing.content,
                      setupChapterId: editingForeshadowing.setupChapterId,
                      plannedResolutionChapter: editingForeshadowing.plannedResolutionChapter,
                    });
                    setCreateForeshadowingDialogOpen(false);
                    setEditingForeshadowing(null);
                  }
                }}
                disabled={!editingForeshadowing?.content || (createForeshadowingDialogOpen && !editingForeshadowing?.setupChapterId)}
              >
                {editForeshadowingDialogOpen ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Chapter Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>{editingId ? '编辑章节' : '创建章节'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>章节序号</Label>
                  <Input
                    type="number"
                    value={formData.chapterNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, chapterNumber: parseInt(e.target.value) || 1 })
                    }
                    min={1}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>章节标题</Label>
                  <Input
                    placeholder="输入章节标题"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>章节内容</Label>
                <Textarea
                  placeholder="输入章节内容..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={15}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.content.length} 字
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createChapter.isPending || updateChapter.isPending}
              >
                {(createChapter.isPending || updateChapter.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingId ? '保存' : '创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* 生成细纲对话框（支持灵感输入） */}
        <Dialog open={generateOutlineDialogOpen} onOpenChange={setGenerateOutlineDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>生成细纲</DialogTitle>
              <DialogDescription>
                为第{selectedChapterForOutline}章生成详细细纲
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>创作灵感（可选）</Label>
                <Textarea
                  placeholder="请输入您的创作灵感，AI将根据灵感生成细纲..."
                  value={outlineInspiration}
                  onChange={(e) => setOutlineInspiration(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  您可以输入一些创作想法、剧情要点或特殊要求，AI会结合这些灵感生成细纲
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setGenerateOutlineDialogOpen(false);
                setOutlineInspiration('');
              }}>
                取消
              </Button>
              <Button
                onClick={handleConfirmGenerateOutline}
                disabled={generatingOutline}
              >
                {generatingOutline ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 修改细纲对话框 */}
        <Dialog open={editOutlineDialogOpen} onOpenChange={setEditOutlineDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>修改细纲</DialogTitle>
              <DialogDescription>
                编辑第{editingOutline?.chapterNumber}章细纲内容
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>前文总结</Label>
                  <Textarea
                    value={editingOutline?.previousSummary || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, previousSummary: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>剧情发展</Label>
                  <Textarea
                    value={editingOutline?.plotDevelopment || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, plotDevelopment: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>人物动态</Label>
                  <Textarea
                    value={editingOutline?.characterDynamics || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, characterDynamics: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>场景描述</Label>
                  <Textarea
                    value={editingOutline?.sceneDescription || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, sceneDescription: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>关键对话要点</Label>
                  <Textarea
                    value={editingOutline?.dialoguePoints || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, dialoguePoints: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>伏笔设置</Label>
                  <Textarea
                    value={editingOutline?.foreshadowing || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, foreshadowing: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>完整细纲内容</Label>
                  <Textarea
                    value={editingOutline?.fullContent || ''}
                    onChange={(e) => setEditingOutline({ ...editingOutline, fullContent: e.target.value })}
                    rows={8}
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditOutlineDialogOpen(false);
                setEditingOutline(null);
              }}>
                取消
              </Button>
              <Button onClick={handleSaveOutline}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI修改细纲对话框（支持上下文对话） */}
        <Dialog open={aiModifyOutlineDialogOpen} onOpenChange={setAiModifyOutlineDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>AI修改细纲</DialogTitle>
              <DialogDescription>
                通过对话方式修改第{editingOutline?.chapterNumber}章细纲
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* 对话历史 */}
              <ScrollArea className="h-[300px] border rounded-lg p-4">
                <div className="space-y-4">
                  {aiModifyOutlineConversation.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      开始对话，告诉AI您想要如何修改细纲
                    </p>
                  ) : (
                    aiModifyOutlineConversation.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {modifyingOutline && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* 输入框 */}
              <div className="space-y-2">
                <Label>修改要求</Label>
                <Textarea
                  placeholder="请输入您的修改要求..."
                  value={aiModifyOutlineRequest}
                  onChange={(e) => setAiModifyOutlineRequest(e.target.value)}
                  rows={3}
                  disabled={modifyingOutline}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !modifyingOutline && aiModifyOutlineRequest.trim()) {
                      handleConfirmAiModifyOutline();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  按 Ctrl+Enter 发送
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAiModifyOutlineDialogOpen(false);
                  setAiModifyOutlineRequest('');
                  setAiModifyOutlineConversation([]);
                  setEditingOutline(null);
                }}
                disabled={modifyingOutline}
              >
                关闭
              </Button>
              <Button
                onClick={handleConfirmAiModifyOutline}
                disabled={modifyingOutline || !aiModifyOutlineRequest.trim()}
              >
                {modifyingOutline ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    修改中...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    发送
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量生成细纲对话框 */}
        <Dialog open={batchGenerateOutlinesDialogOpen} onOpenChange={setBatchGenerateOutlinesDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>批量生成细纲</DialogTitle>
              <DialogDescription>
                按顺序批量生成多个章节的细纲
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>起始章节</Label>
                  <Input
                    type="number"
                    min={1}
                    value={batchStartChapter}
                    onChange={(e) => {
                      const value = parseInt(e.target.value || '1', 10);
                      setBatchStartChapter(isNaN(value) || value < 1 ? 1 : value);
                    }}
                    disabled={batchGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束章节</Label>
                  <Input
                    type="number"
                    min={1}
                    value={batchEndChapter}
                    onChange={(e) => {
                      const value = parseInt(e.target.value || '1', 10);
                      setBatchEndChapter(isNaN(value) || value < 1 ? 1 : value);
                    }}
                    disabled={batchGenerating}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  将生成第 {batchStartChapter} 章到第 {batchEndChapter} 章的细纲，共 {Math.max(0, batchEndChapter - batchStartChapter + 1)} 章
                </p>
                {batchStartChapter > batchEndChapter && (
                  <p className="text-sm text-destructive">
                    起始章节不能大于结束章节
                  </p>
                )}
                {batchEndChapter - batchStartChapter + 1 > 100 && (
                  <p className="text-sm text-destructive">
                    一次最多生成100章细纲
                  </p>
                )}
              </div>
              {batchProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>生成进度</span>
                    <span>{batchProgress.current} / {batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                  <p className="text-xs text-muted-foreground">{batchProgress.message}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBatchGenerateOutlinesDialogOpen(false);
                  setBatchProgress(null);
                }}
                disabled={batchGenerating}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  if (batchStartChapter > batchEndChapter || batchEndChapter - batchStartChapter + 1 > 100) {
                    toast.error('请检查章节范围');
                    return;
                  }
                  setBatchGenerating(true);
                  setBatchProgress({ current: 0, total: batchEndChapter - batchStartChapter + 1, message: '开始生成...' });
                  batchGenerateOutlinesMutation.mutate({
                    novelId,
                    startChapter: batchStartChapter,
                    endChapter: batchEndChapter,
                  });
                }}
                disabled={batchGenerating || batchStartChapter > batchEndChapter || batchEndChapter - batchStartChapter + 1 > 100}
              >
                {batchGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 批量生成章节内容对话框 */}
        <Dialog open={batchGenerateContentDialogOpen} onOpenChange={setBatchGenerateContentDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>批量生成章节内容</DialogTitle>
              <DialogDescription>
                根据已生成的细纲批量生成章节正文（需要先有细纲）
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>起始章节</Label>
                  <Input
                    type="number"
                    min={1}
                    value={batchStartChapter}
                    onChange={(e) => {
                      const value = parseInt(e.target.value || '1', 10);
                      setBatchStartChapter(isNaN(value) || value < 1 ? 1 : value);
                    }}
                    disabled={batchGenerating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>结束章节</Label>
                  <Input
                    type="number"
                    min={1}
                    value={batchEndChapter}
                    onChange={(e) => {
                      const value = parseInt(e.target.value || '1', 10);
                      setBatchEndChapter(isNaN(value) || value < 1 ? 1 : value);
                    }}
                    disabled={batchGenerating}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>目标字数</Label>
                <Select
                  value={targetWordCount.toString()}
                  onValueChange={(value) => setTargetWordCount(parseInt(value))}
                  disabled={batchGenerating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORD_COUNT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  将生成第 {batchStartChapter} 章到第 {batchEndChapter} 章的内容，共 {Math.max(0, batchEndChapter - batchStartChapter + 1)} 章
                </p>
                {batchStartChapter > batchEndChapter && (
                  <p className="text-sm text-destructive">
                    起始章节不能大于结束章节
                  </p>
                )}
                {batchEndChapter - batchStartChapter + 1 > 50 && (
                  <p className="text-sm text-destructive">
                    一次最多生成50章内容
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  注意：批量生成前请确保对应章节已生成细纲
                </p>
              </div>
              {batchProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>生成进度</span>
                    <span>{batchProgress.current} / {batchProgress.total}</span>
                  </div>
                  <Progress value={(batchProgress.current / batchProgress.total) * 100} />
                  <p className="text-xs text-muted-foreground">{batchProgress.message}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBatchGenerateContentDialogOpen(false);
                  setBatchProgress(null);
                }}
                disabled={batchGenerating}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  if (batchStartChapter > batchEndChapter || batchEndChapter - batchStartChapter + 1 > 50) {
                    toast.error('请检查章节范围');
                    return;
                  }
                  setBatchGenerating(true);
                  setBatchProgress({ current: 0, total: batchEndChapter - batchStartChapter + 1, message: '开始生成...' });
                  batchGenerateContentMutation.mutate({
                    novelId,
                    startChapter: batchStartChapter,
                    endChapter: batchEndChapter,
                    targetWordCount,
                  });
                }}
                disabled={batchGenerating || batchStartChapter > batchEndChapter || batchEndChapter - batchStartChapter + 1 > 50}
              >
                {batchGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    开始生成
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NovelDashboardLayout>
  );
}
