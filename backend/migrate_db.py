import os
import sys
from sqlalchemy import create_engine, text

# Add backend dir to path to import config
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.config import get_settings

def run_migration():
    settings = get_settings()
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        print("Adding map_data column to simulation_runs...")
        try:
            conn.execute(text("ALTER TABLE simulation_runs ADD COLUMN map_data JSON;"))
            conn.commit()
            print("Added map_data column.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column map_data already exists.")
            else:
                print(f"Error adding map_data: {e}")
                conn.rollback()
                
        print("Adding agent_states column to simulation_runs...")
        try:
            conn.execute(text("ALTER TABLE simulation_runs ADD COLUMN agent_states JSON;"))
            conn.commit()
            print("Added agent_states column.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Column agent_states already exists.")
            else:
                print(f"Error adding agent_states: {e}")
                conn.rollback()

        print("Widening video_path column to TEXT (for HuggingFace URLs)...")
        try:
            conn.execute(text("ALTER TABLE projects ALTER COLUMN video_path TYPE TEXT;"))
            conn.commit()
            print("video_path column widened to TEXT.")
        except Exception as e:
            if "already" in str(e).lower() or "no change" in str(e).lower():
                print("video_path already TEXT or no change needed.")
            else:
                print(f"Error widening video_path: {e}")
                conn.rollback()

if __name__ == "__main__":
    run_migration()
    print("Migration complete.")
