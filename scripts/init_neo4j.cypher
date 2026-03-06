// ============================================
// 幻写次元 - AI小说生成系统
// Neo4j知识图谱初始化脚本
// ============================================

// ============================================
// 清理旧数据（可选，生产环境慎用）
// ============================================
// MATCH (n) DETACH DELETE n;

// ============================================
// 创建约束和索引
// ============================================

// 用户节点约束
CREATE CONSTRAINT user_id_unique IF NOT EXISTS
FOR (u:User) REQUIRE u.userId IS UNIQUE;

// 小说节点约束
CREATE CONSTRAINT novel_id_unique IF NOT EXISTS
FOR (n:Novel) REQUIRE n.novelId IS UNIQUE;

// 人物节点约束
CREATE CONSTRAINT character_id_unique IF NOT EXISTS
FOR (c:Character) REQUIRE c.characterId IS UNIQUE;

// 地点节点约束
CREATE CONSTRAINT location_id_unique IF NOT EXISTS
FOR (l:Location) REQUIRE l.locationId IS UNIQUE;

// 事件节点约束
CREATE CONSTRAINT event_id_unique IF NOT EXISTS
FOR (e:Event) REQUIRE e.eventId IS UNIQUE;

// 物品节点约束
CREATE CONSTRAINT item_id_unique IF NOT EXISTS
FOR (i:Item) REQUIRE i.itemId IS UNIQUE;

// 组织节点约束
CREATE CONSTRAINT organization_id_unique IF NOT EXISTS
FOR (o:Organization) REQUIRE o.organizationId IS UNIQUE;

// 章节节点约束
CREATE CONSTRAINT chapter_id_unique IF NOT EXISTS
FOR (ch:Chapter) REQUIRE ch.chapterId IS UNIQUE;

// ============================================
// 创建索引以提高查询性能
// ============================================

// 用户索引
CREATE INDEX user_name_index IF NOT EXISTS
FOR (u:User) ON (u.name);

// 小说索引
CREATE INDEX novel_title_index IF NOT EXISTS
FOR (n:Novel) ON (n.title);

CREATE INDEX novel_user_index IF NOT EXISTS
FOR (n:Novel) ON (n.userId);

// 人物索引
CREATE INDEX character_name_index IF NOT EXISTS
FOR (c:Character) ON (c.name);

CREATE INDEX character_novel_index IF NOT EXISTS
FOR (c:Character) ON (c.novelId);

// 地点索引
CREATE INDEX location_name_index IF NOT EXISTS
FOR (l:Location) ON (l.name);

// 事件索引
CREATE INDEX event_name_index IF NOT EXISTS
FOR (e:Event) ON (e.name);

CREATE INDEX event_time_index IF NOT EXISTS
FOR (e:Event) ON (e.timePoint);

// ============================================
// 节点标签说明
// ============================================
// :User - 用户节点
// :Novel - 小说项目节点
// :Character - 人物节点
// :Location - 地点/场景节点
// :Event - 事件节点
// :Item - 物品/道具节点
// :Organization - 组织/势力节点
// :Chapter - 章节节点
// :WorldSetting - 世界观设定节点
// :Timeline - 时间线节点

// ============================================
// 关系类型说明
// ============================================
// (:User)-[:OWNS]->(:Novel) - 用户拥有小说
// (:Novel)-[:HAS_CHARACTER]->(:Character) - 小说包含人物
// (:Novel)-[:HAS_LOCATION]->(:Location) - 小说包含地点
// (:Novel)-[:HAS_EVENT]->(:Event) - 小说包含事件
// (:Novel)-[:HAS_CHAPTER]->(:Chapter) - 小说包含章节
// (:Character)-[:KNOWS]->(:Character) - 人物认识人物
// (:Character)-[:LOVES]->(:Character) - 人物爱慕人物
// (:Character)-[:HATES]->(:Character) - 人物仇恨人物
// (:Character)-[:FAMILY_OF]->(:Character) - 人物是人物的家人
// (:Character)-[:FRIEND_OF]->(:Character) - 人物是人物的朋友
// (:Character)-[:ENEMY_OF]->(:Character) - 人物是人物的敌人
// (:Character)-[:BELONGS_TO]->(:Organization) - 人物属于组织
// (:Character)-[:OWNS]->(:Item) - 人物拥有物品
// (:Character)-[:LOCATED_AT]->(:Location) - 人物位于地点
// (:Character)-[:PARTICIPATES_IN]->(:Event) - 人物参与事件
// (:Event)-[:HAPPENS_AT]->(:Location) - 事件发生在地点
// (:Event)-[:FOLLOWS]->(:Event) - 事件跟随事件（时间线）
// (:Event)-[:CAUSES]->(:Event) - 事件导致事件
// (:Chapter)-[:CONTAINS_EVENT]->(:Event) - 章节包含事件
// (:Chapter)-[:FEATURES]->(:Character) - 章节涉及人物

// ============================================
// 示例：创建测试数据
// ============================================

// 创建示例用户
MERGE (u:User {userId: 1})
SET u.name = '测试用户',
    u.createdAt = datetime();

// 创建示例小说
MERGE (n:Novel {novelId: 1})
SET n.title = '示例小说',
    n.userId = 1,
    n.genre = '玄幻',
    n.createdAt = datetime();

