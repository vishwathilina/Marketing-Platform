'use client';
import DashboardNavbar from '@/components/DashboardNavbar';
// import { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    
    return (
        <div className="min-h-screen bg-[#f3f3f1] text-[#101828]">
            <DashboardNavbar />
            {children}
        </div>
    );
}
