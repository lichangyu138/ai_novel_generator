/**
 * Characters Page - Manage novel characters with gender, relationships, and AI generation
 */
import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { useAuth } from '@/_core/hooks/useAuth';
import {
  Plus,
  Users,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
  Sparkles,
  Link2,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

const ROLES = [
  '主角',
  '配角',
  '反派',
  '大反派BOSS',
  '幕后黑手',
  '导师',
  '搭档',
  '爱人',
  '青梅竹马',
  '情敌',
  '朋友',
  '损友',
  '死党',
  '家人',
  '上司',
  '下属',
  '组织首领',
  '搞笑担当',
  '智囊',
  '工具人',
  '路人/群众',
  '其他',
];
const GENDERS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];
const RELATIONSHIP_TYPES = [
  '父母',
  '子女',
  '兄弟姐妹',
  '亲戚',
  '恋人',
  '前恋人',
  '配偶',
  '青梅竹马',
  '暗恋',
  '情敌',
  '朋友',
  '死党',
  '损友',
  '同学',
  '同事',
  '上司',
  '下属',
  '师徒',
  '师兄弟/师姐妹',
  '同门',
  '战友',
  '搭档',
  '盟友',
  '竞争对手',
  '宿敌',
  '仇人',
  '主仆',
  '雇主',
  '雇员',
  '邻居',
  // 后宫/多角关系相关
  '后宫候补',
  '正宫/本命',
  '暧昧对象',
  '备胎',
  '追求者',
  '被追求者',
  '情敌（后宫线）',
  '其他',
];

interface CharacterFormData {
  name: string;
  gender: 'male' | 'female' | 'other';
  role: string;
  appearanceChapter: string; // 出场章节（可选）
  personality: string;
  background: string;
  appearance: string;
  abilities: string;
  relationships: string;
  notes: string;
}

interface RelationshipFormData {
  targetCharacterId: number;
  relationshipType: string;
  description: string;
}

const emptyForm: CharacterFormData = {
  name: '',
  gender: 'male',
  role: '',
  appearanceChapter: '',
  personality: '',
  background: '',
  appearance: '',
  abilities: '',
  relationships: '',
  notes: '',
};

