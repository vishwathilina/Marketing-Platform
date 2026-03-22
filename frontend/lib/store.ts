import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    id: string;
    email: string;
    subscription_tier: string;
}

interface AuthStore {
    user: User | null;
    isAuthenticated: boolean;
    setUser: (user: User | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            setUser: (user) => set({ user, isAuthenticated: !!user }),
            logout: () => {
                localStorage.removeItem('token');
                set({ user: null, isAuthenticated: false });
            },
        }),
        {
            name: 'auth-storage',
        }
    )
);

interface Project {
    id: string;
    title: string;
    status: string;
    created_at: string;
}

interface ProjectStore {
    projects: Project[];
    activeProject: Project | null;
    setProjects: (projects: Project[]) => void;
    setActiveProject: (project: Project | null) => void;
    addProject: (project: Project) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
    projects: [],
    activeProject: null,
    setProjects: (projects) => set({ projects }),
    setActiveProject: (project) => set({ activeProject: project }),
    addProject: (project) =>
        set((state) => ({ projects: [project, ...state.projects] })),
}));
