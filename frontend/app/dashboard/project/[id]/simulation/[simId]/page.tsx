'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';

const AgentMap = dynamic(
    () => import('@/components/AgentMap'),
    {
        ssr: false,
        loading: () => (
            <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center">
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
import { simulationsApi, projectsApi } from '@/lib/api';
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
            const response = await fetch(
                `${baseUrl}/simulations/${simId}/report`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <div className="border-b border-slate-200 bg-white">
                <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-5 flex items-start md:items-center justify-between gap-4">
                    <div>
                        <p className="text-3xl font-extrabold tracking-tight">
                            BRAND<span className="font-light text-slate-600">CAMPAIGN</span>
                        </p>
                        <p className="text-sm text-slate-500 mt-1">Simulation analytics dashboard</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href={`/dashboard/project/${projectId}`}
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Link>
                        {isCompleted && (
                            <button
                                onClick={handleDownloadReport}
                                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${statusBadgeClass}`}>
                            {currentStatus || 'LOADING'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">Select up to 15 ads to compare results</p>
                </div>

                {/* Running / Pending state */}
                {isRunning && !isCompleted && !isFailed && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center mb-6">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-slate-600" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Running</h3>
                        {simulationStatus && (
                            <>
                                <div className="max-w-sm mx-auto mt-6">
                                    <div className="flex justify-between text-sm mb-2 text-slate-600">
                                        <span>Progress</span>
                                        <span>{simulationStatus.progress}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-slate-900 transition-all duration-500"
                                            style={{ width: `${simulationStatus.progress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-slate-500 mt-2">
                                        Day {simulationStatus.current_day} • {simulationStatus.active_agents} agents active
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Failed state */}
                {isFailed && (
                    <div className="rounded-2xl border border-red-200 bg-white p-12 text-center">
                        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Failed</h3>
                        <p className="text-slate-600 mb-6">
                            {simulationRow?.error_message || 'Something went wrong during this simulation.'}
                        </p>
                        <Link
                            href={`/dashboard/project/${projectId}`}
                            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to Project</span>
                        </Link>
                    </div>
                )}

                {/* Loading results after completion */}
                {isCompleted && resultsLoading && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Loading results...</p>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <aside className="xl:col-span-3 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                <h3 className="text-lg font-semibold mb-4">Metrics</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="rounded-lg bg-slate-100 px-3 py-2 font-medium">Overview</div>
                                    <div className="rounded-lg bg-slate-100 px-3 py-2 font-medium">In-market impact</div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">Engagement</div>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">Brand Predisposition</div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 text-sm">
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

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600 space-y-2">
                                <p className="font-semibold text-slate-700">Sentiment summary</p>
                                {sentimentData.map((item) => {
                                    const pct = totalSentiment > 0 ? Math.round((item.value / totalSentiment) * 100) : 0;
                                    return (
                                        <div key={item.name}>
                                            <div className="flex justify-between mb-1">
                                                <span>{item.name}</span>
                                                <span>{item.value} ({pct}%)</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
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
                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-2xl font-bold">Insights</h2>
                                    </div>
                                    <div className="flex items-start gap-6">
                                        <video
                                            src={project.video_path}
                                            controls
                                            className="w-full max-w-[320px] rounded-xl bg-black border border-slate-200"
                                            preload="metadata"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                        <div className="pt-2">
                                            <p className="text-sm font-semibold text-slate-800">vlm_generated_context</p>
                                            <div className="mt-2 h-52 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-6">
                                                    {project?.vlm_generated_context || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-3xl font-bold">Overview</h3>
                                    <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                                        View Overview
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <TrendingUp className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">KPI</span>
                                        </div>
                                        <p className="text-3xl font-bold">{simulationRow?.engagement_score ?? 0}</p>
                                        <p className="text-sm text-slate-500">Engagement score</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <Users className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">Scale</span>
                                        </div>
                                        <p className="text-3xl font-bold">{simulationRow?.num_agents ?? 0}</p>
                                        <p className="text-sm text-slate-500">Total agents</p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <AlertTriangle className="w-5 h-5 text-slate-500" />
                                            <span className="text-xs text-slate-500">Risk</span>
                                        </div>
                                        <p className="text-3xl font-bold">{results.risk_flags?.length || 0}</p>
                                        <p className="text-sm text-slate-500">Risk flags</p>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-5">
                                <h3 className="text-3xl font-bold mb-4">In-market impact</h3>
                                <div className="rounded-xl border border-slate-200 p-4">
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

                            {/* Opinion Trajectory Chart */}
                            {results.opinion_trajectory && Object.keys(results.opinion_trajectory).length > 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                                    <h3 className="text-lg font-semibold mb-4">Opinion Spread Over Time</h3>
                                    <OpinionTrajectoryChart trajectoryData={results.opinion_trajectory} />
                                </div>
                            )}

                            {/* Risk Flags */}
                            {results.risk_flags?.length > 0 && (
                                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                                    <h3 className="text-lg font-semibold mb-4 flex items-center">
                                        <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                                        Risk Flags
                                    </h3>
                                    <div className="space-y-4">
                                        {results.risk_flags.map((flag: any, index: number) => (
                                            <div
                                                key={index}
                                                className={`p-4 rounded-xl border ${getSeverityClass(flag.severity)}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium">{flag.flag_type.replace(/_/g, ' ')}</span>
                                                    <span className="text-sm px-2 py-1 rounded-lg bg-white/70 border border-white/70">
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
