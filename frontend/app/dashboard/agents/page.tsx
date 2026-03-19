'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Users, Plus, ArrowLeft, Loader2, Edit2, Trash2, MapPin, Briefcase, GraduationCap 
} from 'lucide-react';
import { agentsApi } from '@/lib/api';

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
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<any>(null);

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

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <Link href="/dashboard" className="p-2 rounded-xl glass hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center">
                                <Users className="w-8 h-8 mr-3 text-primary-400" />
                                Agent Builder
                            </h1>
                            <p className="text-white/60">Design custom demographic profiles for simulations</p>
                        </div>
                    </div>
                    <button 
                        onClick={openCreateForm}
                        className="btn-primary flex items-center space-x-2"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Create Agent</span>
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : agents?.length === 0 ? (
                    <div className="glass-card rounded-3xl p-16 text-center">
                        <Users className="w-16 h-16 text-white/20 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No Custom Agents</h3>
                        <p className="text-white/60 mb-6 max-w-md mx-auto">
                            You haven't built any custom agents yet. Create some to use them in your simulations alongside or instead of AI-generated agents.
                        </p>
                        <button onClick={openCreateForm} className="btn-primary inline-flex items-center space-x-2">
                            <Plus className="w-5 h-5" />
                            <span>Create First Agent</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {agents?.map((agent: any) => (
                            <div key={agent.id} className="glass-card rounded-2xl overflow-hidden hover-lift flex flex-col">
                                <div className="p-6 flex-1">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-xl font-bold gradient-text pb-1 truncate pr-2">{agent.name}</h3>
                                        <div className="flex gap-2 shrink-0">
                                            <button 
                                                onClick={() => openEditForm(agent)}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if(confirm('Delete this custom agent?')) {
                                                        deleteMutation.mutate(agent.id);
                                                    }
                                                }}
                                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center text-sm text-white/80">
                                            <span className="w-16 text-white/50">Demog:</span>
                                            <span>{agent.age} yo {agent.gender}, {agent.ethnicity}</span>
                                        </div>
                                        <div className="flex items-center text-sm text-white/80">
                                            <MapPin className="w-4 h-4 mr-2 text-primary-400/70" />
                                            <span className="truncate">{agent.location}</span>
                                        </div>
                                        <div className="flex items-center text-sm text-white/80">
                                            <Briefcase className="w-4 h-4 mr-2 text-accent-400/70" />
                                            <span className="truncate">{agent.occupation || 'Unspecified'}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {agent.personality_traits?.slice(0,3).map((t: string) => (
                                            <span key={t} className="text-xs px-2 py-1 rounded-full bg-primary-500/20 text-primary-200 border border-primary-500/10">
                                                {t}
                                            </span>
                                        ))}
                                        {agent.values?.slice(0,2).map((v: string) => (
                                            <span key={v} className="text-xs px-2 py-1 rounded-full bg-accent-500/20 text-accent-200 border border-accent-500/10">
                                                {v.replace('_', ' ')}
                                            </span>
                                        ))}
                                        {(agent.personality_traits?.length > 3 || agent.values?.length > 2) && (
                                            <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/60">...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeForm} />
                    <div className="relative glass-card w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 border border-white/20 shadow-2xl">
                        <h2 className="text-2xl font-bold mb-6">
                            {editingAgent ? 'Edit Custom Agent' : 'Create New Agent'}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Basic Info</h3>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-white/70">Full Name</label>
                                        <input required name="name" value={formData.name} onChange={handleChange} className="input-field" placeholder="e.g. Nuwan Perera" />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Age</label>
                                            <input required type="number" name="age" value={formData.age} onChange={handleNumberChange} min={18} max={100} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Gender</label>
                                            <select name="gender" value={formData.gender} onChange={handleChange} className="input-field">
                                                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-white/70">Location</label>
                                        <select name="location" value={formData.location} onChange={handleChange} className="input-field">
                                            {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Religion</label>
                                            <select name="religion" value={formData.religion} onChange={handleChange} className="input-field">
                                                {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Ethnicity</label>
                                            <select name="ethnicity" value={formData.ethnicity} onChange={handleChange} className="input-field">
                                                {ETHNICITIES.map(e => <option key={e} value={e}>{e}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Socioeconomic Info */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Socioeconomic</h3>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-white/70">Occupation</label>
                                        <input name="occupation" value={formData.occupation} onChange={handleChange} className="input-field" placeholder="e.g. Software Engineer" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-white/70">Education</label>
                                        <input name="education" value={formData.education} onChange={handleChange} className="input-field" placeholder="e.g. Bachelor's Degree" />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm mb-1 text-white/70">Income Level</label>
                                        <select name="income_level" value={formData.income_level} onChange={handleChange} className="input-field">
                                            {INCOME_LEVELS.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Social Media</label>
                                            <select name="social_media_usage" value={formData.social_media_usage} onChange={handleChange} className="input-field">
                                                {SOCIAL_MEDIA_USAGE.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm mb-1 text-white/70">Politics</label>
                                            <select name="political_leaning" value={formData.political_leaning} onChange={handleChange} className="input-field">
                                                {POLITICAL_LEANING.map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Traits & Values */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold border-b border-white/10 pb-2">Psychographics</h3>
                                
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm mb-2 text-white/70">Personality Traits</label>
                                        <div className="flex flex-wrap gap-2">
                                            {PERSONALITY_TRAITS.map(trait => (
                                                <button
                                                    key={trait} type="button"
                                                    onClick={() => toggleArrayItem('personality_traits', trait)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                                                        formData.personality_traits.includes(trait)
                                                        ? 'bg-primary-500 text-white' : 'glass hover:bg-white/10 text-white/60'
                                                    }`}
                                                >
                                                    {trait}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm mb-2 text-white/70">Core Values</label>
                                        <div className="flex flex-wrap gap-2">
                                            {VALUES_LIST.map(val => (
                                                <button
                                                    key={val} type="button"
                                                    onClick={() => toggleArrayItem('values', val)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs transition-colors ${
                                                        formData.values.includes(val)
                                                        ? 'bg-accent-500 text-white' : 'glass hover:bg-white/10 text-white/60'
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
                                <label className="block text-sm mb-1 text-white/70">Background / Bio (Optional)</label>
                                <textarea 
                                    name="bio" value={formData.bio} onChange={handleChange} 
                                    className="input-field h-24 resize-none" 
                                    placeholder="Add any specific background details or context for this agent..."
                                />
                            </div>

                            <div className="flex justify-end gap-4 pt-6 border-t border-white/10">
                                <button type="button" onClick={closeForm} className="px-6 py-2.5 rounded-xl glass hover:bg-white/10 transition-colors">
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="btn-primary px-8 py-2.5 flex items-center"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
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
