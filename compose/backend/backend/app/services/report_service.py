import os
from collections import Counter
from datetime import datetime

from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, PageBreak

from app.services.chart_service import (
    generate_behavior_chart,
    generate_reaction_chart,
    generate_risk_chart,
    generate_sentiment_chart,
    generate_sri_lanka_regional_map,
)


def _safe_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _calculate_sentiment_from_simulation(simulation):
    sentiment = simulation.sentiment_breakdown or {}
    return {
        'positive': _safe_int(sentiment.get('positive', 0)),
        'neutral': _safe_int(sentiment.get('neutral', 0)),
        'negative': _safe_int(sentiment.get('negative', 0)),
    }


def _risk_distribution(risk_flags):
    counts = Counter((flag.severity or 'LOW').upper() for flag in risk_flags)
    return {
        'CRITICAL': counts.get('CRITICAL', 0),
        'HIGH': counts.get('HIGH', 0),
        'MEDIUM': counts.get('MEDIUM', 0),
        'LOW': counts.get('LOW', 0),
    }


def _generate_executive_summary(metrics):
    sentiment_signal = 'balanced'
    if metrics['positive_rate'] >= 55:
        sentiment_signal = 'favorable'
    elif metrics['negative_rate'] >= 35:
        sentiment_signal = 'fragile'

    risk_signal = 'controlled'
    if metrics['critical_risks'] > 0:
        risk_signal = 'critical'
    elif metrics['high_risks'] > 0:
        risk_signal = 'elevated'

    return (
        'AI Executive Summary: This simulation indicates a '
        f"{sentiment_signal} public response pattern with an engagement score of {metrics['engagement_score']}%. "
        f"Endorsement pressure is {metrics['endorsement_rate']}% versus boycott pressure at {metrics['boycott_rate']}%. "
        f"Risk posture is {risk_signal}, with {metrics['total_risks']} flagged issues requiring monitoring. "
        'Regional spread suggests opinion clusters that can be targeted with segmented messaging and '
        'proactive mitigation in high-risk pockets.'
    )


def _prediction_recommendations(metrics):
    recommendations = []

    if metrics['negative_rate'] >= 35 or metrics['boycott_rate'] >= 30:
        recommendations.append(
            'Prediction: Negative momentum may rise over the next cycle unless corrective narrative action is taken.'
        )
        recommendations.append(
            'Recommendation: Launch a rapid trust-repair content variant focused on transparency and value reassurance.'
        )
    else:
        recommendations.append(
            'Prediction: Campaign sentiment is likely to remain stable with moderate upside in endorsements.'
        )
        recommendations.append(
            'Recommendation: Scale high-performing message variants and preserve tone consistency across channels.'
        )

    if metrics['critical_risks'] > 0 or metrics['high_risks'] > 0:
        recommendations.append(
            'Recommendation: Prioritize high-severity risk flags with audience-specific messaging and escalation monitoring.'
        )

    recommendations.append(
        'Recommendation: Re-run simulation after creative refinements to validate risk reduction and sentiment lift.'
    )

    return recommendations


def _collect_agent_reasonings(simulation, agent_logs):
    reasonings = []
    
    demographics_map = {}

    # Extract initial/final full agent states
    for state in simulation.agent_states or []:
        agent_id = state.get('agent_id')
        reasoning = (state.get('reasoning') or '').strip()
        opinion = (state.get('opinion') or 'NEUTRAL').upper()
        profile = state.get('profile') or {}

        if agent_id:
            demographics = (
                f"Age: {profile.get('age', 'N/A')} | Gender: {profile.get('gender', 'N/A')} | "
                f"Location: {profile.get('location', 'N/A')} | Income: {profile.get('income_level', 'N/A')} | "
                f"Religion: {profile.get('religion', 'N/A')} | Ethnicity: {profile.get('ethnicity', 'N/A')}"
            )
            demographics_map[agent_id] = demographics
            if reasoning:
                reasonings.append(
                    {
                        'agent_id': agent_id,
                        'opinion': opinion,
                        'reasoning': f"[Final Assessment] {reasoning}",
                        'demographics': demographics
                    }
                )

    # Pull active reasoning from event logs
    for log in agent_logs:
        payload = log.event_data or {}
        if not isinstance(payload, dict):
            continue

        reasoning = (payload.get('details') or payload.get('reasoning') or '').strip()
        if not reasoning:
            continue
            
        agent_id = log.agent_id
        opinion = (payload.get('opinion') or log.event_type or 'NEUTRAL').upper()
        
        reasonings.append(
            {
                'agent_id': agent_id,
                'opinion': opinion,
                'reasoning': f"[{log.event_type}] {reasoning}",
                'demographics': demographics_map.get(agent_id, "See above")
            }
        )

    # Sort sequentially by agent to show reasoning history
    return sorted(reasonings, key=lambda x: x['agent_id'])


