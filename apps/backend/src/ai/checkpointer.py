# Implements: FR-03, FR-16
# Safety:    S10
# Owner:     ai (zhsraD)

# pyrefly: ignore [missing-import]
from src.config import settings

try:
    from langgraph.checkpoint.postgres import PostgresSaver

    # Convert asyncpg/sqlalchemy URL to psycopg connection string
    db_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    checkpointer = PostgresSaver.from_conn_string(db_url)
except Exception:
    from langgraph.checkpoint.memory import MemorySaver

    checkpointer = MemorySaver()

__all__ = ["checkpointer"]
