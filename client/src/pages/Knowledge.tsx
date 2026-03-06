/**
 * Knowledge Base Page - Manage story events and knowledge entries
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Clock,
  Database,
  Loader2,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  BookOpen,
  MapPin,
  Filter,
  Users,
  Globe,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

// Timeline visualization for story events
function StoryTimeline({ events, onEdit, onDelete }: {
  events: any[]; 
  onEdit: (event: any) => void;
  onDelete: (id: number) => void;
}) {
  const eventTypeColors: Record<string, string> = {
    'plot': 'bg-blue-500',
    'character': 'bg-purple-500',
    'world': 'bg-green-500',
    'conflict': 'bg-red-500',
    'resolution': 'bg-yellow-500',
  };

  const eventTypeLabels: Record<string, string> = {
    'plot': '剧情',
    'character': '人物',
    'world': '世界',
    'conflict': '冲突',
    'resolution': '解决',
  };

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Clock className="h-12 w-12 mb-4 opacity-50" />
        <p>暂无事件数据</p>
        <p className="text-sm">AI生成章节后将自动提取事件</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8 space-y-4">
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
      {events.map((event) => (
        <div key={event.id} className="relative group">
          <div className={`absolute left-[-1.625rem] top-1.5 w-3 h-3 rounded-full ${eventTypeColors[event.eventType] || 'bg-gray-500'}`} />
          <div className="scandi-card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{event.name}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full text-white ${eventTypeColors[event.eventType] || 'bg-gray-500'}`}>
                    {eventTypeLabels[event.eventType] || '其他'}
                  </span>
                  {event.importance && (
                    <span className="text-xs text-muted-foreground">
                      重要度: {'★'.repeat(event.importance)}
                    </span>
                  )}
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {event.timePoint || '未知时间'}
                </span>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(event)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(event.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Knowledge base entries list
function KnowledgeList({
  entries,
  onEdit,
  onDelete,
  onSync,
  filterType,
  setFilterType
}: {
  entries: any[];
  onEdit: (entry: any) => void;
  onDelete: (id: number) => void;
  onSync: (id: number) => void;
  filterType: string;
  setFilterType: (type: string) => void;
}) {
  // 可以同步到世界观的类型
  const syncableTypes = ['location', 'item', 'organization'];

  const typeLabels: Record<string, string> = {
    'character': '人物',
    'relationship': '关系',
    'event': '事件',
    'location': '地点',
    'item': '物品',
    'organization': '组织',
    'setting': '设定',
    'other': '其他',
  };

  const typeIcons: Record<string, React.ReactNode> = {
    'character': <Users className="h-4 w-4" />,
    'relationship': <Users className="h-4 w-4" />,
    'event': <Clock className="h-4 w-4" />,
    'location': <MapPin className="h-4 w-4" />,
    'item': <BookOpen className="h-4 w-4" />,
    'organization': <Globe className="h-4 w-4" />,
    'setting': <Globe className="h-4 w-4" />,
    'other': <Database className="h-4 w-4" />,
  };

  const filteredEntries = filterType === 'all' 
    ? entries 
    : entries.filter(e => e.type === filterType);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="character">人物</SelectItem>
            <SelectItem value="event">事件</SelectItem>
            <SelectItem value="location">地点</SelectItem>
            <SelectItem value="item">物品</SelectItem>
            <SelectItem value="setting">设定</SelectItem>
            <SelectItem value="other">其他</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          共 {filteredEntries.length} 条记录
        </span>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
          <Database className="h-12 w-12 mb-4 opacity-50" />
          <p>暂无知识条目</p>
          <p className="text-sm">AI生成章节后将自动提取知识</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredEntries.map((entry) => (
            <div key={entry.id} className="scandi-card p-4 group hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {typeIcons[entry.type]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{entry.name}</h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-muted">
                        {typeLabels[entry.type]}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {entry.description}
                      </p>
                    )}
                    {entry.isAutoExtracted === 1 && entry.sourceChapterId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                          自动提取自第{entry.sourceChapterId}章
                        </span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  {syncableTypes.includes(entry.type) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSync(entry.id)}
                      title="同步到世界观"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(entry.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Knowledge() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const novelId = parseInt(params.id || '0');

  const [activeTab, setActiveTab] = useState('characters');
  const [filterType, setFilterType] = useState('all');
  
  // Dialog states
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showKnowledgeDialog, setShowKnowledgeDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<any>(null);

  // Form states
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    timePoint: '',
    eventType: 'plot' as const,
    importance: 3,
  });

  const [knowledgeForm, setKnowledgeForm] = useState({
    type: 'character' as const,
    name: '',
    description: '',
  });

  // tRPC queries
  const novelQuery = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const eventsQuery = trpc.events.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const knowledgeQuery = trpc.knowledge.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const syncToWorldbuildingMutation = trpc.knowledge.syncToWorldbuilding.useMutation({
    onSuccess: (data) => {
      toast.success(data.message || '已同步到世界观');
      knowledgeQuery.refetch();
    },
    onError: (error) => {
      toast.error(`同步失败: ${error.message}`);
    },
  });

  const aiInitTimelineFromOutline = trpc.worldbuilding.timeline.initializeFromOutline.useMutation({
    onSuccess: (res) => {
      eventsQuery.refetch();
      toast.success(`已从大纲提取 ${res.eventsCreated} 个事件`);
    },
    onError: (error) => {
      toast.error(`AI初始化失败: ${error.message}`);
    },
  });

  const aiInitTimelineFromChapters = trpc.worldbuilding.timeline.initializeFromChapters.useMutation({
    onSuccess: (res) => {
      eventsQuery.refetch();
      toast.success(`已从 ${res.chaptersProcessed} 章提取 ${res.eventsCreated} 个事件`);
    },
    onError: (error) => {
      toast.error(`AI初始化失败: ${error.message}`);
    },
  });

  // Mutations
  const utils = trpc.useUtils();

  const createEventMutation = trpc.events.create.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate({ novelId });
      setShowEventDialog(false);
      resetEventForm();
      toast.success('事件创建成功');
    },
    onError: () => toast.error('创建失败'),
  });

  const updateEventMutation = trpc.events.update.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate({ novelId });
      setShowEventDialog(false);
      setEditingEvent(null);
      resetEventForm();
      toast.success('事件更新成功');
    },
    onError: () => toast.error('更新失败'),
  });

  const deleteEventMutation = trpc.events.delete.useMutation({
    onSuccess: () => {
      utils.events.list.invalidate({ novelId });
      toast.success('事件删除成功');
    },
    onError: () => toast.error('删除失败'),
  });

  const createKnowledgeMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate({ novelId });
      setShowKnowledgeDialog(false);
      resetKnowledgeForm();
      toast.success('知识条目创建成功');
    },
    onError: () => toast.error('创建失败'),
  });

  const updateKnowledgeMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate({ novelId });
      setShowKnowledgeDialog(false);
      setEditingKnowledge(null);
      resetKnowledgeForm();
      toast.success('知识条目更新成功');
    },
    onError: () => toast.error('更新失败'),
  });

  const deleteKnowledgeMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate({ novelId });
      toast.success('知识条目删除成功');
    },
    onError: () => toast.error('删除失败'),
  });

  const resetEventForm = () => {
    setEventForm({
      name: '',
      description: '',
      timePoint: '',
      eventType: 'plot',
      importance: 3,
    });
  };

  const resetKnowledgeForm = () => {
    setKnowledgeForm({
      type: 'other',
      name: '',
      description: '',
    });
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setEventForm({
      name: event.name,
      description: event.description || '',
      timePoint: event.timePoint || '',
      eventType: event.eventType || 'plot',
      importance: event.importance || 3,
    });
    setShowEventDialog(true);
  };

  const handleEditKnowledge = (entry: any) => {
    setEditingKnowledge(entry);
    setKnowledgeForm({
      type: entry.type,
      name: entry.name,
      description: entry.description || '',
    });
    setShowKnowledgeDialog(true);
  };

  const handleSaveEvent = () => {
    if (!eventForm.name.trim()) {
      toast.error('请输入事件名称');
      return;
    }

    if (editingEvent) {
      updateEventMutation.mutate({
        id: editingEvent.id,
        ...eventForm,
      });
    } else {
      createEventMutation.mutate({
        novelId,
        ...eventForm,
      });
    }
  };

  const handleSaveKnowledge = () => {
    if (!knowledgeForm.name.trim()) {
      toast.error('请输入名称');
      return;
    }

    if (editingKnowledge) {
      updateKnowledgeMutation.mutate({
        id: editingKnowledge.id,
        ...knowledgeForm,
      });
    } else {
      createKnowledgeMutation.mutate({
        novelId,
        ...knowledgeForm,
      });
    }
  };

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
  const events = eventsQuery.data || [];
  const knowledge = knowledgeQuery.data || [];

  // Calculate stats
  const stats = {
    events: events.length,
    knowledge: knowledge.length,
  };

  return (
    <NovelDashboardLayout novelId={novelId} novelTitle={novel?.title}>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">知识库</h1>
            <p className="text-muted-foreground font-light">
              管理故事事件和知识条目
            </p>
          </div>
          <Button variant="outline" onClick={() => {
            eventsQuery.refetch();
            knowledgeQuery.refetch();
            toast.success('数据已刷新');
          }} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            刷新数据
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Clock className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.events}</div>
                <div className="text-sm text-muted-foreground">故事事件</div>
              </div>
            </div>
          </div>
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.knowledge}</div>
                <div className="text-sm text-muted-foreground">知识条目</div>
              </div>
            </div>
          </div>
        </div>

        {/* Graph tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="characters" className="gap-2">
              <Users className="h-4 w-4" />
              人物设定
            </TabsTrigger>
            <TabsTrigger value="relationships" className="gap-2">
              <Users className="h-4 w-4" />
              人物关系
            </TabsTrigger>
            <TabsTrigger value="locations" className="gap-2">
              <MapPin className="h-4 w-4" />
              地点场景
            </TabsTrigger>
            <TabsTrigger value="items" className="gap-2">
              <BookOpen className="h-4 w-4" />
              物品道具
            </TabsTrigger>
            <TabsTrigger value="organizations" className="gap-2">
              <Globe className="h-4 w-4" />
              组织势力
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <Clock className="h-4 w-4" />
              时间线
            </TabsTrigger>
          </TabsList>

          <TabsContent value="characters">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">人物设定</h2>
                <Button onClick={() => {
                  setEditingKnowledge(null);
                  setKnowledgeForm({ ...knowledgeForm, type: 'character' });
                  setShowKnowledgeDialog(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加人物
                </Button>
              </div>
              <KnowledgeList
                entries={knowledge.filter(k => k.type === 'character')}
                onEdit={handleEditKnowledge}
                onDelete={(id) => deleteKnowledgeMutation.mutate({ id })}
                onSync={(id) => {
                  if (confirm('确定要将此条目同步到世界观吗？如果已存在同名条目，将会合并内容。')) {
                    syncToWorldbuildingMutation.mutate({ id });
                  }
                }}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            </div>
          </TabsContent>

          <TabsContent value="relationships">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">人物关系</h2>
                <Button onClick={() => {
                  setEditingKnowledge(null);
                  setKnowledgeForm({ ...knowledgeForm, type: 'relationship' });
                  setShowKnowledgeDialog(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加关系
                </Button>
              </div>
              <KnowledgeList
                entries={knowledge.filter(k => k.type === 'relationship')}
                onEdit={handleEditKnowledge}
                onDelete={(id) => deleteKnowledgeMutation.mutate({ id })}
                onSync={(id) => {
                  if (confirm('确定要将此条目同步到世界观吗？')) {
                    syncToWorldbuildingMutation.mutate({ id });
                  }
                }}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            </div>
          </TabsContent>

          <TabsContent value="locations">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">地点场景</h2>
                <Button onClick={() => {
                  setEditingKnowledge(null);
                  setKnowledgeForm({ ...knowledgeForm, type: 'location' });
                  setShowKnowledgeDialog(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加地点
                </Button>
              </div>
              <KnowledgeList
                entries={knowledge.filter(k => k.type === 'location')}
                onEdit={handleEditKnowledge}
                onDelete={(id) => deleteKnowledgeMutation.mutate({ id })}
                onSync={(id) => {
                  const entry = knowledge.find(k => k.id === id);
                  if (!entry) return;

                  if (confirm(`确定要将"${entry.name}"同步到世界观-地点吗？如果已存在同名地点，将会合并内容。`)) {
                    syncToWorldbuildingMutation.mutate({ id, targetType: 'location' });
                  }
                }}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            </div>
          </TabsContent>

          <TabsContent value="items">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">物品道具</h2>
                <Button onClick={() => {
                  setEditingKnowledge(null);
                  setKnowledgeForm({ ...knowledgeForm, type: 'item' });
                  setShowKnowledgeDialog(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加物品
                </Button>
              </div>
              <KnowledgeList
                entries={knowledge.filter(k => k.type === 'item')}
                onEdit={handleEditKnowledge}
                onDelete={(id) => deleteKnowledgeMutation.mutate({ id })}
                onSync={(id) => {
                  const entry = knowledge.find(k => k.id === id);
                  if (!entry) return;

                  if (confirm(`确定要将"${entry.name}"同步到世界观-物品吗？如果已存在同名物品，将会合并内容。`)) {
                    syncToWorldbuildingMutation.mutate({ id, targetType: 'item' });
                  }
                }}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            </div>
          </TabsContent>

          <TabsContent value="organizations">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">组织势力</h2>
                <Button onClick={() => {
                  setEditingKnowledge(null);
                  setKnowledgeForm({ ...knowledgeForm, type: 'organization' });
                  setShowKnowledgeDialog(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  添加组织
                </Button>
              </div>
              <KnowledgeList
                entries={knowledge.filter(k => k.type === 'organization')}
                onEdit={handleEditKnowledge}
                onDelete={(id) => deleteKnowledgeMutation.mutate({ id })}
                onSync={(id) => {
                  const entry = knowledge.find(k => k.id === id);
                  if (!entry) return;

                  if (confirm(`确定要将"${entry.name}"同步到世界观-组织吗？如果已存在同名组织，将会合并内容。`)) {
                    syncToWorldbuildingMutation.mutate({ id, targetType: 'organization' });
                  }
                }}
                filterType={filterType}
                setFilterType={setFilterType}
              />
            </div>
          </TabsContent>

          <TabsContent value="timeline">
            <div className="scandi-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">时间线</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('将从大纲中提取关键阶段事件，确定继续？')) {
                        aiInitTimelineFromOutline.mutate({ novelId });
                      }
                    }}
                    disabled={aiInitTimelineFromOutline.isPending}
                    className="gap-2"
                  >
                    {aiInitTimelineFromOutline.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Sparkles className="h-4 w-4" />
                    从大纲初始化
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm('将从已有章节中提取事件，确定继续？')) {
                        aiInitTimelineFromChapters.mutate({ novelId });
                      }
                    }}
                    disabled={aiInitTimelineFromChapters.isPending}
                    className="gap-2"
                  >
                    {aiInitTimelineFromChapters.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Sparkles className="h-4 w-4" />
                    从章节初始化
                  </Button>
                  <Button onClick={() => {
                    setEditingEvent(null);
                    resetEventForm();
                    setShowEventDialog(true);
                  }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    添加事件
                  </Button>
                </div>
              </div>
              <StoryTimeline
                events={events}
                onEdit={handleEditEvent}
                onDelete={(id) => deleteEventMutation.mutate({ id })}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Event Dialog */}
      <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEvent ? '编辑事件' : '添加事件'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">事件名称</label>
              <Input
                value={eventForm.name}
                onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                placeholder="输入事件名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">事件描述</label>
              <Textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="描述事件详情"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">时间点</label>
                <Input
                  value={eventForm.timePoint}
                  onChange={(e) => setEventForm({ ...eventForm, timePoint: e.target.value })}
                  placeholder="如：第1章、第一天"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">事件类型</label>
                <Select 
                  value={eventForm.eventType} 
                  onValueChange={(v) => setEventForm({ ...eventForm, eventType: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plot">剧情</SelectItem>
                    <SelectItem value="character">人物</SelectItem>
                    <SelectItem value="world">世界</SelectItem>
                    <SelectItem value="conflict">冲突</SelectItem>
                    <SelectItem value="resolution">解决</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">重要度 ({eventForm.importance})</label>
              <input
                type="range"
                min="1"
                max="5"
                value={eventForm.importance}
                onChange={(e) => setEventForm({ ...eventForm, importance: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEventDialog(false)}>取消</Button>
            <Button onClick={handleSaveEvent} disabled={createEventMutation.isPending || updateEventMutation.isPending}>
              {(createEventMutation.isPending || updateEventMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Knowledge Dialog */}
      <Dialog open={showKnowledgeDialog} onOpenChange={setShowKnowledgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKnowledge ? '编辑知识条目' : '添加知识条目'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">类型</label>
              <Select 
                value={knowledgeForm.type} 
                onValueChange={(v) => setKnowledgeForm({ ...knowledgeForm, type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="character">人物</SelectItem>
                  <SelectItem value="relationship">人物关系</SelectItem>
                  <SelectItem value="location">地点</SelectItem>
                  <SelectItem value="item">物品</SelectItem>
                  <SelectItem value="organization">组织</SelectItem>
                  <SelectItem value="event">事件</SelectItem>
                  <SelectItem value="setting">设定</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">名称</label>
              <Input
                value={knowledgeForm.name}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, name: e.target.value })}
                placeholder="输入名称"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">描述</label>
              <Textarea
                value={knowledgeForm.description}
                onChange={(e) => setKnowledgeForm({ ...knowledgeForm, description: e.target.value })}
                placeholder="详细描述"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKnowledgeDialog(false)}>取消</Button>
            <Button onClick={handleSaveKnowledge} disabled={createKnowledgeMutation.isPending || updateKnowledgeMutation.isPending}>
              {(createKnowledgeMutation.isPending || updateKnowledgeMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </NovelDashboardLayout>
  );
}
