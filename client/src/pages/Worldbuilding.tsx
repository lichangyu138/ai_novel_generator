import { useMemo, useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { PaginatedList } from "@/components/PaginatedList";
import {
  MapPin,
  Package,
  Users,
  Plus,
  Search,
  Edit,
  Trash2,
  Clock,
  ArrowLeft,
  Sparkles,
  Network,
  User,
  Link2,
  ZoomIn,
  ZoomOut,
  Loader2,
  Database,
} from "lucide-react";
import NovelDashboardLayout from "@/components/NovelDashboardLayout";
import { trpc } from "@/lib/trpc";
import * as d3 from 'd3';

// Types
interface CharacterNode {
  id: number;
  name: string;
  gender?: string;
  role?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface RelationshipEdge {
  source: number | CharacterNode;
  target: number | CharacterNode;
  type: string;
  description?: string;
}

// D3 Force-directed graph for character relationships
function CharacterRelationGraph({
  characters,
  relationships
}: {
  characters: any[];
  relationships: any[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 500,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || characters.length === 0) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current);
    const width = dimensions.width;
    const height = dimensions.height;

    // Create zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    const g = svg.append('g');

    // Prepare nodes and links
    const nodes: CharacterNode[] = characters.map(char => ({
      id: char.id,
      name: char.name,
      gender: char.gender,
      role: char.role,
    }));

    const links: RelationshipEdge[] = relationships.map(rel => ({
      source: rel.sourceCharacterId,
      target: rel.targetCharacterId,
      type: rel.relationshipType,
      description: rel.description,
    }));

    // Color scale for relationship types
    const relationshipColors: Record<string, string> = {
      '父母': '#e74c3c',
      '子女': '#e74c3c',
      '兄弟姐妹': '#f39c12',
      '恋人': '#e91e63',
      '配偶': '#e91e63',
      '朋友': '#3498db',
      '敌人': '#8e44ad',
      '师徒': '#27ae60',
      '同事': '#95a5a6',
      '主仆': '#1abc9c',
    };

    // Gender colors
    const genderColors: Record<string, string> = {
      'male': '#4a90d9',
      'female': '#e91e63',
      'other': '#9b59b6',
    };

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance(200))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(80));

    // Draw links
    const link = g.append('g')
      .selectAll('g')
      .data(links)
      .join('g');

    link.append('line')
      .attr('stroke', d => relationshipColors[d.type] || '#999')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8);

    // Link labels with background
    const linkLabelGroup = link.append('g')
      .attr('class', 'link-label-group');

    // Background rect for better readability
    linkLabelGroup.append('rect')
      .attr('fill', 'white')
      .attr('stroke', '#ddd')
      .attr('stroke-width', 0.5)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('x', -20)
      .attr('y', -12)
      .attr('width', 40)
      .attr('height', 16)
      .attr('pointer-events', 'none');

    linkLabelGroup.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 0)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d => d.type);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<any, CharacterNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    // Node circles
    node.append('circle')
      .attr('r', 30)
      .attr('fill', d => genderColors[d.gender || 'other'] || '#9b59b6')
      .attr('fill-opacity', 0.2)
      .attr('stroke', d => genderColors[d.gender || 'other'] || '#9b59b6')
      .attr('stroke-width', 2);

    // Node labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 4)
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .attr('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d => d.name.length > 4 ? d.name.slice(0, 4) + '..' : d.name);

    // Role labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 50)
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('pointer-events', 'none')
      .style('user-select', 'none')
      .text(d => d.role || '');

    // Update positions on tick
    simulation.on('tick', () => {
      link.select('line')
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      link.select('.link-label-group')
        .attr('transform', (d: any) => {
          const x = (d.source.x + d.target.x) / 2;
          const y = (d.source.y + d.target.y) / 2;
          return `translate(${x},${y})`;
        });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [characters, relationships, dimensions]);

  if (characters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
        <Users className="h-12 w-12 mb-4 opacity-50" />
        <p>暂无人物数据</p>
        <p className="text-sm">请先在人物设定中添加角色</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(z / 1.2, 0.3))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="bg-muted/20 rounded-lg cursor-grab active:cursor-grabbing"
      />
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#4a90d9]/20 border-2 border-[#4a90d9]" />
          <span>男性</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#e91e63]/20 border-2 border-[#e91e63]" />
          <span>女性</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#9b59b6]/20 border-2 border-[#9b59b6]" />
          <span>其他</span>
        </div>
      </div>
    </div>
  );
}

