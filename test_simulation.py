"""
Test the fixed simulation end-to-end with 3 agents.
Run from the project root with venv activated:
    python test_simulation.py
"""
import os
import sys
import logging
from pathlib import Path

# Setup
sys.path.insert(0, str(Path(__file__).parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

from simulation.run_simulation import run_simulation

print("=" * 60)
print("  Testing Fixed Ray Simulation (3 agents, 1 day)")
print("=" * 60)
print()

result = run_simulation(
    experiment_id="test_001",
    ad_content=(
        "A family enjoying tea together at home. "
        "The ad shows traditional values and togetherness. "
        "Brand: Ceylon Gold Tea. "
        "Tagline: 'Bringing families closer, one cup at a time.'"
    ),
    num_agents=3,
    simulation_days=1,
)

print()
print("=" * 60)
print("  RESULTS")
print("=" * 60)
print(f"  Virality Score:   {result['virality_score']}")
print(f"  Total Agents:     {result['total_agents']}")
print(f"  Responding:       {result['responding_agents']}")
print(f"  Sentiment:        {result['sentiment_breakdown']}")
print(f"  Risk Flags:       {len(result['risk_flags'])}")
print(f"  Agent Logs:       {len(result['agent_logs'])}")
print()

# Print individual agent reactions
for log in result['agent_logs']:
    print(f"  [{log['agent_id']}] {log['event_type']}: {log['details'][:80]}...")

print()
print("=" * 60)
print("  TEST PASSED" if result['total_agents'] == 3 else "  TEST FAILED")
print("=" * 60)
