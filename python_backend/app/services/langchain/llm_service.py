"""
LangChain LLM Service - AI Model Integration
Supports multiple model providers with streaming
"""
from typing import Optional, Dict, Any, AsyncGenerator, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import logging
import time
from openai import APIConnectionError, APITimeoutError

from app.config.settings import get_settings
from app.models.database import AIModelConfig

settings = get_settings()
logger = logging.getLogger(__name__)


class LLMService:
    """LLM Service with support for multiple model providers"""
    
    def __init__(self, model_config: Optional[AIModelConfig] = None):
        """
        Initialize LLM service
        
        Args:
            model_config: Optional custom model configuration from database
        """
        self.model_config = model_config
        self._llm = None
    
    def _get_llm(self, streaming: bool = False, timeout: float = 600.0) -> ChatOpenAI:
        """Get LLM instance based on configuration"""
        if self.model_config:
            # Use custom model configuration
            print(f"[LLMService] Using custom config: {self.model_config.api_base}, model={self.model_config.model_name}")
            return ChatOpenAI(
                api_key=self.model_config.api_key,
                base_url=self.model_config.api_base,
                model=self.model_config.model_name,
                temperature=self.model_config.temperature,
                max_tokens=self.model_config.max_tokens,
                streaming=streaming,
                timeout=timeout,
                max_retries=3  # 添加重试次数
            )
        else:
            # Use default configuration from settings
            api_key = settings.OPENAI_API_KEY or settings.BUILT_IN_FORGE_API_KEY or "hk-4rlisq100003893046dc10e91fa58f850eaba608d8ff489d"
            base_url = settings.OPENAI_API_BASE or settings.BUILT_IN_FORGE_API_URL or "https://api.openai-hk.com/v1"
            model = settings.OPENAI_MODEL or "gemini-3-pro-preview"
            print(f"[LLMService] Using config: api_key={'set' if api_key else 'missing'}, base_url={base_url}, model={model}")
            return ChatOpenAI(
                api_key=api_key,
                base_url=base_url,
                model=model,
                temperature=settings.DEFAULT_TEMPERATURE,
                max_tokens=settings.DEFAULT_MAX_TOKENS,
                streaming=streaming,
                timeout=timeout,
                max_retries=3  # 添加重试次数
            )
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Generate text using LLM (non-streaming)

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Optional temperature override
            max_tokens: Optional max tokens override

        Returns:
            Generated text
        """
        llm = self._get_llm(streaming=False)

        if temperature is not None:
            llm.temperature = temperature
        if max_tokens is not None:
            llm.max_tokens = max_tokens

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        response = await llm.ainvoke(messages)
        return response.content

    def generate_sync(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Generate text using LLM (synchronous version for LangGraph)
        With retry mechanism for connection errors
        """
        # 复用默认配置，避免同步/异步配置不一致导致空内容
        safe_max_tokens = max_tokens or settings.DEFAULT_MAX_TOKENS
        if safe_max_tokens > 32768:
            print(f"[generate_sync] 警告：max_tokens={safe_max_tokens} 超过最大值，调整为 32768")
            safe_max_tokens = 32768

        # 根据 max_tokens 动态设置超时时间（每1000 tokens约10秒，最少300秒）
        timeout = max(300.0, (safe_max_tokens / 1000) * 10)
        llm = self._get_llm(streaming=False, timeout=timeout)
        if temperature is not None:
            llm.temperature = temperature
        if safe_max_tokens is not None:
            llm.max_tokens = safe_max_tokens

        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))

        # Get model name for logging
        model_name = self.model_config.model_name if self.model_config else (settings.OPENAI_MODEL or "gemini-3-pro-preview")

        print(f"[generate_sync] 开始调用 LLM，messages 数量: {len(messages)}")
        print(f"[generate_sync] 提示词长度: {len(prompt)}")
        print(f"[generate_sync] max_tokens: {safe_max_tokens}")
        print(f"[generate_sync] timeout: {timeout}秒")
        print(f"[generate_sync] 模型: {model_name}")

        # 重试机制
        max_retries = 3
        retry_delay = 2  # 初始延迟2秒
        
        for attempt in range(max_retries):
            try:
                if attempt > 0:
                    wait_time = retry_delay * (2 ** (attempt - 1))  # 指数退避
                    print(f"[generate_sync] 第 {attempt + 1} 次重试，等待 {wait_time} 秒...")
                    time.sleep(wait_time)
                
                print(f"[generate_sync] 正在调用 llm.invoke()... (尝试 {attempt + 1}/{max_retries})")
                response = llm.invoke(messages)
                print(f"[generate_sync] llm.invoke() 返回成功")

                print(f"[generate_sync] LLM 调用完成")
                print(f"[generate_sync] 响应对象: {response}")
                print(f"[generate_sync] 响应类型: {type(response)}")
                print(f"[generate_sync] 是否有 content 属性: {hasattr(response, 'content')}")

                if hasattr(response, 'content'):
                    content = response.content if response.content else ""
                    print(f"[generate_sync] content 类型: {type(content)}")
                    print(f"[generate_sync] content 长度: {len(content)}")
                    print(f"[generate_sync] content 预览: {content[:200] if content else 'None'}")

                    if not content:
                        print(f"[generate_sync] 警告：LLM 返回了空内容！")
                        print(f"[generate_sync] 完整响应对象: {response}")

                    return content
                else:
                    print(f"[generate_sync] 没有 content 属性，返回字符串形式")
                    return str(response)
                    
            except (APIConnectionError, APITimeoutError) as e:
                error_msg = str(e)
                print(f"[generate_sync] 连接错误 (尝试 {attempt + 1}/{max_retries}): {error_msg}")
                print(f"[generate_sync] 错误类型: {type(e)}")
                
                if attempt == max_retries - 1:
                    # 最后一次重试失败
                    print(f"[generate_sync] 所有重试均失败，抛出异常")
                    import traceback
                    traceback.print_exc()
                    raise
                # 继续重试
                continue
                
            except Exception as e:
                # 其他类型的错误直接抛出，不重试
                print(f"[generate_sync] 错误: {e}")
                print(f"[generate_sync] 错误类型: {type(e)}")
                import traceback
                traceback.print_exc()
                raise
        
        # 理论上不会到达这里
        raise Exception("重试机制异常：所有重试均失败但未抛出异常")
    
    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generate text using LLM with streaming
        
        Args:
            prompt: User prompt
            system_prompt: Optional system prompt
            temperature: Optional temperature override
            max_tokens: Optional max tokens override
        
        Yields:
            Text chunks as they are generated
        """
        llm = self._get_llm(streaming=True)
        
        if temperature is not None:
            llm.temperature = temperature
        if max_tokens is not None:
            llm.max_tokens = max_tokens
        
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        messages.append(HumanMessage(content=prompt))
        
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content
    
    async def generate_with_context(
        self,
        prompt: str,
        context: List[Dict[str, str]],
        system_prompt: Optional[str] = None
    ) -> AsyncGenerator[str, None]:
        """
        Generate text with conversation context (streaming)
        
        Args:
            prompt: Current user prompt
            context: List of previous messages [{role, content}]
            system_prompt: Optional system prompt
        
        Yields:
            Text chunks as they are generated
        """
        llm = self._get_llm(streaming=True)
        
        messages = []
        if system_prompt:
            messages.append(SystemMessage(content=system_prompt))
        
        # Add context messages
        for msg in context:
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        
        # Add current prompt
        messages.append(HumanMessage(content=prompt))
        
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content


def get_llm_service(model_config: Optional[AIModelConfig] = None) -> LLMService:
    """Get LLM service instance"""
    return LLMService(model_config)
