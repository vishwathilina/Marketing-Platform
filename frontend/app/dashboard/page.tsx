'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Plus,
    FileVideo,
    Loader2,
    Trash2,
    MoreVertical,
    Search,
    ArrowUpDown,
} from 'lucide-react';
import { projectsApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

type SortField = 'title' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function DashboardPage() {
    const router = useRouter();
    const { user, setUser, logout } = useAuthStore();
    const [mounted, setMounted] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState<{ id: string; title: string } | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<SortField>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    useEffect(() => {
        setMounted(true);
        
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.project-menu-btn') && !target.closest('.project-dropdown-menu')) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        
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
        
        return () => document.removeEventListener('click', handleClickOutside);
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

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
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

    const filteredAndSortedProjects = projects
        ?.filter((project: any) =>
            project.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a: any, b: any) => {
            const modifier = sortOrder === 'asc' ? 1 : -1;
            if (sortField === 'title') {
                return a.title.localeCompare(b.title) * modifier;
            } else if (sortField === 'created_at') {
                return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * modifier;
            }
            return 0;
        });

    if (!mounted) return null;

    return (
        <>
            <main className="mx-auto max-w-[1280px] px-6 py-8">
                <div className="mb-7 flex items-center justify-between">
                    <h1 className="text-5xl font-semibold tracking-tight">Projects</h1>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Search className="w-4 h-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                className="pl-10 pr-4 py-2 border border-[#d1d5db] rounded-md focus:outline-none focus:ring-2 focus:ring-[#00897f] focus:border-transparent text-sm w-64 shadow-sm"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        <Link
                            href="/dashboard/new"
                            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 hover:scale-105 transition"
                        >
                            <Plus className="h-4 w-4" />
                            New Project
                        </Link>
                    </div>
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
                ) : filteredAndSortedProjects?.length === 0 ? (
                    <div className="rounded-lg border border-[#d1d5db] bg-white p-14 text-center mt-4">
                        <p className="text-[#6b7280]">No projects found matching "{searchQuery}".</p>
                    </div>
                ) : (
                    <div className="border border-[#d1d5db] bg-white sm:rounded-lg">
                        <table className="w-full table-fixed">
                            <thead className="bg-[#f3f4f6] text-left text-sm font-semibold text-[#374151]">
                                <tr>
                                    <th 
                                        className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors"
                                        onClick={() => handleSort('title')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Project Name
                                            <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4">Status</th>
                                    <th 
                                        className="px-6 py-4 cursor-pointer hover:bg-gray-200 transition-colors"
                                        onClick={() => handleSort('created_at')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Date Created
                                            <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4">Created By</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredAndSortedProjects?.map((project: any) => (
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
                                        <td className="px-6 py-4 text-sm text-gray-800">
                                            {new Date(project.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center justify-between gap-3 relative ${openMenuId === project.id ? 'z-50' : 'z-0'}`}>
                                                <span className="truncate text-sm text-[#4b5563]">{user?.email || 'Current User'}</span>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                                                        }}
                                                        className="project-menu-btn inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-[#6b7280] transition hover:bg-[#f3f4f6]"
                                                        aria-label={`Options for ${project.title}`}
                                                    >
                                                        <MoreVertical className="h-5 w-5" />
                                                    </button>
                                                    
                                                    {openMenuId === project.id && (
                                                        <div 
                                                            className="project-dropdown-menu absolute right-0 top-full mt-1 w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50 border border-[#e5e7eb] divide-y divide-[#f3f4f6]"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={(e) => {
                                                                    setOpenMenuId(null);
                                                                    openDeleteModal(e, project.id, project.title);
                                                                }}
                                                                className="block w-full px-4 py-2 text-sm text-left text-[#ef4444] hover:bg-[#fef2f2] font-medium"
                                                            >
                                                               
                                                                Delete
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
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
        </>
    );
}
