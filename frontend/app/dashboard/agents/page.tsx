'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Users, Plus, ArrowLeft, Loader2, Edit2, Trash2, MapPin, Briefcase, GraduationCap, LogOut, FileBadge2, MoreVertical
} from 'lucide-react';
import { agentsApi, authApi, getStoredToken } from '@/lib/api';
import { useAuthStore } from '@/lib/store';



const LOCATIONS = [
    "Colombo", "Dehiwala-Mount Lavinia", "Moratuwa", "Negombo", "Sri Jayawardenepura Kotte", 
    "Kandy", "Galle", "Jaffna", "Trincomalee", "Batticaloa", "Anuradhapura", "Polonnaruwa", 
    "Kurunegala", "Ratnapura", "Badulla", "Matara", "Hambantota", "Vavuniya", "Nuwara Eliya", 
    "Kalmunai", "Ampara", "Kalutara", "Gampaha", "Puttalam", "Mannar"
];
const GENDERS = ["Male", "Female"];
const INCOME_LEVELS = ["Below Poverty Line", "Lower Income", "Lower Middle Income", "Middle Income", "Upper Middle Income", "Upper Income"];
const RELIGIONS = ["Buddhist", "Hindu", "Muslim", "Christian"];
const ETHNICITIES = ["Sinhalese", "Tamil", "Moor", "Burgher"];
const SOCIAL_MEDIA_USAGE = ["Very High", "High", "Moderate", "Low", "None"];
const POLITICAL_LEANING = ["Progressive", "Moderate", "Conservative", "Nationalist", "Apolitical"];
const VALUES_LIST = [
    "family_oriented", "traditional", "modern", "environmentally_conscious",
    "religious", "career_focused", "community_oriented", "individualistic",
    "health_conscious", "tech_savvy", "budget_conscious", "luxury_oriented",
    "socially_aware", "politically_active"
];
const PERSONALITY_TRAITS = [
    "Analytical", "Empathetic", "Traditional", "Ambitious", 
    "Skeptical", "Optimistic", "Cautious", "Social", 
    "Independent", "Loyal", "Creative", "Pragmatic"
];

