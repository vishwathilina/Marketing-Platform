'use client';

import Link from 'next/link';
export default function HelpCenter() {
    return (
        <div className="min-h-screen bg-white">
            <header className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-slate-800">Platform Help Center</h1>
                    <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-2">
                        ← Returns to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">How to Use AgentSociety</h2>
                    <p className="text-lg text-slate-600">
                        Follow these steps to run your first autonomous marketing simulation and extract actionable demographic intelligence.
                    </p>
                </div>

                <div className="space-y-12">
                    {/* Step 1 */}
                    <div className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg ring-4 ring-white shadow-sm shrink-0">1</div>
                            <div className="w-0.5 h-full bg-slate-100 group-hover:bg-blue-100 transition-colors mt-4"></div>
                        </div>
                        <div className="pb-12">
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Creating a Project</h3>
                            <p className="text-slate-600 mb-4 text-lg">
                                Everything begins with a "Project". A project holds your marketing creative and all the simulations run against it.
                            </p>
                            <ul className="space-y-3 text-slate-600">
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>From the Dashboard, click <b>"New Project"</b>.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>Upload your <b>video advertisement</b>. The platform's Vision LLM (Gemini) will automatically watch the video and transcribe it into a high-density 150-word context brief for the agents.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="text-blue-500 font-bold">•</span>
                                    <span>Once processed, you can review the <b>Extracted Details</b> on the project page before simulating.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg ring-4 ring-white shadow-sm shrink-0">2</div>
                            <div className="w-0.5 h-full bg-slate-100 group-hover:bg-indigo-100 transition-colors mt-4"></div>
                        </div>
                        <div className="pb-12">
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Configuring the Simulation</h3>
                            <p className="text-slate-600 mb-4 text-lg">
                                With your project ready, click <b>"New Simulation"</b> to configure how your synthetic audience is generated.
                            </p>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-4 space-y-4">
                                <div>
                                    <h4 className="font-semibold text-slate-900">Custom Agents vs Random AI Population</h4>
                                    <p className="text-sm text-slate-600 mt-1">You can hand-pick specific custom personas to act as key influencers, or you can supply generic demographic parameters (like Age and Location) to let the platform spin up thousands of randomized civilian agents instantly.</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-slate-900">Simulation Days</h4>
                                    <p className="text-sm text-slate-600 mt-1">Select how long the agents deliberate. On Day 1, they watch the ad. On Days 2+, they iteratively message each other, causing social networks to form and opinions to shift dynamically.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-lg ring-4 ring-white shadow-sm shrink-0">3</div>
                            <div className="w-0.5 h-full bg-slate-100 group-hover:bg-rose-100 transition-colors mt-4"></div>
                        </div>
                        <div className="pb-12">
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Real-Time Observability</h3>
                            <p className="text-slate-600 mb-4 text-lg">
                                After launching the simulation, the system will spin up background Ray clusters to process thousands of independent LLM calls parallelly.
                            </p>
                            <p className="text-slate-600">
                                You can safely navigate away or keep the loading screen open. An active counter will display the live heartbeat of the simulation day by day. If you realize you made a mistake configuring agents, you can press the newly integrated <b>"Cancel Simulation"</b> button to immediately halt compute spending.
                            </p>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-6 group">
                        <div className="flex flex-col items-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg ring-4 ring-white shadow-sm shrink-0">4</div>
                        </div>
                        <div className="pb-2">
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Analyzing the Report</h3>
                            <p className="text-slate-600 mb-4 text-lg">
                                Once completed, the dashboard unlocks the semantic telemetry graphs and interaction records.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="border border-slate-200 rounded-lg p-5">
                                    <h4 className="font-semibold text-slate-900 text-base mb-1">Downloadable PDF</h4>
                                    <p className="text-sm text-slate-500">Click the "Download PDF Report" to export a robust document filled with demographic correlations and exact agent deliberation transcripts for executive stakeholders.</p>
                                </div>
                                <div className="border border-slate-200 rounded-lg p-5">
                                    <h4 className="font-semibold text-slate-900 text-base mb-1">Interactive Radar & Map</h4>
                                    <p className="text-sm text-slate-500">See precisely where in Sri Lanka the negative sentiment originates dynamically on the ChromaDB-powered geographic view, and analyze complex emotional combinations (e.g. "Irritating" vs "Interesting").</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-16 bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Ready to test your campaigns?</h3>
                    <p className="text-slate-600 mb-6">Head back to the dashboard to begin orchestrating your first simulation.</p>
                    <Link href="/dashboard" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-slate-900 hover:bg-black shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">
                        Launch Dashboard
                    </Link>
                </div>
            </main>
        </div>
    );
}
