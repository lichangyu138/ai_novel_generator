/**
 * Novel List Page - Display user's novels with Scandinavian design
 */
import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  Plus,
  BookOpen,
  Calendar,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const GENRES = [
  '玄幻',
  '奇幻',
  '武侠',
  '仙侠',
  '都市',
  '现实',
  '军事',
  '历史',
  '游戏',
  '体育',
  '科幻',
  '悬疑',
  '轻小说',
  '其他',
];

const STYLES = [
  '热血',
  '轻松',
  '搞笑',
  '虐心',
  '治愈',
  '黑暗',
  '励志',
  '爽文',
  '其他',
];

export default function NovelList() {
  const [, setLocation] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newNovel, setNewNovel] = useState({
    title: '',
    genre: '',
    style: '',
    description: '',
    prompt: '',
    worldSetting: '',
  });

  const utils = trpc.useUtils();
  const { data: novels, isLoading } = trpc.novels.list.useQuery();
  
  const createMutation = trpc.novels.create.useMutation({
    onSuccess: () => {
      toast.success('小说创建成功');
      setCreateDialogOpen(false);
      setNewNovel({
        title: '',
        genre: '',
        style: '',
        description: '',
        prompt: '',
        worldSetting: '',
      });
      utils.novels.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '创建失败');
    },
  });

  const deleteMutation = trpc.novels.delete.useMutation({
    onSuccess: () => {
      toast.success('小说已删除');
      utils.novels.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '删除失败');
    },
  });

  const handleCreateNovel = () => {
    if (!newNovel.title) {
      toast.error('请输入小说标题');
      return;
    }
    createMutation.mutate(newNovel);
  };

  const handleDeleteNovel = (novelId: number) => {
    if (!confirm('确定要删除这本小说吗？此操作不可恢复。')) {
      return;
    }
    deleteMutation.mutate({ id: novelId });
  };

  return (
    <NovelDashboardLayout>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">我的小说</h1>
            <p className="text-muted-foreground font-light">
              管理你的所有小说项目
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                创建新小说
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>创建新小说</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">小说标题 *</Label>
                  <Input
                    id="title"
                    placeholder="请输入小说标题"
                    value={newNovel.title}
                    onChange={(e) =>
                      setNewNovel({ ...newNovel, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="genre">类型</Label>
                    <Select
                      value={newNovel.genre}
                      onValueChange={(value) =>
                        setNewNovel({ ...newNovel, genre: value })
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
                      value={newNovel.style}
                      onValueChange={(value) =>
                        setNewNovel({ ...newNovel, style: value })
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
                    placeholder="请输入小说简介"
                    rows={3}
                    value={newNovel.description}
                    onChange={(e) =>
                      setNewNovel({ ...newNovel, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="worldSetting">世界观设定</Label>
                  <Textarea
                    id="worldSetting"
                    placeholder="描述小说的世界观、背景设定等"
                    rows={4}
                    value={newNovel.worldSetting}
                    onChange={(e) =>
                      setNewNovel({ ...newNovel, worldSetting: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">创作提示词</Label>
                  <Textarea
                    id="prompt"
                    placeholder="用于指导AI生成内容的提示词"
                    rows={4}
                    value={newNovel.prompt}
                    onChange={(e) =>
                      setNewNovel({ ...newNovel, prompt: e.target.value })
                    }
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleCreateNovel} disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        创建中...
                      </>
                    ) : (
                      '创建'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Novel Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !novels || novels.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">还没有小说</h3>
            <p className="text-muted-foreground font-light mb-6">
              点击上方按钮创建你的第一本小说
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              创建新小说
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {novels.map((novel) => (
              <div key={novel.id} className="scandi-card p-6 group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setLocation(`/novels/${novel.id}`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteNovel(novel.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link href={`/novels/${novel.id}`} className="block">
                  <h3 className="text-lg font-bold mb-2 hover:text-primary transition-colors">
                    {novel.title}
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {novel.genre && (
                      <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                        {novel.genre}
                      </span>
                    )}
                    {novel.style && (
                      <span className="px-2 py-0.5 text-xs bg-secondary/50 text-secondary-foreground rounded">
                        {novel.style}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-light line-clamp-2 mb-4">
                    {novel.description || '暂无简介'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(novel.createdAt).toLocaleDateString()}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </NovelDashboardLayout>
  );
}
