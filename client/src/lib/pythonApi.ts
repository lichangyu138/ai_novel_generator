/**
 * Python Backend API Client
 * Handles communication with the Python FastAPI backend
 */

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class PythonApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const fullUrl = `${PYTHON_API_BASE}${endpoint}`;
    console.log('[PythonAPI] 请求URL:', fullUrl);
    console.log('[PythonAPI] 请求方法:', options.method || 'GET');
    console.log('[PythonAPI] 请求体:', options.body);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      console.log('[PythonAPI] 响应状态:', response.status, response.statusText);
      console.log('[PythonAPI] 响应Content-Type:', response.headers.get('content-type'));

      // Check if response is JSON
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (isJson) {
        const errorData = await response.json().catch(() => ({}));
        return { error: errorData.detail || `HTTP ${response.status}` };
        } else {
          // Not JSON, likely HTML error page
          const text = await response.text();
          console.error('[PythonAPI] 收到非JSON响应:', text.substring(0, 200));
          return { 
            error: `服务器返回了非JSON响应 (HTTP ${response.status})。请检查后端服务是否正常运行，URL是否正确: ${fullUrl}` 
          };
        }
      }

      if (!isJson) {
        const text = await response.text();
        console.error('[PythonAPI] 收到非JSON响应:', text.substring(0, 200));
        return { 
          error: `服务器返回了非JSON响应。请检查后端服务是否正常运行，URL是否正确: ${fullUrl}` 
        };
      }

      const data = await response.json();
      console.log('[PythonAPI] 响应数据:', data);
      return { data };
    } catch (error) {
      console.error('[PythonAPI] 请求错误:', error);
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return { 
          error: `解析响应失败: 服务器返回的不是有效的JSON。请检查后端服务是否正常运行，URL是否正确: ${fullUrl}` 
        };
      }
      return { error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Auth endpoints
  async register(username: string, email: string, password: string) {
    return this.request<{ access_token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(username: string, password: string) {
    return this.request<{ access_token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async getMe() {
    return this.request<User>('/auth/me');
  }

  // Novel endpoints
  async listNovels(page = 1, pageSize = 20) {
    return this.request<NovelListResponse>(`/novels?page=${page}&page_size=${pageSize}`);
  }

  async getNovel(novelId: number) {
    return this.request<Novel>(`/novels/${novelId}`);
  }

  async createNovel(data: NovelCreate) {
    return this.request<Novel>('/novels', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNovel(novelId: number, data: Partial<NovelCreate>) {
    return this.request<Novel>(`/novels/${novelId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteNovel(novelId: number) {
    return this.request<void>(`/novels/${novelId}`, {
      method: 'DELETE',
    });
  }

  // Character endpoints
  async listCharacters(novelId: number) {
    return this.request<Character[]>(`/novels/${novelId}/characters`);
  }

  async createCharacter(novelId: number, data: CharacterCreate) {
    return this.request<Character>(`/novels/${novelId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCharacter(novelId: number, characterId: number, data: Partial<CharacterCreate>) {
    return this.request<Character>(`/novels/${novelId}/characters/${characterId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCharacter(novelId: number, characterId: number) {
    return this.request<void>(`/novels/${novelId}/characters/${characterId}`, {
      method: 'DELETE',
    });
  }

  // Outline endpoints with streaming
  async generateOutline(novelId: number, onChunk: (chunk: string) => void) {
    return this.streamRequest(`/novels/${novelId}/outlines/generate`, onChunk, {
      method: 'POST',
    });
  }

  async listOutlines(novelId: number) {
    return this.request<Outline[]>(`/novels/${novelId}/outlines`);
  }

  async getCurrentOutline(novelId: number) {
    return this.request<Outline>(`/novels/${novelId}/outlines/current`);
  }

  async updateOutline(novelId: number, outlineId: number, content: string) {
    return this.request<Outline>(`/novels/${novelId}/outlines/${outlineId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  // Detailed outline endpoints with streaming
  async generateDetailedOutline(
    novelId: number,
    groupIndex: number,
    startChapter: number,
    endChapter: number,
    onChunk: (chunk: string) => void
  ) {
    return this.streamRequest(`/novels/${novelId}/outlines/detailed/generate`, onChunk, {
      method: 'POST',
      body: JSON.stringify({
        group_index: groupIndex,
        start_chapter: startChapter,
        end_chapter: endChapter,
      }),
    });
  }

  async listDetailedOutlines(novelId: number) {
    return this.request<DetailedOutline[]>(`/novels/${novelId}/outlines/detailed`);
  }

  // New method for batch detailed outline generation (moved to chapters API)
  // Using the new simple endpoint that actually works
  async generateDetailedOutlines(
    novelId: number,
    groupIndex: number,
    startChapter: number,
    endChapter: number
  ) {
    return this.request<{
      success: boolean;
      total_chapters: number;
      successful: number;
      failed: number;
      results: Array<{
        chapter: number;
        content: string;
        detailed_outline_id: number;
        chapter_outline_id: number;
      }>;
      errors: Array<{
        chapter: number;
        error: string;
      }>;
    }>(`/novels/${novelId}/chapters/detailed-outlines/generate-simple`, {
        method: 'POST',
        body: JSON.stringify({
          group_index: groupIndex,
          start_chapter: startChapter,
          end_chapter: endChapter,
        }),
    });
  }

  // Chapter endpoints with streaming
  async generateChapter(
    novelId: number,
    chapterNumber: number,
    onChunk: (chunk: string) => void,
    detailedOutlineId?: number
  ) {
    return this.streamRequest(`/novels/${novelId}/chapters/generate`, onChunk, {
      method: 'POST',
      body: JSON.stringify({
        chapter_number: chapterNumber,
        detailed_outline_id: detailedOutlineId,
      }),
    });
  }

  async listChapters(novelId: number) {
    return this.request<Chapter[]>(`/novels/${novelId}/chapters`);
  }

  async getChapter(novelId: number, chapterNumber: number) {
    return this.request<Chapter>(`/novels/${novelId}/chapters/${chapterNumber}`);
  }

  async updateChapter(novelId: number, chapterNumber: number, data: { title?: string; content?: string }) {
    return this.request<Chapter>(`/novels/${novelId}/chapters/${chapterNumber}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reviewChapter(novelId: number, chapterNumber: number, status: string, feedback?: string) {
    return this.request<Chapter>(`/novels/${novelId}/chapters/${chapterNumber}/review`, {
      method: 'POST',
      body: JSON.stringify({ status, feedback }),
    });
  }

  async reviseChapter(novelId: number, chapterNumber: number, feedback: string, onChunk: (chunk: string) => void) {
    return this.streamRequest(`/novels/${novelId}/chapters/${chapterNumber}/revise`, onChunk, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  // Knowledge endpoints
  async getKnowledgeStats(novelId: number) {
    return this.request<KnowledgeStats>(`/novels/${novelId}/knowledge/stats`);
  }

  async getCharacterGraph(novelId: number) {
    return this.request<GraphData>(`/novels/${novelId}/knowledge/graph/characters`);
  }

  async getWorldGraph(novelId: number) {
    return this.request<GraphData>(`/novels/${novelId}/knowledge/graph/world`);
  }

  async getTimeline(novelId: number) {
    return this.request<TimelineData>(`/novels/${novelId}/knowledge/timeline`);
  }

  // Model config endpoints
  async listModelConfigs() {
    return this.request<ModelConfig[]>('/model-configs');
  }

  async createModelConfig(data: ModelConfigCreate) {
    return this.request<ModelConfig>('/model-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateModelConfig(configId: number, data: Partial<ModelConfigCreate>) {
    return this.request<ModelConfig>(`/model-configs/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteModelConfig(configId: number) {
    return this.request<void>(`/model-configs/${configId}`, {
      method: 'DELETE',
    });
  }

  async setDefaultModelConfig(configId: number) {
    return this.request<ModelConfig>(`/model-configs/${configId}/set-default`, {
      method: 'POST',
    });
  }

  async testModelConfig(data: ModelConfigCreate) {
    return this.request<{ success: boolean; message: string; test_response?: string }>('/model-configs/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Generation history endpoints
  async listGenerationHistory(generationType?: string, page = 1, pageSize = 20) {
    let url = `/history?page=${page}&page_size=${pageSize}`;
    if (generationType) {
      url += `&generation_type=${generationType}`;
    }
    return this.request<GenerationHistoryListResponse>(url);
  }

  async listNovelGenerationHistory(novelId: number, generationType?: string, page = 1, pageSize = 20) {
    let url = `/novels/${novelId}/history?page=${page}&page_size=${pageSize}`;
    if (generationType) {
      url += `&generation_type=${generationType}`;
    }
    return this.request<GenerationHistoryListResponse>(url);
  }

  // Admin endpoints
  async listUsers(page = 1, pageSize = 20) {
    return this.request<UserListResponse>(`/admin/users?page=${page}&page_size=${pageSize}`);
  }

  async updateUser(userId: number, data: { role?: string; is_active?: boolean }) {
    return this.request<User>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getSystemStats() {
    return this.request<SystemStats>('/admin/stats');
  }

  // Streaming request helper
  private async streamRequest(
    endpoint: string,
    onChunk: (chunk: string) => void,
    options: RequestInit = {}
  ): Promise<{ done: boolean; error?: string }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${PYTHON_API_BASE}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { done: false, error: errorData.detail || `HTTP ${response.status}` };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return { done: false, error: 'No response body' };
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                onChunk(data.chunk);
              }
              if (data.done) {
                return { done: true };
              }
              if (data.error) {
                return { done: false, error: data.error };
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      return { done: true };
    } catch (error) {
      return { done: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  // Streaming request helper with progress callback
  private async streamRequestWithProgress(
    endpoint: string,
    onChunk: (chunk: string) => void,
    onProgress?: (data: any) => void,
    options: RequestInit = {}
  ): Promise<{ done: boolean; error?: string }> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const fullUrl = `${PYTHON_API_BASE}${endpoint}`;
    console.log('[PythonAPI] 开始请求:', fullUrl);
    console.log('[PythonAPI] 请求体:', options.body);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        headers,
      });

      console.log('[PythonAPI] 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.detail || `HTTP ${response.status}`;
        console.error('[PythonAPI] 请求失败:', errorMsg);
        return { done: false, error: errorMsg };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        console.error('[PythonAPI] 没有响应体');
        return { done: false, error: 'No response body' };
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      let hasReceivedData = false;

      console.log('[PythonAPI] 开始读取流式响应...');

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[PythonAPI] 流式响应结束，共收到', chunkCount, '个chunk');
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              hasReceivedData = true;
              
              // Handle chunk data
              if (data.chunk) {
                chunkCount++;
                onChunk(data.chunk);
                if (chunkCount % 10 === 0) {
                  console.log('[PythonAPI] 已收到', chunkCount, '个chunk');
                }
              }
              
              // Handle progress data (chapter status updates)
              if (onProgress && (data.chapter || data.status)) {
                console.log('[PythonAPI] 进度更新:', data);
                onProgress(data);
              }
              
              // Handle completion
              if (data.done) {
                console.log('[PythonAPI] 生成完成');
                return { done: true };
              }
              
              // Handle errors
              if (data.error) {
                console.error('[PythonAPI] 服务器错误:', data.error);
                return { done: false, error: data.error };
              }
            } catch (e) {
              console.warn('[PythonAPI] 解析JSON失败:', line, e);
            }
          } else {
            console.warn('[PythonAPI] 未知格式的行:', line);
            }
          }
        }

      if (!hasReceivedData) {
        console.warn('[PythonAPI] 警告: 没有收到任何数据');
        return { done: false, error: '没有收到任何数据，请检查后端服务是否正常运行' };
      }

      console.log('[PythonAPI] 流式响应正常结束');
      return { done: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Network error';
      console.error('[PythonAPI] 网络错误:', errorMsg, error);
      return { done: false, error: errorMsg };
    }
  }
}

// Types
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

export interface Novel {
  id: number;
  user_id: number;
  title: string;
  genre?: string;
  style?: string;
  description?: string;
  prompt?: string;
  world_setting?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface NovelCreate {
  title: string;
  genre?: string;
  style?: string;
  description?: string;
  prompt?: string;
  world_setting?: string;
}

export interface NovelListResponse {
  items: Novel[];
  total: number;
  page: number;
  page_size: number;
}

export interface Character {
  id: number;
  novel_id: number;
  user_id: number;
  name: string;
  role?: string;
  gender?: string;
  age?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  abilities?: string;
  relationships?: CharacterRelation[];
  extra_info?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CharacterRelation {
  character_id: number;
  relation_type: string;
  description?: string;
}

export interface CharacterCreate {
  name: string;
  role?: string;
  gender?: string;
  age?: string;
  personality?: string;
  background?: string;
  appearance?: string;
  abilities?: string;
  relationships?: CharacterRelation[];
  extra_info?: Record<string, unknown>;
}

export interface Outline {
  id: number;
  novel_id: number;
  content: string;
  version: number;
  is_current: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DetailedOutline {
  id: number;
  outline_id: number;
  novel_id: number;
  group_index: number;
  start_chapter: number;
  end_chapter: number;
  content: string;
  version: number;
  is_current: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: number;
  novel_id: number;
  chapter_number: number;
  title?: string;
  content?: string;
  word_count: number;
  version: number;
  is_current: boolean;
  generation_status: string;
  review_status: string;
  review_feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeStats {
  total: number;
  character: number;
  chapter_content: number;
  setting: number;
  plot: number;
}

export interface GraphNode {
  id: number;
  name: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: number;
  target: number;
  type: string;
  description?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TimelineEvent {
  id: number;
  name: string;
  time_point: string;
  description?: string;
  chapter_id?: number;
}

export interface TimelineData {
  events: TimelineEvent[];
}

export interface ModelConfig {
  id: number;
  user_id: number;
  name: string;
  model_type: string;
  api_base?: string;
  model_name?: string;
  temperature: number;
  top_p: number;
  max_tokens: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModelConfigCreate {
  name: string;
  model_type: string;
  api_key?: string;
  api_base?: string;
  model_name?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  is_default?: boolean;
}

export interface GenerationHistoryListResponse {
  items: GenerationHistory[];
  total: number;
  page: number;
  page_size: number;
}

export interface GenerationHistory {
  id: number;
  novel_id: number;
  novel_title?: string;
  type: string;
  chapter_number?: number;
  target_id?: number;
  prompt?: string;
  content?: string;
  model_config?: Record<string, unknown>;
  token_usage?: Record<string, unknown>;
  duration_seconds?: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}

export interface SystemStats {
  users: {
    total: number;
    active: number;
    admins: number;
  };
  novels: {
    total: number;
  };
  model_configs: {
    total: number;
  };
}

export interface KnowledgeContext {
  characters: Character[];
  events: StoryEvent[];
  knowledge_entries: KnowledgeEntry[];
  world_setting: string | null;
  previous_chapters: { chapter_number: number; title?: string; content?: string }[];
}

export interface StoryEvent {
  id: number;
  title: string;
  description?: string;
  event_type?: string;
  importance?: number;
  characters_involved?: string;
  location?: string;
}

export interface KnowledgeEntry {
  id: number;
  entry_type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface StreamEvent {
  type: 'context' | 'chunk' | 'done' | 'error';
  data: unknown;
}

export interface GenerateChapterStreamRequest {
  novel_id: number;
  chapter_number: number;
  detailed_outline_id?: number;
  target_word_count?: number;
  include_knowledge?: boolean;
  include_characters?: boolean;
  include_events?: boolean;
  custom_prompt?: string;
}

export interface AIModifyStreamRequest {
  content: string;
  instruction: string;
  novel_id: number;
}

export interface ConfirmGenerationRequest {
  novel_id: number;
  content_type: 'chapter' | 'outline' | 'detailed_outline';
  content_id: number;
  content: string;
  extract_knowledge?: boolean;
}

// Export singleton instance
export const pythonApi = new PythonApiClient();

// Enhanced streaming API methods
export async function* generateChapterStream(
  request: GenerateChapterStreamRequest,
  token?: string,
  onContext?: (context: { characters_count: number; events_count: number; knowledge_count: number }) => void
): AsyncGenerator<string, void, unknown> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${PYTHON_API_BASE}/generate/chapter/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Generation failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          
          if (event.type === 'context' && onContext) {
            onContext(event.data as { characters_count: number; events_count: number; knowledge_count: number });
          } else if (event.type === 'chunk') {
            yield event.data as string;
          } else if (event.type === 'done') {
            return;
          } else if (event.type === 'error') {
            throw new Error(event.data as string);
          }
        } catch (e) {
          // Ignore parse errors for incomplete data
        }
      }
    }
  }
}

export async function* aiModifyStream(
  request: AIModifyStreamRequest,
  token?: string
): AsyncGenerator<string, void, unknown> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${PYTHON_API_BASE}/generate/ai-modify/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AI modify failed: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const event: StreamEvent = JSON.parse(line.slice(6));
          
          if (event.type === 'chunk') {
            yield event.data as string;
          } else if (event.type === 'done') {
            return;
          } else if (event.type === 'error') {
            throw new Error(event.data as string);
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }
}

export async function getChapterContext(
  request: GenerateChapterStreamRequest,
  token?: string
): Promise<{
  novel: Novel;
  detailed_outline: string | null;
  context: KnowledgeContext;
}> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${PYTHON_API_BASE}/generate/chapter/context`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Failed to get context: ${response.statusText}`);
  }

  return response.json();
}

export async function confirmGeneration(
  request: ConfirmGenerationRequest,
  token?: string
): Promise<{ success: boolean; id: number; type: string }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${PYTHON_API_BASE}/generate/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Confirm failed: ${response.statusText}`);
  }

  return response.json();
}
