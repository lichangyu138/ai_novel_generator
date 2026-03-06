"""
Neo4j Knowledge Graph Database Connection and Operations
Data isolation: Each user's graph data is isolated using user_id property
"""
from neo4j import GraphDatabase, Driver
from typing import List, Dict, Any, Optional
import logging

from app.config.settings import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class Neo4jClient:
    """Neo4j client with user/project data isolation"""
    
    def __init__(self):
        self._driver: Optional[Driver] = None
    
    def connect(self):
        """Connect to Neo4j server"""
        if self._driver:
            return
        
        try:
            self._driver = GraphDatabase.driver(
                settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
            )
            # Verify connection
            self._driver.verify_connectivity()
            logger.info("Connected to Neo4j successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Neo4j: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from Neo4j"""
        if self._driver:
            self._driver.close()
            self._driver = None
    
    @property
    def driver(self) -> Driver:
        """Get driver instance"""
        if not self._driver:
            self.connect()
        return self._driver
    
    def init_constraints(self):
        """Initialize database constraints and indexes"""
        with self.driver.session() as session:
            # Create constraints for Character nodes
            session.run("""
                CREATE CONSTRAINT character_unique IF NOT EXISTS
                FOR (c:Character) REQUIRE (c.user_id, c.novel_id, c.character_id) IS UNIQUE
            """)
            
            # Create index for faster lookups
            session.run("""
                CREATE INDEX character_user_novel IF NOT EXISTS
                FOR (c:Character) ON (c.user_id, c.novel_id)
            """)
            
            # Create constraints for WorldElement nodes
            session.run("""
                CREATE CONSTRAINT world_element_unique IF NOT EXISTS
                FOR (w:WorldElement) REQUIRE (w.user_id, w.novel_id, w.element_id) IS UNIQUE
            """)
            
            # Create constraints for Timeline nodes
            session.run("""
                CREATE CONSTRAINT timeline_unique IF NOT EXISTS
                FOR (t:Timeline) REQUIRE (t.user_id, t.novel_id, t.event_id) IS UNIQUE
            """)
            
            logger.info("Neo4j constraints and indexes initialized")
    
    # Character Operations
    def create_character(
        self,
        user_id: int,
        novel_id: int,
        character_id: int,
        name: str,
        properties: Dict[str, Any]
    ):
        """Create a character node"""
        with self.driver.session() as session:
            session.run("""
                MERGE (c:Character {user_id: $user_id, novel_id: $novel_id, character_id: $character_id})
                SET c.name = $name,
                    c.role = $role,
                    c.gender = $gender,
                    c.age = $age,
                    c.personality = $personality,
                    c.background = $background,
                    c.abilities = $abilities,
                    c.updated_at = datetime()
            """, 
                user_id=user_id,
                novel_id=novel_id,
                character_id=character_id,
                name=name,
                role=properties.get("role", ""),
                gender=properties.get("gender", ""),
                age=properties.get("age", ""),
                personality=properties.get("personality", ""),
                background=properties.get("background", ""),
                abilities=properties.get("abilities", "")
            )
    
    def create_character_relationship(
        self,
        user_id: int,
        novel_id: int,
        from_character_id: int,
        to_character_id: int,
        relation_type: str,
        description: str = ""
    ):
        """Create a relationship between two characters"""
        with self.driver.session() as session:
            session.run("""
                MATCH (c1:Character {user_id: $user_id, novel_id: $novel_id, character_id: $from_id})
                MATCH (c2:Character {user_id: $user_id, novel_id: $novel_id, character_id: $to_id})
                MERGE (c1)-[r:RELATES_TO {type: $relation_type}]->(c2)
                SET r.description = $description,
                    r.updated_at = datetime()
            """,
                user_id=user_id,
                novel_id=novel_id,
                from_id=from_character_id,
                to_id=to_character_id,
                relation_type=relation_type,
                description=description
            )
    
    def get_character_graph(
        self,
        user_id: int,
        novel_id: int
    ) -> Dict[str, Any]:
        """Get character relationship graph for a novel"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (c:Character {user_id: $user_id, novel_id: $novel_id})
                OPTIONAL MATCH (c)-[r:RELATES_TO]->(c2:Character {user_id: $user_id, novel_id: $novel_id})
                RETURN c, collect({relationship: r, target: c2}) as relationships
            """,
                user_id=user_id,
                novel_id=novel_id
            )
            
            nodes = []
            edges = []
            seen_nodes = set()
            
            for record in result:
                char = record["c"]
                char_id = char["character_id"]
                
                if char_id not in seen_nodes:
                    nodes.append({
                        "id": char_id,
                        "name": char["name"],
                        "role": char.get("role", ""),
                        "properties": dict(char)
                    })
                    seen_nodes.add(char_id)
                
                for rel_data in record["relationships"]:
                    if rel_data["relationship"] and rel_data["target"]:
                        edges.append({
                            "source": char_id,
                            "target": rel_data["target"]["character_id"],
                            "type": rel_data["relationship"]["type"],
                            "description": rel_data["relationship"].get("description", "")
                        })
            
            return {"nodes": nodes, "edges": edges}
    
    # World Element Operations
    def create_world_element(
        self,
        user_id: int,
        novel_id: int,
        element_id: int,
        element_type: str,  # location, organization, item, concept
        name: str,
        properties: Dict[str, Any]
    ):
        """Create a world element node"""
        with self.driver.session() as session:
            session.run("""
                MERGE (w:WorldElement {user_id: $user_id, novel_id: $novel_id, element_id: $element_id})
                SET w.name = $name,
                    w.element_type = $element_type,
                    w.description = $description,
                    w.properties = $properties,
                    w.updated_at = datetime()
            """,
                user_id=user_id,
                novel_id=novel_id,
                element_id=element_id,
                name=name,
                element_type=element_type,
                description=properties.get("description", ""),
                properties=str(properties)
            )
    
    def get_world_graph(
        self,
        user_id: int,
        novel_id: int
    ) -> Dict[str, Any]:
        """Get world structure graph for a novel"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (w:WorldElement {user_id: $user_id, novel_id: $novel_id})
                OPTIONAL MATCH (w)-[r]->(w2:WorldElement {user_id: $user_id, novel_id: $novel_id})
                RETURN w, collect({relationship: type(r), target: w2}) as connections
            """,
                user_id=user_id,
                novel_id=novel_id
            )
            
            nodes = []
            edges = []
            seen_nodes = set()
            
            for record in result:
                elem = record["w"]
                elem_id = elem["element_id"]
                
                if elem_id not in seen_nodes:
                    nodes.append({
                        "id": elem_id,
                        "name": elem["name"],
                        "type": elem.get("element_type", ""),
                        "description": elem.get("description", "")
                    })
                    seen_nodes.add(elem_id)
                
                for conn in record["connections"]:
                    if conn["target"]:
                        edges.append({
                            "source": elem_id,
                            "target": conn["target"]["element_id"],
                            "type": conn["relationship"]
                        })
            
            return {"nodes": nodes, "edges": edges}
    
    # Timeline Operations
    def create_timeline_event(
        self,
        user_id: int,
        novel_id: int,
        event_id: int,
        event_name: str,
        time_point: str,
        description: str,
        chapter_id: Optional[int] = None
    ):
        """Create a timeline event node"""
        with self.driver.session() as session:
            session.run("""
                MERGE (t:Timeline {user_id: $user_id, novel_id: $novel_id, event_id: $event_id})
                SET t.name = $event_name,
                    t.time_point = $time_point,
                    t.description = $description,
                    t.chapter_id = $chapter_id,
                    t.updated_at = datetime()
            """,
                user_id=user_id,
                novel_id=novel_id,
                event_id=event_id,
                event_name=event_name,
                time_point=time_point,
                description=description,
                chapter_id=chapter_id
            )
    
    def get_timeline(
        self,
        user_id: int,
        novel_id: int
    ) -> List[Dict[str, Any]]:
        """Get timeline events for a novel"""
        with self.driver.session() as session:
            result = session.run("""
                MATCH (t:Timeline {user_id: $user_id, novel_id: $novel_id})
                RETURN t
                ORDER BY t.time_point
            """,
                user_id=user_id,
                novel_id=novel_id
            )
            
            events = []
            for record in result:
                event = record["t"]
                events.append({
                    "id": event["event_id"],
                    "name": event["name"],
                    "time_point": event["time_point"],
                    "description": event.get("description", ""),
                    "chapter_id": event.get("chapter_id")
                })
            
            return events
    
    # Cleanup Operations
    def delete_novel_data(self, user_id: int, novel_id: int):
        """Delete all graph data for a specific novel"""
        with self.driver.session() as session:
            session.run("""
                MATCH (n {user_id: $user_id, novel_id: $novel_id})
                DETACH DELETE n
            """,
                user_id=user_id,
                novel_id=novel_id
            )
    
    def delete_user_data(self, user_id: int):
        """Delete all graph data for a specific user"""
        with self.driver.session() as session:
            session.run("""
                MATCH (n {user_id: $user_id})
                DETACH DELETE n
            """,
                user_id=user_id
            )


# Global Neo4j client instance
neo4j_client = Neo4jClient()


def get_neo4j_client() -> Neo4jClient:
    """Get Neo4j client instance"""
    return neo4j_client
