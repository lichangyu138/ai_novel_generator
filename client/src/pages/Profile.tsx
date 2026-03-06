/**
 * Profile Page - User profile and settings
 */
import React from 'react';
import { useLocation } from 'wouter';
import NovelDashboardLayout from '@/components/NovelDashboardLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/_core/hooks/useAuth';
import { User, Mail, Shield, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    setLocation('/');
    toast.success('已退出登录');
  };

  return (
    <NovelDashboardLayout>
      <div className="p-6 md:p-8 lg:p-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">个人中心</h1>
          <p className="text-muted-foreground font-light">
            管理你的账户信息和设置
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-6">账户信息</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{user.name || '未设置昵称'}</h3>
                    <p className="text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>用户名</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{user.name || user.email}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{user.email || '未设置'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>角色</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className={user.role === 'admin' ? 'text-primary font-medium' : ''}>
                        {user.role === 'admin' ? '管理员' : '普通用户'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>注册时间</Label>
                    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : '未知'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-6">
            <div className="scandi-card p-6">
              <h2 className="text-lg font-bold mb-4">账户操作</h2>
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={handleLogout}
                >
                  退出登录
                </Button>
              </div>
            </div>

            {user.role === 'admin' && (
              <div className="scandi-card p-6">
                <h2 className="text-lg font-bold mb-4">管理员功能</h2>
                <div className="space-y-3">
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => setLocation('/admin')}
                  >
                    进入管理后台
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </NovelDashboardLayout>
  );
}
