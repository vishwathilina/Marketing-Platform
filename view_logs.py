"""Check the current project status and VLM context"""
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db')
conn = engine.connect()

result = conn.execute(text("""
    SELECT id, title, status, vlm_generated_context, created_at 
    FROM projects 
    ORDER BY created_at DESC 
    LIMIT 3
"""))

print("=" * 80)
print("RECENT PROJECTS")
print("=" * 80)

for row in result:
    print(f"\nID: {row[0]}")
    print(f"Title: {row[1]}")
    print(f"Status: {row[2]}")
    print(f"Created: {row[4]}")
    context = row[3] or "None"
    print(f"VLM Context: {context[:200]}..." if len(context) > 200 else f"VLM Context: {context}")
    print("-" * 40)

conn.close()
