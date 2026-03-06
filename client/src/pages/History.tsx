/**
 * History Page - View generation history
 */
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  History as HistoryIcon,
  Loader2,
  Eye,
  Sparkles,
  Layers,
  FileText,
  Pencil,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface GenerationHistory {
  id: number;
  type: string;
  novel_title?: string;
  chapter_number?: number;
  prompt?: string;
  content?: string;
  status: string;
  error_message?: string;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: 'all', label: '全部类型' },
  { value: 'outline', label: '大纲' },
  { value: 'detailed_outline', label: '细纲' },
  { value: 'chapter', label: '章节' },
  { value: 'revision', label: '修改' },
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'outline':
      return <Sparkles className="h-4 w-4" />;
    case 'detailed_outline':
      return <Layers className="h-4 w-4" />;
    case 'chapter':
      return <FileText className="h-4 w-4" />;
    case 'revision':
      return <Pencil className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const getTypeLabel = (type: string) => {
  const option = TYPE_OPTIONS.find((o) => o.value === type);
  return option?.label || type;
};

export default function History() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [histories] = useState<GenerationHistory[]>([]);
  const [loading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedHistory, setSelectedHistory] = useState<GenerationHistory | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  const handleViewDetail = (history: GenerationHistory) => {
    setSelectedHistory(history);
    setDialogOpen(true);
  };

  if (authLoading) {
    return (
      <NovelDashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </NovelDashboardLayout>
    );
  }

  return (
    <NovelDashboardLayout>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">生成历史</h1>
            <p className="text-muted-foreground font-light">
              查看所有生成操作的历史记录
            </p>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Info Alert */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>功能说明</AlertTitle>
          <AlertDescription>
            生成历史功能需要在本地部署Python后端。当前版本暂不支持在线查看历史记录。
            请参考部署文档启动Python后端服务后使用此功能。
          </AlertDescription>
        </Alert>

        {/* History list */}
        {histories.length === 0 ? (
          <div className="scandi-card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <HistoryIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">暂无历史记录</h3>
            <p className="text-muted-foreground font-light">
              生成内容后，历史记录将显示在这里
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {histories.map((history) => (
              <div key={history.id} className="scandi-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {getTypeIcon(history.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{getTypeLabel(history.type)}</h3>
                        {history.novel_title && (
                          <span className="text-sm text-muted-foreground">
                            - {history.novel_title}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          {new Date(history.created_at).toLocaleString()}
                        </span>
                        {history.chapter_number && (
                          <span>第{history.chapter_number}章</span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-xs rounded ${
                            history.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : history.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {history.status === 'completed'
                            ? '已完成'
                            : history.status === 'failed'
                            ? '失败'
                            : '进行中'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetail(history)}
                    className="gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    查看
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detail dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedHistory && getTypeLabel(selectedHistory.type)}
                {selectedHistory?.novel_title &&
                  ` - ${selectedHistory.novel_title}`}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {selectedHistory?.prompt && (
                <div>
                  <h4 className="font-medium mb-2">输入提示</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">
                      {selectedHistory.prompt}
                    </pre>
                  </div>
                </div>
              )}
              {selectedHistory?.content && (
                <div>
                  <h4 className="font-medium mb-2">生成内容</h4>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">
                      {selectedHistory.content}
                    </pre>
                  </div>
                </div>
              )}
              {selectedHistory?.error_message && (
                <div>
                  <h4 className="font-medium mb-2 text-destructive">错误信息</h4>
                  <div className="p-4 bg-destructive/10 rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm text-destructive">
                      {selectedHistory.error_message}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </NovelDashboardLayout>
  );
}
