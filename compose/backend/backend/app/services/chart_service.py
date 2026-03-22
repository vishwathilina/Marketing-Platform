import os
from collections import Counter

import matplotlib.pyplot as plt


def generate_reaction_chart(boycott_count, endorse_count, simulation_id):
    labels = ['Boycott', 'Endorsement']
    values = [boycott_count, endorse_count]

    plt.figure()
    if sum(values) == 0:
        plt.pie([1], labels=['No Data'], colors=['#e5e7eb'])
    else:
        plt.pie(values, labels=labels, autopct='%1.1f%%')
    plt.title('Agent Reaction Distribution')

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/chart_{simulation_id}.png'

    plt.savefig(file_path)
    plt.close()

    return file_path


def generate_sentiment_chart(sentiment_breakdown, simulation_id):
    labels = ['Positive', 'Neutral', 'Negative']
    values = [
        sentiment_breakdown.get('positive', 0),
        sentiment_breakdown.get('neutral', 0),
        sentiment_breakdown.get('negative', 0),
    ]
    colors = ['#10b981', '#eab308', '#ef4444']

    plt.figure(figsize=(8, 4.8))
    bars = plt.bar(labels, values, color=colors)
    plt.title('Sentiment Distribution')
    plt.ylabel('Agent Count')
    for bar, value in zip(bars, values):
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.5,
            str(value),
            ha='center',
            va='bottom',
            fontsize=9,
        )
    plt.tight_layout()

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/sentiment_chart_{simulation_id}.png'
    plt.savefig(file_path)
    plt.close()
    return file_path


def generate_behavior_chart(agent_logs, simulation_id):
    behavior_counts = Counter(log.event_type for log in agent_logs)

    labels = list(behavior_counts.keys())
    values = list(behavior_counts.values())

    if not labels:
        labels = ['NO_EVENTS']
        values = [0]

    plt.figure(figsize=(9, 4.8))
    plt.bar(labels, values, color='#2563eb')
    plt.title('Agent Behavior Events')
    plt.ylabel('Occurrences')
    plt.xticks(rotation=30, ha='right')
    plt.tight_layout()

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/behavior_chart_{simulation_id}.png'
    plt.savefig(file_path)
    plt.close()

    return file_path, behavior_counts


def generate_risk_chart(risk_flags, simulation_id):
    severity_levels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    severity_counts = Counter((flag.severity or 'LOW').upper() for flag in risk_flags)
    values = [severity_counts.get(level, 0) for level in severity_levels]
    colors = ['#7f1d1d', '#b91c1c', '#f59e0b', '#65a30d']

    plt.figure(figsize=(8, 4.8))
    bars = plt.bar(severity_levels, values, color=colors)
    plt.title('Risk Severity Profile')
    plt.ylabel('Flags Count')
    for bar, value in zip(bars, values):
        plt.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.2,
            str(value),
            ha='center',
            va='bottom',
            fontsize=9,
        )
    plt.tight_layout()

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/risk_chart_{simulation_id}.png'
    plt.savefig(file_path)
    plt.close()

    return file_path, severity_counts


def generate_sri_lanka_regional_map(map_data, simulation_id):
    # Approximate Sri Lanka island outline (lat, lon points)
    sri_lanka_outline = [
        (9.84, 80.17), (9.70, 79.86), (9.40, 79.80), (8.95, 79.75),
        (8.45, 79.76), (7.75, 79.78), (6.95, 79.85), (6.20, 80.05),
        (6.00, 80.45), (6.12, 80.85), (6.35, 81.20), (6.75, 81.65),
        (7.20, 81.95), (7.75, 81.95), (8.30, 81.85), (8.95, 81.70),
        (9.35, 81.45), (9.68, 81.08), (9.84, 80.70), (9.84, 80.17),
    ]

    latitudes = []
    longitudes = []
    colors = []

    for agent in map_data or []:
        coords = agent.get('coordinates', [])
        opinion = (agent.get('opinion') or 'NEUTRAL').upper()

        if not isinstance(coords, list) or len(coords) != 2:
            continue

        lat, lon = coords[0], coords[1]
        latitudes.append(lat)
        longitudes.append(lon)

        if opinion == 'POSITIVE':
            colors.append('#10b981')
        elif opinion == 'NEGATIVE':
            colors.append('#ef4444')
        else:
            colors.append('#94a3b8')

    plt.figure(figsize=(8, 10), facecolor='#0f172a')
    ax = plt.gca()
    ax.set_facecolor('#0f172a')

    outline_lat = [p[0] for p in sri_lanka_outline]
    outline_lon = [p[1] for p in sri_lanka_outline]
    plt.plot(outline_lon, outline_lat, color='#64748b', linewidth=1.7, label='Sri Lanka')

    # Major city/place labels for better geographic context
    major_places = {
        'Jaffna': (9.66, 80.02),
        'Anuradhapura': (8.31, 80.40),
        'Trincomalee': (8.57, 81.23),
        'Kurunegala': (7.49, 80.36),
        'Kandy': (7.29, 80.63),
        'Colombo': (6.93, 79.86),
        'Negombo': (7.21, 79.84),
        'Batticaloa': (7.71, 81.70),
        'Galle': (6.05, 80.22),
        'Matara': (5.95, 80.55),
    }

    for place_name, (lat, lon) in major_places.items():
        plt.scatter(lon, lat, c='#f8fafc', s=10, alpha=0.7)
        plt.text(
            lon + 0.03,
            lat + 0.02,
            place_name,
            fontsize=8,
            color='#e2e8f0',
            alpha=0.9,
        )

    if latitudes and longitudes:
        plt.scatter(
            longitudes,
            latitudes,
            c=colors,
            alpha=0.75,
            s=20,
            edgecolors='#0b1120',
            linewidths=0.2,
        )

    plt.xlim(79.5, 82.1)
    plt.ylim(5.8, 10.2)
    plt.xlabel('Longitude', color='#cbd5e1')
    plt.ylabel('Latitude', color='#cbd5e1')
    plt.title('Regional Analysis - Sri Lanka Agent Distribution', color='#f8fafc')
    plt.grid(alpha=0.15, color='#334155')
    ax.tick_params(axis='x', colors='#cbd5e1')
    ax.tick_params(axis='y', colors='#cbd5e1')

    for spine in ax.spines.values():
        spine.set_color('#475569')

    plt.tight_layout()

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/sri_lanka_map_{simulation_id}.png'
    plt.savefig(file_path)
    plt.close()

    return file_path