"""
Elasticsearch 全文搜索服务
用于小说内容的全文检索、模糊搜索、高亮显示等功能
"""

from elasticsearch import Elasticsearch, helpers
from typing import List, Dict, Any, Optional
import logging
from ..config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ElasticsearchService:
    """Elasticsearch服务类"""
    
    def __init__(self):
        self.client: Optional[Elasticsearch] = None
        self.connected = False
        
        # 索引名称定义
        self.INDEX_NOVELS = "novels"
        self.INDEX_CHAPTERS = "chapters"
        self.INDEX_CHARACTERS = "characters"
        self.INDEX_EVENTS = "events"
        self.INDEX_LOCATIONS = "locations"
        self.INDEX_ITEMS = "items"
        self.INDEX_ORGANIZATIONS = "organizations"
        self.INDEX_FORESHADOWING = "foreshadowing"
    
    async def connect(self):
        """连接到Elasticsearch"""
        try:
            es_url = getattr(settings, 'ELASTICSEARCH_URL', 'http://localhost:9200')
            es_user = getattr(settings, 'ELASTICSEARCH_USER', None)
            es_password = getattr(settings, 'ELASTICSEARCH_PASSWORD', None)
            
            if es_user and es_password:
                self.client = Elasticsearch(
                    es_url,
                    basic_auth=(es_user, es_password),
                    verify_certs=False
                )
            else:
                self.client = Elasticsearch(es_url)
            
            # 测试连接
            if self.client.ping():
                self.connected = True
                logger.info("Elasticsearch连接成功")
                # 初始化索引
                await self.init_indices()
            else:
                logger.warning("Elasticsearch连接失败")
                self.connected = False
        except Exception as e:
            logger.warning(f"Elasticsearch连接失败: {e}")
            self.connected = False
    
    async def disconnect(self):
        """断开连接"""
        if self.client:
            self.client.close()
            self.connected = False
            logger.info("Elasticsearch连接已关闭")
    
    async def init_indices(self):
        """初始化所有索引"""
        indices_mappings = {
            self.INDEX_NOVELS: self._get_novel_mapping(),
            self.INDEX_CHAPTERS: self._get_chapter_mapping(),
            self.INDEX_CHARACTERS: self._get_character_mapping(),
            self.INDEX_EVENTS: self._get_event_mapping(),
            self.INDEX_LOCATIONS: self._get_location_mapping(),
            self.INDEX_ITEMS: self._get_item_mapping(),
            self.INDEX_ORGANIZATIONS: self._get_organization_mapping(),
            self.INDEX_FORESHADOWING: self._get_foreshadowing_mapping(),
        }
        
        for index_name, mapping in indices_mappings.items():
            await self._create_index_if_not_exists(index_name, mapping)
    
    async def _create_index_if_not_exists(self, index_name: str, mapping: Dict):
        """创建索引（如果不存在）"""
        if not self.client:
            return
        
        try:
            if not self.client.indices.exists(index=index_name):
                self.client.indices.create(index=index_name, body=mapping)
                logger.info(f"创建索引: {index_name}")
        except Exception as e:
            logger.error(f"创建索引失败 {index_name}: {e}")
    
    def _get_novel_mapping(self) -> Dict:
        """小说索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "title": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
                    "genre": {"type": "keyword"},
                    "style": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "prompt": {"type": "text", "analyzer": "ik_max_word"},
                    "world_setting": {"type": "text", "analyzer": "ik_max_word"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
    
    def _get_chapter_mapping(self) -> Dict:
        """章节索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "chapter_number": {"type": "integer"},
                    "title": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
                    "content": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
                    "summary": {"type": "text", "analyzer": "ik_max_word"},
                    "word_count": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "emotional_tone": {"type": "keyword"},
                    "involved_characters": {"type": "integer"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        }
    
    def _get_character_mapping(self) -> Dict:
        """人物索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "aliases": {"type": "text", "analyzer": "ik_max_word"},
                    "role": {"type": "keyword"},
                    "gender": {"type": "keyword"},
                    "personality": {"type": "text", "analyzer": "ik_max_word"},
                    "background": {"type": "text", "analyzer": "ik_max_word"},
                    "appearance": {"type": "text", "analyzer": "ik_max_word"},
                    "abilities": {"type": "text", "analyzer": "ik_max_word"},
                    "speech_style": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_event_mapping(self) -> Dict:
        """事件索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "event_type": {"type": "keyword"},
                    "chapter_number": {"type": "integer"},
                    "location": {"type": "text", "analyzer": "ik_max_word"},
                    "consequences": {"type": "text", "analyzer": "ik_max_word"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_location_mapping(self) -> Dict:
        """地点索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "location_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "atmosphere": {"type": "text", "analyzer": "ik_max_word"},
                    "notable_features": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_item_mapping(self) -> Dict:
        """物品索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "item_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "abilities": {"type": "text", "analyzer": "ik_max_word"},
                    "rarity": {"type": "keyword"},
                    "origin": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_organization_mapping(self) -> Dict:
        """组织索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "org_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "hierarchy": {"type": "text", "analyzer": "ik_max_word"},
                    "goals": {"type": "text", "analyzer": "ik_max_word"},
                    "founding_story": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_foreshadowing_mapping(self) -> Dict:
        """伏笔索引映射"""
        return {
            "settings": {
                "number_of_shards": 1,
                "number_of_replicas": 0,
                "analysis": self._get_chinese_analyzer()
            },
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "title": {"type": "text", "analyzer": "ik_max_word", "fields": {"keyword": {"type": "keyword"}}},
                    "content": {"type": "text", "analyzer": "ik_max_word"},
                    "planted_chapter": {"type": "integer"},
                    "target_chapter": {"type": "integer"},
                    "importance": {"type": "keyword"},
                    "status": {"type": "keyword"},
                    "resolution_notes": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        }
    
    def _get_chinese_analyzer(self) -> Dict:
        """获取中文分析器配置"""
        return {
            "analyzer": {
                "ik_max_word": {
                    "type": "custom",
                    "tokenizer": "ik_max_word"
                },
                "ik_smart": {
                    "type": "custom",
                    "tokenizer": "ik_smart"
                }
            }
        }
    
    # ============================================
    # 索引操作方法
    # ============================================
    
    async def index_document(self, index: str, doc_id: int, document: Dict) -> bool:
        """索引单个文档"""
        if not self.connected or not self.client:
            return False
        
        try:
            self.client.index(index=index, id=str(doc_id), body=document)
            return True
        except Exception as e:
            logger.error(f"索引文档失败: {e}")
            return False
    
    async def bulk_index(self, index: str, documents: List[Dict]) -> bool:
        """批量索引文档"""
        if not self.connected or not self.client:
            return False
        
        try:
            actions = [
                {
                    "_index": index,
                    "_id": str(doc.get("id")),
                    "_source": doc
                }
                for doc in documents
            ]
            helpers.bulk(self.client, actions)
            return True
        except Exception as e:
            logger.error(f"批量索引失败: {e}")
            return False
    
    async def delete_document(self, index: str, doc_id: int) -> bool:
        """删除文档"""
        if not self.connected or not self.client:
            return False
        
        try:
            self.client.delete(index=index, id=str(doc_id))
            return True
        except Exception as e:
            logger.error(f"删除文档失败: {e}")
            return False
    
    async def update_document(self, index: str, doc_id: int, document: Dict) -> bool:
        """更新文档"""
        if not self.connected or not self.client:
            return False
        
        try:
            self.client.update(index=index, id=str(doc_id), body={"doc": document})
            return True
        except Exception as e:
            logger.error(f"更新文档失败: {e}")
            return False
    
    # ============================================
    # 搜索方法
    # ============================================
    
    async def search(
        self,
        index: str,
        query: str,
        user_id: int,
        novel_id: Optional[int] = None,
        fields: Optional[List[str]] = None,
        size: int = 20,
        from_: int = 0,
        highlight: bool = True
    ) -> Dict[str, Any]:
        """
        全文搜索
        
        Args:
            index: 索引名称
            query: 搜索关键词
            user_id: 用户ID（数据隔离）
            novel_id: 小说ID（可选，进一步过滤）
            fields: 搜索字段列表
            size: 返回结果数量
            from_: 分页起始位置
            highlight: 是否高亮
        
        Returns:
            搜索结果
        """
        if not self.connected or not self.client:
            return {"hits": [], "total": 0}
        
        # 默认搜索字段
        if fields is None:
            fields = ["title", "content", "name", "description"]
        
        # 构建查询
        must_clauses = [
            {"term": {"user_id": user_id}},
            {"multi_match": {
                "query": query,
                "fields": fields,
                "type": "best_fields",
                "fuzziness": "AUTO"
            }}
        ]
        
        if novel_id:
            must_clauses.append({"term": {"novel_id": novel_id}})
        
        search_body = {
            "query": {
                "bool": {
                    "must": must_clauses
                }
            },
            "size": size,
            "from": from_,
            "sort": [{"_score": "desc"}]
        }
        
        # 添加高亮
        if highlight:
            search_body["highlight"] = {
                "fields": {field: {} for field in fields},
                "pre_tags": ["<mark>"],
                "post_tags": ["</mark>"],
                "fragment_size": 150,
                "number_of_fragments": 3
            }
        
        try:
            response = self.client.search(index=index, body=search_body)
            
            hits = []
            for hit in response["hits"]["hits"]:
                item = {
                    "id": hit["_id"],
                    "score": hit["_score"],
                    **hit["_source"]
                }
                if "highlight" in hit:
                    item["highlight"] = hit["highlight"]
                hits.append(item)
            
            return {
                "hits": hits,
                "total": response["hits"]["total"]["value"]
            }
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return {"hits": [], "total": 0}
    
    async def search_all(
        self,
        query: str,
        user_id: int,
        novel_id: Optional[int] = None,
        size: int = 10
    ) -> Dict[str, Any]:
        """
        跨索引全局搜索
        
        Args:
            query: 搜索关键词
            user_id: 用户ID
            novel_id: 小说ID（可选）
            size: 每个索引返回的结果数量
        
        Returns:
            各索引的搜索结果
        """
        results = {}
        
        indices_config = [
            (self.INDEX_CHAPTERS, ["title", "content", "summary"]),
            (self.INDEX_CHARACTERS, ["name", "aliases", "personality", "background"]),
            (self.INDEX_EVENTS, ["name", "description", "consequences"]),
            (self.INDEX_LOCATIONS, ["name", "description", "atmosphere"]),
            (self.INDEX_ITEMS, ["name", "description", "abilities"]),
            (self.INDEX_ORGANIZATIONS, ["name", "description", "goals"]),
            (self.INDEX_FORESHADOWING, ["title", "content", "resolution_notes"]),
        ]
        
        for index, fields in indices_config:
            result = await self.search(
                index=index,
                query=query,
                user_id=user_id,
                novel_id=novel_id,
                fields=fields,
                size=size
            )
            results[index] = result
        
        return results
    
    async def suggest(
        self,
        index: str,
        query: str,
        user_id: int,
        field: str = "name",
        size: int = 5
    ) -> List[str]:
        """
        搜索建议/自动补全
        
        Args:
            index: 索引名称
            query: 输入的查询词
            user_id: 用户ID
            field: 建议字段
            size: 返回建议数量
        
        Returns:
            建议列表
        """
        if not self.connected or not self.client:
            return []
        
        try:
            search_body = {
                "query": {
                    "bool": {
                        "must": [
                            {"term": {"user_id": user_id}},
                            {"match_phrase_prefix": {field: query}}
                        ]
                    }
                },
                "size": size,
                "_source": [field]
            }
            
            response = self.client.search(index=index, body=search_body)
            
            suggestions = []
            for hit in response["hits"]["hits"]:
                value = hit["_source"].get(field)
                if value and value not in suggestions:
                    suggestions.append(value)
            
            return suggestions
        except Exception as e:
            logger.error(f"获取建议失败: {e}")
            return []
    
    async def aggregate_stats(
        self,
        index: str,
        user_id: int,
        novel_id: Optional[int] = None,
        agg_field: str = "status"
    ) -> Dict[str, int]:
        """
        聚合统计
        
        Args:
            index: 索引名称
            user_id: 用户ID
            novel_id: 小说ID（可选）
            agg_field: 聚合字段
        
        Returns:
            聚合结果
        """
        if not self.connected or not self.client:
            return {}
        
        must_clauses = [{"term": {"user_id": user_id}}]
        if novel_id:
            must_clauses.append({"term": {"novel_id": novel_id}})
        
        try:
            search_body = {
                "query": {
                    "bool": {"must": must_clauses}
                },
                "size": 0,
                "aggs": {
                    "stats": {
                        "terms": {
                            "field": agg_field,
                            "size": 100
                        }
                    }
                }
            }
            
            response = self.client.search(index=index, body=search_body)
            
            result = {}
            for bucket in response["aggregations"]["stats"]["buckets"]:
                result[bucket["key"]] = bucket["doc_count"]
            
            return result
        except Exception as e:
            logger.error(f"聚合统计失败: {e}")
            return {}


# 创建全局实例
es_service = ElasticsearchService()
