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
            <div className="flex h-[calc(100vh-64px)] items-center justify-center">
                <div className="spinner" />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-[calc(100vh-64px)] items-center justify-center">
                <p>Project not found</p>
            </div>
        );
    }

    const statusConfig: Record<string, { label: string; cls: string; icon: ReactNode }> = {
        COMPLETED: { label: 'Completed', cls: 'text-[#059669] bg-[#d1fae5] border border-[#a7f3d0]', icon: <CheckCircle className="w-3 h-3" /> },
        RUNNING: { label: 'Running', cls: 'text-[#0284c7] bg-[#d1e8ff] border border-[#bae6fd]', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
        PENDING: { label: 'Pending', cls: 'text-[#d97706] bg-[#fef3c7] border border-[#fde68a]', icon: <Clock className="w-3 h-3" /> },
        FAILED: { label: 'Failed', cls: 'text-[#dc2626] bg-[#fee2e2] border border-[#fecaca]', icon: <XCircle className="w-3 h-3" /> },
        READY: { label: 'Ready', cls: 'text-[#059669] bg-[#d1fae5] border border-[#a7f3d0]', icon: <CheckCircle className="w-3 h-3" /> },
    };

    return (
        <div className="bg-[#f3f3f1] text-[#101828]">
            <main className="mx-auto max-w-[1280px] px-6 py-8">
                {/* Header */}
                <div className="mb-8 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f9fafb] transition-colors shadow-sm">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-semibold text-[#111827]">{project.title}</h1>
                            <p className="text-[#6b7280] mt-1 text-sm">
                                Status: {project.status} • Created {new Date(project.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    {project.status === 'READY' && (
                        <button
                            onClick={() => setShowRunModal(true)}
                            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 hover:scale-105 transition"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            Run New Simulation
                        </button>
                    )}
                </div>

                {/* Video Preview (HuggingFace URL) */}
                {project.video_path?.startsWith('https://') && (
                    <div className="border border-[#e5e7eb] bg-white p-6 shadow-sm mb-6">
                        <h2 className="text-xl font-bold text-[#111827] mb-4">Ad Video Preview</h2>
                        <video
                            src={project.video_path}
                            controls
                            className="w-full  max-h-[500px] bg-black"
                            preload="metadata"
                        >
                            Your browser does not support the video tag.
                        </video>
                    </div>
                )}

                {/* Video processing state */}
                {project.status !== 'READY' && project.status !== 'FAILED' && (
                    <div className="rounded-xl border border-[#e5e7eb] bg-white p-10 text-center mb-6 shadow-sm">
                        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-[#00897f]" />
                        <p className="text-[#374151] font-medium">Video is being processed...</p>
                        <p className="text-sm text-[#6b7280] mt-2">This may take a few minutes</p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Ad Analysis */}
                    <div className=" border border-[#e5e7eb] bg-white p-6 shadow-sm h-[600px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-[#111827]">Ad Analysis</h2>
                            {project.status === 'READY' && project.vlm_generated_context && !isEditingContext && (
                                <button
                                    onClick={() => {
                                        setContextValue(project.vlm_generated_context || '');
                                        setIsEditingContext(true);
                                    }}
                                    className="p-1.5 rounded-full border border-[#d1d5db] bg-white hover:bg-[#f9fafb] transition-colors text-[#00897f]"
                                    title="Edit Context"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {project.status === 'READY' && project.vlm_generated_context ? (
                                isEditingContext ? (
                                    <div className="space-y-4 h-full flex flex-col">
                                        <textarea
                                            className="flex-1 w-full rounded-md border border-[#d1d5db] bg-white p-3 text-sm text-[#374151] focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f] resize-none"
                                            value={contextValue}
                                            onChange={(e) => setContextValue(e.target.value)}
                                        />
                                        {updateContextMutation.isError && (
                                            <p className="text-xs text-red-500">Failed to save context.</p>
                                        )}
                                        <div className="flex justify-end gap-3 pt-2">
                                            <button
                                                className="rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
                                                onClick={() => {
                                                    setIsEditingContext(false);
                                                    updateContextMutation.reset();
                                                }}
                                                disabled={updateContextMutation.isPending}
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                className="inline-flex items-center gap-2 rounded-md bg-[#00897f] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#007a71] disabled:opacity-70"
                                                onClick={() => updateContextMutation.mutate(contextValue)}
                                                disabled={updateContextMutation.isPending}
                                            >
                                                {updateContextMutation.isPending && (
                                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                )}
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-[#4b5563] text-[15px] leading-relaxed whitespace-pre-wrap font-sans">
                                        {project.vlm_generated_context}
                                    </div>
                                )
                            ) : (
                                <div className="flex h-full items-center justify-center text-[#9ca3af] italic text-sm">
                                    No analysis available yet.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Steps to Select Agents & Past Simulations */}
                    <div className="flex flex-col gap-6 h-[600px]">
                        {/* Steps to Select Agents */}
                        <div className="border border-[#e5e7eb] bg-white p-6 shadow-sm overflow-y-auto custom-scrollbar flex-shrink-0">
                            <h2 className="text-2xl font-bold text-[#111827] mb-5">Steps to Run Simulation</h2>
                            <ol className="space-y-4 text-[#4b5563] text-[15px] leading-relaxed list-decimal pl-5">
                                <li className="pl-1">Choose the simulation mode: AI generated agents or your custom agents.</li>
                                <li className="pl-1">Set the number of agents and simulation days based on campaign scope.</li>
                                <li className="pl-1">Apply demographic filters or select custom profiles relevant to this ad audience.</li>
                                <li className="pl-1">Review your setup and run the simulation to generate sentiment and risk insights.</li>
                            </ol>
                        </div>

                        {/* Past Simulations */}
                        <div className=" border border-[#e5e7eb] bg-white p-6 shadow-sm flex-1 flex flex-col overflow-hidden">
                            <div className="flex items-center gap-2 mb-4">
                                <History className="h-6 w-6 text-[#00897f]" />
                                <h2 className="text-2xl font-bold text-[#111827]">Past Simulations</h2>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 mt-2">
                                {!existingSimulations || existingSimulations.length === 0 ? (
                                    <div className="flex h-full flex-col justify-center items-center pb-4">
                                        <p className="text-[#6b7280] text-[15px]">No simulations yet for this project.</p>
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
                                                    className="flex items-center justify-between w-full rounded-lg border border-[#e5e7eb] bg-white px-4 py-3 hover:bg-[#f9fafb] transition-colors shadow-sm"
                                                >
                                                    <div>
                                                        <p className="text-sm font-semibold text-[#111827]">{simDate}</p>
                                                        <div className="flex gap-4 mt-1 text-xs text-[#6b7280]">
                                                            {sim.num_agents && <span>{sim.num_agents} agents</span>}
                                                            {sim.simulation_days && <span>{sim.simulation_days} days</span>}
                                                        </div>
                                                    </div>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${sc.cls}`}>
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
                    </div>
                </div>
            </main>

            {/* Run New Simulation Modal */}
            {showRunModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => !startSimulation.isPending && setShowRunModal(false)}
                    />

                    {/* Modal */}
                    <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl text-[#111827] custom-scrollbar">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">Run New Simulation</h2>
                            <button
                                onClick={() => setShowRunModal(false)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6]"
                                disabled={startSimulation.isPending}
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Agent tabs */}
                        <div className="flex border-b border-[#e5e7eb] mb-6">
                            <button
                                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${agentTab === 'ai' ? 'border-[#00897f] text-[#00897f]' : 'border-transparent text-[#6b7280] hover:text-[#374151]'}`}
                                onClick={() => setAgentTab('ai')}
                            >
                                AI Generated
                            </button>
                            <button
                                className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${agentTab === 'custom' ? 'border-[#00897f] text-[#00897f]' : 'border-transparent text-[#6b7280] hover:text-[#374151]'}`}
                                onClick={() => setAgentTab('custom')}
                            >
                                Custom Agents
                            </button>
                        </div>

                        {agentTab === 'ai' ? (
                            <div className="space-y-5 mb-6">
                                <div>
                                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Number of AI Agents</label>
                                    <input
                                        type="number"
                                        value={numAgents}
                                        onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                        className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]"
                                        min={5} max={1000}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-[#374151] mb-1.5">Simulation Days</label>
                                    <input
                                        type="number"
                                        value={simulationDays}
                                        onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                        className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]"
                                        min={1} max={30}
                                    />
                                </div>

                                <div className="border border-[#e5e7eb] rounded-lg overflow-hidden bg-[#f9fafb]">
                                    <button
                                        onClick={() => setIsDemographicsOpen(!isDemographicsOpen)}
                                        className="w-full px-4 py-3 flex justify-between items-center hover:bg-[#f3f4f6] transition-colors"
                                    >
                                        <span className="text-sm font-semibold text-[#374151]">Demographic Filters (Optional)</span>
                                        {isDemographicsOpen ? <ChevronUp className="h-4 w-4 text-[#6b7280]" /> : <ChevronDown className="h-4 w-4 text-[#6b7280]" />}
                                    </button>

                                    {isDemographicsOpen && (
                                        <div className="p-4 border-t border-[#e5e7eb] bg-white space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-[#6b7280] mb-1">Gender</label>
                                                    <select
                                                        className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]"
                                                        value={demoFilter.gender}
                                                        onChange={e => setDemoFilter({ ...demoFilter, gender: e.target.value })}
                                                    >
                                                        <option value="All">All</option>
                                                        <option value="Male">Male</option>
                                                        <option value="Female">Female</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-[#6b7280] mb-1">Location target</label>
                                                    <select
                                                        className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]"
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
                            <div className="space-y-5 mb-6">
                                {customAgents?.length === 0 ? (
                                    <div className="text-center p-6 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]">
                                        <p className="text-sm text-[#6b7280] mb-4">You don't have any custom agents yet.</p>
                                        <Link href="/dashboard/agents" className="inline-flex items-center gap-2 rounded-md border border-[#d1d5db] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#f3f4f6]">
                                            Go to Agent Builder
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center space-x-3 text-sm border border-[#e5e7eb] rounded-lg p-3 bg-[#f9fafb]">
                                            <input
                                                type="checkbox"
                                                id="useOnlyCustom"
                                                className="rounded border-[#d1d5db] text-[#00897f] focus:ring-[#00897f]"
                                                checked={useCustomAgentsOnly}
                                                onChange={e => setUseCustomAgentsOnly(e.target.checked)}
                                            />
                                            <label htmlFor="useOnlyCustom" className="font-medium text-[#374151] cursor-pointer">Use ONLY selected custom agents</label>
                                        </div>

                                        {!useCustomAgentsOnly && (
                                            <div>
                                                <label className="block text-sm font-semibold text-[#374151] mb-1.5">Total Agents (Mixed group)</label>
                                                <input
                                                    type="number" value={numAgents}
                                                    onChange={(e) => setNumAgents(Math.max(5, Math.min(1000, parseInt(e.target.value) || 5)))}
                                                    className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" min={5} max={1000}
                                                />
                                                <p className="text-xs text-[#6b7280] mt-1.5">Remaining agent slots will be AI generated.</p>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-semibold text-[#374151] mb-2">Select Agents ({selectedAgentIds.length} selected)</label>
                                            <div className="max-h-48 overflow-y-auto space-y-1 p-2 border border-[#e5e7eb] rounded-lg bg-white custom-scrollbar">
                                                {customAgents?.map((ca: any) => (
                                                    <div
                                                        key={ca.id}
                                                        className="flex items-center space-x-3 p-2 hover:bg-[#f9fafb] rounded-md cursor-pointer border border-transparent hover:border-[#e5e7eb]"
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
                                                            className="rounded border-[#d1d5db] text-[#00897f] focus:ring-[#00897f]"
                                                        />
                                                        <span className="text-sm font-medium text-[#111827] flex-1">{ca.name} <span className="text-[#6b7280] font-normal">({ca.age}yo)</span></span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-[#374151] mb-1.5">Simulation Days</label>
                                            <input
                                                type="number" value={simulationDays}
                                                onChange={(e) => setSimulationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                                className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" min={1} max={30}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {startSimulation.isError && (
                            <p className="text-sm font-medium text-red-600 bg-red-50 py-2 px-3 rounded-md mb-4">Failed to start simulation. Please try again.</p>
                        )}

                        <button
                            type="button"
                            onClick={handleStartSimulation}
                            disabled={startSimulation.isPending}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/30 hover:scale-[1.02] transition disabled:opacity-70 disabled:hover:scale-100"
                        >
                            {startSimulation.isPending ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="h-5 w-5 fill-current" />
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