// 建立用户与小说的关系
MATCH (u:User {userId: 1}), (n:Novel {novelId: 1})
MERGE (u)-[:OWNS]->(n);

// 创建示例人物
MERGE (c1:Character {characterId: 1})
SET c1.name = '主角',
    c1.novelId = 1,
    c1.role = '主角',
    c1.personality = '正义、勇敢',
    c1.createdAt = datetime();

MERGE (c2:Character {characterId: 2})
SET c2.name = '女主',
    c2.novelId = 1,
    c2.role = '女主角',
    c2.personality = '温柔、聪慧',
    c2.createdAt = datetime();

MERGE (c3:Character {characterId: 3})
SET c3.name = '反派',
    c3.novelId = 1,
    c3.role = '反派',
    c3.personality = '阴险、狡诈',
    c3.createdAt = datetime();

// 建立小说与人物的关系
MATCH (n:Novel {novelId: 1}), (c:Character)
WHERE c.novelId = 1
MERGE (n)-[:HAS_CHARACTER]->(c);

// 建立人物之间的关系
MATCH (c1:Character {characterId: 1}), (c2:Character {characterId: 2})
MERGE (c1)-[:LOVES {since: '第一章'}]->(c2)
MERGE (c2)-[:LOVES {since: '第三章'}]->(c1);

MATCH (c1:Character {characterId: 1}), (c3:Character {characterId: 3})
MERGE (c1)-[:ENEMY_OF {reason: '杀父之仇'}]->(c3)
MERGE (c3)-[:ENEMY_OF {reason: '阻碍计划'}]->(c1);

// 创建示例地点
MERGE (l1:Location {locationId: 1})
SET l1.name = '青云宗',
    l1.novelId = 1,
    l1.description = '主角所在的修仙门派',
    l1.type = '门派';

MERGE (l2:Location {locationId: 2})
SET l2.name = '魔域',
    l2.novelId = 1,
    l2.description = '反派势力的大本营',
    l2.type = '禁地';

// 建立小说与地点的关系
MATCH (n:Novel {novelId: 1}), (l:Location)
WHERE l.novelId = 1
MERGE (n)-[:HAS_LOCATION]->(l);

// 创建示例事件
MERGE (e1:Event {eventId: 1})
SET e1.name = '主角入门',
    e1.novelId = 1,
    e1.description = '主角加入青云宗',
    e1.timePoint = 1,
    e1.chapterNumber = 1;

MERGE (e2:Event {eventId: 2})
SET e2.name = '初遇女主',
    e2.novelId = 1,
    e2.description = '主角在门派中遇到女主',
    e2.timePoint = 2,
    e2.chapterNumber = 3;

MERGE (e3:Event {eventId: 3})
SET e3.name = '大战反派',
    e3.novelId = 1,
    e3.description = '主角与反派的第一次正面冲突',
    e3.timePoint = 3,
    e3.chapterNumber = 10;

// 建立事件时间线
MATCH (e1:Event {eventId: 1}), (e2:Event {eventId: 2})
MERGE (e1)-[:FOLLOWS]->(e2);

MATCH (e2:Event {eventId: 2}), (e3:Event {eventId: 3})
MERGE (e2)-[:FOLLOWS]->(e3);

// 建立人物与事件的关系
MATCH (c1:Character {characterId: 1}), (e1:Event {eventId: 1})
MERGE (c1)-[:PARTICIPATES_IN]->(e1);

MATCH (c1:Character {characterId: 1}), (c2:Character {characterId: 2}), (e2:Event {eventId: 2})
MERGE (c1)-[:PARTICIPATES_IN]->(e2)
MERGE (c2)-[:PARTICIPATES_IN]->(e2);

MATCH (c1:Character {characterId: 1}), (c3:Character {characterId: 3}), (e3:Event {eventId: 3})
MERGE (c1)-[:PARTICIPATES_IN]->(e3)
MERGE (c3)-[:PARTICIPATES_IN]->(e3);

// 建立事件与地点的关系
MATCH (e1:Event {eventId: 1}), (l1:Location {locationId: 1})
MERGE (e1)-[:HAPPENS_AT]->(l1);

MATCH (e2:Event {eventId: 2}), (l1:Location {locationId: 1})
MERGE (e2)-[:HAPPENS_AT]->(l1);

MATCH (e3:Event {eventId: 3}), (l2:Location {locationId: 2})
MERGE (e3)-[:HAPPENS_AT]->(l2);

// ============================================
// 常用查询示例
// ============================================

// 查询某小说的所有人物关系
// MATCH (n:Novel {novelId: 1})-[:HAS_CHARACTER]->(c1:Character)
// OPTIONAL MATCH (c1)-[r]->(c2:Character)
// RETURN c1, r, c2;

// 查询某人物的所有关系
// MATCH (c:Character {characterId: 1})-[r]-(other)
// RETURN c, r, other;

// 查询事件时间线
// MATCH path = (e1:Event)-[:FOLLOWS*]->(e2:Event)
// WHERE e1.novelId = 1
// RETURN path;

// 查询人物参与的所有事件
// MATCH (c:Character {characterId: 1})-[:PARTICIPATES_IN]->(e:Event)
// RETURN c.name, e.name, e.timePoint
// ORDER BY e.timePoint;

// ============================================
// 完成提示
// ============================================
RETURN '知识图谱初始化完成！' AS message;
