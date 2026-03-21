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
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
} from 'recharts';
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
    const [showVideoPreview, setShowVideoPreview] = useState(false);

    // Fetch parent project for video preview
    const { data: project } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => projectsApi.get(projectId),
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

    const isCompleted = simulationStatus?.status === 'COMPLETED';
    const isFailed = simulationStatus?.status === 'FAILED';
    const isRunning =
        simulationStatus?.status === 'RUNNING' ||
        simulationStatus?.status === 'PENDING' ||
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

    const sentimentData = results?.sentiment_breakdown
        ? [
            { name: 'Positive', value: results.sentiment_breakdown.positive, color: COLORS.positive },
            { name: 'Neutral', value: results.sentiment_breakdown.neutral, color: COLORS.neutral },
            { name: 'Negative', value: results.sentiment_breakdown.negative, color: COLORS.negative },
        ]
        : [];

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center space-x-4 mb-8">
                    <Link
                        href={`/dashboard/project/${projectId}`}
                        className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Simulation Results</h1>
                        <p className="text-white/60">
                            {simulationStatus
                                ? `Status: ${simulationStatus.status}`
                                : 'Loading simulation...'}
                        </p>
                    </div>

                    {isCompleted && (
                        <div className="ml-auto">
                            <button
                                onClick={handleDownloadReport}
                                className="btn-primary flex items-center space-x-2 px-4 py-2"
                            >
                                <Download className="w-4 h-4" />
                                <span>Download Report</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Running / Pending state */}
                {isRunning && !isCompleted && !isFailed && (
                    <div className="glass-card rounded-2xl p-12 text-center mb-6">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary-400" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Running</h3>
                        {simulationStatus && (
                            <>
                                <div className="max-w-sm mx-auto mt-6">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>Progress</span>
                                        <span>{simulationStatus.progress}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-bar-fill"
                                            style={{ width: `${simulationStatus.progress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-white/40 mt-2">
                                        Day {simulationStatus.current_day} • {simulationStatus.active_agents} agents active
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Failed state */}
                {isFailed && (
                    <div className="glass-card rounded-2xl p-12 text-center">
                        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Simulation Failed</h3>
                        <p className="text-white/60 mb-6">Something went wrong during this simulation.</p>
                        <Link
                            href={`/dashboard/project/${projectId}`}
                            className="btn-primary inline-flex items-center space-x-2 px-4 py-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to Project</span>
                        </Link>
                    </div>
                )}

                {/* Loading results after completion */}
                {isCompleted && resultsLoading && (
                    <div className="glass-card rounded-2xl p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                        <p>Loading results...</p>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="space-y-6">
                        {/* Video Preview (collapsible) */}
                        {project?.video_path?.startsWith('https://') && (
                            <div className="glass-card rounded-2xl overflow-hidden">
                                <button
                                    onClick={() => setShowVideoPreview(v => !v)}
                                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-semibold flex items-center gap-2">
                                        <span>📹</span> Ad Video Preview
                                    </span>
                                    <span className="text-white/50 text-sm">{showVideoPreview ? '▲ Hide' : '▼ Show'}</span>
                                </button>
                                {showVideoPreview && (
                                    <div className="px-6 pb-6">
                                        <video
                                            src={project.video_path}
                                            controls
                                            className="w-full rounded-xl max-h-72 bg-black/20"
                                            preload="metadata"
                                        >
                                            Your browser does not support the video tag.
                                        </video>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Stats Cards */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="glass-card rounded-xl p-4 text-center">
                                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary-400" />
                                <p className="text-2xl font-bold gradient-text">{results.engagement_score}%</p>
                                <p className="text-sm text-white/60">Engagement Score</p>
                            </div>
                            <div className="glass-card rounded-xl p-4 text-center">
                                <Users className="w-6 h-6 mx-auto mb-2 text-emerald-400" />
                                <p className="text-2xl font-bold">{results.total_agents}</p>
                                <p className="text-sm text-white/60">Total Agents</p>
                            </div>
                            <div className="glass-card rounded-xl p-4 text-center">
                                <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
                                <p className="text-2xl font-bold">{results.risk_flags?.length || 0}</p>
                                <p className="text-sm text-white/60">Risk Flags</p>
                            </div>
                        </div>

                        {/* Sentiment Chart */}
                        <div className="glass-card rounded-2xl p-6">
                            <h3 className="text-lg font-semibold mb-4">Sentiment Breakdown</h3>
                            <div className="flex items-center">
                                <div className="w-48 h-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={sentimentData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {sentimentData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1 space-y-3 ml-8">
                                    {sentimentData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <span>{item.name}</span>
                                            </div>
                                            <span className="font-semibold">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Opinion Trajectory Chart */}
                        {results.opinion_trajectory && Object.keys(results.opinion_trajectory).length > 0 && (
                            <div className="glass-card rounded-2xl p-6">
                                <h3 className="text-lg font-semibold mb-4">Opinion Spread Over Time</h3>
                                <OpinionTrajectoryChart trajectoryData={results.opinion_trajectory} />
                            </div>
                        )}

                        {/* Risk Flags */}
                        {results.risk_flags?.length > 0 && (
                            <div className="glass-card rounded-2xl p-6">
                                <h3 className="text-lg font-semibold mb-4 flex items-center">
                                    <AlertCircle className="w-5 h-5 mr-2 text-red-400" />
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
                                                <span className="text-sm px-2 py-1 rounded-lg bg-white/10">
                                                    {flag.severity}
                                                </span>
                                            </div>
                                            <p className="text-sm opacity-80">{flag.description}</p>

                                            {flag.sample_agent_reactions?.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    <p className="text-xs font-medium opacity-60">Sample reactions:</p>
                                                    {flag.sample_agent_reactions.map((reaction: any, i: number) => (
                                                        <div key={i} className="text-xs opacity-60 flex items-start space-x-2">
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
                                <MapPin className="w-5 h-5 text-primary-400" />
                                Agent Geographic Map
                            </h2>
                            <AgentMap simulationId={simId} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
