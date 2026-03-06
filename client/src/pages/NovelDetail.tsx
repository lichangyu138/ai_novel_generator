/**
 * Novel Detail Page - Overview of a novel project
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Users,
  FileText,
  Layers,
  Network,
  Loader2,
  Save,
  ArrowRight,
  Eye,
  Settings,
  Sparkles,
} from 'lucide-react';
import { NovelPreviewDialog } from '@/components/NovelPreviewDialog';
import { NovelSettingsDialog } from '@/components/NovelSettingsDialog';
import { toast } from 'sonner';

const GENRES = [
  '玄幻', '奇幻', '武侠', '仙侠', '都市', '现实',
  '军事', '历史', '游戏', '体育', '科幻', '悬疑', '轻小说', '其他',
];

const STYLES = [
  '热血', '轻松', '搞笑', '虐心', '治愈', '黑暗', '励志', '爽文', '其他',
];

export default function NovelDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const novelId = parseInt(params.id || '0');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [editData, setEditData] = useState({
    title: '',
    genre: '',
    style: '',
    description: '',
    prompt: '',
    worldSetting: '',
  });

  const utils = trpc.useUtils();
  const { data: novel, isLoading } = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: novelId > 0 && isAuthenticated }
  );

  const updateMutation = trpc.novels.update.useMutation({
    onSuccess: () => {
      toast.success('保存成功');
      utils.novels.get.invalidate({ id: novelId });
    },
    onError: (error) => {
      toast.error(error.message || '保存失败');
    },
  });

  useEffect(() => {
    if (novel) {
      setEditData({
        title: novel.title,
        genre: novel.genre || '',
        style: novel.style || '',
        description: novel.description || '',
        prompt: novel.prompt || '',
        worldSetting: novel.worldSetting || '',
      });
    }
  }, [novel]);

  useEffect(() => {
    if (!isLoading && !novel && novelId > 0) {
      toast.error('小说不存在');
      setLocation('/novels');
    }
  }, [isLoading, novel, novelId, setLocation]);

  // AI 生成世界观
  const generateWorldSettingMutation = trpc.ai.generateWorldSetting.useMutation({
    onSuccess: (data) => {
      setEditData((prev) => ({ ...prev, worldSetting: data.content || '' }));
      toast.success('已根据大纲生成世界观');
    },
    onError: (error) => {
      toast.error(error.message || '生成失败');
    },
  });

  const handleSave = () => {
    if (!editData.title) {
      toast.error('请输入小说标题');
      return;
    }

    updateMutation.mutate({
      id: novelId,
      title: editData.title,
      genre: editData.genre || undefined,
      style: editData.style || undefined,
      description: editData.description || undefined,
      prompt: editData.prompt || undefined,
      worldSetting: editData.worldSetting || undefined,
    });
  };

  const navigateTo = (path: string) => {
    setLocation(path);
  };

  if (isLoading) {
    return (
      <NovelDashboardLayout novelId={novelId}>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </NovelDashboardLayout>
    );
  }

  if (!novel) {
    return null;
  }

  return (
    <NovelDashboardLayout novelId={novelId} novelTitle={novel.title}>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{novel.title}</h1>
            <p className="text-muted-foreground font-light">
              项目概览和基本设置
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2">
              <Eye className="h-4 w-4" />
              预览
            </Button>
            <Button variant="outline" onClick={() => setSettingsOpen(true)} className="gap-2">
              <Settings className="h-4 w-4" />
              设置
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  保存修改
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">基本信息</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">小说标题</Label>
                  <Input
                    id="title"
                    value={editData.title}
                    onChange={(e) =>
                      setEditData({ ...editData, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="genre">类型</Label>
                    <Select
                      value={editData.genre}
                      onValueChange={(value) =>
                        setEditData({ ...editData, genre: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENRES.map((genre) => (
                          <SelectItem key={genre} value={genre}>
                            {genre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="style">风格</Label>
                    <Select
                      value={editData.style}
                      onValueChange={(value) =>
                        setEditData({ ...editData, style: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择风格" />
                      </SelectTrigger>
                      <SelectContent>
                        {STYLES.map((style) => (
                          <SelectItem key={style} value={style}>
                            {style}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">简介</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={editData.description}
                    onChange={(e) =>
                      setEditData({ ...editData, description: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">世界观设定</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => generateWorldSettingMutation.mutate({ novelId })}
                  disabled={generateWorldSettingMutation.isPending}
                >
                  {generateWorldSettingMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      AI 从大纲生成
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                rows={6}
                placeholder="描述小说的世界观、背景设定、时代背景等"
                value={editData.worldSetting}
                onChange={(e) =>
                  setEditData({ ...editData, worldSetting: e.target.value })
                }
              />
            </div>

            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">创作提示词</h2>
              <Textarea
                rows={6}
                placeholder="用于指导AI生成内容的提示词，可以包含写作风格、叙事视角、语言特点等"
                value={editData.prompt}
                onChange={(e) =>
                  setEditData({ ...editData, prompt: e.target.value })
                }
              />
            </div>
          </div>

          {/* Quick actions */}
          <div className="space-y-6">
            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">快速操作</h2>
              <div className="space-y-3">
                <button
                  onClick={() => navigateTo(`/novels/${novelId}/characters`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">人物设定</div>
                      <div className="text-sm text-muted-foreground">
                        管理角色信息
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <button
                  onClick={() => navigateTo(`/novels/${novelId}/outline`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">大纲管理</div>
                      <div className="text-sm text-muted-foreground">
                        生成和编辑大纲
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <button
                  onClick={() => navigateTo(`/novels/${novelId}/chapters`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <FileText className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="font-medium">章节管理</div>
                      <div className="text-sm text-muted-foreground">
                        生成和审核章节
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <button
                  onClick={() => navigateTo(`/novels/${novelId}/knowledge`)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Network className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">知识图谱</div>
                      <div className="text-sm text-muted-foreground">
                        可视化人物关系
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>
              </div>
            </div>

            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">项目信息</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">创建时间</span>
                  <span>{new Date(novel.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">更新时间</span>
                  <span>{new Date(novel.updatedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">状态</span>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                    {novel.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Dialog */}
        <NovelPreviewDialog
          novelId={novelId}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />

        {/* Settings Dialog */}
        <NovelSettingsDialog
          novelId={novelId}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSaved={() => utils.novels.get.invalidate({ id: novelId })}
        />
      </div>
    </NovelDashboardLayout>
  );
}
