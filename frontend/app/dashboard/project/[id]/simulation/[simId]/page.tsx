'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

const AgentMap = dynamic(
    () => import('@/components/AgentMap'),
    {
        ssr: false,
        loading: () => (
            <div className="glass-card h-[600px] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-400" />
                    <p className="text-white/60">Loading map component...</p>
                </div>
            </div>
        )
    }
);

import {
    ArrowLeft,
    Loader2,
    AlertTriangle,
    Users,
    TrendingUp,
    MessageCircle,
    AlertCircle,
    MapPin,
    Download,
    XCircle,
    CalendarDays,
    Clock3,
    Activity,
    BarChart3,
} from 'lucide-react';
import { simulationsApi, projectsApi, getStoredToken } from '@/lib/api';
import OpinionTrajectoryChart from '@/components/OpinionTrajectoryChart';

const COLORS = {
    positive: '#10b981',
    neutral: '#eab308',
    negative: '#ef4444',
};

export default function SimulationResultsPage() {
    const params = useParams();
    const projectId = params.id as string;
    const simId = params.simId as string;

    const [pollingEnabled, setPollingEnabled] = useState(true);

    // Fetch parent project for video preview
    const { data: project } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => projectsApi.get(projectId),
    });

    const { data: simulationBase } = useQuery({
        queryKey: ['simulation', simId],
        queryFn: () => simulationsApi.get(simId),
    });

    // Poll simulation status
    const { data: simulationStatus } = useQuery({
        queryKey: ['simulationStatus', simId],
        queryFn: () => simulationsApi.getStatus(simId),
        enabled: pollingEnabled,
        refetchInterval: 2000,
    });

    // Stop polling once done
    useEffect(() => {
        if (
            simulationStatus?.status === 'COMPLETED' ||
            simulationStatus?.status === 'FAILED'
        ) {
            setPollingEnabled(false);
        }
    }, [simulationStatus]);

    const currentStatus = simulationStatus?.status || simulationBase?.status;

    const isCompleted = currentStatus === 'COMPLETED';
    const isFailed = currentStatus === 'FAILED';
    const isRunning =
        currentStatus === 'RUNNING' ||
        currentStatus === 'PENDING' ||
        pollingEnabled;

    const { data: results, isLoading: resultsLoading } = useQuery({
        queryKey: ['simulationResults', simId],
        queryFn: () => simulationsApi.getResults(simId),
        enabled: isCompleted,
    });

    const handleDownloadReport = async () => {
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
            const token = getStoredToken();
            const response = await fetch(
                `${baseUrl}/simulations/${simId}/report`,
                {
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                }
            );
            if (!response.ok) throw new Error('Failed to download report');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'simulation_report.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Failed to download report', error);
        }
    };

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'risk-critical';
            case 'HIGH': return 'risk-high';
            case 'MEDIUM': return 'risk-medium';
            default: return 'risk-low';
        }
    };

    const simulationRow = results?.simulation || simulationBase;

    const sentiment = simulationRow?.sentiment_breakdown || {
        positive: 0,
        neutral: 0,
        negative: 0,
    };

    const sentimentData = [
        { name: 'Positive', value: sentiment.positive || 0, color: COLORS.positive },
        { name: 'Neutral', value: sentiment.neutral || 0, color: COLORS.neutral },
        { name: 'Negative', value: sentiment.negative || 0, color: COLORS.negative },
    ];

    const totalSentiment = sentimentData.reduce((sum, item) => sum + item.value, 0);

    const formatDateTime = (value?: string) => {
        if (!value) return 'N/A';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString();
    };

    const statusBadgeClass = (() => {
        if (currentStatus === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (currentStatus === 'FAILED') return 'bg-red-100 text-red-700 border-red-200';
        if (currentStatus === 'RUNNING') return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    })();

    return (
        <div className="bg-slate-100 text-slate-900">
            <div className="border-b border-slate-200 bg-white">
                <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 flex items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="text-3xl font-extrabold tracking-tight">
                            AGENTIC<span className="font-light text-slate-600">MARKETING</span>
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Simulation analytics dashboard</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/dashboard/project/${projectId}`}
                            className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                        {isCompleted && (
                            <button
                                onClick={handleDownloadReport}
                                className="inline-flex items-center gap-2 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold">{project?.title || 'Ad'}</h1>
                        <span className={`px-3 py-1 text-xs font-semibold border ${statusBadgeClass}`}>
                            {currentStatus || 'LOADING'}
                        </span>
                    </div>

                </div>

                {/* Running / Pending state */}
                {isRunning && !isCompleted && !isFailed && (
                    <div className="border border-slate-200 bg-white p-8 text-center mb-6">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-slate-600" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Running</h3>
                        {simulationStatus && (
                            <>
                                <div className="max-w-sm mx-auto mt-6">
                                    <div className="flex justify-between text-sm mb-2 text-slate-600">
                                        <span>Progress</span>
                                        <span>{simulationStatus.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 overflow-hidden">
                                        <div
                                            className="h-full bg-slate-900 transition-all duration-500"
                                            style={{ width: `${simulationStatus.progress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Day {simulationStatus.current_day} • {simulationStatus.active_agents} agents active
                                    </p>
                                </div>
                                <div className="mt-8">
                                    <button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to cancel this simulation?')) {
                                                try {
                                                    await simulationsApi.cancel(simId);
                                                    window.location.reload();
                                                } catch (e) {
                                                    alert('Failed to cancel simulation');
                                                }
                                            }
                                        }}
                                        className="inline-flex font-semibold items-center gap-2 border border-red-200 bg-red-50 text-red-600 px-4 py-2 hover:bg-red-100 transition-colors"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Cancel Simulation
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Failed state */}
                {isFailed && (
                    <div className="border border-red-200 bg-white p-12 text-center">
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Failed</h3>
                        <p className="text-slate-600 mb-6">
                            {simulationRow?.error_message || 'Something went wrong during this simulation.'}
                        </p>
                        <Link
                            href={`/dashboard/project/${projectId}`}
                            className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to Project</span>
                        </Link>
                    </div>
                )}

                {/* Loading results after completion */}
                {isCompleted && resultsLoading && (
                    <div className="border border-slate-200 bg-white p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Loading results...</p>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <aside className="xl:col-span-3 space-y-4">
                            <div className="border border-slate-200 bg-white p-4">
                                <h3 className="text-lg font-semibold mb-4">Metrics</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="bg-slate-100 px-3 py-2 font-medium">Overview</div>
                                    <div className="bg-slate-100 px-3 py-2 font-medium">In-market impact</div>
                                    <div className="bg-slate-50 px-3 py-2 text-slate-600">Engagement</div>
                                    <div className="bg-slate-50 px-3 py-2 text-slate-600">Brand Predisposition</div>
                                </div>
                            </div>

                            <div className="border border-slate-200 bg-white p-4 space-y-3 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Simulation ID</span>
                                    <span className="font-medium text-right break-all">{simulationRow?.id}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Project ID</span>
                                    <span className="font-medium text-right break-all">{simulationRow?.project_id}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Status</span>
                                    <span className="font-medium">{simulationRow?.status || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Agents</span>
                                    <span className="font-medium">{simulationRow?.num_agents ?? 0}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Simulation days</span>
                                    <span className="font-medium">{simulationRow?.simulation_days ?? 0}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Created at</span>
                                    <span className="font-medium text-right">{formatDateTime(simulationRow?.created_at)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Started at</span>
                                    <span className="font-medium text-right">{formatDateTime(simulationRow?.started_at)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-slate-500">Completed at</span>
                                    <span className="font-medium text-right">{formatDateTime(simulationRow?.completed_at)}</span>
                                </div>
                            </div>

                            <div className="border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-2">
                                <p className="font-semibold text-slate-700">Sentiment summary</p>
                                {sentimentData.map((item) => {
                                    const pct = totalSentiment > 0 ? Math.round((item.value / totalSentiment) * 100) : 0;
                                    return (
                                        <div key={item.name}>
                                            <div className="flex justify-between mb-1">
                                                <span>{item.name}</span>
                                                <span>{item.value} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 overflow-hidden">
                                                <div
                                                    className="h-full"
                                                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </aside>

                        <main className="xl:col-span-9 space-y-6">
                            {project?.video_path?.startsWith('https://') && (
                                <div className="border border-slate-200 bg-white p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-2xl font-bold">Insights</h2>
                                    </div>
                                    <div className="flex items-start gap-6">
                                        <video
                                            src={project.video_path}
                                            controls
                                            className="w-full max-w-[320px] bg-black border border-slate-200"
                                            preload="metadata"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                        <div className="pt-2">
                                            <p className="text-sm font-semibold text-slate-800">vlm_generated_context</p>
                                            <div className="mt-2 h-52 overflow-y-auto border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6">
                                                    {project?.vlm_generated_context || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <section className="border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-3xl font-bold">Overview</h3>
                                    <button className="border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        View Overview
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <TrendingUp className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">KPI</span>
                                        </div>
                                        <p className="text-3xl font-bold">{simulationRow?.engagement_score ?? 0}</p>
                                        <p className="text-sm text-slate-500">Engagement score</p>
                                    </div>
                                    <div className="border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <Users className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">Scale</span>
                                        </div>
                                        <p className="text-3xl font-bold">{simulationRow?.num_agents ?? 0}</p>
                                        <p className="text-sm text-slate-500">Total agents</p>
                                    </div>
                                    <div className="border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <AlertTriangle className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">Risk</span>
                                        </div>
                                        <p className="text-3xl font-bold">{results.risk_flags?.length || 0}</p>
                                        <p className="text-sm text-slate-500">Risk flags</p>
                                    </div>
                                </div>
                            </section>

                            <section className="border border-slate-200 bg-white p-5">
                                <h3 className="text-3xl font-bold mb-4">In-market impact</h3>
                                <div className="border border-slate-200 p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <Activity className="w-4 h-4" />
                                                <span className="text-xs">Status</span>
                                            </div>
                                            <p className="text-xl font-bold">{simulationRow?.status || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <BarChart3 className="w-4 h-4" />
                                                <span className="text-xs">Simulation days</span>
                                            </div>
                                            <p className="text-xl font-bold">{simulationRow?.simulation_days ?? 0}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <CalendarDays className="w-4 h-4" />
                                                <span className="text-xs">Created</span>
                                            </div>
                                            <p className="text-sm font-semibold">{formatDateTime(simulationRow?.created_at)}</p>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                                <Clock3 className="w-4 h-4" />
                                                <span className="text-xs">Completed</span>
                                            </div>
                                            <p className="text-sm font-semibold">{formatDateTime(simulationRow?.completed_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* KANTAR-LIKE ADVANCED METRICS */}
                            {results.agent_states && results.agent_states.length > 0 && (
                                <>
                                    <section className="border border-slate-200 bg-white p-5">
                                        <h3 className="text-xl font-bold mb-4">Performance & effectiveness</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {[
                                                { label: 'Communication awareness', value: (() => { const nonNeutral = results.agent_states.filter((a: any) => a.opinion !== 'NEUTRAL').length; return Math.round((nonNeutral / results.agent_states.length) * 100); })() },
                                                { label: 'Branded memorability', value: (() => { const intense = results.agent_states.filter((a: any) => a.emotion_intensity > 0.5).length; return Math.round((intense / results.agent_states.length) * 100); })() },
                                                { label: 'Remembered reach', value: (() => { const positive = results.agent_states.filter((a: any) => a.opinion === 'POSITIVE').length; return Math.round((positive / results.agent_states.length) * 100); })() },
                                                { label: 'Active engagement', value: (() => { const active = results.agent_states.filter((a: any) => ['BOYCOTT', 'ENDORSEMENT'].includes(a.event_type) || a.emotion_intensity > 0.7).length; return Math.round((active / results.agent_states.length) * 100); })() },
                                            ].map((metric, i) => (
                                                <div key={i} className="border border-slate-200 p-4 relative overflow-hidden group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-3xl font-bold text-slate-800">{metric.value}</span>
                                                        <Activity className="w-4 h-4 text-slate-400 group-hover:text-amber-500 transition-colors" />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{metric.label}</p>
                                                    <div className="absolute bottom-0 left-0 h-1 bg-amber-400" style={{ width: `${metric.value}%` }} />
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="border border-slate-200 bg-white p-5">
                                        <h3 className="text-xl font-bold mb-4">Involvement diagnosis</h3>
                                        <div className="w-full h-[400px] flex items-center justify-center">
                                            {(() => {
                                                let involving = 0, interesting = 0, pleasant = 0, boring = 0, unpleasant = 0, irritating = 0, touching = 0;
                                                results.agent_states.forEach((s: any) => {
                                                    const emotion = (s.emotion || 'neutral').toLowerCase();
                                                    const intensity = s.emotion_intensity || 0;
                                                    if (intensity > 0.6) involving += 1;
                                                    if (intensity > 0.4 && ['happy', 'neutral'].includes(emotion)) interesting += 1;
                                                    if (emotion === 'happy') { pleasant += 1; touching += intensity; }
                                                    if (emotion === 'neutral' && intensity < 0.3) boring += 1;
                                                    if (emotion === 'angry') { irritating += 1; unpleasant += intensity; }
                                                    if (emotion === 'sad') { unpleasant += 1; touching += intensity; }
                                                });
                                                const t = results.agent_states.length || 1;
                                                const radarData = [
                                                    { subject: 'Involving', value: Math.min(100, Math.round((involving / t) * 100)) },
                                                    { subject: 'Pleasant', value: Math.min(100, Math.round((pleasant / t) * 100)) },
                                                    { subject: 'Interesting', value: Math.min(100, Math.round((interesting / t) * 100)) },
                                                    { subject: 'Touching', value: Math.min(100, Math.round((touching / t) * 100)) },
                                                    { subject: 'Irritating', value: Math.min(100, Math.round((irritating / t) * 100)) },
                                                    { subject: 'Unpleasant', value: Math.min(100, Math.round((unpleasant / t) * 100)) },
                                                    { subject: 'Boring', value: Math.min(100, Math.round((boring / t) * 100)) },
                                                ];
                                                return (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                                            <PolarGrid stroke="#e2e8f0" />
                                                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8' }} />
                                                            <Radar name="Agents" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                                                        </RadarChart>
                                                    </ResponsiveContainer>
                                                );
                                            })()}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-4 text-center">
                                            A diagnostic plot showing emotional mappings to advertising reception constructs.
                                        </p>
                                    </section>
                                </>
                            )}

                            {/* Opinion Trajectory Chart */}
                            {results.opinion_trajectory && Object.keys(results.opinion_trajectory).length > 0 && (
                                <div className="border border-slate-200 bg-white p-6">
                                    <h3 className="text-lg font-semibold mb-4">Opinion Spread Over Time</h3>
                                    <OpinionTrajectoryChart trajectoryData={results.opinion_trajectory} />
                                </div>
                            )}

                            {/* Risk Flags */}
                            {results.risk_flags?.length > 0 && (
                                <div className="border border-slate-200 bg-white p-6">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                                        <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                                        Risk Flags
                                    </h3>
                                    <div className="space-y-4">
                                        {results.risk_flags.map((flag: any, index: number) => (
                                            <div
                                                key={index}
                                                className={`p-4 border ${getSeverityClass(flag.severity)}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{flag.flag_type.replace(/_/g, ' ')}</span>
                                                    <span className="text-sm px-2 py-1 bg-white/70 border border-white/70">
                                                        {flag.severity}
                                                    </span>
                                                </div>
                                                <p className="text-sm opacity-90">{flag.description}</p>

                                                {flag.sample_agent_reactions?.length > 0 && (
                                                    <div className="mt-3 space-y-2">
                                                        <p className="text-xs font-medium opacity-80">Sample reactions:</p>
                                                        {flag.sample_agent_reactions.map((reaction: any, i: number) => (
                                                            <div key={i} className="text-xs opacity-80 flex items-start space-x-2">
                                                                <MessageCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                                                <span>"{reaction.reasoning}"</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Agent Map */}
                            <div>
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-slate-700" />
                                    Agent Geographic Map
                                </h2>
                                <AgentMap simulationId={simId} />
                            </div>
                        </main>
                    </div>
                )}
            </div>
        </div>
    );
}
