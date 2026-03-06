/**
 * Novel Settings Dialog Component
 * Supports custom genre/style, writer style templates, and AI tone removal
 */
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, Palette, BookOpen, Settings } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface NovelSettingsDialogProps {
  novelId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

// Predefined genres
const GENRES = [
  { value: 'fantasy', label: '玄幻' },
  { value: 'xianxia', label: '仙侠' },
  { value: 'wuxia', label: '武侠' },
  { value: 'urban', label: '都市' },
  { value: 'romance', label: '言情' },
  { value: 'scifi', label: '科幻' },
  { value: 'history', label: '历史' },
  { value: 'game', label: '游戏' },
  { value: 'sports', label: '竞技' },
  { value: 'military', label: '军事' },
  { value: 'custom', label: '自定义' },
];

// Predefined styles
const STYLES = [
  { value: 'light', label: '轻松幽默' },
  { value: 'serious', label: '严肃正剧' },
  { value: 'dark', label: '黑暗沉重' },
  { value: 'warm', label: '温馨治愈' },
  { value: 'suspense', label: '悬疑烧脑' },
  { value: 'action', label: '热血激燃' },
  { value: 'custom', label: '自定义' },
];

// Writer style templates
const WRITER_STYLES = [
  { 
    value: 'none', 
    label: '无特定风格',
    prompt: '',
  },
  { 
    value: 'jinyong', 
    label: '金庸风格',
    prompt: '模仿金庸先生的写作风格，注重武侠江湖的氛围营造，人物对话古朴典雅，善用诗词歌赋点缀，情节跌宕起伏，注重侠义精神的表达。',
  },
  { 
    value: 'gulong', 
    label: '古龙风格',
    prompt: '模仿古龙先生的写作风格，句子简短有力，善用断句制造悬念，人物性格鲜明独特，对话机智幽默，注重氛围和意境的营造。',
  },
  { 
    value: 'maoyan', 
    label: '猫腻风格',
    prompt: '模仿猫腻的写作风格，文字细腻优美，善于心理描写，情节布局精巧，人物成长线清晰，注重细节伏笔的埋设。',
  },
  { 
    value: 'tangjiasanshao', 
    label: '唐家三少风格',
    prompt: '模仿唐家三少的写作风格，节奏明快，战斗描写热血激燃，主角成长路线清晰，情感描写细腻，善于设置升级体系。',
  },
  { 
    value: 'ergen', 
    label: '耳根风格',
    prompt: '模仿耳根的写作风格，文笔优美富有诗意，善于营造宏大世界观，人物刻画深刻，情节跌宕起伏，注重情感的细腻表达。',
  },
  { 
    value: 'tiancan', 
    label: '天蚕土豆风格',
    prompt: '模仿天蚕土豆的写作风格，节奏紧凑，战斗场面精彩，主角性格鲜明，善于设置热血燃点，情节推进迅速。',
  },
  { 
    value: 'custom', 
    label: '自定义风格',
    prompt: '',
  },
];

export function NovelSettingsDialog({
  novelId,
  open,
  onOpenChange,
  onSaved,
}: NovelSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    customGenre: '',
    style: '',
    customStyle: '',
    writerStyle: 'none',
    writerStylePrompt: '',
    removeAiTone: 0,
    description: '',
    prompt: '',
    worldSetting: '',
  });

  const utils = trpc.useUtils();
  const { data: novel, isLoading } = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: open }
  );

  const updateMutation = trpc.novels.update.useMutation({
    onSuccess: () => {
      toast.success('设置已保存');
      utils.novels.get.invalidate({ id: novelId });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message || '保存失败');
    },
  });

  // Load novel data into form
  useEffect(() => {
    if (novel) {
      const novelData = novel as {
        title: string;
        genre?: string | null;
        customGenre?: string | null;
        style?: string | null;
        customStyle?: string | null;
        writerStyle?: string | null;
        writerStylePrompt?: string | null;
        removeAiTone?: number | null;
        description?: string | null;
        prompt?: string | null;
        worldSetting?: string | null;
      };
      setFormData({
        title: novelData.title || '',
        genre: novelData.genre || '',
        customGenre: novelData.customGenre || '',
        style: novelData.style || '',
        customStyle: novelData.customStyle || '',
        writerStyle: novelData.writerStyle || 'none',
        writerStylePrompt: novelData.writerStylePrompt || '',
        removeAiTone: novelData.removeAiTone || 0,
        description: novelData.description || '',
        prompt: novelData.prompt || '',
        worldSetting: novelData.worldSetting || '',
      });
    }
  }, [novel]);

  const handleWriterStyleChange = (value: string) => {
    const style = WRITER_STYLES.find(s => s.value === value);
    setFormData({
      ...formData,
      writerStyle: value,
      writerStylePrompt: style?.prompt || formData.writerStylePrompt,
    });
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error('请输入小说标题');
      return;
    }

    updateMutation.mutate({
      id: novelId,
      title: formData.title,
      genre: formData.genre === 'custom' ? 'custom' : formData.genre || undefined,
      customGenre: formData.genre === 'custom' ? formData.customGenre : undefined,
      style: formData.style === 'custom' ? 'custom' : formData.style || undefined,
      customStyle: formData.style === 'custom' ? formData.customStyle : undefined,
      writerStyle: formData.writerStyle || undefined,
      writerStylePrompt: formData.writerStylePrompt || undefined,
      removeAiTone: formData.removeAiTone,
      description: formData.description || undefined,
      prompt: formData.prompt || undefined,
      worldSetting: formData.worldSetting || undefined,
    });
  };

  const isPending = updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            小说设置
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">
                <BookOpen className="h-4 w-4 mr-2" />
                基本信息
              </TabsTrigger>
              <TabsTrigger value="style">
                <Palette className="h-4 w-4 mr-2" />
                风格设置
              </TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles className="h-4 w-4 mr-2" />
                AI设置
              </TabsTrigger>
            </TabsList>

            {/* Basic Info Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">小说标题 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请输入小说标题"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>小说类型</Label>
                  <Select
                    value={formData.genre}
                    onValueChange={(v) => setFormData({ ...formData, genre: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre.value} value={genre.value}>
                          {genre.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.genre === 'custom' && (
                    <Input
                      placeholder="输入自定义类型"
                      value={formData.customGenre}
                      onChange={(e) => setFormData({ ...formData, customGenre: e.target.value })}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>小说风格</Label>
                  <Select
                    value={formData.style}
                    onValueChange={(v) => setFormData({ ...formData, style: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择风格" />
                    </SelectTrigger>
                    <SelectContent>
                      {STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value}>
                          {style.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.style === 'custom' && (
                    <Input
                      placeholder="输入自定义风格"
                      value={formData.customStyle}
                      onChange={(e) => setFormData({ ...formData, customStyle: e.target.value })}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">小说简介</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="请输入小说简介..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="worldSetting">世界观设定</Label>
                <Textarea
                  id="worldSetting"
                  value={formData.worldSetting}
                  onChange={(e) => setFormData({ ...formData, worldSetting: e.target.value })}
                  placeholder="描述小说的世界观、背景设定..."
                  rows={4}
                />
              </div>
            </TabsContent>

            {/* Style Tab */}
            <TabsContent value="style" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>作家描写风格</Label>
                <p className="text-sm text-muted-foreground">
                  选择一个知名作家的写作风格作为参考，AI将模仿该风格进行创作
                </p>
                <Select
                  value={formData.writerStyle}
                  onValueChange={handleWriterStyleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择作家风格" />
                  </SelectTrigger>
                  <SelectContent>
                    {WRITER_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="writerStylePrompt">风格提示词</Label>
                <p className="text-sm text-muted-foreground">
                  详细描述您希望的写作风格，AI将根据此提示词调整输出
                </p>
                <Textarea
                  id="writerStylePrompt"
                  value={formData.writerStylePrompt}
                  onChange={(e) => setFormData({ ...formData, writerStylePrompt: e.target.value })}
                  placeholder="描述您期望的写作风格..."
                  rows={6}
                />
              </div>

              {formData.writerStyle !== 'none' && formData.writerStyle !== 'custom' && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">当前选择的风格特点：</p>
                  <p className="text-sm text-muted-foreground">
                    {WRITER_STYLES.find(s => s.value === formData.writerStyle)?.prompt}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* AI Settings Tab */}
            <TabsContent value="ai" className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base">去AI味</Label>
                  <p className="text-sm text-muted-foreground">
                    启用后，AI生成的内容将更加自然，减少机械感和套路化表达
                  </p>
                </div>
                <Switch
                  checked={formData.removeAiTone === 1}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, removeAiTone: checked ? 1 : 0 })
                  }
                />
              </div>

              {formData.removeAiTone === 1 && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    去AI味功能已启用
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 减少"不禁"、"竟然"等AI常用词汇</li>
                    <li>• 避免过于工整的排比和对仗</li>
                    <li>• 增加口语化和个性化表达</li>
                    <li>• 减少说教性和总结性语句</li>
                    <li>• 让对话更加自然生动</li>
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prompt">全局生成提示词</Label>
                <p className="text-sm text-muted-foreground">
                  此提示词将应用于所有AI生成内容，可用于设置特殊要求
                </p>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="例如：注重细节描写，多使用比喻和拟人手法..."
                  rows={4}
                />
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