def _collect_agent_interactions(simulation, agent_logs):
    interactions = []

    # Extract friendship/influence networks from agent_states
    agent_id_to_opinion = {}
    for state in simulation.agent_states or []:
        agent_id = state.get('agent_id')
        opinion = (state.get('opinion') or 'NEUTRAL').upper()
        friends = state.get('friends') or []
        reasoning = (state.get('reasoning') or '').strip()

        agent_id_to_opinion[agent_id] = opinion

        # Document each friendship connection with context
        for friend_id in friends:
            friend_opinion = agent_id_to_opinion.get(friend_id, 'UNKNOWN')
            interactions.append(
                {
                    'from_agent': agent_id,
                    'to_agent': friend_id,
                    'influencer_opinion': opinion,
                    'target_opinion': friend_opinion,
                    'context': f'{agent_id} (opinion: {opinion}) is connected to {friend_id} (opinion: {friend_opinion}). Context: {reasoning[:100]}...' if reasoning else f'{agent_id} ({opinion}) → {friend_id} ({friend_opinion})',
                }
            )

    # Extract explicit interactions from event logs (e.g., PERSUASION, INFLUENCE events)
    for log in agent_logs:
        event_type = log.event_type or ''
        if 'INFLUENCE' in event_type or 'PERSUADE' in event_type or 'CONVINCE' in event_type:
            payload = log.event_data or {}
            if not isinstance(payload, dict):
                continue

            target_id = payload.get('target_agent_id') or payload.get('influenced_agent')
            if not target_id:
                continue

            reasoning = (payload.get('reasoning') or payload.get('message') or '').strip()
            interactions.append(
                {
                    'from_agent': log.agent_id,
                    'to_agent': target_id,
                    'interaction_type': event_type,
                    'context': reasoning[:150] if reasoning else f'{log.agent_id} performed {event_type} on {target_id}',
                }
            )

    return interactions