export default function AgentBuilderPage() {
    const router = useRouter();
    const { user, setUser, logout } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check auth on mount
        const checkAuth = async () => {
            const token = getStoredToken();
            if (!token) {
                router.push('/login');
                return;
            }
            try {
                const userData = await authApi.getMe();
                setUser(userData);
            } catch (error: any) {
                const status = error?.response?.status;
                if (status === 401 || status === 403) {
                    router.push('/login');
                }
            }
        };
        checkAuth();
    }, []);

    const handleLogout = () => {
        authApi.logout();
        logout();
        router.push('/');
    };

    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any>(null);
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        age: 30,
        gender: 'Male',
        location: 'Colombo',
        occupation: '',
        education: '',
        income_level: 'Middle Income',
        religion: 'Buddhist',
        ethnicity: 'Sinhalese',
        social_media_usage: 'Moderate',
        political_leaning: 'Moderate',
        values: [] as string[],
        personality_traits: [] as string[],
        bio: ''
    });

    const { data: agents, isLoading } = useQuery({
        queryKey: ['customAgents'],
        queryFn: agentsApi.list,
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => agentsApi.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customAgents'] });
            closeForm();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => agentsApi.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customAgents'] });
            closeForm();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: agentsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customAgents'] });
        }
    });

    const openCreateForm = () => {
        setEditingAgent(null);
        setFormData({
            name: '', age: 30, gender: 'Male', location: 'Colombo',
            occupation: '', education: '', income_level: 'Middle Income',
            religion: 'Buddhist', ethnicity: 'Sinhalese', social_media_usage: 'Moderate',
            political_leaning: 'Moderate', values: [], personality_traits: [], bio: ''
        });
        setIsFormOpen(true);
    };

    const openEditForm = (agent: any) => {
        setEditingAgent(agent);
        setFormData({
            name: agent.name || '',
            age: agent.age || 30,
            gender: agent.gender || 'Male',
            location: agent.location || 'Colombo',
            occupation: agent.occupation || '',
            education: agent.education || '',
            income_level: agent.income_level || 'Middle Income',
            religion: agent.religion || 'Buddhist',
            ethnicity: agent.ethnicity || 'Sinhalese',
            social_media_usage: agent.social_media_usage || 'Moderate',
            political_leaning: agent.political_leaning || 'Moderate',
            values: agent.values || [],
            personality_traits: agent.personality_traits || [],
            bio: agent.bio || ''
        });
        setIsFormOpen(true);
    };

    const closeForm = () => {
        setIsFormOpen(false);
        setEditingAgent(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    };

    const toggleArrayItem = (field: 'values' | 'personality_traits', item: string) => {
        setFormData(prev => {
            const arr = prev[field] as string[];
            if (arr.includes(item)) {
                return { ...prev, [field]: arr.filter(i => i !== item) };
            } else {
                return { ...prev, [field]: [...arr, item] };
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingAgent) {
            updateMutation.mutate({ id: editingAgent.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const toggleMenu = (id: string) => {
        if (menuOpenId === id) {
            setMenuOpenId(null);
        } else {
            setMenuOpenId(id);
        }
    };

    if (!mounted) return null;

    return (
        
        <div onClick={() => setMenuOpenId(null)}>
            <main className="mx-auto max-w-[1280px] px-6 py-8">
                <div className="mb-7 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f9fafb] transition-colors">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-5xl font-semibold tracking-tight">Agents</h1>
                    </div>
                    <button 
                        onClick={openCreateForm}
                        className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 hover:scale-105 transition"
                    >
                        <Plus className="h-4 w-4" />
                        New Agent
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="w-8 h-8 animate-spin text-[#4b5563]" />
                    </div>
                ) : agents?.length === 0 ? (
                    <div className="rounded-lg border border-[#d1d5db] bg-white p-14 text-center">
                        <Users className="mx-auto mb-4 h-12 w-12 text-[#9ca3af]" />
                        <h3 className="mb-2 text-xl font-semibold">No Custom Agents</h3>
                        <p className="mb-7 text-[#6b7280]">
                            You haven't built any custom agents yet. Create some to use them in your simulations.
                        </p>
                        <button onClick={openCreateForm} className="inline-flex items-center gap-2 rounded-md border border-cyan-500/40 shadow-lg shadow-cyan-500/40 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#f9fafb]">
                            <Plus className="w-5 h-5" />
                            <span>Create First Agent</span>
                        </button>
                    </div>
                ) : (
                    <div className=" rounded-md border border-[#d1d5db] bg-white">
                        <table className="w-full table-fixed">
                            <thead className="bg-[#f3f4f6] text-left text-sm font-semibold text-[#374151]">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4 w-24">Age</th>
                                    <th className="px-6 py-4 w-32">Gender</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4">Career</th>
                                    <th className="px-6 py-4 w-40 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents?.map((agent: any) => (
                                    <tr
                                        key={agent.id}
                                        className="border-t border-[#e5e7eb] transition-colors hover:bg-[#f9fafb]"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-12 w-16 overflow-hidden rounded border border-[#e5e7eb] bg-[#eef2ff] items-center justify-center shrink-0">
                                                    <Users className="h-5 w-5 text-[#4f46e5]" />
                                                </div>
                                                <span className="truncate font-semibold text-[#111827]">{agent.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#4b5563]">{agent.age}</td>
                                        <td className="px-6 py-4 text-sm text-[#4b5563]">{agent.gender}</td>
                                        <td className="px-6 py-4 text-sm text-[#4b5563]">{agent.location}</td>
                                        <td className="px-6 py-4 text-sm text-[#4b5563] truncate" title={agent.occupation || 'Unspecified'}>
                                            {agent.occupation || 'Unspecified'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end relative" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => toggleMenu(agent.id)}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
                                                >
                                                    <MoreVertical className="h-5 w-5" />
                                                </button>
                                                
                                                {menuOpenId === agent.id && (
                                                    <div className="absolute right-0 top-full mt-1 w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 border border-[#e5e7eb] divide-y divide-[#f3f4f6]">
                                                        <button
                                                            onClick={() => {
                                                                setMenuOpenId(null);
                                                                openEditForm(agent);
                                                            }}
                                                            className="block w-full px-4 py-2 text-sm text-left text-[#374151] hover:bg-[#f9fafb] font-medium"
                                                        >
                                                            See More
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setMenuOpenId(null);
                                                                if(confirm('Delete this custom agent?')) {
                                                                    deleteMutation.mutate(agent.id);
                                                                }
                                                            }}
                                                            className="block w-full px-4 py-2 text-sm text-left text-[#ef4444] hover:bg-[#fef2f2] font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="absolute inset-0" onClick={closeForm} />
                    <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#e5e7eb] bg-white p-8 shadow-2xl text-[#111827]">
                        <h2 className="text-2xl font-bold mb-6">
                            {editingAgent ? 'Edit Custom Agent' : 'Create New Agent'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b border-[#e5e7eb] pb-2">Basic Info</h3>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-[#4b5563]">Full Name</label>
                                        <input required name="name" value={formData.name} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" placeholder="e.g. Nuwan Perera" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Age</label>
                                            <input required type="number" name="age" value={formData.age} onChange={handleNumberChange} min={18} max={100} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" />
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-[#4b5563]">Location</label>
                                        <select name="location" value={formData.location} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Religion</label>
                                            <select name="religion" value={formData.religion} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Ethnicity</label>
                                            <select name="ethnicity" value={formData.ethnicity} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                                {ETHNICITIES.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Socioeconomic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b border-[#e5e7eb] pb-2">Socioeconomic</h3>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-[#4b5563]">Occupation</label>
                                        <input name="occupation" value={formData.occupation} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" placeholder="e.g. Software Engineer" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-[#4b5563]">Education</label>
                                        <input name="education" value={formData.education} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]" placeholder="e.g. Bachelor's Degree" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-[#4b5563]">Income Level</label>
                                        <select name="income_level" value={formData.income_level} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                            {INCOME_LEVELS.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Social Media</label>
                                            <select name="social_media_usage" value={formData.social_media_usage} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                                {SOCIAL_MEDIA_USAGE.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-[#4b5563]">Politics</label>
                                            <select name="political_leaning" value={formData.political_leaning} onChange={handleChange} className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f]">
                                                {POLITICAL_LEANING.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Traits & Values */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold border-b border-[#e5e7eb] pb-2">Psychographics</h3>
                                
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm mb-2 text-[#4b5563]">Personality Traits</label>
                                        <div className="flex flex-wrap gap-2">
                                            {PERSONALITY_TRAITS.map(trait => (
                                                <button
                                                    key={trait} type="button"
                                                    onClick={() => toggleArrayItem('personality_traits', trait)}
                                                    className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                                                        formData.personality_traits.includes(trait)
                                                        ? 'bg-[#00897f] border-[#00897f] text-white' : 'bg-[#f9fafb] border-[#d1d5db] text-[#4b5563] hover:bg-[#f3f4f6]'
                                                    }`}
                                                >
                                                    {trait}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-2 text-[#4b5563]">Core Values</label>
                                        <div className="flex flex-wrap gap-2">
                                            {VALUES_LIST.map(val => (
                                                <button
                                                    key={val} type="button"
                                                    onClick={() => toggleArrayItem('values', val)}
                                                    className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                                                        formData.values.includes(val)
                                                        ? 'bg-[#00897f] border-[#00897f] text-white' : 'bg-[#f9fafb] border-[#d1d5db] text-[#4b5563] hover:bg-[#f3f4f6]'
                                                    }`}
                                                >
                                                    {val.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Bio */}
                            <div>
                                <label className="block text-sm mb-1 text-[#4b5563]">Background / Bio (Optional)</label>
                                <textarea 
                                    name="bio" value={formData.bio} onChange={handleChange} 
                                    className="w-full rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-sm focus:border-[#00897f] focus:outline-none focus:ring-1 focus:ring-[#00897f] h-24 resize-none" 
                                    placeholder="Add any specific background details or context for this agent..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-[#e5e7eb]">
                                <button type="button" onClick={closeForm} className="rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]">
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-cyan-500/30 hover:scale-105 transition disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    {editingAgent ? 'Save Changes' : 'Create Agent'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
