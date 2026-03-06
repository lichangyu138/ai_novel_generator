import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2,
  Copy,
  Eye,
  Code,
  Sparkles,
  ArrowLeft,
  BookOpen
} from "lucide-react";

interface PromptTemplate {
  id: number;
  name: string;
  templateType: string;
  content: string;
  description: string;
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
}

const TEMPLATE_TYPES = [
  { value: "outline", label: "大纲生成", description: "用于生成小说整体大纲" },
  { value: "detailed_outline", label: "细纲生成", description: "用于生成章节细纲" },
  { value: "chapter", label: "章节生成", description: "用于生成章节正文" },
  { value: "revision", label: "内容修改", description: "用于根据反馈修改内容" },
  { value: "character", label: "人物生成", description: "用于生成人物设定" },
  { value: "worldbuilding", label: "世界观构建", description: "用于生成世界观设定" },
];

export default function PromptTemplates() {
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("all");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  
  // 示例模板数据
  const [templates, setTemplates] = useState<PromptTemplate[]>([
    {
      id: -1,
      name: "默认大纲生成模板",
      templateType: "outline",
      content: `你是一位专业的小说大纲设计师。请根据以下信息生成一份详细的小说大纲。

## 小说基本信息
- 标题：{title}
- 类型：{genre}
- 风格：{style}
- 简介：{description}
- 目标字数：{target_word_count}字
- 预计章节数：{chapter_count}章

## 世界观设定
{world_setting}

## 主要人物
{characters}

## 用户提示词
{user_prompt}

## 要求
1. 大纲应包含完整的故事主线和支线
2. 明确每个阶段的核心冲突和转折点
3. 人物成长弧线要清晰
4. 伏笔和回收要有规划
5. 结构要符合三幕式或英雄之旅等经典叙事结构

请生成大纲：`,
      description: "系统默认大纲生成模板",
      variables: ["title", "genre", "style", "description", "target_word_count", "chapter_count", "world_setting", "characters", "user_prompt"],
      isDefault: true,
      isActive: true,
    },
    {
      id: -2,
      name: "默认细纲生成模板",
      templateType: "detailed_outline",
      content: `你是一位专业的小说细纲设计师。请根据以下信息为指定章节生成详细的细纲。

## 小说信息
- 标题：{title}
- 类型：{genre}
- 当前进度：第{start_chapter}章 - 第{end_chapter}章

## 总大纲
{outline}

## 前情提要
{previous_summary}

## 本组章节需要完成的情节点
{plot_points}

## 活跃人物
{active_characters}

## 待回收的伏笔
{pending_foreshadowing}

请生成第{start_chapter}章到第{end_chapter}章的细纲：`,
      description: "系统默认细纲生成模板",
      variables: ["title", "genre", "start_chapter", "end_chapter", "outline", "previous_summary", "plot_points", "active_characters", "pending_foreshadowing"],
      isDefault: true,
      isActive: true,
    },
    {
      id: -3,
      name: "默认章节生成模板",
      templateType: "chapter",
      content: `你是一位专业的小说作家。请根据以下信息生成小说章节内容。

## 小说信息
- 标题：{title}
- 类型：{genre}
- 风格：{style}
- 当前章节：第{chapter_number}章 - {chapter_title}

## 章节细纲
{detailed_outline}

## 前一章摘要
{previous_chapter_summary}

## 本章出场人物
{chapter_characters}

## 人物当前状态
{character_states}

## 相关知识库内容
{knowledge_context}

## 相关人物关系
{relationship_context}

## 写作要求
1. 字数要求：{target_word_count}字左右
2. 保持人物性格和说话风格的一致性
3. 场景描写要生动具体
4. 对话要符合人物特点
5. 注意情节的连贯性和节奏感

请开始创作：`,
      description: "系统默认章节生成模板",
      variables: ["title", "genre", "style", "chapter_number", "chapter_title", "detailed_outline", "previous_chapter_summary", "chapter_characters", "character_states", "knowledge_context", "relationship_context", "target_word_count"],
      isDefault: true,
      isActive: true,
    },
  ]);
  
  const [editForm, setEditForm] = useState({
    name: "",
    templateType: "",
    content: "",
    description: "",
  });
  
  const getTypeLabel = (type: string) => {
    const found = TEMPLATE_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  };
  
  const filteredTemplates = templates.filter(t => 
    activeTab === "all" || t.templateType === activeTab
  );
  
  const handleEdit = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setEditForm({
      name: template.name,
      templateType: template.templateType,
      content: template.content,
      description: template.description,
    });
    setIsEditDialogOpen(true);
  };
  
  const handlePreview = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    setIsPreviewDialogOpen(true);
  };
  
  const handleDuplicate = (template: PromptTemplate) => {
    const newTemplate: PromptTemplate = {
      ...template,
      id: Date.now(),
      name: `${template.name} (副本)`,
      isDefault: false,
    };
    setTemplates([...templates, newTemplate]);
    toast.success("模板复制成功");
  };
  
  const handleSave = () => {
    if (selectedTemplate) {
      if (selectedTemplate.isDefault) {
        // 复制默认模板为新模板
        const newTemplate: PromptTemplate = {
          id: Date.now(),
          name: editForm.name,
          templateType: editForm.templateType,
          content: editForm.content,
          description: editForm.description,
          variables: extractVariables(editForm.content),
          isDefault: false,
          isActive: true,
        };
        setTemplates([...templates, newTemplate]);
        toast.success("已基于默认模板创建新模板");
      } else {
        // 更新现有模板
        setTemplates(templates.map(t => 
          t.id === selectedTemplate.id 
            ? { ...t, ...editForm, variables: extractVariables(editForm.content) }
            : t
        ));
        toast.success("模板更新成功");
      }
    }
    setIsEditDialogOpen(false);
  };
  
  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{(\w+)\}/g) || [];
    return Array.from(new Set(matches.map(m => m.slice(1, -1))));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-600 mb-4">请先登录后访问</p>
            <Link href="/login">
              <Button>前往登录</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container max-w-6xl py-8">
        {/* 页面标题 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/novels">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Prompt模板管理</h1>
              <p className="text-slate-500 text-sm">管理大纲、细纲、章节生成的Prompt模板</p>
            </div>
          </div>
          <Button onClick={() => {
            setSelectedTemplate(null);
            setEditForm({ name: "", templateType: "outline", content: "", description: "" });
            setIsEditDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            新建模板
          </Button>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="all">全部</TabsTrigger>
            {TEMPLATE_TYPES.map(type => (
              <TabsTrigger key={type.value} value={type.value}>
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        {template.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={template.isDefault ? "secondary" : "outline"}>
                        {template.isDefault ? "系统默认" : "自定义"}
                      </Badge>
                      <Badge variant="outline">
                        {getTypeLabel(template.templateType)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <p className="text-xs text-slate-500 mb-2">变量列表：</p>
                    <div className="flex flex-wrap gap-1">
                      {template.variables.slice(0, 6).map((v, idx) => (
                        <code key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                          {`{${v}}`}
                        </code>
                      ))}
                      {template.variables.length > 6 && (
                        <span className="text-xs text-slate-400">
                          +{template.variables.length - 6} 更多
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handlePreview(template)}>
                      <Eye className="w-3 h-3 mr-1" />
                      预览
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                      <Edit className="w-3 h-3 mr-1" />
                      {template.isDefault ? "基于此创建" : "编辑"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDuplicate(template)}>
                      <Copy className="w-3 h-3 mr-1" />
                      复制
                    </Button>
                    {!template.isDefault && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setTemplates(templates.filter(t => t.id !== template.id));
                          toast.success("模板已删除");
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Tabs>

        {/* 编辑对话框 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate 
                  ? (selectedTemplate.isDefault ? "基于默认模板创建" : "编辑模板")
                  : "新建模板"
                }
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>模板名称</Label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="请输入模板名称"
                  />
                </div>
                <div>
                  <Label>模板类型</Label>
                  <Select
                    value={editForm.templateType}
                    onValueChange={(value) => setEditForm({ ...editForm, templateType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择模板类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>描述</Label>
                <Input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="请输入模板描述"
                />
              </div>
              <div>
                <Label>模板内容</Label>
                <p className="text-xs text-slate-500 mb-2">
                  使用 {`{变量名}`} 格式定义变量，如 {`{title}`}、{`{content}`}
                </p>
                <Textarea
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                  placeholder="请输入模板内容..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
              {editForm.content && (
                <div>
                  <Label>检测到的变量</Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {extractVariables(editForm.content).map((v, idx) => (
                      <code key={idx} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>取消</Button>
              <Button onClick={handleSave}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 预览对话框 */}
        <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>模板预览 - {selectedTemplate?.name}</DialogTitle>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="outline">{getTypeLabel(selectedTemplate.templateType)}</Badge>
                  <Badge variant={selectedTemplate.isDefault ? "secondary" : "outline"}>
                    {selectedTemplate.isDefault ? "系统默认" : "自定义"}
                  </Badge>
                </div>
                <div>
                  <Label>变量列表</Label>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedTemplate.variables.map((v, idx) => (
                      <code key={idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>模板内容</Label>
                  <pre className="mt-2 p-4 bg-slate-900 text-slate-100 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                    {selectedTemplate.content}
                  </pre>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>关闭</Button>
              <Button onClick={() => {
                if (selectedTemplate) {
                  handleEdit(selectedTemplate);
                  setIsPreviewDialogOpen(false);
                }
              }}>
                <Edit className="w-4 h-4 mr-2" />
                编辑
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
