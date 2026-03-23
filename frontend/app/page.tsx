'use client';
import Link from 'next/link';
import { ArrowRight, Check, Play, Star } from 'lucide-react';
import DashboardNavbar from '@/components/DashboardNavbar';
import { useEffect, useState } from 'react';

export default function HomePage() {
    const CAROUSEL_SWITCH_MS = 50000;
    const [cookie, setCookie] = useState<string[]>([]);
    const [activeSlide, setActiveSlide] = useState(0);

    const carouselSlides = [
        {
            heroVideo: 'https://huggingface.co/datasets/vish85521/videos/resolve/main/videos/9d2d27df-60fb-4681-9e16-d5b84a559629.mp4',
            heroImage: '',
            productImage: 'https://essstr.blob.core.windows.net/essimg/ItemAsset/Pic18117.jpg',
            questionOne: 'Will it go well with my tea ?',
            questionTwo: 'Is it low calorie ?',
            percent: '86%',
            statText: 'Engagement score',
            productNameOne: 'Maliban',
            productNameTwo: 'Cream Cracker',
            price: 'LKR 250.00',
            rating: '4.6',
        },
        {
            heroVideo: 'https://huggingface.co/datasets/vish85521/videos/resolve/main/videos/1d82deee-3c0a-4007-af26-4c3fa1e353e3.mp4',
            heroImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=1000&q=80',
            productImage: 'https://nippon.s3.ap-southeast-1.amazonaws.com/products/d5c40b6ef0c7e36cf1cdeb554dd1681c33c8516d.jpg',
            questionOne: 'How much area will this actually cover?',
            questionTwo: 'What is the drying time?',
            percent: '48%',
            statText: 'Engagement score',
            productNameOne: 'Nippolac',
            productNameTwo: 'paint',
            price: 'LKR 1950',
            rating: '4.4',
        },
        {
            heroVideo: 'https://huggingface.co/datasets/vish85521/videos/resolve/main/videos/747feb47-d323-4515-b1a6-c5511a9f8c12.mp4',
            heroImage: 'https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=1000&q=80',
            productImage: 'https://assets.unileversolutions.com/v1/982487.png',
            questionOne: 'Does it whiten?',
            questionTwo: 'The Freshness Duration',
            percent: '92%',
            statText: 'Engagement score',
            productNameOne: 'Signal Strong',
            productNameTwo: 'Teeth',
            price: 'LKR 200.00',
            rating: '4.8',
        },
        {
            heroVideo: 'https://huggingface.co/datasets/vish85521/videos/resolve/main/videos/9881919e-718f-4756-a43e-7e5713286b5f.mp4',
            heroImage: 'https://images.unsplash.com/photo-1503342452485-86ff0a33d548?auto=format&fit=crop&w=1000&q=80',
            productImage: 'https://i0.wp.com/onlinekade.lk/wp-content/uploads/2024/06/5063305003546.jpg',
            questionOne: 'Is it Pure Ceylon Tea?',
            questionTwo: 'Is it strong enough ?',
            percent: '67%',
            statText: 'Engagement score',
            productNameOne: 'Laojee Tea',
            productNameTwo: '',
            price: 'LKR 659.99',
            rating: '4.5',
        },
    ];

    useEffect(() => {
        setCookie(document.cookie.split('; '));
        console.log("Cookies:", cookie);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % carouselSlides.length);
        }, CAROUSEL_SWITCH_MS);

        return () => clearInterval(timer);
    }, [carouselSlides.length, CAROUSEL_SWITCH_MS]);

    const userCookie = cookie.find(row => row.startsWith('user='));
    const currentSlide = carouselSlides[activeSlide];

    return (
        <div className="min-h-screen bg-[#f3f3f1] text-[#101828] font-sans overflow-hidden">
            {/* Top Navigation Bar mimicking the Dashboard */}
            {userCookie ?
                <DashboardNavbar />
                :
                <header className="border-b border-[#e5e7eb] bg-[#f8f8f7] relative z-50">
                    <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3">
                        <div className="flex items-center space-x-3">
                            <img src="/logo.png" alt="AgenticMarketing Logo" className="w-8 h-8 object-contain  " />
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
                <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 md:py-12 pt-0">
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

                        {/* Video Carousel */}
                        <div className="relative mx-auto w-full max-w-[620px] aspect-square lg:mx-0">
                            {/* Main Container */}
                            <div className="relative w-full h-full">
                                {/* Large Orange rounded rectangle background - main focal point */}
                                <div
                                    className="absolute top-8 left-1/4 overflow-hidden rounded-[2rem] bg-orange-500 shadow-2xl"
                                    style={{ width: '55%', height: '85%' }}
                                >
                                    {/* Product Video */}
                                    <video
                                        key={activeSlide}
                                        autoPlay
                                        loop
                                        muted
                                        playsInline
                                        className="h-full w-full object-cover"
                                    >
                                        <source src={currentSlide.heroVideo} type="video/mp4" />
                                        <source src="/tech.mp4" type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>

                                    {/* Play Button Overlay */}
                                    <div
                                        className="absolute flex items-center justify-center"
                                        style={{ bottom: '20%', left: '50%', transform: 'translateX(-50%)' }}
                                    >
                                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-2xl">
                                            <Play className="h-7 w-7 fill-gray-900 text-gray-900" />
                                        </div>
                                    </div>
                                </div>

                                {/* Gradient overlay shape behind image */}
                                <div
                                    className="absolute rounded-3xl"
                                    style={{
                                        top: '10%',
                                        left: '8%',
                                        width: '45%',
                                        height: '75%',
                                    }}
                                />

                                {/* Left Chat Bubbles */}
                                <div className="absolute left-0 top-1/4 z-30 space-y-4" style={{ width: '45%' }}>
                                    {/* First Message */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-500">
                                            <Check className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="rounded-3xl bg-white px-5 py-3 shadow-lg">
                                            <p className="text-sm font-semibold text-gray-900">{currentSlide.questionOne}</p>
                                        </div>
                                    </div>

                                    {/* Second Message */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-500">
                                            <Check className="h-5 w-5 text-white" />
                                        </div>
                                        <div className="rounded-3xl bg-white px-5 py-3 shadow-lg">
                                            <p className="text-sm font-semibold text-gray-900">{currentSlide.questionTwo}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Top Right Stats Card */}
                                <div
                                    className="absolute z-30 rounded-3xl border border-gray-200 bg-white p-6 shadow-xl"
                                    style={{
                                        top: '8%',
                                        right: '5%',
                                        width: '35%',
                                    }}
                                >
                                    <p className="mb-1 text-xs font-medium tracking-wide text-gray-500">UP TO</p>
                                    <p className="mb-2 text-5xl font-bold leading-none text-gray-900">{currentSlide.percent}</p>
                                    <p className="text-sm leading-snug text-gray-700">{currentSlide.statText}</p>
                                </div>

                                {/* Bottom Right Product Card */}
                                <div
                                    className="absolute z-30 rounded-3xl bg-gray-200 p-4 shadow-xl md:p-5"
                                    style={{
                                        bottom: '5%',
                                        right: '2%',
                                        width: '46%',
                                    }}
                                >
                                    <div className="flex items-center gap-3 md:gap-4">
                                        {/* Product Image */}
                                        <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl bg-gray-300 md:h-24 md:w-24">
                                            <img
                                                src={currentSlide.productImage}
                                                alt="Product"
                                                className="h-full w-full object-cover"
                                            />
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex min-w-0 flex-1 flex-col justify-between">
                                            <div>
                                                <p className="truncate text-sm font-bold leading-tight text-gray-900 md:text-base">{currentSlide.productNameOne}</p>
                                                <p className="truncate text-sm font-bold leading-tight text-gray-900 md:text-base">{currentSlide.productNameTwo}</p>
                                            </div>

                                            <div>
                                                <p className="mb-1.5 whitespace-nowrap text-xl font-bold text-gray-900 md:mb-2 md:text-2xl">{currentSlide.price}</p>
                                                <div className="flex items-center gap-1">
                                                    <Star className="h-4 w-4 fill-gray-900 text-gray-900 md:h-5 md:w-5" />
                                                    <p className="text-sm font-semibold text-gray-900">{currentSlide.rating}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="absolute bottom-1 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2">
                                    {carouselSlides.map((_, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            aria-label={`Go to slide ${index + 1}`}
                                            onClick={() => setActiveSlide(index)}
                                            className={`h-2.5 rounded-full transition-all duration-300 ${
                                                activeSlide === index ? 'w-8 bg-[#111827]' : 'w-2.5 bg-[#9ca3af]'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-24">
                        {[
                            { value: '1000+', label: 'AI Agents' },
                            { value: '< 1 Hour', label: 'Simulation Time' },
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

            {/* Feature Sections */}
            <section id="how-it-works" className="py-24 bg-white relative z-10">
                <div className="max-w-7xl mx-auto px-6 space-y-24">
                    {/* Feature 1: Powerful Insights */}
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-4xl font-bold mb-4 font-heading text-[#101828]">Powerful insights, all in one place.</h2>
                            <p className="text-lg text-[#4b5563] mb-6">
                                Share learnings throughout your organisation with team-level access to project data. Intuitive visual analytics dashboards make it easy to understand your results, synthesise insights across projects, and look at performance versus our norms. So you can make faster, more confident decisions.
                            </p>
                            <Link href="#" className="inline-flex items-center gap-2 rounded-sm bg-[#101828] px-6 py-3 text-base font-semibold text-white hover:bg-[#1f2937] transition-colors">
                                Explore solutions
                            </Link>
                        </div>
                        <div className="bg-gray-200 h-80 rounded-sm flex items-center justify-center">
                            <img src="/screensho1.png" alt="Analytics Dashboard" className="h-full w-full object-cover" />
                        </div>
                    </div>

                    {/* Feature 2: Consumer Research */}
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="bg-gray-200 h-80 rounded-sm flex items-center justify-center order-last md:order-first">
                            <img src="/screensho2.png" alt="Consumer Research" className="h-full w-full object-cover" />
                        </div>
                        <div>
                            <h2 className="text-4xl font-bold mb-4 font-heading text-[#101828]">Consumer research, on your terms.</h2>
                            <p className="text-lg text-[#4b5563] mb-6">
                                Choose from a full suite of market research tools designed to help you optimise your marketing mix, whether you're getting feedback on an idea, developing a new product or launching a campaign. Get the flexibility you need to run self-serve studies or combine the speed and agility of the platform with expert service.
                            </p>
                            <Link href="#" className="inline-flex items-center gap-2 rounded-sm bg-[#101828] px-6 py-3 text-base font-semibold text-white hover:bg-[#1f2937] transition-colors">
                                Explore pricing
                            </Link>
                        </div>
                    </div>
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
                            Start your first simulation free.
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
                    <p>© {new Date().getFullYear()} AGENTIC MARKETING.</p>
                </div>
            </footer>
        </div>
    );
}
