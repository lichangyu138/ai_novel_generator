/**
 * Streaming Chapter Generator Component
 * Displays real-time AI generation with knowledge context
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, BookOpen, Users, Calendar, Database, Edit, Check, X, MessageSquare } from 'lucide-react';
import { 
  generateChapterStream, 
  aiModifyStream, 
  getChapterContext, 
  confirmGeneration,
  type GenerateChapterStreamRequest,
  type KnowledgeContext 
} from '@/lib/pythonApi';

interface StreamingChapterGeneratorProps {
  novelId: number;
  chapterNumber: number;
  detailedOutlineId?: number;
  onComplete?: (content: string, chapterId: number) => void;
  onCancel?: () => void;
}

type GenerationPhase = 'idle' | 'loading-context' | 'generating' | 'editing' | 'confirming';

export function StreamingChapterGenerator({
  novelId,
  chapterNumber,
  detailedOutlineId,
  onComplete,
  onCancel,
}: StreamingChapterGeneratorProps) {
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [content, setContent] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [context, setContext] = useState<KnowledgeContext | null>(null);
  const [contextStats, setContextStats] = useState<{
    characters_count: number;
    events_count: number;
    knowledge_count: number;
  } | null>(null);
  const [targetWordCount, setTargetWordCount] = useState(2000);
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showAIModifyDialog, setShowAIModifyDialog] = useState(false);
  const [modifyInstruction, setModifyInstruction] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during generation
  useEffect(() => {
    if (phase === 'generating' && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, phase]);

  // Load context before generation
  const loadContext = useCallback(async () => {
    setPhase('loading-context');
    setError(null);
    
    try {
      const result = await getChapterContext({
        novel_id: novelId,
        chapter_number: chapterNumber,
        detailed_outline_id: detailedOutlineId,
      });
      
      setContext(result.context);
      setContextStats({
        characters_count: result.context.characters.length,
        events_count: result.context.events.length,
        knowledge_count: result.context.knowledge_entries.length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载上下文失败');
      setPhase('idle');
    }
  }, [novelId, chapterNumber, detailedOutlineId]);

  // Start streaming generation
  const startGeneration = useCallback(async () => {
    setPhase('generating');
    setContent('');
    setError(null);
    
    abortControllerRef.current = new AbortController();
    
    const request: GenerateChapterStreamRequest = {
      novel_id: novelId,
      chapter_number: chapterNumber,
      detailed_outline_id: detailedOutlineId,
      target_word_count: targetWordCount,
      include_knowledge: true,
      include_characters: true,
      include_events: true,
      custom_prompt: customPrompt || undefined,
    };
    
    try {
      let fullContent = '';
      
      for await (const chunk of generateChapterStream(
        request,
        undefined, // token will be handled by the API client
        (stats) => setContextStats(stats)
      )) {
        fullContent += chunk;
        setContent(fullContent);
      }
      
      setEditedContent(fullContent);
      setPhase('editing');
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
      setPhase('idle');
    }
  }, [novelId, chapterNumber, detailedOutlineId, targetWordCount, customPrompt]);

  // Handle AI modification
  const handleAIModify = useCallback(async () => {
    if (!modifyInstruction.trim()) return;
    
    setIsModifying(true);
    setShowAIModifyDialog(false);
    
    try {
      let modifiedContent = '';
      
      for await (const chunk of aiModifyStream({
        content: editedContent,
        instruction: modifyInstruction,
        novel_id: novelId,
      })) {
        modifiedContent += chunk;
        setEditedContent(modifiedContent);
      }
      
      setModifyInstruction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI修改失败');
    } finally {
      setIsModifying(false);
    }
  }, [editedContent, modifyInstruction, novelId]);

  // Confirm and save
  const handleConfirm = useCallback(async () => {
    setPhase('confirming');
    
    try {
      const result = await confirmGeneration({
        novel_id: novelId,
        content_type: 'chapter',
        content_id: chapterNumber,
        content: editedContent,
        extract_knowledge: true,
      });
      
      if (result.success && onComplete) {
        onComplete(editedContent, result.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setPhase('editing');
    }
  }, [novelId, chapterNumber, editedContent, onComplete]);

  // Cancel generation
  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onCancel?.();
  }, [onCancel]);

  return (
    <div className="space-y-4">
      {/* Context Stats */}
      {contextStats && (
        <div className="flex gap-4 flex-wrap">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {contextStats.characters_count} 人物
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {contextStats.events_count} 事件
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {contextStats.knowledge_count} 知识条目
          </Badge>
        </div>
      )}

      {/* Generation Settings */}
      {phase === 'idle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              生成第 {chapterNumber} 章
            </CardTitle>
            <CardDescription>
              系统将自动查询知识库和知识图谱，获取人物、事件等上下文信息
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="1500">1500字</SelectItem>
                    <SelectItem value="2000">2000字</SelectItem>
                    <SelectItem value="2500">2500字</SelectItem>
                    <SelectItem value="3000">3000字</SelectItem>
                    <SelectItem value="4000">4000字</SelectItem>
                    <SelectItem value="5000">5000字</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>额外要求（可选）</Label>
              <Textarea
                placeholder="例如：这一章需要有一场激烈的战斗场面..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={loadContext} className="flex-1">
                <BookOpen className="h-4 w-4 mr-2" />
                加载上下文并开始生成
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading Context */}
      {phase === 'loading-context' && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">正在查询知识库和知识图谱...</p>
          </CardContent>
        </Card>
      )}

      {/* Context Preview */}
      {phase === 'loading-context' && context && (
        <Card>
          <CardHeader>
            <CardTitle>上下文预览</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="characters">
              <TabsList>
                <TabsTrigger value="characters">人物 ({context.characters.length})</TabsTrigger>
                <TabsTrigger value="events">事件 ({context.events.length})</TabsTrigger>
                <TabsTrigger value="knowledge">知识库 ({context.knowledge_entries.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="characters" className="max-h-48 overflow-auto">
                {context.characters.map((char) => (
                  <div key={char.id} className="py-2 border-b last:border-0">
                    <span className="font-medium">{char.name}</span>
                    {char.role && <span className="text-muted-foreground ml-2">({char.role})</span>}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="events" className="max-h-48 overflow-auto">
                {context.events.map((event) => (
                  <div key={event.id} className="py-2 border-b last:border-0">
                    <span className="font-medium">{event.title}</span>
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="knowledge" className="max-h-48 overflow-auto">
                {context.knowledge_entries.map((entry) => (
                  <div key={entry.id} className="py-2 border-b last:border-0">
                    <Badge variant="outline" className="mr-2">{entry.entry_type}</Badge>
                    <span className="text-sm">{entry.content}</span>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
            
            <div className="mt-4 flex gap-2">
              <Button onClick={startGeneration} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                开始生成
              </Button>
              <Button variant="outline" onClick={() => setPhase('idle')}>
                返回
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generating */}
      {phase === 'generating' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              正在生成中...
            </CardTitle>
            <CardDescription>
              已生成 {content.length} 字
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              ref={contentRef}
              className="prose prose-sm max-w-none max-h-96 overflow-auto p-4 bg-muted rounded-lg"
            >
              {content || <span className="text-muted-foreground">等待生成...</span>}
            </div>
            <div className="mt-4">
              <Button variant="destructive" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                取消生成
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editing */}
      {phase === 'editing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              编辑内容
            </CardTitle>
            <CardDescription>
              生成完成，共 {editedContent.length} 字。您可以手动修改或使用AI修改。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="content">编辑内容</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
              </TabsList>
              
              <TabsContent value="content">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none max-h-96 overflow-auto p-4 bg-muted rounded-lg whitespace-pre-wrap">
                  {editedContent}
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button onClick={handleConfirm} disabled={isModifying}>
                <Check className="h-4 w-4 mr-2" />
                确认并保存
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowAIModifyDialog(true)}
                disabled={isModifying}
              >
                {isModifying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4 mr-2" />
                )}
                AI修改
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditedContent(content);
                }}
                disabled={isModifying}
              >
                重置为原始内容
              </Button>
              <Button
                variant="outline"
                onClick={() => setPhase('idle')}
                disabled={isModifying}
              >
                重新生成
              </Button>
              <Button variant="ghost" onClick={handleCancel} disabled={isModifying}>
                取消
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirming */}
      {phase === 'confirming' && (
        <Card>
          <CardContent className="py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">正在保存并提取知识...</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* AI Modify Dialog */}
      <Dialog open={showAIModifyDialog} onOpenChange={setShowAIModifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI修改</DialogTitle>
            <DialogDescription>
              请描述您希望如何修改内容，AI将根据您的指令进行修改。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>修改指令</Label>
              <Textarea
                placeholder="例如：让对话更加生动、增加环境描写、修改结尾让它更有悬念..."
                value={modifyInstruction}
                onChange={(e) => setModifyInstruction(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIModifyDialog(false)}>
              取消
            </Button>
            <Button onClick={handleAIModify} disabled={!modifyInstruction.trim()}>
              <Sparkles className="h-4 w-4 mr-2" />
              开始修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
