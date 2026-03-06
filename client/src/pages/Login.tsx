/**
 * Login Page - Username/Password Authentication
 * Independent authentication without Manus OAuth
 */
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { BookOpen, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export default function Login() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const utils = trpc.useUtils();
  
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      console.log('[Frontend Login] Login success:', data);
      console.log('[Frontend Login] User data:', data.user);
      
      // 更新 auth.me 查询的缓存数据
      utils.auth.me.setData(undefined, data.user);
      console.log('[Frontend Login] Updated auth.me cache');
      
      // 刷新 auth.me 查询以确保状态同步
      try {
        await utils.auth.me.invalidate();
        console.log('[Frontend Login] Invalidated auth.me query');
        
        // 等待查询完成
        const meData = await utils.auth.me.fetch();
        console.log('[Frontend Login] Fetched auth.me data:', meData);
        
        if (meData) {
          toast.success('登录成功');
          // 使用 setLocation 而不是 window.location.href，避免页面完全刷新
          setTimeout(() => {
            setLocation('/novels');
          }, 200);
        } else {
          console.warn('[Frontend Login] auth.me returned null, using window.location');
          toast.success('登录成功');
          window.location.href = '/novels';
        }
      } catch (error) {
        console.error('[Frontend Login] Error refreshing auth state:', error);
        toast.success('登录成功');
        // 如果刷新失败，直接跳转
        window.location.href = '/novels';
      }
    },
    onError: (error) => {
      console.error('[Frontend Login] Login error:', error);
      console.error('[Frontend Login] Error message:', error.message);
      console.error('[Frontend Login] Error code:', error.data?.code);
      console.error('[Frontend Login] Error shape:', error.shape);
      console.error('[Frontend Login] Full error:', JSON.stringify(error, null, 2));
      toast.error(error.message || '登录失败');
    },
  });

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation('/novels');
    }
  }, [isAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Frontend Login] Login attempt started');
    console.log('[Frontend Login] Username:', username);
    console.log('[Frontend Login] Password length:', password.length);
    
    if (!username || !password) {
      console.warn('[Frontend Login] Username or password is empty');
      toast.error('请输入用户名和密码');
      return;
    }
    
    console.log('[Frontend Login] Calling login mutation...');
    try {
      loginMutation.mutate({ username, password });
    } catch (error) {
      console.error('[Frontend Login] Mutation call error:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-bold text-2xl">幻写次元</span>
          </Link>

          {/* Content */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">欢迎回来</h1>
              <p className="text-muted-foreground font-light">
                登录您的账户，继续创作
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loginMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loginMutation.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    登录
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              还没有账户？{' '}
              <Link href="/register" className="text-primary hover:underline font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-muted/30 items-center justify-center relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-20 left-20 w-64 h-64 geo-shape geo-blue" />
        <div className="absolute bottom-32 right-20 w-48 h-48 geo-shape geo-pink" />
        <div className="absolute top-1/2 left-1/3 w-32 h-32 geo-shape geo-blue" />

        <div className="relative z-10 text-center max-w-md px-8">
          <h2 className="text-3xl font-bold mb-4">AI驱动的创作体验</h2>
          <p className="text-muted-foreground font-light text-lg">
            从设定到完整章节，让AI成为你的创作伙伴。知识图谱保证人物一致，向量检索确保情节连贯。
          </p>
        </div>
      </div>
    </div>
  );
}
