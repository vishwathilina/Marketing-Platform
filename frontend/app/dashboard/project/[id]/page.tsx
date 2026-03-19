'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
    Download,
    Edit2,
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
import { projectsApi, simulationsApi, agentsApi } from '@/lib/api';
import { 
    ChevronDown, ChevronUp 
} from 'lucide-react';
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
    
    const [agentTab, setAgentTab] = useState<'ai' | 'custom'>('ai');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [useCustomAgentsOnly, setUseCustomAgentsOnly] = useState(false);
    const [isDemographicsOpen, setIsDemographicsOpen] = useState(false);
    
    const [demoFilter, setDemoFilter] = useState({
        age_range: [18, 65],
        gender: 'All',
        location: 'All',
        income_level: [] as string[],
        religion: [] as string[]
    });

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    
    const queryClient = useQueryClient();
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [contextValue, setContextValue] = useState("");

    const { data: customAgents } = useQuery({
        queryKey: ['customAgents'],
        queryFn: agentsApi.list,
        enabled: mounted,
    });

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

    const startSimulation = useMutation({
        mutationFn: (payload: any) => simulationsApi.start(projectId, payload),
        onSuccess: (data) => {
            setActiveSimulation(data);
            setPollingEnabled(true);
        },
    });

    const handleStartSimulation = () => {
        const payload: any = { num_agents: numAgents, simulation_days: simulationDays };
        
        if (agentTab === 'custom') {
            payload.agent_ids = selectedAgentIds;
            payload.use_custom_agents_only = useCustomAgentsOnly;
        } else {
            payload.demographic_filter = {
                age_range: demoFilter.age_range,
                gender: demoFilter.gender === 'All' ? null : demoFilter.gender,
                location: demoFilter.location === 'All' ? null : demoFilter.location,
                income_level: demoFilter.income_level.length ? demoFilter.income_level : null,
                religion: demoFilter.religion.length ? demoFilter.religion : null,
            };
        }
        
        startSimulation.mutate(payload);
    };

    const { data: results, isLoading: resultsLoading } = useQuery({
        queryKey: ['simulationResults', activeSimulation?.id],
        queryFn: () => simulationsApi.getResults(activeSimulation.id),
        enabled: simulationStatus?.status === 'COMPLETED',
    });

    const updateContextMutation = useMutation({
        mutationFn: (context: string) => projectsApi.updateContext(projectId, context),
        onSuccess: (updatedProject) => {
            queryClient.setQueryData(['project', projectId], updatedProject);
            setIsEditingContext(false);
        },
    });

    const handleSaveContext = () => {
        updateContextMutation.mutate(contextValue);
    };

    const handleDownloadReport = async () => {
        if (!activeSimulation) return;

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
            const response = await fetch(
                `${baseUrl}/simulations/${activeSimulation.id}/report`,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to download report');
            }

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

                {/* VLM Context Editor */}
                {project.status === 'READY' && project.vlm_generated_context && (
                    <div className="glass-card rounded-2xl p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Ad Analysis</h2>
                            {!isEditingContext && (
                                <button 
                                    onClick={() => {
                                        setContextValue(project.vlm_generated_context || "");
                                        setIsEditingContext(true);
                                    }}
                                    className="p-1.5 rounded-lg glass hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                                    title="Edit Context"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {isEditingContext ? (
                            <div className="space-y-4">
                                <textarea
                                    className="w-full h-48 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/80 resize-none focus:outline-none focus:border-primary-400"
                                    value={contextValue}
                                    onChange={(e) => setContextValue(e.target.value)}
                                />
                                {updateContextMutation.isError && (
                                    <p className="text-xs text-red-500">Failed to save context.</p>
                                )}
                                <div className="flex justify-end gap-3">
                                    <button 
                                        className="px-4 py-2 rounded-xl text-sm font-medium glass hover:bg-white/10 transition-colors"
                                        onClick={() => {
                                            setIsEditingContext(false);
                                            updateContextMutation.reset();
                                        }}
                                        disabled={updateContextMutation.isPending}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        className="btn-primary px-4 py-2 rounded-xl text-sm font-medium flex items-center"
                                        onClick={handleSaveContext}
                                        disabled={updateContextMutation.isPending}
                                    >
                                        {updateContextMutation.isPending && (
                                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        )}
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="max-h-48 overflow-y-auto">
                                <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans">
                                    {project.vlm_generated_context}
                                </pre>
                            </div>
                        )}
                    </div>
                )}

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
                                    <div className="flex border-b border-white/10 mb-6">
                                        <button
                                            className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${agentTab === 'ai' ? 'border-primary-400 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}
                                            onClick={() => setAgentTab('ai')}
                                        >
                                            AI Generated
                                        </button>
                                        <button
                                            className={`flex-1 pb-2 text-sm font-medium transition-colors border-b-2 ${agentTab === 'custom' ? 'border-primary-400 text-white' : 'border-transparent text-white/50 hover:text-white/80'}`}
                                            onClick={() => setAgentTab('custom')}
                                        >
                                            Custom Agents
                                        </button>
                                    </div>

                                    {agentTab === 'ai' ? (
                                        <div className="space-y-4 mb-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Number of AI Agents</label>
                                                <input
                                                    type="number" value={numAgents}
                                                    onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                                    className="input-field" min={5} max={1000} disabled={pollingEnabled}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium mb-2">Simulation Days</label>
                                                <input
                                                    type="number" value={simulationDays}
                                                    onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                                    className="input-field" min={1} max={30} disabled={pollingEnabled}
                                                />
                                            </div>

                                            <div className="border border-white/10 rounded-xl overflow-hidden mt-4">
                                                <button
                                                    onClick={() => setIsDemographicsOpen(!isDemographicsOpen)}
                                                    className="w-full px-4 py-3 flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <span className="text-sm font-semibold">Demographic Filters (Optional)</span>
                                                    {isDemographicsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                                
                                                {isDemographicsOpen && (
                                                    <div className="p-4 bg-white/5 space-y-4">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-xs text-white/70 mb-1">Gender</label>
                                                                <select 
                                                                    className="input-field text-sm p-2"
                                                                    value={demoFilter.gender}
                                                                    onChange={e => setDemoFilter({...demoFilter, gender: e.target.value})}
                                                                >
                                                                    <option value="All">All</option>
                                                                    <option value="Male">Male</option>
                                                                    <option value="Female">Female</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-white/70 mb-1">Location target</label>
                                                                <select 
                                                                    className="input-field text-sm p-2"
                                                                    value={demoFilter.location}
                                                                    onChange={e => setDemoFilter({...demoFilter, location: e.target.value})}
                                                                >
                                                                    <option value="All">All of Sri Lanka</option>
                                                                    <option value="Colombo">Colombo</option>
                                                                    <option value="Kandy">Kandy</option>
                                                                    <option value="Galle">Galle</option>
                                                                    <option value="Jaffna">Jaffna</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4 mb-6">
                                            {customAgents?.length === 0 ? (
                                                <div className="text-center p-4 rounded-xl border border-white/10 bg-white/5">
                                                    <p className="text-sm text-white/60 mb-3">You don't have any custom agents yet.</p>
                                                    <Link href="/dashboard/agents" className="btn-primary py-2 text-sm">
                                                        Go to Agent Builder
                                                    </Link>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex items-center space-x-2 text-sm border border-white/10 rounded-xl p-3 bg-white/5">
                                                        <input 
                                                            type="checkbox" 
                                                            id="useOnlyCustom" 
                                                            className="rounded"
                                                            checked={useCustomAgentsOnly}
                                                            onChange={e => setUseCustomAgentsOnly(e.target.checked)}
                                                        />
                                                        <label htmlFor="useOnlyCustom">Use ONLY selected custom agents</label>
                                                    </div>
                                                    
                                                    {!useCustomAgentsOnly && (
                                                        <div>
                                                            <label className="block text-sm font-medium mb-1">Total Agents (Mixed group)</label>
                                                            <input
                                                                type="number" value={numAgents}
                                                                onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                                                className="input-field" min={5} max={1000} disabled={pollingEnabled}
                                                            />
                                                            <p className="text-xs text-white/50 mt-1">Remaining agent slots will be AI generated.</p>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">Select Agents ({selectedAgentIds.length} active)</label>
                                                        <div className="max-h-48 overflow-y-auto space-y-1 p-2 border border-white/10 rounded-xl">
                                                            {customAgents?.map((ca: any) => (
                                                                <div key={ca.id} className="flex items-center space-x-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                                                                     onClick={() => {
                                                                         setSelectedAgentIds(prev => 
                                                                             prev.includes(ca.id) ? prev.filter(id => id !== ca.id) : [...prev, ca.id]
                                                                         )
                                                                     }}
                                                                >
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={selectedAgentIds.includes(ca.id)}
                                                                        readOnly
                                                                        className="rounded text-primary-500 focus:ring-primary-500"
                                                                    />
                                                                    <span className="text-sm flex-1">{ca.name} <span className="text-white/40">({ca.age}yo)</span></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium mb-2">Simulation Days</label>
                                                        <input
                                                            type="number" value={simulationDays}
                                                            onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                                            className="input-field" min={1} max={30} disabled={pollingEnabled}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

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
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleDownloadReport}
                                        className="btn-primary flex items-center space-x-2 px-4 py-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download Report</span>
                                    </button>
                                </div>

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