export default function Worldbuilding() {
  const { id } = useParams<{ id: string }>();
  const novelId = parseInt(id || "0");
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("characters");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [currentAddType, setCurrentAddType] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTargetType, setAiTargetType] = useState<"location" | "item" | "organization" | "timeline" | null>(null);
  const [aiTargetId, setAiTargetId] = useState<number | null>(null);
  const [aiTargetName, setAiTargetName] = useState("");
  const [aiCurrentDesc, setAiCurrentDesc] = useState("");
  const [aiUserRequest, setAiUserRequest] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiHistory, setAiHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [timelineStartChapter, setTimelineStartChapter] = useState<string>("");
  const [timelineEndChapter, setTimelineEndChapter] = useState<string>("");

  // Character states
  const [characterDialogOpen, setCharacterDialogOpen] = useState(false);
  const [editingCharacterId, setEditingCharacterId] = useState<number | null>(null);
  const [characterForm, setCharacterForm] = useState({
    name: "",
    gender: "male" as "male" | "female" | "other",
    role: "",
    personality: "",
    background: "",
    appearance: "",
    abilities: "",
    notes: "",
  });

  // AI Extract Characters (from outline/chapters)
  const [extractCharactersOpen, setExtractCharactersOpen] = useState(false);
  const [extractSourceType, setExtractSourceType] = useState<"outline" | "chapter" | "all_chapters">("outline");
  const [extractChapterId, setExtractChapterId] = useState<string>("");
  const [extractAdditionalPrompt, setExtractAdditionalPrompt] = useState<string>("");

  // Relationship states
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [selectedCharacterForRelation, setSelectedCharacterForRelation] = useState<number | null>(null);
  const [editingRelationshipId, setEditingRelationshipId] = useState<number | null>(null);
  const [relationshipForm, setRelationshipForm] = useState({
    targetCharacterId: null as number | null,
    relationshipType: "",
    description: "",
  });

  const utils = trpc.useUtils();

  const { data: locationEntries = [] } = trpc.worldbuilding.locations.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );
  const { data: itemEntries = [] } = trpc.worldbuilding.items.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );
  const { data: organizationEntries = [] } = trpc.worldbuilding.organizations.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );
  const { data: timelineEvents = [] } = trpc.worldbuilding.timeline.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );
  const { data: chapters = [] } = trpc.chapters.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );

  // Character and Relationship queries
  const { data: characters = [] } = trpc.characters.list.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );

  const { data: relationships = [] } = trpc.characters.listRelationships.useQuery(
    { novelId },
    { enabled: !!user && novelId > 0 }
  );

  // AI 初始化：从大纲提取地点 / 物品 / 组织，互不影响
  const aiInitLocations = trpc.worldbuilding.initializeFromOutline.useMutation({
    onSuccess: (res) => {
      utils.worldbuilding.locations.list.invalidate({ novelId });
      utils.worldbuilding.items.list.invalidate({ novelId });
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      toast.success(`已从大纲提取：地点 ${res.locations} 个，物品 ${res.items} 个，组织 ${res.organizations} 个`);
    },
    onError: (error) => {
      toast.error(error.message || "AI 初始化失败");
    },
  });

  const aiInitItems = trpc.worldbuilding.initializeFromOutline.useMutation({
    onSuccess: (res) => {
      utils.worldbuilding.items.list.invalidate({ novelId });
      toast.success(`已从大纲提取物品 ${res.items} 个`);
    },
    onError: (error) => {
      toast.error(error.message || "AI 初始化失败");
    },
  });

  const aiInitOrganizations = trpc.worldbuilding.initializeFromOutline.useMutation({
    onSuccess: (res) => {
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      toast.success(`已从大纲提取组织 ${res.organizations} 个`);
    },
    onError: (error) => {
      toast.error(error.message || "AI 初始化失败");
    },
  });

  const createLocation = trpc.worldbuilding.locations.create.useMutation({
    onSuccess: () => {
      utils.worldbuilding.locations.list.invalidate({ novelId });
      toast.success("地点已创建");
    },
    onError: (error) => toast.error(error.message || "创建地点失败"),
  });

  const updateLocation = trpc.worldbuilding.locations.update.useMutation({
    onSuccess: () => {
      utils.worldbuilding.locations.list.invalidate({ novelId });
      toast.success("地点已更新");
    },
    onError: (error) => toast.error(error.message || "更新地点失败"),
  });

  const createItem = trpc.worldbuilding.items.create.useMutation({
    onSuccess: () => {
      utils.worldbuilding.items.list.invalidate({ novelId });
      toast.success("物品已创建");
    },
    onError: (error) => toast.error(error.message || "创建物品失败"),
  });

  const updateItem = trpc.worldbuilding.items.update.useMutation({
    onSuccess: () => {
      utils.worldbuilding.items.list.invalidate({ novelId });
      toast.success("物品已更新");
    },
    onError: (error) => toast.error(error.message || "更新物品失败"),
  });

  const createOrganization = trpc.worldbuilding.organizations.create.useMutation({
    onSuccess: () => {
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      toast.success("组织已创建");
    },
    onError: (error) => toast.error(error.message || "创建组织失败"),
  });

  const updateOrganization = trpc.worldbuilding.organizations.update.useMutation({
    onSuccess: () => {
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      toast.success("组织已更新");
    },
    onError: (error) => toast.error(error.message || "更新组织失败"),
  });

  const deleteLocation = trpc.worldbuilding.locations.delete.useMutation({
    onSuccess: () => {
      utils.worldbuilding.locations.list.invalidate({ novelId });
      toast.success("已删除地点");
    },
    onError: (error) => toast.error(error.message || "删除地点失败"),
  });

  const batchDeleteLocations = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => deleteLocation.mutateAsync({ id })));
      toast.success(`已删除 ${ids.length} 个地点`);
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  const deleteItem = trpc.worldbuilding.items.delete.useMutation({
    onSuccess: () => {
      utils.worldbuilding.items.list.invalidate({ novelId });
      toast.success("已删除物品");
    },
    onError: (error) => toast.error(error.message || "删除物品失败"),
  });

  const batchDeleteItems = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => deleteItem.mutateAsync({ id })));
      toast.success(`已删除 ${ids.length} 个物品`);
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  const deleteOrganization = trpc.worldbuilding.organizations.delete.useMutation({
    onSuccess: () => {
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      toast.success("已删除组织");
    },
    onError: (error) => toast.error(error.message || "删除组织失败"),
  });

  const batchDeleteOrganizations = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => deleteOrganization.mutateAsync({ id })));
      toast.success(`已删除 ${ids.length} 个组织`);
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  const createTimelineEvent = trpc.worldbuilding.timeline.create.useMutation({
    onSuccess: () => {
      utils.worldbuilding.timeline.list.invalidate({ novelId });
      toast.success("事件已创建");
    },
    onError: (error) => toast.error(error.message || "创建事件失败"),
  });

  const updateTimelineEvent = trpc.worldbuilding.timeline.update.useMutation({
    onSuccess: () => {
      utils.worldbuilding.timeline.list.invalidate({ novelId });
      toast.success("事件已更新");
    },
    onError: (error) => toast.error(error.message || "更新事件失败"),
  });

  const deleteTimelineEvent = trpc.worldbuilding.timeline.delete.useMutation({
    onSuccess: () => {
      utils.worldbuilding.timeline.list.invalidate({ novelId });
      toast.success("事件已删除");
    },
    onError: (error) => toast.error(error.message || "删除事件失败"),
  });

  const batchDeleteTimelineEvents = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => deleteTimelineEvent.mutateAsync({ id })));
      toast.success(`已删除 ${ids.length} 个事件`);
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  // 同步到向量库（全量）
  const syncToVectorDB = trpc.worldbuilding.syncToVectorDB.useMutation({
    onSuccess: (res) => {
      toast.success(`已同步 ${res.syncedCount}/${res.total} 条数据到向量库`);
    },
    onError: (error) => {
      toast.error(error.message || "同步向量库失败");
    },
  });

  // 同步单个条目到向量库
  const syncSingleToVectorDB = trpc.worldbuilding.syncToVectorDB.useMutation({
    onSuccess: (res) => {
      const message = res.syncedCount > 0
        ? `已同步 ${res.syncedCount} 条数据`
        : '内容未变更，无需同步';
      toast.success(message);
      // 刷新列表以更新同步状态
      utils.worldbuilding.locations.list.invalidate({ novelId });
      utils.worldbuilding.items.list.invalidate({ novelId });
      utils.worldbuilding.organizations.list.invalidate({ novelId });
      utils.worldbuilding.characters.list.invalidate({ novelId });
    },
    onError: (error) => {
      toast.error(error.message || "同步失败");
    },
  });

  // Character mutations
  const createCharacter = trpc.characters.create.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate({ novelId });
      toast.success("角色已创建");
      setCharacterDialogOpen(false);
      resetCharacterForm();
    },
    onError: (error) => toast.error(error.message || "创建角色失败"),
  });

  const updateCharacter = trpc.characters.update.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate({ novelId });
      toast.success("角色已更新");
      setCharacterDialogOpen(false);
      resetCharacterForm();
    },
    onError: (error) => toast.error(error.message || "更新角色失败"),
  });

  const deleteCharacter = trpc.characters.delete.useMutation({
    onSuccess: () => {
      utils.characters.list.invalidate({ novelId });
      utils.characters.listRelationships.invalidate({ novelId });
      toast.success("角色已删除");
    },
    onError: (error) => toast.error(error.message || "删除角色失败"),
  });

  const batchDeleteCharacters = async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => deleteCharacter.mutateAsync({ id })));
      toast.success(`已删除 ${ids.length} 个角色`);
    } catch (error: any) {
      toast.error(error.message || "批量删除失败");
    }
  };

  // Relationship mutations
  const createRelationship = trpc.characters.createRelationship.useMutation({
    onSuccess: () => {
      utils.characters.listRelationships.invalidate({ novelId });
      toast.success("关系已添加");
      setRelationshipDialogOpen(false);
      resetRelationshipForm();
      setSelectedCharacterForRelation(null);
    },
    onError: (error) => toast.error(error.message || "添加关系失败"),
  });

  // AI: Extract characters via Python backend
  const extractCharacters = trpc.worldbuilding.extractCharacters.useMutation({
    onSuccess: (res: any) => {
      utils.characters.list.invalidate({ novelId });
      utils.characters.listRelationships.invalidate({ novelId });
      toast.success(res?.message || `已提取人物：${res?.extracted_count ?? 0} 个`);
      setExtractCharactersOpen(false);
      setExtractAdditionalPrompt("");
      setExtractChapterId("");
      setExtractSourceType("outline");
    },
    onError: (error) => {
      toast.error(error.message || "AI 提取人物失败");
    },
  });

  const deleteRelationship = trpc.characters.deleteRelationship.useMutation({
    onSuccess: () => {
      utils.characters.listRelationships.invalidate({ novelId });
      toast.success("关系已删除");
    },
    onError: (error) => toast.error(error.message || "删除关系失败"),
  });

  // 时间线：从大纲提取阶段事件
  const aiInitTimeline = trpc.worldbuilding.timeline.initializeFromOutline.useMutation({
    onSuccess: (res) => {
      utils.worldbuilding.timeline.list.invalidate({ novelId });
      toast.success(`已从大纲提取事件 ${res.eventsCreated} 个`);
    },
    onError: (error) => toast.error(error.message || "AI 初始化时间线失败"),
  });

  const refineEntry = trpc.worldbuilding.refineEntry.useMutation({
    onSuccess: (res) => {
      setAiResult(res.refinedDescription);
      setAiHistory((prev) => [
        ...prev,
        { role: "assistant", content: res.refinedDescription },
      ]);
    },
    onError: (error) => {
      toast.error(error.message || "AI 修改失败");
    },
  });

  // Helper functions
  const resetCharacterForm = () => {
    setCharacterForm({
      name: "",
      gender: "male",
      role: "",
      personality: "",
      background: "",
      appearance: "",
      abilities: "",
      notes: "",
    });
    setEditingCharacterId(null);
  };

  const resetRelationshipForm = () => {
    setRelationshipForm({
      targetCharacterId: null,
      relationshipType: "",
      description: "",
    });
    setEditingRelationshipId(null);
    // 不要重置 selectedCharacterForRelation，因为它是在打开对话框时设置的
  };

  const getCharacterName = (id: number) => {
    const character = characters.find(c => c.id === id);
    return character?.name || '未知';
  };

  const getCharacterRelationships = (characterId: number) => {
    return relationships.filter(
      r => r.sourceCharacterId === characterId || r.targetCharacterId === characterId
    );
  };

  const handleSaveCharacter = () => {
    if (!characterForm.name.trim()) {
      toast.error("请输入角色名称");
      return;
    }

    if (editingCharacterId) {
      updateCharacter.mutate({
        id: editingCharacterId,
        ...characterForm,
      });
    } else {
      createCharacter.mutate({
        novelId,
        ...characterForm,
      });
    }
  };

  const handleSaveRelationship = () => {
    console.log('Relationship form:', {
      selectedCharacterForRelation,
      targetCharacterId: relationshipForm.targetCharacterId,
      relationshipType: relationshipForm.relationshipType,
    });

    if (!selectedCharacterForRelation || !relationshipForm.targetCharacterId || !relationshipForm.relationshipType.trim()) {
      toast.error("请填写完整的关系信息");
      return;
    }

    createRelationship.mutate({
      novelId,
      sourceCharacterId: selectedCharacterForRelation,
      targetCharacterId: relationshipForm.targetCharacterId,
      relationshipType: relationshipForm.relationshipType,
      description: relationshipForm.description || undefined,
    });
  };

  const filteredLocations = useMemo(
    () =>
      locationEntries.filter((l) =>
        !searchQuery
          ? true
          : l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (l.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [locationEntries, searchQuery]
  );

  const filteredItems = useMemo(
    () =>
      itemEntries.filter((i) =>
        !searchQuery
          ? true
          : i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (i.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [itemEntries, searchQuery]
  );

  const filteredOrganizations = useMemo(
    () =>
      organizationEntries.filter((o) =>
        !searchQuery
          ? true
          : o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (o.description || "").toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [organizationEntries, searchQuery]
  );
  
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      planted: { label: "已埋设", variant: "secondary" },
      developing: { label: "发展中", variant: "default" },
      resolved: { label: "已回收", variant: "outline" },
      abandoned: { label: "已放弃", variant: "destructive" },
    };
    const config = statusMap[status] || { label: status, variant: "default" as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };
  
  const getImportanceBadge = (importance: string) => {
    const importanceMap: Record<string, { label: string; className: string }> = {
      high: { label: "重要", className: "bg-red-100 text-red-800" },
      medium: { label: "一般", className: "bg-yellow-100 text-yellow-800" },
      low: { label: "次要", className: "bg-gray-100 text-gray-800" },
    };
    const config = importanceMap[importance] || { label: importance, className: "bg-gray-100 text-gray-800" };
    return <span className={`px-2 py-1 rounded text-xs ${config.className}`}>{config.label}</span>;
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
    <NovelDashboardLayout novelId={novelId}>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/novels/${novelId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">世界观构建</h1>
              <p className="text-slate-500 text-sm">管理小说的地点、物品、组织、伏笔和时间线</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('确定要将所有世界观数据同步到向量库吗？')) {
                  syncToVectorDB.mutate({ novelId });
                }
              }}
              disabled={syncToVectorDB.isPending}
            >
              {syncToVectorDB.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  同步中...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  同步向量库
                </>
              )}
            </Button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        {/* 标签页 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="characters" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              人物设定
            </TabsTrigger>
            <TabsTrigger value="relations" className="flex items-center gap-2">
              <Network className="w-4 h-4" />
              人物关系
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              地点场景
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              物品道具
            </TabsTrigger>
            <TabsTrigger value="organizations" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              组织势力
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              时间线
            </TabsTrigger>
          </TabsList>

          {/* 人物设定 */}
          <TabsContent value="characters" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-600">共 {characters.length} 个角色</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setExtractCharactersOpen(true)}
                  disabled={extractCharacters.isPending}
                >
                  {extractCharacters.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                      AI 提取中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI 提取人物
                    </>
                  )}
                </Button>
              <Button onClick={() => {
                resetCharacterForm();
                setCharacterDialogOpen(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                添加角色
              </Button>
              </div>
            </div>
            <PaginatedList
              items={characters}
              pageSize={12}
              getItemId={(char) => char.id}
              onBatchDelete={batchDeleteCharacters}
              renderItem={(character, isSelected, onToggle) => {
                const charRelationships = getCharacterRelationships(character.id);
                return (
                  <Card key={character.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox checked={isSelected} onCheckedChange={onToggle} />
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{character.name}</CardTitle>
                            <CardDescription>
                              {character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他'}
                              {character.role && ` · ${character.role}`}
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {character.personality && (
                        <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                          {character.personality}
                        </p>
                      )}
                      {charRelationships.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-muted-foreground mb-1">人物关系</p>
                          <div className="flex flex-wrap gap-1">
                            {charRelationships.slice(0, 3).map((rel) => {
                              const otherCharId = rel.sourceCharacterId === character.id
                                ? rel.targetCharacterId
                                : rel.sourceCharacterId;
                              return (
                                <Badge key={rel.id} variant="outline" className="text-xs">
                                  {getCharacterName(otherCharId)} · {rel.relationshipType}
                                </Badge>
                              );
                            })}
                            {charRelationships.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{charRelationships.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCharacterId(character.id);
                            setCharacterForm({
                              name: character.name || '',
                              gender: character.gender || 'male',
                              role: character.role || '',
                              personality: character.personality || '',
                              background: character.background || '',
                              appearance: character.appearance || '',
                              abilities: character.abilities || '',
                              notes: character.notes || '',
                            });
                            setCharacterDialogOpen(true);
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiTargetType("character");
                            setAiTargetId(character.id);
                            setAiTargetName(character.name);
                            setAiCurrentDesc(
                              `角色：${character.role || ''}\n性别：${character.gender || ''}\n性格：${character.personality || ''}\n背景：${character.background || ''}\n外貌：${character.appearance || ''}\n能力：${character.abilities || ''}`
                            );
                            setAiUserRequest("");
                            setAiResult("");
                            setAiHistory([]);
                            setAiDialogOpen(true);
                          }}
                        >
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI 修改
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCharacterForRelation(character.id);
                            resetRelationshipForm();
                            setRelationshipDialogOpen(true);
                          }}
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          添加关系
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const content = `角色：${character.name}\n性别：${character.gender || ''}\n角色定位：${character.role || ''}\n性格：${character.personality || ''}\n背景：${character.background || ''}\n外貌：${character.appearance || ''}\n能力：${character.abilities || ''}`;
                            syncSingleToVectorDB.mutate({
                              novelId,
                              items: [{
                                source_type: 'character',
                                source_id: character.id,
                                name: character.name,
                                content
                              }]
                            });
                          }}
                          disabled={syncSingleToVectorDB.isPending}
                        >
                          <Database className="w-3 h-3 mr-1" />
                          同步
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (confirm("确定要删除该角色吗？相关的人物关系也会被删除。")) {
                              deleteCharacter.mutate({ id: character.id });
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          删除
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }}
            />
          </TabsContent>

          {/* 人物关系图 */}
          <TabsContent value="relations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>人物关系网络</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    拖拽节点调整位置，滚轮缩放
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <CharacterRelationGraph
                  characters={characters}
                  relationships={relationships}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 地点场景 */}
          <TabsContent value="locations" className="space-y-4">
            <div className="flex justify-between items-center">
            <p className="text-slate-600">共 {filteredLocations.length} 个地点</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => aiInitLocations.mutate({ novelId, scope: "locations" })}
                disabled={aiInitLocations.isPending}
              >
                {aiInitLocations.isPending ? (
                  <>
                    <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                    从大纲提取
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    AI 从大纲初始化
                  </>
                )}
              </Button>
              <Button onClick={() => { setCurrentAddType("location"); setIsAddDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                添加地点
              </Button>
            </div>
            </div>
            <PaginatedList
              items={filteredLocations}
              pageSize={12}
              getItemId={(loc) => loc.id}
              onBatchDelete={batchDeleteLocations}
              renderItem={(location, isSelected, onToggle) => (
                <Card key={location.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} onCheckedChange={onToggle} />
                        <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            {location.name}
                          </CardTitle>
                        </div>
                        <CardDescription>{/* 类型信息可后续从描述中解析 */}</CardDescription>
                      </div>
                      {getImportanceBadge("medium")}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 whitespace-pre-line mb-2">
                      {location.description}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentAddType("location");
                          setEditingId(location.id);
                          setFormName(location.name);
                          setFormType(location.type || "");
                          setFormDescription(location.description || "");
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiTargetType("location");
                          setAiTargetId(location.id);
                          setAiTargetName(location.name);
                          setAiCurrentDesc(location.description || "");
                          setAiUserRequest("");
                          setAiResult("");
                          setAiHistory([]);
                          setAiDialogOpen(true);
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI 修改
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const content = `地点：${location.name}\n类型：${location.type || ''}\n描述：${location.description || ''}`;
                          syncSingleToVectorDB.mutate({
                            novelId,
                            items: [{
                              source_type: 'location',
                              source_id: location.id,
                              name: location.name,
                              content
                            }]
                          });
                        }}
                        disabled={syncSingleToVectorDB.isPending}
                      >
                        <Database className="w-3 h-3 mr-1" />
                        同步
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("确定要删除该地点吗？")) {
                            deleteLocation.mutate({ id: location.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            />
          </TabsContent>

          {/* 物品道具 */}
          <TabsContent value="items" className="space-y-4">
            <div className="flex justify-between items-center">
            <p className="text-slate-600">共 {filteredItems.length} 个物品</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiInitItems.mutate({ novelId, scope: "items" })}
                  disabled={aiInitItems.isPending}
                >
                  {aiInitItems.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                      从大纲提取
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 从大纲初始化
                    </>
                  )}
                </Button>
                <Button onClick={() => { setCurrentAddType("item"); setIsAddDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加物品
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="w-4 h-4 text-amber-500" />
                      {item.name}
                    </CardTitle>
                    <CardDescription>{item.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 whitespace-pre-line mb-2">
                      {item.description}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentAddType("item");
                          setEditingId(item.id);
                          setFormName(item.name);
                          setFormType(item.type || "");
                          setFormDescription(item.description || "");
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiTargetType("item");
                          setAiTargetId(item.id);
                          setAiTargetName(item.name);
                          setAiCurrentDesc(item.description || "");
                          setAiUserRequest("");
                          setAiResult("");
                          setAiHistory([]);
                          setAiDialogOpen(true);
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI 修改
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const content = `物品：${item.name}\n类型：${item.type || ''}\n描述：${item.description || ''}`;
                          syncSingleToVectorDB.mutate({
                            novelId,
                            items: [{
                              source_type: 'item',
                              source_id: item.id,
                              name: item.name,
                              content
                            }]
                          });
                        }}
                        disabled={syncSingleToVectorDB.isPending}
                      >
                        <Database className="w-3 h-3 mr-1" />
                        同步
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("确定要删除该物品吗？")) {
                            deleteItem.mutate({ id: item.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 组织势力 */}
          <TabsContent value="organizations" className="space-y-4">
            <div className="flex justify-between items-center">
            <p className="text-slate-600">共 {filteredOrganizations.length} 个组织</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiInitOrganizations.mutate({ novelId, scope: "organizations" })}
                  disabled={aiInitOrganizations.isPending}
                >
                  {aiInitOrganizations.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                      从大纲提取
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 从大纲初始化
                    </>
                  )}
                </Button>
                <Button onClick={() => { setCurrentAddType("organization"); setIsAddDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  添加组织
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrganizations.map((org) => (
                <Card key={org.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-500" />
                      {org.name}
                    </CardTitle>
                    <CardDescription>{org.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600 whitespace-pre-line mb-2">
                      {org.description}
                    </p>
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCurrentAddType("organization");
                          setEditingId(org.id);
                          setFormName(org.name);
                          setFormType(org.type || "");
                          setFormDescription(org.description || "");
                          setIsAddDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAiTargetType("organization");
                          setAiTargetId(org.id);
                          setAiTargetName(org.name);
                          setAiCurrentDesc(org.description || "");
                          setAiUserRequest("");
                          setAiResult("");
                          setAiHistory([]);
                          setAiDialogOpen(true);
                        }}
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI 修改
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const content = `组织：${org.name}\n类型：${org.type || ''}\n描述：${org.description || ''}`;
                          syncSingleToVectorDB.mutate({
                            novelId,
                            items: [{
                              source_type: 'organization',
                              source_id: org.id,
                              name: org.name,
                              content
                            }]
                          });
                        }}
                        disabled={syncSingleToVectorDB.isPending}
                      >
                        <Database className="w-3 h-3 mr-1" />
                        同步
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm("确定要删除该组织吗？")) {
                            deleteOrganization.mutate({ id: org.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        删除
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 时间线 */}
          <TabsContent value="timeline" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-slate-600">
                共 {timelineEvents.length} 个事件
                {selectedEventIds.length > 0 && `（已选中 ${selectedEventIds.length} 个）`}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiInitTimeline.mutate({ novelId })}
                  disabled={aiInitTimeline.isPending}
                >
                  {aiInitTimeline.isPending ? (
                    <>
                      <Sparkles className="w-4 h-4 mr-1 animate-spin" />
                      从大纲提取
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-1" />
                      AI 从大纲初始化
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setCurrentAddType("timeline");
                    setEditingId(null);
                    setFormName("");
                    setFormType("");
                    setFormDescription("");
                    setTimelineStartChapter("");
                    setTimelineEndChapter("");
                    setIsAddDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加事件
                </Button>
              </div>
            </div>
            <div className="relative">
              {timelineEvents.length > 0 ? (
                <div className="space-y-4">
                  {/* 章节刻度 */}
                  <div className="flex items-center text-xs font-medium text-slate-600 border-b pb-2">
                    <span className="w-6"></span>
                    <span className="w-56 pl-3">事件名称</span>
                    <div className="flex-1 grid grid-cols-12 gap-1 px-2">
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="text-center text-slate-500">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <span className="w-52 text-right pr-3">类型 / 操作</span>
                  </div>

                  {/* 事件列表 */}
                  <div className="space-y-3">
                    {timelineEvents.map((event) => {
                      const match = event.timePoint?.match(/第(\d+)(?:-(\d+))?章/);
                      const start = match ? parseInt(match[1], 10) : event.chapterId || 1;
                      const end = match && match[2] ? parseInt(match[2], 10) : start;
                      // 甘特图横轴固定为 12 列；有章节就按章节范围映射，没有章节则按事件里的“第X章”范围映射
                      const maxChapterFromChapters =
                        chapters.length > 0 ? Math.max(...chapters.map((c: any) => c.chapterNumber)) : 0;
                      const maxChapterFromEvents = Math.max(
                        1,
                        ...timelineEvents.map((e) => {
                          const m = e.timePoint?.match(/第(\d+)(?:-(\d+))?章/);
                          const s = m ? parseInt(m[1], 10) : e.chapterId || 1;
                          const t = m && m[2] ? parseInt(m[2], 10) : s;
                          return Number.isFinite(t) ? t : 1;
                        })
                      );
                      const maxChapter = Math.max(maxChapterFromChapters, maxChapterFromEvents, 12);

                      // 将章节号线性映射到 1..12
                      const toCol = (ch: number) => {
                        const clamped = Math.max(1, Math.min(ch, maxChapter));
                        return Math.max(1, Math.min(12, Math.ceil((clamped / maxChapter) * 12)));
                      };
                      const colStart = toCol(start);
                      const colEnd = Math.max(colStart, toCol(end));
                      const span = Math.max(1, colEnd - colStart + 1);

                      // 事件类型颜色
                      const typeColors: Record<string, string> = {
                        plot: 'bg-blue-500',
                        character: 'bg-purple-500',
                        world: 'bg-green-500',
                        conflict: 'bg-red-500',
                        resolution: 'bg-amber-500',
                      };
                      const barColor = typeColors[event.eventType as string] || 'bg-blue-500';

                      return (
                        <div key={event.id} className="flex items-center gap-3 group hover:bg-slate-50 rounded-lg p-2 transition-colors">
                          {/* 复选框 */}
                          <Input
                            type="checkbox"
                            className="w-4 h-4 flex-shrink-0"
                            checked={selectedEventIds.includes(event.id)}
                            onChange={(e) => {
                              setSelectedEventIds((prev) =>
                                e.target.checked
                                  ? [...prev, event.id]
                                  : prev.filter((id) => id !== event.id)
                              );
                            }}
                          />

                          {/* 事件信息 */}
                          <div className="w-56 flex-shrink-0">
                            <div className="font-medium text-sm text-slate-800 truncate" title={event.name}>
                              {event.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              第 {start}{end !== start ? `-${end}` : ''} 章
                            </div>
                          </div>

                          {/* 甘特图条 */}
                          <div className="flex-1 grid grid-cols-12 gap-1 items-center px-2 min-h-[32px]">
                            <div
                              className={`h-7 rounded ${barColor} shadow-sm flex items-center justify-center text-white text-xs font-medium transition-all group-hover:shadow-md`}
                              style={{
                                gridColumn: `${colStart} / span ${span}`,
                              }}
                              title={event.description || event.name}
                            >
                              {span >= 3 && <span className="truncate px-2">{event.name}</span>}
                            </div>
                          </div>

                          {/* 类型和操作 */}
                          <div className="w-52 flex items-center justify-end gap-2 flex-shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {event.eventType === 'plot' ? '剧情' :
                               event.eventType === 'character' ? '人物' :
                               event.eventType === 'world' ? '世界' :
                               event.eventType === 'conflict' ? '冲突' :
                               event.eventType === 'resolution' ? '解决' : event.eventType}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setCurrentAddType("timeline");
                                setEditingId(event.id);
                                setFormName(event.name);
                                setFormType(event.eventType || "");
                                setFormDescription(event.description || "");
                                const matchForForm = event.timePoint?.match(/第(\d+)(?:-(\d+))?章/);
                                setTimelineStartChapter(matchForForm ? matchForForm[1] : "");
                                setTimelineEndChapter(
                                  matchForForm && matchForForm[2] ? matchForForm[2] : ""
                                );
                                setIsAddDialogOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setAiTargetType("timeline");
                                setAiTargetId(event.id);
                                setAiTargetName(event.name);
                                setAiCurrentDesc(event.description || "");
                                setAiUserRequest("");
                                setAiResult("");
                                setAiHistory([]);
                                setAiDialogOpen(true);
                              }}
                            >
                              <Sparkles className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                if (confirm("确定要删除该事件吗？")) {
                                  deleteTimelineEvent.mutate({ id: event.id });
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedEventIds.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (!confirm(`确定要批量删除选中的 ${selectedEventIds.length} 个事件吗？`)) {
                            return;
                          }
                          selectedEventIds.forEach((id) =>
                            deleteTimelineEvent.mutate({ id })
                          );
                          setSelectedEventIds([]);
                        }}
                      >
                        批量删除选中事件
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500 pl-4">
                  暂无事件，无法绘制甘特图。请先添加时间线事件。
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* AI 修改对话框 */}
        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                AI 修改
                {aiTargetType === "location"
                  ? "地点"
                  : aiTargetType === "item"
                  ? "物品"
                  : aiTargetType === "organization"
                  ? "组织"
                  : ""}
                ：{aiTargetName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                <div className="font-medium mb-1">当前描述：</div>
                <div className="whitespace-pre-line border rounded-md p-2 bg-slate-50 max-h-40 overflow-auto">
                  {aiCurrentDesc || "（暂无描述）"}
                </div>
              </div>
              <div className="space-y-2">
                <Label>本轮修改要求</Label>
                <Textarea
                  rows={3}
                  placeholder="例如：语气更庄严一些，突出宗门历史感；控制在150字以内。"
                  value={aiUserRequest}
                  onChange={(e) => setAiUserRequest(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!aiTargetType || !aiTargetName) return;
                      if (!aiUserRequest.trim()) {
                        toast.error("请先输入修改要求");
                        return;
                      }
                      const newHistory = [
                        ...aiHistory,
                        { role: "user" as const, content: aiUserRequest },
                      ];
                      setAiHistory(newHistory);
                      refineEntry.mutate({
                        novelId,
                        type: aiTargetType,
                        name: aiTargetName,
                        // 如果已经有上一轮 AI 结果，则作为当前描述传入，便于多轮迭代
                        currentDescription: aiResult || aiCurrentDesc,
                        userRequest: aiUserRequest,
                        conversationHistory: newHistory,
                      });
                    }}
                    disabled={refineEntry.isPending}
                  >
                    {refineEntry.isPending ? "AI 思考中..." : "发送给 AI"}
                  </Button>
                </div>
              </div>
              {aiHistory.length > 0 && (
                <div className="space-y-2">
                  <Label>对话历史</Label>
                  <div className="border rounded-md p-2 max-h-48 overflow-auto text-sm space-y-2 bg-slate-50">
                    {aiHistory.map((msg, idx) => (
                      <div key={idx}>
                        <span className="font-medium">
                          {msg.role === "user" ? "你：" : "AI："}
                        </span>
                        <span className="whitespace-pre-line ml-1">
                          {msg.content}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {aiResult && (
                <div className="space-y-2">
                  <Label>AI 建议的描述</Label>
                  <div className="border rounded-md p-2 whitespace-pre-line bg-emerald-50 text-sm max-h-40 overflow-auto">
                    {aiResult}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAiDialogOpen(false);
                  setAiTargetType(null);
                  setAiTargetId(null);
                  setAiTargetName("");
                  setAiCurrentDesc("");
                  setAiUserRequest("");
                  setAiResult("");
                  setAiHistory([]);
                }}
              >
                关闭
              </Button>
              <Button
                disabled={!aiResult || !aiTargetType || !aiTargetId}
                onClick={() => {
                  if (!aiResult || !aiTargetType || !aiTargetId) return;

                  if (aiTargetType === "character") {
                    // 解析AI返回的人物描述，尝试提取各个字段
                    const lines = aiResult.split('\n').filter(l => l.trim());
                    const updates: any = {};

                    // 简单的字段提取逻辑
                    for (const line of lines) {
                      if (line.includes('角色：') || line.includes('角色定位：')) {
                        updates.role = line.split(/[：:]/)[1]?.trim();
                      } else if (line.includes('性别：')) {
                        const gender = line.split(/[：:]/)[1]?.trim();
                        if (gender?.includes('男')) updates.gender = 'male';
                        else if (gender?.includes('女')) updates.gender = 'female';
                        else updates.gender = 'other';
                      } else if (line.includes('性格：') || line.includes('性格特点：')) {
                        updates.personality = line.split(/[：:]/)[1]?.trim();
                      } else if (line.includes('背景：') || line.includes('背景故事：')) {
                        updates.background = line.split(/[：:]/)[1]?.trim();
                      } else if (line.includes('外貌：') || line.includes('外貌描述：')) {
                        updates.appearance = line.split(/[：:]/)[1]?.trim();
                      } else if (line.includes('能力：') || line.includes('能力技能：')) {
                        updates.abilities = line.split(/[：:]/)[1]?.trim();
                      }
                    }

                    // 如果没有提取到字段，就把整个结果作为背景
                    if (Object.keys(updates).length === 0) {
                      updates.background = aiResult;
                    }

                    updateCharacter.mutate({
                      id: aiTargetId,
                      ...updates,
                    });
                  } else if (aiTargetType === "location") {
                    updateLocation.mutate({
                      id: aiTargetId,
                      description: aiResult,
                    });
                  } else if (aiTargetType === "item") {
                    updateItem.mutate({
                      id: aiTargetId,
                      description: aiResult,
                    });
                  } else if (aiTargetType === "organization") {
                    updateOrganization.mutate({
                      id: aiTargetId,
                      description: aiResult,
                    });
                  } else if (aiTargetType === "timeline") {
                    updateTimelineEvent.mutate({
                      id: aiTargetId,
                      description: aiResult,
                    });
                  }
                  setAiDialogOpen(false);
                  setAiTargetType(null);
                  setAiTargetId(null);
                  setAiTargetName("");
                  setAiCurrentDesc("");
                  setAiUserRequest("");
                  setAiResult("");
                  setAiHistory([]);
                }}
              >
                应用到当前条目
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI 提取人物对话框 */}
        <Dialog open={extractCharactersOpen} onOpenChange={setExtractCharactersOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>AI 提取人物设定</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>提取来源</Label>
                <Select
                  value={extractSourceType}
                  onValueChange={(value: "outline" | "chapter" | "all_chapters") => setExtractSourceType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择提取来源" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outline">从大纲提取</SelectItem>
                    <SelectItem value="chapter">从指定章节提取</SelectItem>
                    <SelectItem value="all_chapters">从所有章节提取</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {extractSourceType === "chapter" && (
                <div className="space-y-2">
                  <Label>章节 ID（chapter.id）</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="请输入章节ID（不是章节号）"
                    value={extractChapterId}
                    onChange={(e) => setExtractChapterId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    提示：这里需要章节表的 ID（chapter.id），不是第几章的章号。
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>额外要求（可选）</Label>
                <Textarea
                  rows={3}
                  placeholder="例如：重点关注主角与重要配角；不要漏掉提到过的绰号。"
                  value={extractAdditionalPrompt}
                  onChange={(e) => setExtractAdditionalPrompt(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setExtractCharactersOpen(false)}
                disabled={extractCharacters.isPending}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  if (extractSourceType === "chapter") {
                    const idNum = parseInt(extractChapterId, 10);
                    if (Number.isNaN(idNum) || idNum <= 0) {
                      toast.error("请填写正确的章节ID");
                      return;
                    }
                    extractCharacters.mutate({
                      novelId,
                      sourceType: extractSourceType,
                      sourceId: idNum,
                      additionalPrompt: extractAdditionalPrompt?.trim() || undefined,
                    });
                    return;
                  }

                  extractCharacters.mutate({
                    novelId,
                    sourceType: extractSourceType,
                    additionalPrompt: extractAdditionalPrompt?.trim() || undefined,
                  });
                }}
                disabled={extractCharacters.isPending}
              >
                {extractCharacters.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    提取中...
                  </>
                ) : (
                  "开始提取"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 添加对话框 */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "编辑" : "添加"}
                {currentAddType === "location"
                  ? "地点"
                  : currentAddType === "item"
                  ? "物品"
                  : currentAddType === "organization"
                  ? "组织"
                  : "事件"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>名称</Label>
                <Input
                  placeholder="请输入名称"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div>
                <Label>类型</Label>
                <Input
                  placeholder={
                    currentAddType === "timeline"
                      ? "例如：plot / character / world / conflict / resolution"
                      : "请输入类型"
                  }
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                />
              </div>
              <div>
                <Label>描述</Label>
                <Textarea
                  placeholder="请输入详细描述"
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              {currentAddType === "timeline" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>起始章节</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="例如：1"
                        value={timelineStartChapter}
                        onChange={(e) => setTimelineStartChapter(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>结束章节（可选）</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="例如：5"
                        value={timelineEndChapter}
                        onChange={(e) => setTimelineEndChapter(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    将显示为“第X章”或“第X-Y章”，并用于上方甘特图的范围计算。
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingId(null);
                  setFormName("");
                  setFormType("");
                  setFormDescription("");
                  setTimelineStartChapter("");
                  setTimelineEndChapter("");
                }}
              >
                取消
              </Button>
              <Button
                onClick={() => {
                  if (!formName.trim()) {
                    toast.error("请输入名称");
                    return;
                  }
                  // 计算时间线事件的章节范围
                  const startNum = parseInt(timelineStartChapter, 10);
                  const endNum = parseInt(timelineEndChapter, 10);
                  const hasValidStart = !Number.isNaN(startNum) && startNum > 0;
                  const hasValidEnd = !Number.isNaN(endNum) && endNum > 0;
                  let eventTime: string | undefined;
                  let chapterNumber: number | undefined;
                  if (hasValidStart) {
                    chapterNumber = startNum;
                    if (hasValidEnd && endNum !== startNum) {
                      eventTime = `第${startNum}-${endNum}章`;
                    } else {
                      eventTime = `第${startNum}章`;
                    }
                  }
                  if (currentAddType === "location") {
                    if (editingId) {
                      updateLocation.mutate({
                        id: editingId,
                        name: formName,
                        description: formDescription || undefined,
                      });
                    } else {
                      createLocation.mutate({
                        novelId,
                        name: formName,
                        type: formType || undefined,
                        description: formDescription || undefined,
                      });
                    }
                  } else if (currentAddType === "item") {
                    if (editingId) {
                      updateItem.mutate({
                        id: editingId,
                        name: formName,
                        description: formDescription || undefined,
                      });
                    } else {
                      createItem.mutate({
                        novelId,
                        name: formName,
                        type: formType || undefined,
                        description: formDescription || undefined,
                      });
                    }
                  } else if (currentAddType === "organization") {
                    if (editingId) {
                      updateOrganization.mutate({
                        id: editingId,
                        name: formName,
                        description: formDescription || undefined,
                      });
                    } else {
                      createOrganization.mutate({
                        novelId,
                        name: formName,
                        type: formType || undefined,
                        description: formDescription || undefined,
                      });
                    }
                  } else if (currentAddType === "timeline") {
                    if (editingId) {
                      updateTimelineEvent.mutate({
                        id: editingId,
                        title: formName,
                        description: formDescription || undefined,
                        eventTime,
                        eventType: formType || undefined,
                        chapterNumber,
                      });
                    } else {
                      createTimelineEvent.mutate({
                        novelId,
                        title: formName,
                        description: formDescription || undefined,
                        eventTime,
                        eventType: formType || undefined,
                        chapterNumber,
                      });
                    }
                  }
                  setIsAddDialogOpen(false);
                  setEditingId(null);
                  setFormName("");
                  setFormType("");
                  setFormDescription("");
                  setTimelineStartChapter("");
                  setTimelineEndChapter("");
                }}
              >
                确认添加
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 人物设定对话框 */}
        <Dialog open={characterDialogOpen} onOpenChange={setCharacterDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCharacterId ? '编辑角色' : '添加新角色'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>角色名称 *</Label>
                  <Input
                    placeholder="请输入角色名称"
                    value={characterForm.name}
                    onChange={(e) => setCharacterForm({ ...characterForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>性别</Label>
                  <Select
                    value={characterForm.gender}
                    onValueChange={(value: 'male' | 'female' | 'other') =>
                      setCharacterForm({ ...characterForm, gender: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">男</SelectItem>
                      <SelectItem value="female">女</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>角色定位</Label>
                  <Input
                    placeholder="如：主角、配角"
                    value={characterForm.role}
                    onChange={(e) => setCharacterForm({ ...characterForm, role: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>性格特点</Label>
                <Textarea
                  placeholder="描述角色的性格特点"
                  rows={3}
                  value={characterForm.personality}
                  onChange={(e) => setCharacterForm({ ...characterForm, personality: e.target.value })}
                />
              </div>
              <div>
                <Label>背景故事</Label>
                <Textarea
                  placeholder="描述角色的背景故事、经历等"
                  rows={3}
                  value={characterForm.background}
                  onChange={(e) => setCharacterForm({ ...characterForm, background: e.target.value })}
                />
              </div>
              <div>
                <Label>外貌描述</Label>
                <Textarea
                  placeholder="描述角色的外貌特征"
                  rows={2}
                  value={characterForm.appearance}
                  onChange={(e) => setCharacterForm({ ...characterForm, appearance: e.target.value })}
                />
              </div>
              <div>
                <Label>能力/技能</Label>
                <Textarea
                  placeholder="描述角色的能力、技能、特长等"
                  rows={2}
                  value={characterForm.abilities}
                  onChange={(e) => setCharacterForm({ ...characterForm, abilities: e.target.value })}
                />
              </div>
              <div>
                <Label>备注</Label>
                <Textarea
                  placeholder="其他备注信息"
                  rows={2}
                  value={characterForm.notes}
                  onChange={(e) => setCharacterForm({ ...characterForm, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCharacterDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSaveCharacter}
                disabled={createCharacter.isPending || updateCharacter.isPending}
              >
                {(createCharacter.isPending || updateCharacter.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 人物关系对话框 */}
        <Dialog
          open={relationshipDialogOpen}
          onOpenChange={(open) => {
            setRelationshipDialogOpen(open);
            if (!open) {
              resetRelationshipForm();
              setSelectedCharacterForRelation(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加人物关系</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>关联角色</Label>
                <Select
                  value={relationshipForm.targetCharacterId?.toString() || ""}
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
              <div>
                <Label>关系类型</Label>
                <Input
                  placeholder="如：朋友、敌人、恋人等"
                  value={relationshipForm.relationshipType}
                  onChange={(e) =>
                    setRelationshipForm({ ...relationshipForm, relationshipType: e.target.value })
                  }
                />
              </div>
              <div>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRelationshipDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSaveRelationship}
                disabled={createRelationship.isPending}
              >
                {createRelationship.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </NovelDashboardLayout>
  );
}
