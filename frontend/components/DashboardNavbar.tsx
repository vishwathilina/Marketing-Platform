'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function DashboardNavbar() {
    const router = useRouter();
    const pathname = usePathname();
    const { logout } = useAuthStore();

    const handleLogout = () => {
        authApi.logout();
        document.cookie = 'user=; path=/; max-age=0'; // Clear the user cookie
        logout();
        router.push('/login');
    };

    const isActive = (path: string) => {
        if (path === '/dashboard' && pathname === '/dashboard') return true;
        if (path !== '/dashboard' && pathname.startsWith(path)) return true;
        return false;
    };

    return (
        <header className="border-b border-[#e5e7eb] bg-[#f8f8f7]">
            <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
                <nav className="flex items-center gap-8 text-sm font-medium text-[#111827]">
                    <Link href="/" className="hover:text-black">Home</Link>
                    <Link href="/dashboard" className={isActive('/dashboard') ? "text-[#00897f]" : "hover:text-black"}>Projects</Link>
                    <Link href="/dashboard/agents" className={isActive('/dashboard/agents') ? "text-[#00897f]" : "hover:text-black"}>Agents</Link>
                    <Link href="/dashboard/about" className={isActive('/dashboard/about') ? "text-[#00897f]" : "hover:text-black"}>About</Link>
                </nav>
                <div className="flex items-center gap-6 text-sm">
                    <Link href="/Help" className="font-semibold hover:text-[#00897f] transition-colors">Help Centre</Link>
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
    );
}
