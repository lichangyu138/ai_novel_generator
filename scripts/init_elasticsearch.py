#!/usr/bin/env python3
"""
Elasticsearch 初始化脚本
用于创建索引、配置中文分词器、设置索引模板等

使用方法:
    python init_elasticsearch.py [--host HOST] [--port PORT] [--user USER] [--password PASSWORD]

依赖:
    pip install elasticsearch

注意:
    - 需要安装 IK 中文分词插件: elasticsearch-plugin install analysis-ik
    - 或使用 Docker: docker pull elasticsearch:8.x (已包含IK插件的镜像)
"""

import argparse
import json
import sys
from elasticsearch import Elasticsearch


def get_chinese_analyzer_settings():
    """获取中文分析器设置"""
    return {
        "analysis": {
            "analyzer": {
                # IK 最大词元分词器 - 用于索引时
                "ik_max_word": {
                    "type": "custom",
                    "tokenizer": "ik_max_word",
                    "filter": ["lowercase", "synonym_filter"]
                },
                # IK 智能分词器 - 用于搜索时
                "ik_smart": {
                    "type": "custom",
                    "tokenizer": "ik_smart",
                    "filter": ["lowercase"]
                },
                # 拼音分词器（需要安装 pinyin 插件）
                "pinyin_analyzer": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "pinyin_filter"]
                }
            },
            "filter": {
                # 同义词过滤器
                "synonym_filter": {
                    "type": "synonym",
                    "synonyms": [
                        "主角,男主,女主,主人公",
                        "反派,大boss,最终boss",
                        "修炼,修行,修真,修仙",
                        "武功,武技,功法,秘籍",
                        "灵气,真气,内力,法力",
                        "境界,等级,修为,实力"
                    ]
                },
                # 拼音过滤器
                "pinyin_filter": {
                    "type": "pinyin",
                    "keep_first_letter": True,
                    "keep_separate_first_letter": False,
                    "keep_full_pinyin": True,
                    "keep_original": True,
                    "limit_first_letter_length": 16,
                    "lowercase": True
                }
            }
        }
    }


def get_index_templates():
    """获取所有索引模板定义"""
    
    # 通用设置
    common_settings = {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "refresh_interval": "1s",
        **get_chinese_analyzer_settings()
    }
    
    return {
        # 小说索引
        "novels": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "fields": {
                            "keyword": {"type": "keyword"},
                            "pinyin": {"type": "text", "analyzer": "pinyin_analyzer"}
                        }
                    },
                    "genre": {"type": "keyword"},
                    "style": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "prompt": {"type": "text", "analyzer": "ik_max_word"},
                    "world_setting": {"type": "text", "analyzer": "ik_max_word"},
                    "target_word_count": {"type": "integer"},
                    "current_word_count": {"type": "integer"},
                    "chapter_count": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        },
        
        # 章节索引
        "chapters": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "chapter_number": {"type": "integer"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "content": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "search_analyzer": "ik_smart",
                        "term_vector": "with_positions_offsets"  # 支持高亮
                    },
                    "summary": {"type": "text", "analyzer": "ik_max_word"},
                    "word_count": {"type": "integer"},
                    "status": {"type": "keyword"},
                    "emotional_tone": {"type": "keyword"},
                    "involved_characters": {"type": "integer"},
                    "key_events": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"}
                }
            }
        },
        
        # 人物索引
        "characters": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {
                            "keyword": {"type": "keyword"},
                            "pinyin": {"type": "text", "analyzer": "pinyin_analyzer"}
                        }
                    },
                    "aliases": {"type": "text", "analyzer": "ik_max_word"},
                    "role": {"type": "keyword"},
                    "gender": {"type": "keyword"},
                    "age": {"type": "keyword"},
                    "personality": {"type": "text", "analyzer": "ik_max_word"},
                    "background": {"type": "text", "analyzer": "ik_max_word"},
                    "appearance": {"type": "text", "analyzer": "ik_max_word"},
                    "abilities": {"type": "text", "analyzer": "ik_max_word"},
                    "weaknesses": {"type": "text", "analyzer": "ik_max_word"},
                    "goals": {"type": "text", "analyzer": "ik_max_word"},
                    "speech_style": {"type": "text", "analyzer": "ik_max_word"},
                    "is_active": {"type": "boolean"},
                    "first_appearance": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 事件索引
        "events": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "event_type": {"type": "keyword"},
                    "chapter_number": {"type": "integer"},
                    "timeline_position": {"type": "integer"},
                    "participants": {"type": "integer"},
                    "location": {"type": "text", "analyzer": "ik_max_word"},
                    "consequences": {"type": "text", "analyzer": "ik_max_word"},
                    "status": {"type": "keyword"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 地点索引
        "locations": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "location_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "parent_location_id": {"type": "integer"},
                    "atmosphere": {"type": "text", "analyzer": "ik_max_word"},
                    "notable_features": {"type": "text", "analyzer": "ik_max_word"},
                    "first_appearance": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 物品索引
        "items": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "item_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "abilities": {"type": "text", "analyzer": "ik_max_word"},
                    "rarity": {"type": "keyword"},
                    "current_owner_id": {"type": "integer"},
                    "origin": {"type": "text", "analyzer": "ik_max_word"},
                    "first_appearance": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 组织索引
        "organizations": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "org_type": {"type": "keyword"},
                    "description": {"type": "text", "analyzer": "ik_max_word"},
                    "hierarchy": {"type": "text", "analyzer": "ik_max_word"},
                    "goals": {"type": "text", "analyzer": "ik_max_word"},
                    "leader_id": {"type": "integer"},
                    "headquarters": {"type": "text", "analyzer": "ik_max_word"},
                    "founding_story": {"type": "text", "analyzer": "ik_max_word"},
                    "first_appearance": {"type": "integer"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 伏笔索引
        "foreshadowing": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "title": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "content": {"type": "text", "analyzer": "ik_max_word"},
                    "planted_chapter": {"type": "integer"},
                    "target_chapter": {"type": "integer"},
                    "actual_resolved_chapter": {"type": "integer"},
                    "related_characters": {"type": "integer"},
                    "related_events": {"type": "integer"},
                    "importance": {"type": "keyword"},
                    "status": {"type": "keyword"},
                    "resolution_notes": {"type": "text", "analyzer": "ik_max_word"},
                    "created_at": {"type": "date"}
                }
            }
        },
        
        # 时间线索引
        "timeline": {
            "settings": common_settings,
            "mappings": {
                "properties": {
                    "id": {"type": "integer"},
                    "novel_id": {"type": "integer"},
                    "user_id": {"type": "integer"},
                    "event_name": {
                        "type": "text",
                        "analyzer": "ik_max_word",
                        "fields": {"keyword": {"type": "keyword"}}
                    },
                    "event_description": {"type": "text", "analyzer": "ik_max_word"},
                    "timeline_date": {"type": "keyword"},
                    "timeline_order": {"type": "integer"},
                    "chapter_number": {"type": "integer"},
                    "event_id": {"type": "integer"},
                    "is_flashback": {"type": "boolean"},
                    "created_at": {"type": "date"}
                }
            }
        }
    }


