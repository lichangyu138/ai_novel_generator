/**
 * Model Configuration Page - Manage AI model settings
 * Supports custom baseUrl for all model types
 */
import React, { useState } from 'react';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Cpu,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Star,
  Globe,
  Key,
  Settings2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', defaultBase: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic Claude', defaultBase: 'https://api.anthropic.com/v1' },
  { value: 'deepseek', label: 'DeepSeek', defaultBase: 'https://api.deepseek.com/v1' },
  { value: 'zhipu', label: '智谱AI', defaultBase: 'https://open.bigmodel.cn/api/paas/v4' },
  { value: 'moonshot', label: 'Moonshot', defaultBase: 'https://api.moonshot.cn/v1' },
  { value: 'qwen', label: '通义千问', defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'ollama', label: 'Ollama (本地)', defaultBase: 'http://localhost:11434/v1' },
  { value: 'custom', label: '自定义API', defaultBase: '' },
];

const COMMON_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  zhipu: ['glm-4-plus', 'glm-4', 'glm-4-flash'],
  moonshot: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  ollama: ['llama3.2', 'qwen2.5', 'deepseek-r1'],
  custom: [],
};

export default function ModelConfigPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    provider: 'openai',
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    modelName: 'gemini-3-pro-preview',
    temperature: '0.7',
    topP: '0.9',
    maxTokens: 4096,
    isDefault: 0,
  });

  const utils = trpc.useUtils();
  const { data: configs, isLoading } = trpc.modelConfigs.list.useQuery();

  const createMutation = trpc.modelConfigs.create.useMutation({
    onSuccess: () => {
      toast.success('配置创建成功');
      setDialogOpen(false);
      resetForm();
      utils.modelConfigs.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '创建失败');
    },
  });

  const updateMutation = trpc.modelConfigs.update.useMutation({
    onSuccess: () => {
      toast.success('配置更新成功');
      setDialogOpen(false);
      resetForm();
      utils.modelConfigs.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '更新失败');
    },
  });

  const deleteMutation = trpc.modelConfigs.delete.useMutation({
    onSuccess: () => {
      toast.success('配置已删除');
      utils.modelConfigs.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '删除失败');
    },
  });

  const setDefaultMutation = trpc.modelConfigs.setDefault.useMutation({
    onSuccess: () => {
      toast.success('已设为默认配置');
      utils.modelConfigs.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || '操作失败');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      displayName: '',
      provider: 'openai',
      apiKey: '',
      apiBase: 'https://api.openai.com/v1',
      modelName: 'gemini-3-pro-preview',
      temperature: '0.7',
      topP: '0.9',
      maxTokens: 4096,
      isDefault: 0,
    });
    setEditingId(null);
    setShowAdvanced(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (config: NonNullable<typeof configs>[number]) => {
    setFormData({
      name: config.name,
      displayName: (config as { displayName?: string }).displayName || '',
      provider: config.provider,
      apiKey: '', // Don't show existing key
      apiBase: config.apiBase || '',
      modelName: config.modelName || '',
      temperature: config.temperature || '0.7',
      topP: config.topP || '0.9',
      maxTokens: config.maxTokens || 4096,
      isDefault: config.isDefault,
    });
    setEditingId(config.id);
    setShowAdvanced(true);
    setDialogOpen(true);
  };

  const handleProviderChange = (provider: string) => {
    const providerInfo = PROVIDERS.find(p => p.value === provider);
    const models = COMMON_MODELS[provider] || [];
    setFormData({
      ...formData,
      provider,
      apiBase: providerInfo?.defaultBase || '',
      modelName: models[0] || '',
    });
  };

  const handleSave = () => {
    if (!formData.name) {
      toast.error('请输入配置名称');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        name: formData.name,
        displayName: formData.displayName || undefined,
        provider: formData.provider,
        apiKey: formData.apiKey || undefined,
        apiBase: formData.apiBase || undefined,
        modelName: formData.modelName || undefined,
        temperature: formData.temperature,
        topP: formData.topP,
        maxTokens: formData.maxTokens,
      });
    } else {
      createMutation.mutate({
        name: formData.name,
        displayName: formData.displayName || undefined,
        provider: formData.provider,
        apiKey: formData.apiKey || undefined,
        apiBase: formData.apiBase || undefined,
        modelName: formData.modelName || undefined,
        temperature: formData.temperature,
        topP: formData.topP,
        maxTokens: formData.maxTokens,
        isDefault: formData.isDefault,
      });
    }
  };

  const handleDelete = (configId: number) => {
    if (!confirm('确定要删除这个配置吗？')) {
      return;
    }
    deleteMutation.mutate({ id: configId });
  };

  const handleSetDefault = (configId: number) => {
    setDefaultMutation.mutate({ id: configId });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <NovelDashboardLayout>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI模型配置</h1>
            <p className="text-muted-foreground font-light">
              管理AI模型API配置，支持自定义API地址
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                添加配置
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? '编辑模型配置' : '添加模型配置'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">配置名称 *</Label>
                  <Input
                    id="name"
                    placeholder="如：GPT-4o 主力模型"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayName">自定义显示名称</Label>
                  <Input
                    id="displayName"
                    placeholder="在界面中显示的名称（可选）"
                    value={formData.displayName}
                    onChange={(e) =>
                      setFormData({ ...formData, displayName: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    留空则使用配置名称作为显示名称
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">模型提供商</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={handleProviderChange}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiBase" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    API Base URL
                  </Label>
                  <Input
                    id="apiBase"
                    placeholder="如：https://api.openai.com/v1"
                    value={formData.apiBase}
                    onChange={(e) =>
                      setFormData({ ...formData, apiBase: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    支持自定义API地址，可用于代理、本地部署或第三方兼容服务
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    API Key
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    placeholder={editingId ? '留空保持不变' : '请输入API Key'}
                    value={formData.apiKey}
                    onChange={(e) =>
                      setFormData({ ...formData, apiKey: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="modelName">模型名称</Label>
                  {COMMON_MODELS[formData.provider]?.length > 0 ? (
                    <Select
                      value={formData.modelName}
                      onValueChange={(value) =>
                        setFormData({ ...formData, modelName: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择模型" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_MODELS[formData.provider].map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="modelName"
                      placeholder="如：gpt-4o, claude-3-opus"
                      value={formData.modelName}
                      onChange={(e) =>
                        setFormData({ ...formData, modelName: e.target.value })
                      }
                    />
                  )}
                </div>

                {/* Advanced Settings Toggle */}
                <div className="flex items-center justify-between pt-2">
                  <Label className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    高级参数设置
                  </Label>
                  <Switch
                    checked={showAdvanced}
                    onCheckedChange={setShowAdvanced}
                  />
                </div>

                {showAdvanced && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>温度 (Temperature)</Label>
                        <span className="text-sm text-muted-foreground">
                          {formData.temperature}
                        </span>
                      </div>
                      <Slider
                        value={[parseFloat(formData.temperature)]}
                        onValueChange={([value]) =>
                          setFormData({ ...formData, temperature: value.toFixed(2) })
                        }
                        min={0}
                        max={2}
                        step={0.01}
                      />
                      <p className="text-xs text-muted-foreground">
                        较低的值使输出更确定，较高的值使输出更随机
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Top P</Label>
                        <span className="text-sm text-muted-foreground">
                          {formData.topP}
                        </span>
                      </div>
                      <Slider
                        value={[parseFloat(formData.topP)]}
                        onValueChange={([value]) =>
                          setFormData({ ...formData, topP: value.toFixed(2) })
                        }
                        min={0}
                        max={1}
                        step={0.01}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">最大Token数</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        value={formData.maxTokens}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxTokens: parseInt(e.target.value) || 4096,
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      '保存'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Config List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !configs || configs.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Cpu className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">还没有模型配置</h3>
            <p className="text-muted-foreground font-light mb-6">
              添加AI模型配置以开始使用小说生成功能
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              添加配置
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {configs.map((config) => (
              <div key={config.id} className="scandi-card p-6 group relative">
                {config.isDefault === 1 && (
                  <div className="absolute top-3 right-3">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Cpu className="h-6 w-6 text-primary" />
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
                      <DropdownMenuItem onClick={() => handleOpenEdit(config)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      {config.isDefault !== 1 && (
                        <DropdownMenuItem onClick={() => handleSetDefault(config.id)}>
                          <Star className="h-4 w-4 mr-2" />
                          设为默认
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(config.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="text-lg font-bold mb-2">{config.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">提供商:</span>
                    <span className="font-medium">
                      {PROVIDERS.find(p => p.value === config.provider)?.label || config.provider}
                    </span>
                  </div>
                  {config.modelName && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">模型:</span>
                      <span className="font-medium">{config.modelName}</span>
                    </div>
                  )}
                  {config.apiBase && (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {config.apiBase}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2 text-xs text-muted-foreground">
                    <span>温度: {config.temperature}</span>
                    <span>Top P: {config.topP}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </NovelDashboardLayout>
  );
}
