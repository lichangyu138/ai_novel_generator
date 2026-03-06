/**
 * Outline Page - Generate and manage novel outlines with AI
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Sparkles,
  Loader2,
  Save,
  RefreshCw,
  Layers,
  Trash2,
  MessageSquare,
  Edit3,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Outline() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const novelId = parseInt(params.id || '0');

  const [editContent, setEditContent] = useState('');
  const [activeTab, setActiveTab] = useState('outline');
  const [generating, setGenerating] = useState(false);
  const [generatingDetailed, setGeneratingDetailed] = useState<number | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState('');
  const [modifyRequest, setModifyRequest] = useState('');
  const [modifyDialogOpen, setModifyDialogOpen] = useState(false);
  const [isModifying, setIsModifying] = useState(false);

  // tRPC queries
  const novelQuery = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );
  
  const outlineQuery = trpc.outlines.getActive.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const detailedOutlinesQuery = trpc.detailedOutlines.listByNovel.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  // tRPC mutations
  const updateOutlineMutation = trpc.outlines.update.useMutation();
  const clearOutlineMutation = trpc.outlines.clear.useMutation();
  const generateOutlineMutation = trpc.ai.generateOutline.useMutation();
  const modifyOutlineMutation = trpc.ai.modifyOutline.useMutation();
  const generateDetailedMutation = trpc.ai.generateDetailedOutline.useMutation();

  const utils = trpc.useUtils();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Redirect if novel not found
  useEffect(() => {
    if (novelQuery.isError || (novelQuery.isFetched && !novelQuery.data)) {
      toast.error('小说不存在');
      setLocation('/novels');
    }
  }, [novelQuery.isError, novelQuery.isFetched, novelQuery.data, setLocation]);

  // Set edit content when outline loads
  useEffect(() => {
    if (outlineQuery.data) {
      setEditContent(outlineQuery.data.content || '');
    }
  }, [outlineQuery.data]);

  // AI Generate Outline
  const handleGenerateOutline = async () => {
    setGenerating(true);
    try {
      const result = await generateOutlineMutation.mutateAsync({
        novelId,
        additionalPrompt: additionalPrompt || undefined,
      });
      toast.success('大纲生成完成');
      setEditContent(result.content);
      setAdditionalPrompt('');
      utils.outlines.getActive.invalidate({ novelId });
      utils.outlines.list.invalidate({ novelId });
    } catch (error) {
      toast.error('生成大纲失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  // AI Modify Outline
  const handleModifyOutline = async () => {
    if (!outlineQuery.data || !modifyRequest) {
      toast.error('请输入修改要求');
      return;
    }

    setIsModifying(true);
    try {
      const result = await modifyOutlineMutation.mutateAsync({
        novelId,
        outlineId: outlineQuery.data.id,
        currentContent: editContent,
        modifyRequest,
      });
      toast.success('大纲修改完成');
      setEditContent(result.content);
      setModifyRequest('');
      setModifyDialogOpen(false);
      utils.outlines.getActive.invalidate({ novelId });
    } catch (error) {
      toast.error('AI修改失败，请重试');
    } finally {
      setIsModifying(false);
    }
  };

  // Save manual edits
  const handleSaveOutline = async () => {
    if (!outlineQuery.data) return;

    try {
      await updateOutlineMutation.mutateAsync({
        id: outlineQuery.data.id,
        content: editContent,
      });
      toast.success('大纲保存成功');
      utils.outlines.getActive.invalidate({ novelId });
    } catch (error) {
      toast.error('保存失败');
    }
  };

  // Clear all outlines
  const handleClearOutline = async () => {
    if (!confirm('确定要清除所有大纲和细纲吗？此操作不可恢复。')) {
      return;
    }

    try {
      await clearOutlineMutation.mutateAsync({ novelId });
      toast.success('大纲已清除');
      setEditContent('');
      utils.outlines.getActive.invalidate({ novelId });
      utils.outlines.list.invalidate({ novelId });
      utils.detailedOutlines.listByNovel.invalidate({ novelId });
    } catch (error) {
      toast.error('清除失败');
    }
  };

  // Generate detailed outline
  const handleGenerateDetailedOutline = async (groupIndex: number) => {
    if (!outlineQuery.data) return;

    const startChapter = groupIndex * 5 + 1;
    const endChapter = startChapter + 4;

    setGeneratingDetailed(groupIndex);
    try {
      await generateDetailedMutation.mutateAsync({
        novelId,
        outlineId: outlineQuery.data.id,
        groupIndex,
        startChapter,
        endChapter,
      });
      toast.success(`第${startChapter}-${endChapter}章细纲生成完成`);
      utils.detailedOutlines.listByNovel.invalidate({ novelId });
    } catch (error) {
      toast.error('生成细纲失败');
    } finally {
      setGeneratingDetailed(null);
    }
  };

  // Loading state
  if (authLoading || novelQuery.isLoading) {
    return (
      <NovelDashboardLayout novelId={novelId}>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </NovelDashboardLayout>
    );
  }

  const novel = novelQuery.data;
  const currentOutline = outlineQuery.data;
  const detailedOutlines = detailedOutlinesQuery.data || [];

  return (
    <NovelDashboardLayout novelId={novelId} novelTitle={novel?.title}>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">大纲管理</h1>
            <p className="text-muted-foreground font-light">
              AI生成和编辑小说大纲，支持手动修改和AI辅助修改
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="outline" className="gap-2">
              <Sparkles className="h-4 w-4" />
              总大纲
            </TabsTrigger>
          </TabsList>

          {/* Main Outline Tab */}
          <TabsContent value="outline" className="space-y-6">
            {/* Generation prompt */}
            {!currentOutline && (
              <div className="scandi-card p-6 space-y-4">
                <Label>生成提示（可选）</Label>
                <Textarea
                  placeholder="输入额外的创作要求，如：希望故事更加悬疑、增加感情线、设定在未来世界等..."
                  rows={3}
                  value={additionalPrompt}
                  onChange={(e) => setAdditionalPrompt(e.target.value)}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGenerateOutline}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {currentOutline ? '重新生成大纲' : 'AI生成大纲'}
                  </>
                )}
              </Button>
              
              {currentOutline && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setModifyDialogOpen(true)}
                    className="gap-2"
                  >
                    <MessageSquare className="h-4 w-4" />
                    AI修改
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveOutline}
                    disabled={updateOutlineMutation.isPending}
                    className="gap-2"
                  >
                    {updateOutlineMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    保存修改
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearOutline}
                    disabled={clearOutlineMutation.isPending}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    {clearOutlineMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    清除大纲
                  </Button>
                </>
              )}
            </div>

            {/* Editor */}
            {currentOutline ? (
              <div className="scandi-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">当前大纲</h2>
                    <span className="text-sm text-muted-foreground">
                      版本 {currentOutline.version}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Edit3 className="h-4 w-4" />
                    可直接编辑
                  </div>
                </div>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="大纲内容..."
                />
              </div>
            ) : (
              <div className="scandi-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">还没有大纲</h3>
                <p className="text-muted-foreground font-light mb-6">
                  点击上方按钮，让AI根据小说设定和人物信息生成大纲
                </p>
              </div>
            )}
          </TabsContent>


        </Tabs>

        {/* AI Modify Dialog */}
        <Dialog open={modifyDialogOpen} onOpenChange={setModifyDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>AI修改大纲</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>修改要求</Label>
                <Textarea
                  placeholder="请描述你希望如何修改大纲，例如：增加更多悬疑元素、调整第二卷的情节发展、加强主角与反派的对抗等..."
                  rows={4}
                  value={modifyRequest}
                  onChange={(e) => setModifyRequest(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setModifyDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleModifyOutline}
                  disabled={isModifying || !modifyRequest}
                  className="gap-2"
                >
                  {isModifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      AI修改中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      开始修改
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </NovelDashboardLayout>
  );
}
