"""Debug agent logs with full event data"""
from sqlalchemy import create_engine, text
import json

engine = create_engine('postgresql://agentsociety:dev_password@localhost:5432/agentsociety_db')
conn = engine.connect()

# Get latest simulation
result = conn.execute(text("""
    SELECT id, status, engagement_score 
    FROM simulation_runs 
    ORDER BY created_at DESC 
    LIMIT 1
"""))

sim = result.fetchone()
print(f"Simulation: {sim[0]}")
print(f"Engagement: {sim[2]}")
print("=" * 60)

# Get agent logs with full data
logs = conn.execute(text("""
    SELECT agent_id, event_type, event_data
    FROM agent_logs 
    WHERE simulation_run_id = :sim_id
    LIMIT 10
"""), {"sim_id": sim[0]})

for i, log in enumerate(logs):
    print(f"\n[{i+1}] Agent: {log[0]}, Type: {log[1]}")
    if log[2]:
        print(f"    Data: {json.dumps(log[2], indent=2)}")
    else:
        print(f"    Data: EMPTY")

# Check for any ERROR events
print("\n" + "=" * 60)
print("Checking for ERROR events:")
errors = conn.execute(text("""
    SELECT agent_id, event_data
    FROM agent_logs 
    WHERE simulation_run_id = :sim_id AND event_type = 'ERROR'
"""), {"sim_id": sim[0]})

error_count = 0
for err in errors:
    error_count += 1
    print(f"  Agent {err[0]}: {err[1]}")

if error_count == 0:
    print("  No ERROR events found")

conn.close()
