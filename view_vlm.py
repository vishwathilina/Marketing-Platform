"""Save VLM content to a file"""
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db')
conn = engine.connect()

result = conn.execute(text("""
    SELECT title, vlm_generated_context, status, video_duration_seconds
    FROM projects 
    WHERE id = '7af86f8e-fd5a-4cc8-a134-333f0f45f2f5'
"""))

row = result.fetchone()
if row:
    output = f"""PROJECT: {row[0]}
STATUS: {row[2]}
DURATION: {row[3]} seconds
{'=' * 70}

VLM GENERATED CONTENT:
{'-' * 70}
{row[1]}

[Total: {len(row[1])} characters]
"""
    with open("vlm_output.txt", "w", encoding="utf-8") as f:
        f.write(output)
    print("Saved to vlm_output.txt")
else:
    print("Project not found")

conn.close()
