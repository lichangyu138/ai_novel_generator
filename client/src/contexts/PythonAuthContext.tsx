/**
 * Python Backend Authentication Context
 * Manages authentication state for the Python FastAPI backend
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { pythonApi, User } from '@/lib/pythonApi';

interface PythonAuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const PythonAuthContext = createContext<PythonAuthContextType | undefined>(undefined);

const TOKEN_KEY = 'python_auth_token';

export function PythonAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from stored token
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        pythonApi.setToken(token);
        const response = await pythonApi.getMe();
        if (response.data) {
          setUser(response.data);
        } else {
          // Token invalid, clear it
          localStorage.removeItem(TOKEN_KEY);
          pythonApi.setToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const response = await pythonApi.login(username, password);

    if (response.data) {
      localStorage.setItem(TOKEN_KEY, response.data.access_token);
      pythonApi.setToken(response.data.access_token);
      setUser(response.data.user);
      setLoading(false);
      return true;
    } else {
      setError(response.error || 'Login failed');
      setLoading(false);
      return false;
    }
  }, []);

  const register = useCallback(async (username: string, email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const response = await pythonApi.register(username, email, password);

    if (response.data) {
      localStorage.setItem(TOKEN_KEY, response.data.access_token);
      pythonApi.setToken(response.data.access_token);
      setUser(response.data.user);
      setLoading(false);
      return true;
    } else {
      setError(response.error || 'Registration failed');
      setLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    pythonApi.setToken(null);
    setUser(null);
    setError(null);
  }, []);

  const value: PythonAuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };

  return (
    <PythonAuthContext.Provider value={value}>
      {children}
    </PythonAuthContext.Provider>
  );
}

export function usePythonAuth() {
  const context = useContext(PythonAuthContext);
  if (context === undefined) {
    throw new Error('usePythonAuth must be used within a PythonAuthProvider');
  }
  return context;
}
