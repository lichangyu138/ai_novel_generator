import { useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Search as SearchIcon, 
  FileText, 
  Users, 
  MapPin, 
  Package,
  Clock,
  ArrowLeft,
  Filter,
  X
} from "lucide-react";
import NovelDashboardLayout from "@/components/NovelDashboardLayout";

interface SearchResult {
  id: number;
  type: "chapter" | "character" | "location" | "item" | "event";
  title: string;
  content: string;
  highlights: string[];
  score: number;
  metadata: Record<string, any>;
}

export default function SearchPage() {
  const { id } = useParams<{ id: string }>();
  const novelId = parseInt(id || "0");
  const { user, loading: authLoading } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // 搜索过滤器
  const [filters, setFilters] = useState({
    chapters: true,
    characters: true,
    locations: true,
    items: true,
    events: true,
  });
  
  // 模拟搜索结果
  const mockResults: SearchResult[] = [
    {
      id: 1,
      type: "chapter",
      title: "第一章：命运的开端",
      content: "在青云山脚下的小村庄里，一个少年正在练习基础剑法...",
      highlights: ["青云山", "少年", "剑法"],
      score: 0.95,
      metadata: { chapterNumber: 1, wordCount: 3500 }
    },
    {
      id: 2,
      type: "character",
      title: "李云飞",
      content: "主角，性格坚韧不拔，拥有神秘的血脉...",
      highlights: ["主角", "神秘", "血脉"],
      score: 0.88,
      metadata: { role: "protagonist" }
    },
    {
      id: 3,
      type: "location",
      title: "青云宗",
      content: "修仙界顶级门派之一，位于青云山巅...",
      highlights: ["修仙界", "顶级门派", "青云山"],
      score: 0.82,
      metadata: { type: "门派" }
    },
    {
      id: 4,
      type: "item",
      title: "轩辕剑",
      content: "上古神剑，传说中的至高神器...",
      highlights: ["上古神剑", "神器"],
      score: 0.78,
      metadata: { type: "神器" }
    },
    {
      id: 5,
      type: "event",
      title: "青云宗入门大典",
      content: "每年一度的入门大典，选拔优秀弟子...",
      highlights: ["入门大典", "选拔", "弟子"],
      score: 0.75,
      metadata: { eventType: "main_plot" }
    },
  ];
  
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    // 模拟搜索延迟
    setTimeout(() => {
      setSearchResults(mockResults);
      setIsSearching(false);
    }, 500);
  };
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "chapter": return <FileText className="w-4 h-4 text-blue-500" />;
      case "character": return <Users className="w-4 h-4 text-green-500" />;
      case "location": return <MapPin className="w-4 h-4 text-amber-500" />;
      case "item": return <Package className="w-4 h-4 text-purple-500" />;
      case "event": return <Clock className="w-4 h-4 text-red-500" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };
  
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      chapter: "章节",
      character: "人物",
      location: "地点",
      item: "物品",
      event: "事件",
    };
    return labels[type] || type;
  };
  
  const filteredResults = searchResults.filter(result => {
    if (activeTab !== "all" && result.type !== activeTab) return false;
    const filterMap: Record<string, boolean> = {
      chapter: filters.chapters,
      character: filters.characters,
      location: filters.locations,
      item: filters.items,
      event: filters.events,
    };
    return filterMap[result.type] ?? true;
  });
  
  const resultCounts = {
    all: searchResults.length,
    chapter: searchResults.filter(r => r.type === "chapter").length,
    character: searchResults.filter(r => r.type === "character").length,
    location: searchResults.filter(r => r.type === "location").length,
    item: searchResults.filter(r => r.type === "item").length,
    event: searchResults.filter(r => r.type === "event").length,
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
        <div className="flex items-center gap-4">
          <Link href={`/novels/${novelId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">全文搜索</h1>
            <p className="text-slate-500 text-sm">搜索章节内容、人物、地点、物品和事件</p>
          </div>
        </div>

        {/* 搜索框 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="输入关键词搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 h-12 text-lg"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchQuery.trim()}
                className="h-12 px-8"
              >
                {isSearching ? "搜索中..." : "搜索"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowFilters(!showFilters)}
                className="h-12"
              >
                <Filter className="w-4 h-4 mr-2" />
                筛选
              </Button>
            </div>
            
            {/* 筛选器 */}
            {showFilters && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-6">
                  <span className="text-sm font-medium text-slate-700">搜索范围：</span>
                  <div className="flex items-center gap-4">
                    {Object.entries({
                      chapters: "章节",
                      characters: "人物",
                      locations: "地点",
                      items: "物品",
                      events: "事件",
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-2">
                        <Checkbox
                          id={key}
                          checked={filters[key as keyof typeof filters]}
                          onCheckedChange={(checked) => 
                            setFilters(prev => ({ ...prev, [key]: checked }))
                          }
                        />
                        <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 搜索结果 */}
        {searchResults.length > 0 && (
          <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  全部 ({resultCounts.all})
                </TabsTrigger>
                <TabsTrigger value="chapter">
                  章节 ({resultCounts.chapter})
                </TabsTrigger>
                <TabsTrigger value="character">
                  人物 ({resultCounts.character})
                </TabsTrigger>
                <TabsTrigger value="location">
                  地点 ({resultCounts.location})
                </TabsTrigger>
                <TabsTrigger value="item">
                  物品 ({resultCounts.item})
                </TabsTrigger>
                <TabsTrigger value="event">
                  事件 ({resultCounts.event})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              {filteredResults.map((result) => (
                <Card key={`${result.type}-${result.id}`} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800">{result.title}</h3>
                          <Badge variant="outline">{getTypeLabel(result.type)}</Badge>
                          <span className="text-xs text-slate-400">
                            相关度: {(result.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{result.content}</p>
                        <div className="flex flex-wrap gap-2">
                          {result.highlights.map((highlight, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 空状态 */}
        {searchResults.length === 0 && searchQuery && !isSearching && (
          <Card>
            <CardContent className="py-12 text-center">
              <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">未找到相关结果</p>
              <p className="text-sm text-slate-400 mt-2">尝试使用不同的关键词搜索</p>
            </CardContent>
          </Card>
        )}

        {/* 初始状态 */}
        {searchResults.length === 0 && !searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <SearchIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">输入关键词开始搜索</p>
              <p className="text-sm text-slate-400 mt-2">
                支持搜索章节内容、人物设定、地点场景、物品道具和事件
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </NovelDashboardLayout>
  );
}
