'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Zap,
    Plus,
    FileVideo,
    Clock,
    CheckCircle,
    AlertCircle,
    LogOut,
    Loader2,
    TrendingUp,
    Trash2
} from 'lucide-react';
import { projectsApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
    const router = useRouter();
    const { user, setUser, logout } = useAuthStore();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Check auth on mount
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }
            try {
                const userData = await authApi.getMe();
                setUser(userData);
            } catch {
                router.push('/login');
            }
        };
        checkAuth();
    }, []);

    const queryClient = useQueryClient();

    const { data: projects, isLoading } = useQuery({
        queryKey: ['projects'],
        queryFn: projectsApi.list,
        enabled: mounted,
    });

    const deleteMutation = useMutation({
        mutationFn: projectsApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
        },
    });

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this project?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleLogout = () => {
        authApi.logout();
        logout();
        router.push('/');
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'READY':
                return <CheckCircle className="w-5 h-5 text-emerald-400" />;
            case 'PROCESSING':
                return <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />;
            case 'FAILED':
                return <AlertCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Clock className="w-5 h-5 text-yellow-400" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'READY':
                return 'Ready';
            case 'PROCESSING':
                return 'Processing';
            case 'FAILED':
                return 'Failed';
            default:
                return 'Pending';
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen">
            {/* Sidebar */}
            <aside className="fixed left-0 top-0 w-64 h-full glass border-r border-white/10 p-6">
                <div className="flex items-center space-x-2 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
                        <Zap className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold gradient-text">AgentSociety</span>
                </div>

                <nav className="space-y-2">
                    <Link
                        href="/dashboard"
                        className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-white/10 text-white"
                    >
                        <TrendingUp className="w-5 h-5" />
                        <span>Projects</span>
                    </Link>
                </nav>

                <div className="absolute bottom-6 left-6 right-6">
                    <div className="glass rounded-xl p-4 mb-4">
                        <p className="text-sm text-white/60">Logged in as</p>
                        <p className="text-sm font-medium truncate">{user?.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center space-x-2 text-white/60 hover:text-white transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 p-8">
                <div className="max-w-6xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-3xl font-bold">Your Projects</h1>
                            <p className="text-white/60 mt-1">Upload videos and run AI simulations</p>
                        </div>

                        <Link href="/dashboard/new" className="btn-primary flex items-center space-x-2">
                            <Plus className="w-5 h-5" />
                            <span>New Project</span>
                        </Link>
                    </div>

                    {/* Projects Grid */}
                    {isLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <div className="spinner" />
                        </div>
                    ) : projects?.length === 0 ? (
                        <div className="glass-card rounded-2xl p-12 text-center">
                            <FileVideo className="w-16 h-16 text-white/20 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                            <p className="text-white/60 mb-6">
                                Upload your first video to start simulating AI reactions
                            </p>
                            <Link href="/dashboard/new" className="btn-primary inline-flex items-center space-x-2">
                                <Plus className="w-5 h-5" />
                                <span>Create Project</span>
                            </Link>
                        </div>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects?.map((project: any) => (
                                <Link
                                    key={project.id}
                                    href={`/dashboard/project/${project.id}`}
                                    className="glass-card rounded-2xl p-6 hover-lift cursor-pointer"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 flex items-center justify-center">
                                            <FileVideo className="w-6 h-6 text-primary-400" />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {getStatusIcon(project.status)}
                                            <span className="text-sm">{getStatusText(project.status)}</span>
                                            <button
                                                onClick={(e) => handleDelete(e, project.id)}
                                                className="ml-2 p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                title="Delete Project"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-semibold mb-2 truncate">{project.title}</h3>

                                    <p className="text-sm text-white/40">
                                        Created {new Date(project.created_at).toLocaleDateString()}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
