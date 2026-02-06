import Link from 'next/link';
import { Zap, Shield, BarChart3, Users } from 'lucide-react';

export default function HomePage() {
    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                {/* Animated background */}
                <div className="absolute inset-0 animate-gradient-bg opacity-20" />

                {/* Navigation */}
                <nav className="relative z-10 flex items-center justify-between p-6 max-w-7xl mx-auto">
                    <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold gradient-text">AgentSociety</span>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Link href="/login" className="btn-secondary">
                            Login
                        </Link>
                        <Link href="/register" className="btn-primary">
                            Get Started
                        </Link>
                    </div>
                </nav>

                {/* Hero Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-7xl font-bold mb-6">
                            <span className="gradient-text">AI-Powered</span>
                            <br />
                            Marketing Risk Detection
                        </h1>

                        <p className="text-xl text-white/60 max-w-2xl mx-auto mb-12">
                            Simulate 1,000+ AI agents reacting to your advertisements.
                            Detect potential PR crises before they happen.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/register" className="btn-primary text-lg px-8 py-4">
                                Try Free Simulation
                            </Link>
                            <Link href="#how-it-works" className="btn-secondary text-lg px-8 py-4">
                                See How It Works
                            </Link>
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
                            <div key={i} className="glass-card rounded-2xl p-6 text-center hover-lift">
                                <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                                <div className="text-white/60 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section id="how-it-works" className="py-24 max-w-7xl mx-auto px-6">
                <h2 className="text-4xl font-bold text-center mb-16">
                    How It <span className="gradient-text">Works</span>
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
                            description: 'Get detailed risk analysis with sentiment breakdown, virality score, and controversy detection.',
                        },
                    ].map((feature, i) => (
                        <div key={i} className="glass-card rounded-2xl p-8 hover-lift">
                            <div className="w-16 h-16 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 flex items-center justify-center mb-6 text-primary-400">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                            <p className="text-white/60">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="glass-card rounded-3xl p-12 text-center">
                        <h2 className="text-3xl font-bold mb-4">
                            Ready to Protect Your Brand?
                        </h2>
                        <p className="text-white/60 mb-8">
                            Start your first simulation free. No credit card required.
                        </p>
                        <Link href="/register" className="btn-primary text-lg px-8 py-4">
                            Get Started Now
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/10 py-8">
                <div className="max-w-7xl mx-auto px-6 text-center text-white/40">
                    <p>© 2024 AgentSociety. Powered by AI.</p>
                </div>
            </footer>
        </div>
    );
}
