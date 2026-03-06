// AI小说生成系统 Neo4j知识图谱初始化脚本
// 创建时间: 2025-12-12
// 版本: 1.0.0

// ==================== 清理现有数据（可选）====================
// MATCH (n) DETACH DELETE n;

// ==================== 创建约束和索引 ====================

// 小说节点约束
CREATE CONSTRAINT novel_id IF NOT EXISTS FOR (n:Novel) REQUIRE n.id IS UNIQUE;

// 角色节点约束
CREATE CONSTRAINT character_id IF NOT EXISTS FOR (c:Character) REQUIRE c.id IS UNIQUE;

// 事件节点约束
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;

// 地点节点约束
CREATE CONSTRAINT location_id IF NOT EXISTS FOR (l:Location) REQUIRE l.id IS UNIQUE;

// 物品节点约束
CREATE CONSTRAINT item_id IF NOT EXISTS FOR (i:Item) REQUIRE i.id IS UNIQUE;

// 组织节点约束
CREATE CONSTRAINT organization_id IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE;

// 章节节点约束
CREATE CONSTRAINT chapter_id IF NOT EXISTS FOR (ch:Chapter) REQUIRE ch.id IS UNIQUE;

// ==================== 创建索引 ====================

// 小说名称索引
CREATE INDEX novel_title IF NOT EXISTS FOR (n:Novel) ON (n.title);

// 角色名称索引
CREATE INDEX character_name IF NOT EXISTS FOR (c:Character) ON (c.name);

// 事件标题索引
CREATE INDEX event_title IF NOT EXISTS FOR (e:Event) ON (e.title);

// 地点名称索引
CREATE INDEX location_name IF NOT EXISTS FOR (l:Location) ON (l.name);

// ==================== 关系类型定义 ====================
// 以下是系统支持的关系类型说明：

// 角色关系
// (:Character)-[:PARENT_OF]->(:Character)     父母关系
// (:Character)-[:CHILD_OF]->(:Character)      子女关系
// (:Character)-[:SIBLING_OF]->(:Character)    兄弟姐妹
// (:Character)-[:SPOUSE_OF]->(:Character)     配偶关系
// (:Character)-[:LOVER_OF]->(:Character)      恋人关系
// (:Character)-[:FRIEND_OF]->(:Character)     朋友关系
// (:Character)-[:ENEMY_OF]->(:Character)      敌人关系
// (:Character)-[:MASTER_OF]->(:Character)     师徒关系（师父）
// (:Character)-[:APPRENTICE_OF]->(:Character) 师徒关系（徒弟）
// (:Character)-[:COLLEAGUE_OF]->(:Character)  同事关系
// (:Character)-[:SUBORDINATE_OF]->(:Character) 上下级关系

// 角色与组织
// (:Character)-[:MEMBER_OF]->(:Organization)  成员关系
// (:Character)-[:LEADER_OF]->(:Organization)  领导关系

// 角色与地点
// (:Character)-[:LIVES_IN]->(:Location)       居住地
// (:Character)-[:BORN_IN]->(:Location)        出生地
// (:Character)-[:VISITED]->(:Location)        访问过

// 角色与物品
// (:Character)-[:OWNS]->(:Item)               拥有
// (:Character)-[:USES]->(:Item)               使用

// 角色与事件
// (:Character)-[:PARTICIPATES_IN]->(:Event)   参与事件
// (:Character)-[:INITIATES]->(:Event)         发起事件
// (:Character)-[:AFFECTED_BY]->(:Event)       受事件影响

// 事件关系
// (:Event)-[:CAUSES]->(:Event)                因果关系
// (:Event)-[:FOLLOWS]->(:Event)               时间顺序
// (:Event)-[:OCCURS_AT]->(:Location)          发生地点
// (:Event)-[:OCCURS_IN]->(:Chapter)           发生章节

// 小说关系
// (:Novel)-[:HAS_CHARACTER]->(:Character)     包含角色
// (:Novel)-[:HAS_EVENT]->(:Event)             包含事件
// (:Novel)-[:HAS_LOCATION]->(:Location)       包含地点
// (:Novel)-[:HAS_CHAPTER]->(:Chapter)         包含章节

// ==================== 示例数据（可选）====================

// 创建示例小说节点
// CREATE (n:Novel {id: 1, title: '示例小说', genre: '玄幻', createdAt: datetime()});

// 创建示例角色
// CREATE (c1:Character {id: 1, name: '主角', gender: 'male', role: '主角'});
// CREATE (c2:Character {id: 2, name: '配角', gender: 'female', role: '女主'});

// 创建角色关系
// MATCH (c1:Character {id: 1}), (c2:Character {id: 2})
// CREATE (c1)-[:LOVER_OF {since: '第10章'}]->(c2);

// ==================== 查询示例 ====================

// 查询角色的所有关系
// MATCH (c:Character {name: '主角'})-[r]-(related)
// RETURN c, type(r) as relationship, related;

// 查询小说的知识图谱
// MATCH (n:Novel {id: 1})-[*1..2]-(connected)
// RETURN n, connected;

// 查询角色关系网络
// MATCH path = (c1:Character)-[*1..3]-(c2:Character)
// WHERE c1.novelId = 1 AND c2.novelId = 1
// RETURN path;

// ==================== 初始化完成 ====================
RETURN '知识图谱初始化完成' AS message;