def generate_simulation_report(simulation, risk_flags, agent_logs):
    boycott_count = sum(1 for log in agent_logs if log.event_type == 'BOYCOTT')
    endorse_count = sum(1 for log in agent_logs if log.event_type == 'ENDORSEMENT')

    total_reactions = max(boycott_count + endorse_count, 1)
    sentiment = _calculate_sentiment_from_simulation(simulation)
    total_sentiment = max(sentiment['positive'] + sentiment['neutral'] + sentiment['negative'], 1)
    risks = _risk_distribution(risk_flags)
    engagement_score = round(float(simulation.engagement_score or 0), 2)

    metrics = {
        'engagement_score': engagement_score,
        'endorsement_rate': round((endorse_count / total_reactions) * 100, 2),
        'boycott_rate': round((boycott_count / total_reactions) * 100, 2),
        'positive_rate': round((sentiment['positive'] / total_sentiment) * 100, 2),
        'negative_rate': round((sentiment['negative'] / total_sentiment) * 100, 2),
        'total_risks': len(risk_flags),
        'critical_risks': risks['CRITICAL'],
        'high_risks': risks['HIGH'],
    }

    chart_path = generate_reaction_chart(
        boycott_count,
        endorse_count,
        simulation.id,
    )
    sentiment_chart_path = generate_sentiment_chart(sentiment, simulation.id)
    behavior_chart_path, behavior_counts = generate_behavior_chart(agent_logs, simulation.id)
    risk_chart_path, severity_counts = generate_risk_chart(risk_flags, simulation.id)
    sri_lanka_map_path = generate_sri_lanka_regional_map(simulation.map_data, simulation.id)
    executive_summary = _generate_executive_summary(metrics)
    recommendations = _prediction_recommendations(metrics)
    all_reasonings = _collect_agent_reasonings(simulation, agent_logs)
    all_interactions = _collect_agent_interactions(simulation, agent_logs)

    os.makedirs('reports', exist_ok=True)
    file_path = f'reports/simulation_report_{simulation.id}.pdf'

    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph('Strategic Simulation Intelligence Report', styles['Title']))
    elements.append(Spacer(1, 20))

    elements.append(Paragraph(f'Simulation ID: {simulation.id}', styles['Normal']))
    elements.append(Paragraph(f'Project ID: {simulation.project_id}', styles['Normal']))
    elements.append(Paragraph(f'Agents: {simulation.num_agents}', styles['Normal']))
    elements.append(Paragraph(f'Simulation Days: {simulation.simulation_days}', styles['Normal']))
    elements.append(Paragraph(f'Generated: {datetime.now()}', styles['Normal']))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('1. Executive Summary (AI Generated)', styles['Heading2']))
    elements.append(Paragraph(executive_summary, styles['Normal']))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('2. Key Metrics', styles['Heading2']))
    elements.append(Paragraph(f'Engagement Score: {engagement_score}%', styles['Normal']))
    elements.append(Paragraph(f'Endorsements: {endorse_count} ({metrics["endorsement_rate"]}%)', styles['Normal']))
    elements.append(Paragraph(f'Boycotts: {boycott_count} ({metrics["boycott_rate"]}%)', styles['Normal']))
    elements.append(Paragraph(f'Total Risk Flags: {len(risk_flags)}', styles['Normal']))

    elements.append(Spacer(1, 12))
    elements.append(Image(chart_path, width=420, height=260))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('3. Sentiment Analysis', styles['Heading2']))
    elements.append(Paragraph(f"Positive: {sentiment['positive']} ({metrics['positive_rate']}%)", styles['Normal']))
    elements.append(Paragraph(f"Neutral: {sentiment['neutral']}", styles['Normal']))
    elements.append(Paragraph(f"Negative: {sentiment['negative']} ({metrics['negative_rate']}%)", styles['Normal']))
    elements.append(Spacer(1, 10))
    elements.append(Image(sentiment_chart_path, width=420, height=240))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('4. Agent Behavior Analysis', styles['Heading2']))
    top_behaviors = behavior_counts.most_common(5)
    if top_behaviors:
        for event_name, count in top_behaviors:
            elements.append(Paragraph(f'{event_name}: {count}', styles['Normal']))
    else:
        elements.append(Paragraph('No behavior events captured for this simulation.', styles['Normal']))
    elements.append(Spacer(1, 10))
    elements.append(Image(behavior_chart_path, width=420, height=230))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('5. Risk Intelligence', styles['Heading2']))
    elements.append(Paragraph(f"Critical: {severity_counts.get('CRITICAL', 0)}", styles['Normal']))
    elements.append(Paragraph(f"High: {severity_counts.get('HIGH', 0)}", styles['Normal']))
    elements.append(Paragraph(f"Medium: {severity_counts.get('MEDIUM', 0)}", styles['Normal']))
    elements.append(Paragraph(f"Low: {severity_counts.get('LOW', 0)}", styles['Normal']))
    elements.append(Spacer(1, 10))
    elements.append(Image(risk_chart_path, width=420, height=230))

    if risk_flags:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph('Top Risk Flags:', styles['Normal']))
    for flag in risk_flags[:5]:
        elements.append(
            Paragraph(
                f'{flag.flag_type} - Severity: {flag.severity}',
                styles['Normal'],
            )
        )

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('6. Regional Analysis (Sri Lanka Map)', styles['Heading2']))
    elements.append(
        Paragraph(
            'The map below visualizes agent opinion distribution across Sri Lanka using simulation coordinates.',
            styles['Normal'],
        )
    )
    elements.append(Spacer(1, 10))
    elements.append(Image(sri_lanka_map_path, width=380, height=460))

    elements.append(Spacer(1, 20))

    elements.append(Paragraph('7. Predictions & Recommendations', styles['Heading2']))
    for insight in recommendations:
        elements.append(Paragraph(f'- {insight}', styles['Normal']))

    elements.append(PageBreak())
    elements.append(Paragraph('Appendix A - Agent-to-Agent Interactions & Influence Networks', styles['Heading2']))
    elements.append(
        Paragraph(
            f'Total interaction edges mapped: {len(all_interactions)}',
            styles['Normal'],
        )
    )
    elements.append(Spacer(1, 10))

    if all_interactions:
        for interaction in all_interactions[:100]:  # Limit to first 100 interactions for readability
            from_agent = interaction.get('from_agent', 'Unknown')
            to_agent = interaction.get('to_agent', 'Unknown')
            context = (interaction.get('context') or interaction.get('interaction_type') or 'Connection').strip()
            elements.append(
                Paragraph(
                    f"<b>{from_agent}</b> → <b>{to_agent}</b>: {context}",
                    styles['Normal'],
                )
            )
            elements.append(Spacer(1, 5))
        
        if len(all_interactions) > 100:
            elements.append(Spacer(1, 10))
            elements.append(
                Paragraph(
                    f'... and {len(all_interactions) - 100} more agent interactions (truncated for report length)',
                    styles['Normal'],
                )
            )
    else:
        elements.append(
            Paragraph('No agent-to-agent interactions were recorded for this simulation.', styles['Normal'])
        )

    elements.append(PageBreak())
    elements.append(Paragraph('Appendix B - All Agent Reasonings', styles['Heading2']))
    elements.append(
        Paragraph(
            f'Total agent reasonings included: {len(all_reasonings)}',
            styles['Normal'],
        )
    )
    elements.append(Spacer(1, 10))

    if all_reasonings:
        for item in all_reasonings:
            demographics = item.get('demographics', 'Demographics not available')
            elements.append(
                Paragraph(
                    f"<b>{item['agent_id']}</b> ({item['opinion']}): {item['reasoning']}<br/><i><font size='8' color='gray'>{demographics}</font></i>",
                    styles['Normal'],
                )
            )
            elements.append(Spacer(1, 6))
    else:
        elements.append(
            Paragraph('No agent reasoning records were available for this simulation.', styles['Normal'])
        )

    doc = SimpleDocTemplate(file_path)
    doc.build(elements)

    return file_path