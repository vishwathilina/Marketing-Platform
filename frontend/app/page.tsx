'use client';
import Link from 'next/link';
import { Zap, Shield, BarChart3, Users, ArrowRight } from 'lucide-react';
import DashboardNavbar from '@/components/DashboardNavbar';
import { useEffect, useState } from 'react';

export default function HomePage() {
    const [cookie, setCookie] = useState<string[]>([]);
    useEffect(() => {
        setCookie(document.cookie.split('; '));
        console.log("Cookies:", cookie);
    }, []);

    const userCookie = cookie.find(row => row.startsWith('user='));

    return (
        <div className="min-h-screen bg-[#f3f3f1] text-[#101828] font-sans overflow-hidden">
            {/* Top Navigation Bar mimicking the Dashboard */}
            {userCookie ?
                <DashboardNavbar />
                :
                <header className="border-b border-[#e5e7eb] bg-[#f8f8f7] relative z-50">
                    <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
                        <div className="flex items-center space-x-3">
                            <img src="/logo.png" alt="AgenticMarketing Logo" className="w-8 h-8 object-contain shadow-lg shadow-cyan-500/30 rounded-lg bg-white" />
                            <span className="text-xl font-bold font-heading text-[#101828]">AGENTIC<span className="font-light text-slate-500">MARKETING</span></span>
                        </div>

                        <div className="flex items-center gap-4 text-sm font-medium">
                            <Link href="/login" className="rounded-sm px-4 py-2 text-[#374151] hover:bg-[#e5e7eb]/50 border border-transparent transition-colors">
                                Login
                            </Link>
                            <Link href="/register" className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/40 hover:-translate-y-0.5 hover:shadow-cyan-500/50 transition-all duration-300">
                                Get Started
                            </Link>
                        </div>
                    </div>
                </header>
            }
            {/* Hero Section */}
            <div className="relative">
                {/* Subtle light mode decorative background elements */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-[10%] left-[20%] w-[30rem] h-[30rem] bg-[#00c2a8] rounded-full mix-blend-multiply filter blur-[128px] opacity-10 animate-pulse" style={{ animationDuration: '8s' }} />
                    <div className="absolute top-[30%] right-[15%] w-[25rem] h-[25rem] bg-amber-200 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-pulse" style={{ animationDuration: '12s' }} />
                </div>

                {/* Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-32">
                    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        <div className="text-center lg:text-left">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 font-heading transform hover:scale-[1.02] transition-transform duration-500 leading-tight">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00897f] to-[#025c56]">AI-Powered</span>
                                <br />
                                Risk Detection
                            </h1>

                            <p className="text-xl text-[#4b5563] max-w-2xl mx-auto lg:mx-0 mb-12">
                                Simulate 1,000+ AI agents reacting to your advertisements.
                                Detect potential PR crises before they happen.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 group">
                                <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-[#00897f] to-[#00c2a8] px-8 py-4 text-lg font-semibold text-white shadow-xl shadow-cyan-900/20 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 w-full sm:w-auto">
                                    Try Free Simulation
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                                <Link href="#how-it-works" className="inline-flex items-center justify-center rounded-sm border border-[#d1d5db] bg-white px-8 py-4 text-lg font-semibold text-[#374151] shadow-sm hover:bg-[#f9fafb] hover:-translate-y-1 hover:shadow-md transition-all duration-300 w-full sm:w-auto">
                                    See How It Works
                                </Link>
                            </div>
                        </div>

                        {/* 3D Video Container */}
                        <div className="relative w-full aspect-square max-w-[500px] mx-auto lg:max-w-none">
                            {/* Decorative background framing */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-[#00c2a8]/30 to-amber-200/30 rounded-sm transform rotate-3 scale-105 transition-transform duration-700 hover:rotate-6"></div>
                            <div className="absolute inset-0 bg-gradient-to-bl from-[#00897f]/20 to-transparent rounded-sm transform -rotate-2 scale-105 transition-transform duration-700"></div>

                            {/* Video Element */}
                            <div className="absolute inset-0 bg-white rounded-sm shadow-2xl overflow-hidden border border-[#e5e7eb] group z-10 w-full h-full flex items-center justify-center">
                                <video
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="w-full h-full object-cover scale-[1.05] transform transition-transform duration-1000 group-hover:scale-110"
                                >
                                    <source src="/tech.mp4" type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>

                                {/* Aesthetic glass overlay */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none mix-blend-overlay"></div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-24">
                        {[
                            { value: '1000+', label: 'AI Agents' },
                            { value: '< 5min', label: 'Simulation Time' },
                            { value: '95%', label: 'Accuracy' },
                            { value: '24/7', label: 'Available' },
                        ].map((stat, i) => (
                            <div key={i} className="rounded-sm border border-[#d1d5db] bg-white p-6 text-center shadow-sm hover:-translate-y-2 hover:shadow-xl hover:rotate-1 transition-all duration-300">
                                <div className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#00897f] to-[#025c56]">{stat.value}</div>
                                <div className="text-[#6b7280] mt-1 font-medium">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-6 relative z-10">
                <h2 className="text-4xl font-bold text-center mb-16 font-heading text-[#111827]">
                    How It <span className="text-[#00897f]">Works</span>
                </h2>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        {
                            icon: <BarChart3 className="w-8 h-8" />,
                            title: 'Upload Your Ad',
                            description: 'Upload your video advertisement. Our AI analyzes every scene for potential triggers.',
                        },
                        {
                            icon: <Users className="w-8 h-8" />,
                            title: 'AI Simulation',
                            description: '1,000+ diverse AI agents react to your ad based on demographics, values, and social influence.',
                        },
                        {
                            icon: <Shield className="w-8 h-8" />,
                            title: 'Risk Report',
                            description: 'Get detailed risk analysis with sentiment breakdown, engagement score, and controversy detection.',
                        },
                    ].map((feature, i) => (
                        <div key={i} className="group rounded-sm border border-[#d1d5db] bg-white p-8 shadow-sm hover:-translate-y-3 hover:shadow-2xl transition-all duration-300 transform perspective-1000">
                            <div className="w-16 h-16 rounded-sm bg-[#e6f4f2] text-[#00897f] flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-3 text-[#111827]">{feature.title}</h3>
                            <p className="text-[#6b7280]">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 relative z-10">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="rounded-sm border border-[#00c2a8]/30 bg-gradient-to-br from-white to-[#f0f9f8] p-12 text-center shadow-2xl hover:shadow-[#00897f]/10 transition-shadow duration-500">
                        <h2 className="text-3xl font-bold mb-4 font-heading text-[#101828]">
                            Ready to Protect Your Brand?
                        </h2>
                        <p className="text-[#4b5563] mb-8 max-w-lg mx-auto">
                            Start your first simulation free. No credit card required. Detect the blind spots in your campaigns.
                        </p>
                        <Link href="/register" className="inline-flex items-center gap-2 rounded-sm bg-[#101828] px-8 py-4 text-lg font-semibold text-white hover:bg-[#1f2937] hover:scale-105 transition-all duration-300">
                            Get Started Now
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#e5e7eb] bg-white py-8 relative z-10">
                <div className="max-w-7xl mx-auto px-6 text-center text-[#9ca3af] text-sm">
                    <p>© {new Date().getFullYear()} AGENTIC MARKETING. Powered by AI.</p>
                </div>
            </footer>
        </div>
    );
}
