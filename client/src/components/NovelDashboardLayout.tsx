/**
 * Novel Dashboard Layout
 * Scandinavian minimalist design with sidebar navigation
 */
import React from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';
import { getLoginUrl } from '@/const';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BookOpen,
  Users,
  FileText,
  Layers,
  Settings,
  LogOut,
  Home,
  History,
  Cpu,
  ChevronRight,
  Menu,
  X,
  Loader2,
  Globe,
  Search,
  FileCode,
  BookOpenCheck,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const mainNavItems: NavItem[] = [
  { label: '首页', href: '/', icon: Home },
  { label: '我的小说', href: '/novels', icon: BookOpen },
];

const novelNavItems: NavItem[] = [
  { label: '项目概览', href: '/novels/:id', icon: FileText },
  { label: '大纲管理', href: '/novels/:id/outline', icon: Layers },
  { label: '章节管理', href: '/novels/:id/chapters', icon: FileText },
  { label: '世界观管理', href: '/novels/:id/worldbuilding', icon: Globe },
  { label: '知识库', href: '/novels/:id/knowledge', icon: Database },
  { label: '全文搜索', href: '/novels/:id/search', icon: Search },
  { label: '阅读模式', href: '/novels/:id/read', icon: BookOpenCheck },
];

const settingsNavItems: NavItem[] = [
  { label: 'AI模型配置', href: '/model-config', icon: Cpu },
  { label: 'Prompt模板', href: '/prompt-templates', icon: FileCode },
  { label: '生成历史', href: '/history', icon: History },
];

interface NovelDashboardLayoutProps {
  children: React.ReactNode;
  novelId?: number;
  novelTitle?: string;
}

export default function NovelDashboardLayout({
  children,
  novelId,
  novelTitle,
}: NovelDashboardLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const isAdmin = user?.role === 'admin';

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  const renderNavItem = (item: NavItem, novelId?: number) => {
    if (item.adminOnly && !isAdmin) return null;

    let href = item.href;
    if (novelId && item.href.includes(':id')) {
      href = item.href.replace(':id', String(novelId));
    }

    const isActive = location === href || (href !== '/' && location.startsWith(href));

    return (
      <Link
        key={item.href}
        href={href}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <item.icon className="h-4 w-4" />
        {item.label}
      </Link>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold text-lg">幻写次元</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {/* Main navigation */}
          <div className="space-y-1">
            {mainNavItems.map((item) => renderNavItem(item))}
          </div>

          {/* Novel-specific navigation */}
          {novelId && (
            <div className="space-y-2">
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <ChevronRight className="h-3 w-3" />
                  {novelTitle || '当前小说'}
                </div>
              </div>
              <div className="space-y-1">
                {novelNavItems.map((item) => renderNavItem(item, novelId))}
              </div>
            </div>
          )}

          {/* Settings navigation */}
          <div className="space-y-2">
            <div className="px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                设置
              </div>
            </div>
            <div className="space-y-1">
              {settingsNavItems.map((item) => renderNavItem(item))}
            </div>
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-auto py-2"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium">{user?.name || user?.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {user?.role === 'admin' ? '管理员' : '用户'}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation('/profile')}>
                <Users className="h-4 w-4 mr-2" />
                个人中心
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => setLocation('/admin')}>
                  <Settings className="h-4 w-4 mr-2" />
                  管理后台
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-16 border-b border-border flex items-center px-4 gap-4 bg-background sticky top-0 z-30">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span className="font-bold">幻写次元</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Decorative geometric shapes */}
      <div className="fixed top-20 right-10 w-32 h-32 geo-shape geo-blue -z-10 hidden xl:block" />
      <div className="fixed bottom-20 right-40 w-24 h-24 geo-shape geo-pink -z-10 hidden xl:block" />
    </div>
  );
}
