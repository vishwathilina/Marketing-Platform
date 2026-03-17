'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery, useMutation } from '@tanstack/react-query';

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
    Play,
    Loader2,
    AlertTriangle,
    CheckCircle,
    Users,
    TrendingUp,
    MessageCircle,
    AlertCircle,
    MapPin,
} from 'lucide-react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
} from 'recharts';
import { projectsApi, simulationsApi } from '@/lib/api';
import OpinionTrajectoryChart from '@/components/OpinionTrajectoryChart';

const COLORS = {
    positive: '#10b981',
    neutral: '#eab308',
    negative: '#ef4444',
};

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [numAgents, setNumAgents] = useState(100);
    const [simulationDays, setSimulationDays] = useState(5);
    const [activeSimulation, setActiveSimulation] = useState<any>(null);
    const [pollingEnabled, setPollingEnabled] = useState(false);

    // Fetch project - poll while processing
    const { data: project, isLoading: projectLoading } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => projectsApi.get(projectId),
        refetchInterval: (query) => {
            // Poll every 5 seconds while video is processing
            const status = query.state.data?.status;
            return status && status !== 'READY' && status !== 'FAILED' ? 5000 : false;
        },
    });

    // Fetch existing simulations for this project
    const { data: existingSimulations } = useQuery({
        queryKey: ['simulations', projectId],
        queryFn: () => simulationsApi.listForProject(projectId),
        enabled: !!project && !activeSimulation,
        refetchOnWindowFocus: false, // prevent refetch on window focus from re-triggering the simulation useEffect
    });

    // Restore the most recent COMPLETED simulation on page load.
    // Do NOT auto-resume PENDING/RUNNING ones — they may be stale from a
    // previous session and auto-resuming them causes the UI to incorrectly
    // show "Running..." whenever the user clicks anywhere on the page.
    useEffect(() => {
        if (!activeSimulation && existingSimulations && existingSimulations.length > 0) {
            const latest = existingSimulations[0];
            setActiveSimulation(latest);

            // Only re-enable polling if the simulation is genuinely still in-flight
            // from THIS session (i.e. we already set pollingEnabled ourselves).
            // Never auto-resume stale PENDING/RUNNING state from a previous session.
        }
    }, [existingSimulations, activeSimulation]);

    // Poll simulation status
    const { data: simulationStatus } = useQuery({
        queryKey: ['simulationStatus', activeSimulation?.id],
        queryFn: () => simulationsApi.getStatus(activeSimulation.id),
        enabled: pollingEnabled && !!activeSimulation,
        refetchInterval: 2000,
    });

    // Check if simulation completed
    useEffect(() => {
        if (simulationStatus?.status === 'COMPLETED' || simulationStatus?.status === 'FAILED') {
            setPollingEnabled(false);
        }
    }, [simulationStatus]);

    // Start simulation mutation
    const startSimulation = useMutation({
        mutationFn: () => simulationsApi.start(projectId, { num_agents: numAgents, simulation_days: simulationDays }),
        onSuccess: (data) => {
            setActiveSimulation(data);
            setPollingEnabled(true);
        },
    });

    // Fetch results when completed
    const { data: results, isLoading: resultsLoading } = useQuery({
        queryKey: ['simulationResults', activeSimulation?.id],
        queryFn: () => simulationsApi.getResults(activeSimulation.id),
        enabled: simulationStatus?.status === 'COMPLETED',
    });

    const handleStartSimulation = () => {
        startSimulation.mutate();
    };

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'risk-critical';
            case 'HIGH': return 'risk-high';
            case 'MEDIUM': return 'risk-medium';
            default: return 'risk-low';
        }
    };

    if (projectLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p>Project not found</p>
            </div>
        );
    }

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
                        href="/dashboard"
                        className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">{project.title}</h1>
                        <p className="text-white/60">
                            Status: {project.status} • Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column - Controls */}
                    <div className="lg:col-span-1">
                        <div className="glass-card rounded-2xl p-6">
                            <h2 className="text-lg font-semibold mb-4">Simulation Settings</h2>

                            {project.status !== 'READY' ? (
                                <div className="text-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-400" />
                                    <p className="text-white/60">Video is being processed...</p>
                                    <p className="text-sm text-white/40 mt-2">This may take a few minutes</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Number of Agents
                                            </label>
                                            <input
                                                type="number"
                                                value={numAgents}
                                                onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                                className="input-field"
                                                min={5}
                                                max={1000}
                                                disabled={pollingEnabled}
                                            />
                                            <p className="text-xs text-white/40 mt-1">5 - 1,000 agents</p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Simulation Days
                                            </label>
                                            <input
                                                type="number"
                                                value={simulationDays}
                                                onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                                className="input-field"
                                                min={1}
                                                max={30}
                                                disabled={pollingEnabled}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handleStartSimulation}
                                        disabled={pollingEnabled || startSimulation.isPending}
                                        className="w-full btn-primary py-3 flex items-center justify-center disabled:opacity-50"
                                    >
                                        {pollingEnabled ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Running...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="w-5 h-5 mr-2" />
                                                Start Simulation
                                            </>
                                        )}
                                    </button>
                                </>
                            )}

                            {/* Progress */}
                            {pollingEnabled && simulationStatus && (
                                <div className="mt-6">
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
                            )}
                        </div>
                    </div>

                    {/* Right Column - Results */}
                    <div className="lg:col-span-2 space-y-6">
                        {results ? (
                            <>
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
                            </>
                        ) : simulationStatus?.status === 'COMPLETED' && resultsLoading ? (
                            <div className="glass-card rounded-2xl p-12 text-center">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                                <p>Loading results...</p>
                            </div>
                        ) : (
                            <div className="glass-card rounded-2xl p-12 text-center">
                                <TrendingUp className="w-16 h-16 text-white/20 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">No Results Yet</h3>
                                <p className="text-white/60">
                                    Run a simulation to see AI agent reactions
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Agent Map */}
                {simulationStatus?.status === 'COMPLETED' && activeSimulation && (
                    <div className="mt-8">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-primary-400" />
                            Agent Geographic Map
                        </h2>
                        <AgentMap simulationId={activeSimulation.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
