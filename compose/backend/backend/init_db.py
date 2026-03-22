"""
Initialize database schema for container startup.

Creates all SQLAlchemy model tables if they do not exist.
Safe to run multiple times.
"""

import os
import time

from sqlalchemy import create_engine, text


def wait_for_db(database_url: str, retries: int = 30, delay: int = 2) -> None:
    """Wait until PostgreSQL accepts connections."""
    engine = create_engine(database_url, pool_pre_ping=True)

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print(f"[db-init] Database is reachable (attempt {attempt}/{retries}).")
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            print(f"[db-init] Waiting for database ({attempt}/{retries}): {exc}")
            time.sleep(delay)

    raise RuntimeError(f"Database is not reachable after {retries} attempts: {last_error}")


def init_schema() -> None:
    from app.config import get_settings
    from app.database import Base, engine

    # Import models so SQLAlchemy registers all table metadata.
    from app import models  # noqa: F401

    settings = get_settings()
    wait_for_db(settings.database_url)

    Base.metadata.create_all(bind=engine)
    print("[db-init] Schema initialization complete.")


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    init_schema()