export default function Characters() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const novelId = parseInt(params.id || '0');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>(emptyForm);
  const [relationshipForm, setRelationshipForm] = useState<RelationshipFormData>({
    targetCharacterId: 0,
    relationshipType: '',
    description: '',
  });
  const [editingRelationshipId, setEditingRelationshipId] = useState<number | null>(null);
  const [selectedCharacterForRelation, setSelectedCharacterForRelation] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // AI 描述附加要求
  const [aiDescriptionRequest, setAiDescriptionRequest] = useState('');

  // tRPC queries
  const novelQuery = trpc.novels.get.useQuery(
    { id: novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const charactersQuery = trpc.characters.list.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  const relationshipsQuery = trpc.characters.listRelationships.useQuery(
    { novelId },
    { enabled: isAuthenticated && novelId > 0 }
  );

  // tRPC mutations
  const createMutation = trpc.characters.create.useMutation();
  const updateMutation = trpc.characters.update.useMutation();
  const deleteMutation = trpc.characters.delete.useMutation();
  const createRelationshipMutation = trpc.characters.createRelationship.useMutation();
  const deleteRelationshipMutation = trpc.characters.deleteRelationship.useMutation();
  const generateDescriptionMutation = trpc.ai.generateCharacterDescription.useMutation();
  const initializeCharactersMutation = trpc.ai.initializeCharactersFromOutline.useMutation();

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

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const extractAppearanceChapter = (notes: string | null | undefined) => {
    if (!notes) return { appearanceChapter: '', cleanedNotes: '' };
    const lines = notes.split('\n');
    let appearanceChapter = '';
    const kept: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('【出场章节】')) {
        appearanceChapter = trimmed.replace('【出场章节】', '').trim();
      } else if (trimmed.startsWith('【初次出现章节】')) {
        appearanceChapter = trimmed.replace('【初次出现章节】', '').trim();
      } else {
        kept.push(line);
      }
    }
    return { appearanceChapter, cleanedNotes: kept.join('\n').trim() };
  };

  const handleOpenEdit = (character: any) => {
    const { appearanceChapter, cleanedNotes } = extractAppearanceChapter(character.notes);
    setFormData({
      name: character.name || '',
      gender: character.gender || 'male',
      role: character.role || '',
      appearanceChapter,
      personality: character.personality || '',
      background: character.background || '',
      appearance: character.appearance || '',
      abilities: character.abilities || '',
      relationships: character.relationships || '',
      notes: cleanedNotes || character.notes || '',
    });
    setEditingId(character.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error('请输入角色名称');
      return;
    }

    // 将出场章节写入 notes 的结构化行，避免覆盖其他备注
    const mergedNotes = [
      formData.notes?.trim(),
      formData.appearanceChapter
        ? `【初次出现章节】${formData.appearanceChapter}`
        : '',
    ].filter(Boolean).join('\n\n');

    try {
      if (editingId) {
        await updateMutation.mutateAsync({
          id: editingId,
          ...formData,
          notes: mergedNotes,
        });
        toast.success('角色更新成功');
      } else {
        await createMutation.mutateAsync({
          novelId,
          ...formData,
          notes: mergedNotes,
        });
        toast.success('角色创建成功');
      }
      setDialogOpen(false);
      resetForm();
      utils.characters.list.invalidate({ novelId });
    } catch (error) {
      toast.error(editingId ? '更新失败' : '创建失败');
    }
  };

  const handleDelete = async (characterId: number) => {
    if (!confirm('确定要删除这个角色吗？相关的人物关系也会被删除。')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ id: characterId });
      toast.success('角色已删除');
      utils.characters.list.invalidate({ novelId });
      utils.characters.listRelationships.invalidate({ novelId });
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // AI Generate Description
  const handleGenerateDescription = async () => {
    if (!formData.name) {
      toast.error('请先输入角色名称');
      return;
    }

    setIsGenerating(true);
    try {
      const result: any = await generateDescriptionMutation.mutateAsync({
        novelId,
        characterId: editingId || undefined,
        name: formData.name,
        gender: formData.gender,
        role: formData.role || undefined,
        existingInfo: [
          formData.personality,
          formData.background,
          formData.appearanceChapter ? `初次出现章节：${formData.appearanceChapter}` : '',
        ].filter(Boolean).join('\n'),
        extraRequirements: aiDescriptionRequest || undefined,
      });

      // 将三观 / 成长线 / 弧光 / 后宫属性整理进备注，方便后续统一查看
      const extraNotesParts: string[] = [];
      if (result.worldview) {
        extraNotesParts.push(`【三观与价值观】\n${result.worldview}`);
      }
      if (result.growthArc) {
        extraNotesParts.push(`【成长线】\n${result.growthArc}`);
      }
      if (result.characterArc) {
        extraNotesParts.push(`【人物弧光】\n${result.characterArc}`);
      }
      if (result.romanceAndHarem) {
        extraNotesParts.push(`【感情/后宫属性】\n${result.romanceAndHarem}`);
      }

      const mergedNotes =
        [formData.notes, extraNotesParts.join('\n\n')]
          .filter(Boolean)
          .join('\n\n')
          .trim();

      setFormData({
        ...formData,
        personality: result.personality || formData.personality,
        background: result.background || formData.background,
        appearance: result.appearance || formData.appearance,
        abilities: result.abilities || formData.abilities,
        notes: mergedNotes || result.notes || formData.notes,
      });
      toast.success('AI描述生成成功');
      // 生成后不强制清空附加要求，方便微调；如需清空可在此处 reset
      // setAiDescriptionRequest('');
    } catch (error) {
      toast.error('AI生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  // Relationship management
  const handleOpenRelationshipDialog = (characterId: number, rel?: any) => {
    setSelectedCharacterForRelation(characterId);
    if (rel) {
      const otherId =
        rel.sourceCharacterId === characterId
          ? rel.targetCharacterId
          : rel.sourceCharacterId;
      setRelationshipForm({
        targetCharacterId: otherId,
        relationshipType: rel.relationshipType || '',
        description: rel.description || '',
      });
      setEditingRelationshipId(rel.id);
    } else {
      setRelationshipForm({
        targetCharacterId: 0,
        relationshipType: '',
        description: '',
      });
      setEditingRelationshipId(null);
    }
    setRelationshipDialogOpen(true);
  };

  const handleSaveRelationship = async () => {
    if (!selectedCharacterForRelation || !relationshipForm.targetCharacterId || !relationshipForm.relationshipType) {
      toast.error('请填写完整的关系信息');
      return;
    }

    try {
      if (editingRelationshipId) {
        await updateRelationshipMutation.mutateAsync({
          id: editingRelationshipId,
          relationshipType: relationshipForm.relationshipType || undefined,
          description: relationshipForm.description || undefined,
        });
        toast.success('关系已更新');
      } else {
        await createRelationshipMutation.mutateAsync({
          novelId,
          sourceCharacterId: selectedCharacterForRelation,
          targetCharacterId: relationshipForm.targetCharacterId,
          relationshipType: relationshipForm.relationshipType,
          description: relationshipForm.description || undefined,
        });
        toast.success('关系添加成功');
      }
      setRelationshipDialogOpen(false);
      setEditingRelationshipId(null);
      utils.characters.listRelationships.invalidate({ novelId });
    } catch (error) {
      toast.error(editingRelationshipId ? '更新关系失败' : '添加关系失败');
    }
  };

  const handleDeleteRelationship = async (relationshipId: number) => {
    try {
      await deleteRelationshipMutation.mutateAsync({ id: relationshipId });
      toast.success('关系已删除');
      utils.characters.listRelationships.invalidate({ novelId });
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // Get relationships for a character
  const getCharacterRelationships = (characterId: number) => {
    const relationships = relationshipsQuery.data || [];
    return relationships.filter(
      r => r.sourceCharacterId === characterId || r.targetCharacterId === characterId
    );
  };

  // Get character name by id
  const getCharacterName = (id: number) => {
    const character = (charactersQuery.data || []).find(c => c.id === id);
    return character?.name || '未知';
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
  const characters = charactersQuery.data || [];

  return (
    <NovelDashboardLayout novelId={novelId} novelTitle={novel?.title}>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">人物设定</h1>
            <p className="text-muted-foreground font-light">
              管理小说中的角色信息，支持AI生成描述和人物关系关联
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <Button
              variant="outline"
              className="gap-1"
              disabled={initializeCharactersMutation.isLoading}
              onClick={async () => {
                try {
                  const res = await initializeCharactersMutation.mutateAsync({ novelId });
                  toast.success(
                    `已从大纲初始化人物：新建 ${res.charactersCreated} 个，更新 ${res.charactersUpdated} 个，关系 ${res.relationshipsCreated} 条`
                  );
                  utils.characters.list.invalidate({ novelId });
                  utils.characters.listRelationships.invalidate({ novelId });
                } catch (error: any) {
                  toast.error(error?.message || 'AI 初始化人物失败，请检查是否已创建并激活大纲');
                }
              }}
            >
              {initializeCharactersMutation.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 初始化中…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI 从大纲初始化人物&关系
                </>
              )}
            </Button>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                添加角色
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? '编辑角色' : '添加新角色'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">角色名称 *</Label>
                    <Input
                      id="name"
                      placeholder="请输入角色名称"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">性别</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value: 'male' | 'female' | 'other') =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择性别" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">角色定位</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData({ ...formData, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择定位" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                <div className="space-y-2">
                  <Label htmlFor="appearanceChapter">初次出现章节（可选）</Label>
                  <Input
                    id="appearanceChapter"
                    placeholder="例如：第1章 / 第3-4章"
                    value={formData.appearanceChapter}
                    onChange={(e) =>
                      setFormData({ ...formData, appearanceChapter: e.target.value })
                    }
                  />
                  </div>
                </div>

                {/* AI Generate Config */}
                <div className="space-y-2">
                  <Label htmlFor="ai-extra">AI生成附加要求（可选）</Label>
                  <Textarea
                    id="ai-extra"
                    placeholder="例如：更偏日常轻松、增加反差萌、强调谋略型、减少中二感、适合仙侠/悬疑/科幻风格等"
                    rows={3}
                    value={aiDescriptionRequest}
                    onChange={(e) => setAiDescriptionRequest(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>AI 会综合角色名称、性别、角色定位、大纲和这里的附加要求生成描述。</span>
                  <Button
                    variant="outline"
                      size="sm"
                    onClick={handleGenerateDescription}
                    disabled={isGenerating || !formData.name}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                        AI生成中...
                      </>
                    ) : (
                      <>
                          <Sparkles className="h-3 w-3" />
                        AI生成描述
                      </>
                    )}
                  </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="personality">性格特点</Label>
                  <Textarea
                    id="personality"
                    placeholder="描述角色的性格特点"
                    rows={3}
                    value={formData.personality}
                    onChange={(e) =>
                      setFormData({ ...formData, personality: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="background">背景故事</Label>
                  <Textarea
                    id="background"
                    placeholder="描述角色的背景故事、经历等"
                    rows={4}
                    value={formData.background}
                    onChange={(e) =>
                      setFormData({ ...formData, background: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="appearance">外貌描述</Label>
                  <Textarea
                    id="appearance"
                    placeholder="描述角色的外貌特征"
                    rows={3}
                    value={formData.appearance}
                    onChange={(e) =>
                      setFormData({ ...formData, appearance: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="abilities">能力/技能</Label>
                  <Textarea
                    id="abilities"
                    placeholder="描述角色的能力、技能、特长等"
                    rows={3}
                    value={formData.abilities}
                    onChange={(e) =>
                      setFormData({ ...formData, abilities: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">备注</Label>
                  <Textarea
                    id="notes"
                    placeholder="其他备注信息"
                    rows={2}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button 
                    onClick={handleSave} 
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
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

        {/* Relationship Dialog */}
        <Dialog
          open={relationshipDialogOpen}
          onOpenChange={(open) => {
            setRelationshipDialogOpen(open);
            if (!open) {
              setEditingRelationshipId(null);
              setRelationshipForm({
                targetCharacterId: 0,
                relationshipType: '',
                description: '',
              });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRelationshipId ? '编辑人物关系' : '添加人物关系'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>关联角色</Label>
                <Select
                  value={relationshipForm.targetCharacterId.toString()}
                  onValueChange={(value) =>
                    setRelationshipForm({ ...relationshipForm, targetCharacterId: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    {characters
                      .filter(c => c.id !== selectedCharacterForRelation)
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.name} ({c.gender === 'male' ? '男' : c.gender === 'female' ? '女' : '其他'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>关系类型</Label>
                <Select
                  value={relationshipForm.relationshipType}
                  onValueChange={(value) =>
                    setRelationshipForm({ ...relationshipForm, relationshipType: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择关系类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>关系描述（可选）</Label>
                <Textarea
                  placeholder="描述两人之间的具体关系"
                  rows={2}
                  value={relationshipForm.description}
                  onChange={(e) =>
                    setRelationshipForm({ ...relationshipForm, description: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setRelationshipDialogOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleSaveRelationship}
                  disabled={createRelationshipMutation.isPending}
                >
                  {createRelationshipMutation.isPending ? (
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

        {/* Character Grid */}
        {charactersQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : characters.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">还没有角色</h3>
            <p className="text-muted-foreground font-light mb-6">
              点击上方按钮添加你的第一个角色
            </p>
            <Button onClick={handleOpenCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              添加角色
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => {
              const charRelationships = getCharacterRelationships(character.id);
              return (
                <div key={character.id} className="scandi-card p-6 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <User className="h-6 w-6 text-primary" />
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
                        <DropdownMenuItem onClick={() => handleOpenEdit(character)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          编辑
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenRelationshipDialog(character.id)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          添加关系
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(character.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <h3 className="text-lg font-bold mb-2">{character.name}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="secondary">
                      {character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}
                    </Badge>
                    {character.role && (
                      <Badge variant="outline">
                        {character.role}
                      </Badge>
                    )}
                  </div>
                  
                  {character.personality && (
                    <p className="text-sm text-muted-foreground font-light line-clamp-2 mb-3">
                      {character.personality}
                    </p>
                  )}

                  {/* Character Relationships */}
                  {charRelationships.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">人物关系</p>
                      <div className="flex flex-wrap gap-1">
                        {charRelationships.map((rel) => {
                          const otherCharId = rel.sourceCharacterId === character.id 
                            ? rel.targetCharacterId 
                            : rel.sourceCharacterId;
                          return (
                            <Badge 
                              key={rel.id} 
                              variant="outline" 
                              className="text-xs cursor-pointer group/badge"
                              onClick={() => handleOpenRelationshipDialog(character.id, rel)}
                            >
                              {getCharacterName(otherCharId)} · {rel.relationshipType}
                              <X
                                className="h-3 w-3 ml-1 opacity-0 group-hover/badge:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRelationship(rel.id);
                                }}
                              />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </NovelDashboardLayout>
  );
}
