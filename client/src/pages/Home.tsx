/**
 * Home Page - Landing page with Scandinavian minimalist design
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import {
  BookOpen,
  Sparkles,
  Network,
  Database,
  FileText,
  Users,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setLocation('/novels');
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const features = [
    {
      icon: Sparkles,
      title: 'AI大纲生成',
      description: '基于你的设定和提示词，AI自动生成完整的小说大纲',
    },
    {
      icon: FileText,
      title: '细纲与章节',
      description: '每5章为一组生成细纲，再逐章生成完整内容',
    },
    {
      icon: Database,
      title: '智能知识库',
      description: '自动提取章节信息，使用Milvus向量检索确保内容一致',
    },
    {
      icon: Network,
      title: '世界观构建',
      description: '管理人物、地点、物品、组织，构建完整的世界观体系',
    },
    {
      icon: Users,
      title: '人物管理',
      description: '完整的人物设定和关系网络，支持AI生成和手动维护',
    },
    {
      icon: BookOpen,
      title: '章节审核',
      description: '每章生成后可审核、修改意见、重新生成',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg">幻写次元</span>
          </Link>

          <div className="flex items-center gap-4">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAuthenticated ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {user?.name || user?.email}
                </span>
                <Button variant="ghost" onClick={() => setLocation('/novels')}>
                  我的小说
                </Button>
                <Button variant="outline" onClick={logout}>
                  退出
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => window.location.href = getLoginUrl()}>
                  登录
                </Button>
                <Button onClick={() => window.location.href = getLoginUrl()}>
                  注册
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 geo-shape geo-blue opacity-50" />
        <div className="absolute top-40 right-20 w-48 h-48 geo-shape geo-pink opacity-50" />
        <div className="absolute bottom-10 left-1/3 w-32 h-32 geo-shape geo-blue opacity-30" />
        <div className="absolute bottom-20 right-1/4 w-40 h-40 geo-shape geo-pink opacity-30" />

        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              AI驱动的
              <br />
              <span className="text-primary">小说创作平台</span>
            </h1>
            <p className="text-xl text-muted-foreground font-light mb-8 max-w-2xl mx-auto">
              从设定到完整章节，让AI成为你的创作伙伴。
              <br />
              知识图谱保证人物一致，向量检索确保情节连贯。
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" onClick={handleGetStarted} className="gap-2">
                开始创作
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                了解更多
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">核心功能</h2>
            <p className="text-muted-foreground font-light max-w-2xl mx-auto">
              幻写次元提供从构思到成稿的全流程AI辅助创作工具
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="scandi-card p-6 hover:shadow-lg transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground font-light">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="scandi-card p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 geo-shape geo-pink opacity-30" />
            <div className="absolute bottom-0 left-0 w-32 h-32 geo-shape geo-blue opacity-30" />

            <div className="relative z-10">
              <h2 className="text-3xl font-bold mb-4">准备好开始创作了吗？</h2>
              <p className="text-muted-foreground font-light mb-8 max-w-xl mx-auto">
                立即注册，体验AI辅助小说创作的全新方式
              </p>
              <Button size="lg" onClick={handleGetStarted} className="gap-2">
                免费开始
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-3 w-3 text-primary" />
              </div>
              <span className="font-medium">幻写次元</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 幻写次元. AI驱动的小说创作平台.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