def create_indices(es: Elasticsearch, force: bool = False):
    """创建所有索引"""
    templates = get_index_templates()
    
    for index_name, index_config in templates.items():
        try:
            # 检查索引是否存在
            if es.indices.exists(index=index_name):
                if force:
                    print(f"删除已存在的索引: {index_name}")
                    es.indices.delete(index=index_name)
                else:
                    print(f"索引已存在，跳过: {index_name}")
                    continue
            
            # 创建索引
            es.indices.create(index=index_name, body=index_config)
            print(f"✓ 创建索引成功: {index_name}")
            
        except Exception as e:
            print(f"✗ 创建索引失败 {index_name}: {e}")


def check_plugins(es: Elasticsearch):
    """检查必要的插件是否安装"""
    try:
        plugins = es.cat.plugins(format="json")
        plugin_names = [p.get("component", "") for p in plugins]
        
        print("\n已安装的插件:")
        for name in plugin_names:
            print(f"  - {name}")
        
        # 检查IK分词器
        if not any("ik" in name.lower() for name in plugin_names):
            print("\n⚠ 警告: 未检测到IK中文分词插件")
            print("  请安装: elasticsearch-plugin install analysis-ik")
            print("  或使用包含IK插件的Docker镜像")
        
        # 检查拼音插件
        if not any("pinyin" in name.lower() for name in plugin_names):
            print("\n⚠ 提示: 未检测到拼音插件（可选）")
            print("  如需拼音搜索功能，请安装: elasticsearch-plugin install analysis-pinyin")
        
        return True
    except Exception as e:
        print(f"检查插件失败: {e}")
        return False


def test_search(es: Elasticsearch):
    """测试搜索功能"""
    print("\n测试搜索功能...")
    
    # 插入测试数据
    test_doc = {
        "id": 9999,
        "user_id": 1,
        "novel_id": 1,
        "name": "测试人物",
        "personality": "聪明、勇敢、善良",
        "background": "出生于修真世家，自幼天赋异禀",
        "created_at": "2024-01-01T00:00:00Z"
    }
    
    try:
        # 索引测试文档
        es.index(index="characters", id="9999", body=test_doc, refresh=True)
        
        # 测试搜索
        result = es.search(
            index="characters",
            body={
                "query": {
                    "multi_match": {
                        "query": "修真",
                        "fields": ["name", "personality", "background"]
                    }
                }
            }
        )
        
        if result["hits"]["total"]["value"] > 0:
            print("✓ 搜索测试成功")
        else:
            print("✗ 搜索测试失败：未找到结果")
        
        # 清理测试数据
        es.delete(index="characters", id="9999")
        
    except Exception as e:
        print(f"✗ 搜索测试失败: {e}")


def main():
    parser = argparse.ArgumentParser(description="Elasticsearch 初始化脚本")
    parser.add_argument("--host", default="localhost", help="Elasticsearch 主机地址")
    parser.add_argument("--port", type=int, default=9200, help="Elasticsearch 端口")
    parser.add_argument("--user", default=None, help="用户名")
    parser.add_argument("--password", default=None, help="密码")
    parser.add_argument("--force", action="store_true", help="强制重建索引（删除已存在的索引）")
    parser.add_argument("--test", action="store_true", help="运行搜索测试")
    args = parser.parse_args()
    
    # 连接Elasticsearch
    es_url = f"http://{args.host}:{args.port}"
    print(f"连接到 Elasticsearch: {es_url}")
    
    try:
        if args.user and args.password:
            es = Elasticsearch(es_url, basic_auth=(args.user, args.password))
        else:
            es = Elasticsearch(es_url)
        
        # 检查连接
        if not es.ping():
            print("✗ 无法连接到 Elasticsearch")
            sys.exit(1)
        
        print("✓ 连接成功")
        
        # 获取集群信息
        info = es.info()
        print(f"  版本: {info['version']['number']}")
        print(f"  集群: {info['cluster_name']}")
        
        # 检查插件
        check_plugins(es)
        
        # 创建索引
        print("\n创建索引...")
        create_indices(es, force=args.force)
        
        # 运行测试
        if args.test:
            test_search(es)
        
        print("\n初始化完成!")
        
    except Exception as e:
        print(f"✗ 错误: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
