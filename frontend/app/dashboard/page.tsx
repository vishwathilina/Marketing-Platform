'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    FileVideo,
    LogOut,
    Loader2,
    Trash2,
} from 'lucide-react';
import { projectsApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function DashboardPage() {
    const router = useRouter();
    const { user, setUser, logout } = useAuthStore();
    const [mounted, setMounted] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null);

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
            setProjectToDelete(null);
        },
    });

    const openDeleteModal = (e: React.MouseEvent, id: string, title: string) => {
        e.preventDefault();
        e.stopPropagation();
        setProjectToDelete({ id, title });
    };

    const handleConfirmDelete = () => {
        if (!projectToDelete) return;
        deleteMutation.mutate(projectToDelete.id);
    };

    const handleLogout = () => {
        authApi.logout();
        logout();
        router.push('/');
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

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'READY':
                return 'text-emerald-700';
            case 'PROCESSING':
                return ' text-blue-700 ';
            case 'FAILED':
                return 'text-red-700';
            default:
                return ' text-amber-700 ';
        }
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#f3f3f1] text-[#101828]">
            <header className="border-b border-[#e5e7eb] bg-[#f8f8f7]">
                <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
                    <nav className="flex items-center gap-8 text-sm font-medium text-[#111827]">
                        <Link href="/" className="hover:text-black">Home</Link>
                        <span className="font-semibold">Projects</span>
                        <span className="text-[#4b5563]">Solutions</span>
                        <span className="text-[#4b5563]">Analytics Dashboards</span>
                    </nav>
                    <div className="flex items-center gap-6 text-sm">
                        <span className="font-semibold">Help Centre</span>
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center gap-2 rounded-md border border-[#d1d5db] px-2.5 py-1.5 text-[#374151] hover:bg-white"
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1280px] px-6 py-8">
                <div className="mb-7 flex items-start justify-between">
                    <h1 className="text-5xl font-semibold tracking-tight">Projects</h1>
                    <Link
                        href="/dashboard/new"
                        className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 hover:scale-105 transition"
                    >
                        <Plus className="h-4 w-4" />
                        New Project
                    </Link>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="h-8 w-8 animate-spin text-[#4b5563]" />
                    </div>
                ) : projects?.length === 0 ? (
                    <div className="rounded-lg border border-[#d1d5db] bg-white p-14 text-center">
                        <FileVideo className="mx-auto mb-4 h-12 w-12 text-[#9ca3af]" />
                        <h3 className="mb-2 text-xl font-semibold">No projects yet</h3>
                        <p className="mb-7 text-[#6b7280]">Create your first project to start simulation.</p>
                        <Link
                            href="/dashboard/new"
                            className="inline-flex items-center gap-2 rounded-md border border-[#111827] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-[#f9fafb]"
                        >
                            <Plus className="h-4 w-4" />
                            Create Project
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-md border border-[#d1d5db] bg-white">
                        <table className="w-full table-fixed">
                            <thead className="bg-[#f3f4f6] text-left text-sm font-semibold text-[#374151]">
                                <tr>
                                    <th className="px-6 py-4">Project Name</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Date Created</th>
                                    <th className="px-6 py-4">Created By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects?.map((project: any) => (
                                    <tr
                                        key={project.id}
                                        onClick={() => router.push(`/dashboard/project/${project.id}`)}
                                        className="cursor-pointer border-t border-[#e5e7eb] transition-colors hover:bg-[#f9fafb]"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-20 overflow-hidden rounded border border-[#e5e7eb] bg-[#eef2ff]">
                                                    <div className="flex h-full w-full items-center justify-center">
                                                        <FileVideo className="h-5 w-5 text-[#4f46e5]" />
                                                    </div>
                                                </div>
                                                <span className="truncate font-semibold text-[#111827]">{project.title}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(project.status)}`}>
                                                {getStatusText(project.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-[#4b5563]">
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="truncate text-sm text-[#4b5563]">{user?.email || 'Current User'}</span>
                                                <button
                                                    onClick={(e) => openDeleteModal(e, project.id, project.title)}
                                                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#fecaca] text-[#ef4444] transition hover:bg-[#fef2f2]"
                                                    aria-label={`Delete ${project.title}`}
                                                    title="Delete project"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {projectToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                    <div className="w-full max-w-md rounded-xl border border-[#e5e7eb] bg-white p-6 shadow-2xl">
                        <h2 className="text-xl font-semibold text-[#111827]">Delete project?</h2>
                        <p className="mt-3 text-sm text-[#4b5563]">
                            Are you sure you want to delete
                            <span className="font-semibold text-[#111827]"> {projectToDelete.title}</span>?
                            This action cannot be undone.
                        </p>
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setProjectToDelete(null)}
                                className="rounded-md border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
                                disabled={deleteMutation.isPending}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                className="inline-flex items-center gap-2 rounded-md bg-[#ef4444] px-4 py-2 text-sm font-semibold text-white hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
