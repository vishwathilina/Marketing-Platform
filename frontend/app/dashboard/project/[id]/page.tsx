'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    Play,
    Loader2,
    CheckCircle,
    Edit2,
    History,
    Clock,
    XCircle,
    ChevronDown,
    ChevronUp,
    X,
    Users,
} from 'lucide-react';
import { projectsApi, simulationsApi, agentsApi } from '@/lib/api';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [showRunModal, setShowRunModal] = useState(false);
    const [numAgents, setNumAgents] = useState(100);
    const [simulationDays, setSimulationDays] = useState(5);
    const [agentTab, setAgentTab] = useState<'ai' | 'custom'>('ai');
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
    const [useCustomAgentsOnly, setUseCustomAgentsOnly] = useState(false);
    const [isDemographicsOpen, setIsDemographicsOpen] = useState(false);
    const [demoFilter, setDemoFilter] = useState({
        age_range: [18, 65],
        gender: 'All',
        location: 'All',
        income_level: [] as string[],
        religion: [] as string[],
    });

    const [isEditingContext, setIsEditingContext] = useState(false);
    const [contextValue, setContextValue] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const queryClient = useQueryClient();

    const { data: customAgents } = useQuery({
        queryKey: ['customAgents'],
        queryFn: agentsApi.list,
        enabled: mounted,
    });

    const { data: project, isLoading: projectLoading } = useQuery({
        queryKey: ['project', projectId],
        queryFn: () => projectsApi.get(projectId),
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return status && status !== 'READY' && status !== 'FAILED' ? 5000 : false;
        },
    });

    const { data: existingSimulations } = useQuery({
        queryKey: ['simulations', projectId],
        queryFn: () => simulationsApi.listForProject(projectId),
        enabled: !!project,
        refetchOnWindowFocus: false,
    });

    const updateContextMutation = useMutation({
        mutationFn: (context: string) => projectsApi.updateContext(projectId, context),
        onSuccess: (updatedProject) => {
            queryClient.setQueryData(['project', projectId], updatedProject);
            setIsEditingContext(false);
        },
    });

    const startSimulation = useMutation({
        mutationFn: (payload: any) => simulationsApi.start(projectId, payload),
        onSuccess: (data) => {
            // Navigate to the simulation results page immediately
            router.push(`/dashboard/project/${projectId}/simulation/${data.id}`);
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

    const statusConfig: Record<string, { label: string; cls: string; icon: ReactNode }> = {
        COMPLETED: { label: 'Completed', cls: 'text-emerald-400 bg-emerald-400/10', icon: <CheckCircle className="w-3 h-3" /> },
        RUNNING: { label: 'Running', cls: 'text-primary-400 bg-primary-400/10', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
        PENDING: { label: 'Pending', cls: 'text-yellow-400 bg-yellow-400/10', icon: <Clock className="w-3 h-3" /> },
        FAILED: { label: 'Failed', cls: 'text-red-400 bg-red-400/10', icon: <XCircle className="w-3 h-3" /> },
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center space-x-4 mb-8">
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-xl glass hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold">{project.title}</h1>
                        <p className="text-white/60">
                            Status: {project.status} • Created {new Date(project.created_at).toLocaleDateString()}
                        </p>
                    </div>

                    {project.status === 'READY' && (
                        <button
                            onClick={() => setShowRunModal(true)}
                            className="btn-primary flex items-center space-x-2 px-5 py-2.5"
                        >
                            <Play className="w-5 h-5" />
                            <span>Run New Simulation</span>
                        </button>
                    )}
                </div>

                {/* Video Preview (HuggingFace URL) */}
                {project.video_path?.startsWith('https://') && (
                    <div className="glass-card rounded-2xl p-6 mb-8">
                        <h2 className="text-lg font-semibold mb-4">Ad Video Preview</h2>
                        <video
                            src={project.video_path}
                            controls
                            className="w-full rounded-xl max-h-96 bg-black/20"
                            preload="metadata"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                {/* Ad Analysis */}
                {project.status === 'READY' && project.vlm_generated_context && (
                    <div className="glass-card rounded-2xl p-6 mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">Ad Analysis</h2>
                            {!isEditingContext && (
                                <button
                                    onClick={() => {
                                        setContextValue(project.vlm_generated_context || '');
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
                                        onClick={() => updateContextMutation.mutate(contextValue)}
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

                {/* Video processing state */}
                {project.status !== 'READY' && project.status !== 'FAILED' && (
                    <div className="glass-card rounded-2xl p-10 text-center mb-8">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary-400" />
                        <p className="text-white/60">Video is being processed...</p>
                        <p className="text-sm text-white/40 mt-2">This may take a few minutes</p>
                    </div>
                )}

                {/* Past Simulations */}
                <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <History className="w-5 h-5 text-primary-400" />
                        <h2 className="text-lg font-semibold">Past Simulations</h2>
                    </div>

                    {!existingSimulations || existingSimulations.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-white/40 text-sm">No simulations yet for this project.</p>
                            {project.status === 'READY' && (
                                <button
                                    onClick={() => setShowRunModal(true)}
                                    className="btn-primary inline-flex items-center space-x-2 mt-4 px-4 py-2 text-sm"
                                >
                                    <Play className="w-4 h-4" />
                                    <span>Run First Simulation</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {existingSimulations.map((sim: any) => {
                                const simDate = new Date(sim.created_at).toLocaleString(undefined, {
                                    month: 'short', day: 'numeric',
                                    hour: '2-digit', minute: '2-digit',
                                });
                                const sc = statusConfig[sim.status] ?? statusConfig.PENDING;

                                return (
                                    <Link
                                        key={sim.id}
                                        href={`/dashboard/project/${projectId}/simulation/${sim.id}`}
                                        className="flex items-center justify-between w-full rounded-xl px-4 py-3 border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all"
                                    >
                                        <div>
                                            <p className="text-sm text-white/80 font-medium">{simDate}</p>
                                            <div className="flex gap-4 mt-1 text-xs text-white/50">
                                                {sim.num_agents && <span>{sim.num_agents} agents</span>}
                                                {sim.simulation_days && <span>{sim.simulation_days} days</span>}
                                            </div>
                                        </div>
                                        <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sc.cls}`}>
                                            {sc.icon}
                                            {sc.label}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Run New Simulation Modal */}
            {showRunModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => !startSimulation.isPending && setShowRunModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative glass-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">Run New Simulation</h2>
                            <button
                                onClick={() => setShowRunModal(false)}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                disabled={startSimulation.isPending}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Agent tabs */}
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
                                        type="number"
                                        value={numAgents}
                                        onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                        className="input-field"
                                        min={5} max={1000}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">Simulation Days</label>
                                    <input
                                        type="number"
                                        value={simulationDays}
                                        onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                        className="input-field"
                                        min={1} max={30}
                                    />
                                </div>

                                <div className="border border-white/10 rounded-xl overflow-hidden">
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
                                                        onChange={e => setDemoFilter({ ...demoFilter, gender: e.target.value })}
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
                                                        onChange={e => setDemoFilter({ ...demoFilter, location: e.target.value })}
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
                                                    className="input-field" min={5} max={1000}
                                                />
                                                <p className="text-xs text-white/50 mt-1">Remaining agent slots will be AI generated.</p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium mb-2">Select Agents ({selectedAgentIds.length} selected)</label>
                                            <div className="max-h-48 overflow-y-auto space-y-1 p-2 border border-white/10 rounded-xl">
                                                {customAgents?.map((ca: any) => (
                                                    <div
                                                        key={ca.id}
                                                        className="flex items-center space-x-3 p-2 hover:bg-white/5 rounded-lg cursor-pointer"
                                                        onClick={() => {
                                                            setSelectedAgentIds(prev =>
                                                                prev.includes(ca.id) ? prev.filter(id => id !== ca.id) : [...prev, ca.id]
                                                            );
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
                                                className="input-field" min={1} max={30}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {startSimulation.isError && (
                            <p className="text-sm text-red-400 mb-4">Failed to start simulation. Please try again.</p>
                        )}

                        <button
                            type="button"
                            onClick={handleStartSimulation}
                            disabled={startSimulation.isPending}
                            className="w-full btn-primary py-3 flex items-center justify-center disabled:opacity-50"
                        >
                            {startSimulation.isPending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 mr-2" />
                                    Start Simulation
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
