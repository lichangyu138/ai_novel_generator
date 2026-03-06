/**
 * Admin Page - System administration dashboard
 */
import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users,
  BookOpen,
  Cpu,
  Loader2,
  Shield,
  UserCheck,
  UserX,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function Admin() {
  const [, setLocation] = useLocation();
  const { user: currentUser, isAuthenticated, loading: authLoading } = useAuth();

  // tRPC queries
  const usersQuery = trpc.admin.listUsers.useQuery(
    undefined,
    { enabled: isAuthenticated && currentUser?.role === 'admin' }
  );

  const novelsStatsQuery = trpc.admin.getStats.useQuery(
    undefined,
    { enabled: isAuthenticated && currentUser?.role === 'admin' }
  );

  // tRPC mutations
  const updateUserMutation = trpc.admin.updateUser.useMutation();

  const utils = trpc.useUtils();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.role !== 'admin') {
      toast.error('无权访问管理后台');
      setLocation('/novels');
    }
  }, [authLoading, isAuthenticated, currentUser, setLocation]);

  const handleUpdateUserRole = async (userId: number, role: string) => {
    try {
      await updateUserMutation.mutateAsync({ userId, role: role as 'user' | 'admin' });
      toast.success('用户角色已更新');
      utils.admin.listUsers.invalidate();
    } catch (error) {
      toast.error('更新失败');
    }
  };



  if (authLoading || usersQuery.isLoading) {
    return (
      <NovelDashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </NovelDashboardLayout>
    );
  }

  const users = usersQuery.data || [];
  const stats = novelsStatsQuery.data || { users: 0, novels: 0, chapters: 0, characters: 0 };

  return (
    <NovelDashboardLayout>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">管理后台</h1>
          <p className="text-muted-foreground font-light">
            系统管理和用户管理
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.users}</div>
                <div className="text-sm text-muted-foreground">总用户数</div>
              </div>
            </div>
          </div>
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{users.length}</div>
                <div className="text-sm text-muted-foreground">活跃用户</div>
              </div>
            </div>
          </div>
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.novels}</div>
                <div className="text-sm text-muted-foreground">小说总数</div>
              </div>
            </div>
          </div>
          <div className="scandi-card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <Cpu className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.chapters}</div>
                <div className="text-sm text-muted-foreground">章节总数</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              用户管理
            </TabsTrigger>
            <TabsTrigger value="system" className="gap-2">
              <Shield className="h-4 w-4" />
              系统设置
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <div className="scandi-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 font-medium">用户</th>
                      <th className="text-left p-4 font-medium">邮箱</th>
                      <th className="text-left p-4 font-medium">角色</th>
                      <th className="text-left p-4 font-medium">状态</th>
                      <th className="text-left p-4 font-medium">注册时间</th>
                      <th className="text-left p-4 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-border">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <span className="font-medium">{user.username}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{user.email || '-'}</td>
                        <td className="p-4">
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleUpdateUserRole(user.id, value)
                            }
                            disabled={user.id === currentUser?.id}
                          >
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">普通用户</SelectItem>
                              <SelectItem value="admin">管理员</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700">
                            活跃
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {/* 用户状态管理功能需要扩展数据库schema */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="system">
            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">系统设置</h2>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>功能说明</AlertTitle>
                <AlertDescription>
                  完整的系统设置功能（AI模型配置、系统参数等）需要在本地部署Python后端。
                  请参考部署文档进行配置。
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </NovelDashboardLayout>
  );
}
