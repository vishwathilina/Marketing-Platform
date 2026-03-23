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
    from app.models import User
    from app.services.auth_service import hash_password

    # Import models so SQLAlchemy registers all table metadata.
    from app import models  # noqa: F401

    settings = get_settings()
    wait_for_db(settings.database_url)

    Base.metadata.create_all(bind=engine)

    # Seed a default admin account for first-run local compose environments.
    initial_admin_email = (settings.initial_admin_email or "").strip().lower()
    initial_admin_password = (settings.initial_admin_password or "").strip()
    if initial_admin_email and initial_admin_password:
        from app.database import SessionLocal

        db = SessionLocal()
        try:
            existing_user = db.query(User).filter(User.email == initial_admin_email).first()
            if not existing_user:
                db.add(
                    User(
                        email=initial_admin_email,
                        password_hash=hash_password(initial_admin_password),
                    )
                )
                db.commit()
                print(f"[db-init] Created initial admin user: {initial_admin_email}")
            else:
                print(f"[db-init] Initial admin already exists: {initial_admin_email}")
        finally:
            db.close()

    print("[db-init] Schema initialization complete.")


if __name__ == "__main__":
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    init_schema()
