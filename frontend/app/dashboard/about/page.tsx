export default function AboutPage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-16 text-[#101828]">
            <div className="border-b border-slate-200 pb-8 mb-10">
                <h1 className="text-4xl font-semibold tracking-tight mb-4">
                    About AgentSociety Platform
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed text-justify">
                    A next-generation autonomous AI simulation environment engine. This platform provides continuous multi-day analytic evaluation of marketing campaigns across synthetic societies, projecting realistic backlash and endorsement metrics before an ad is publicly launched.
                </p>
            </div>

            <article className="prose prose-slate max-w-none text-justify space-y-8">
                <section>
                    <h2 className="text-2xl font-semibold border-b border-slate-100 pb-2 mb-4">Platform Overview</h2>
                    <p className="text-slate-600 leading-relaxed mb-4">
                        The AgentSociety Marketing Platform executes highly realistic, large-scale consumer simulations using advanced Large Language Models (LLMs) to represent synthetic populations accurately. Instead of relying solely on traditional human surveying, our system orchestrates asynchronous social interactions and sentiment propagation over simulated longitudinal intervals.
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                        Through <b>Automated Risk Flagging</b> and <b>Real-Time Deliberation</b>, the platform preemptively identifies cultural controversies across 50+ demographic boundaries and models genuine behavioral shifts across multi-day lifecycles where independent agents hold distinct semantic memories and iteratively influence their social networks.
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-semibold border-b border-slate-100 pb-2 mb-4 mt-8">System Architecture</h2>
                    
                    <div className="pl-4 border-l-2 border-slate-200 space-y-6">
                        <div>
                            <h3 className="text-lg font-medium text-slate-800 mb-1">Multimedia Content Processing (Gemini)</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Marketing collateral — video, print/OOH images, audio ads, or written email/blog copy — is uploaded (or pasted) and programmatically decomposed into factual simulation briefs. Subtype-specific Gemini prompts capture layout, transcript, on-screen/on-page copy, brand marks, and CTAs with structural consistency. Agents then react only to that text brief.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-800 mb-1">Distributed Simulation Engine (Ray + Ollama)</h3>
                            <p className="text-slate-600 leading-relaxed">
                                The computationally intensive processing runs securely across Python Ray clusters scaling over LLM actor pools. Each node manages thousands of individual synthetic agents, representing exact demographic subsets (income, geographic location, political leaning, and personality). Inference queries are asynchronously piped to Ollama Cloud for scalable and low-latency cognitive processing.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-lg font-medium text-slate-800 mb-1">Sociodynamic Network Graph Analysis</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Agents are firmly positioned within a synthesized sociodynamic map. Beginning on "Day 1", each agent independently perceives and evaluates the advertisement. In subsequent cycles, opinions propagate via direct peer-to-peer relationships, uncovering critical behavioral responses such as silent majorities falling to vocal opposition, viral network consensus, and targeted boycott formations.
                            </p>
                        </div>
                        
                        <div>
                            <h3 className="text-lg font-medium text-slate-800 mb-1">Analytics & Regional Mapping</h3>
                            <p className="text-slate-600 leading-relaxed">
                                All emotional responses, reasoning text, and topological opinion reversals are streamed into a PostgreSQL relational instance via an iterative Redis background worker, decoupling the core simulation from the frontend telemetry. This populates dynamic dashboards displaying Kantar-standard semantic trajectory maps, risk-level histograms, and detailed Sri Lankan geographical analysis utilizing integrated ChromaDB vector layers.
                            </p>
                        </div>
                    </div>
                </section>
            </article>

            <div className="mt-16 pt-8 border-t border-slate-200 text-center">
                <p className="text-sm font-medium text-slate-400">
                    AgentSociety Marketing Platform © {new Date().getFullYear()} — Powering Predictive Brand Intelligence
                </p>
            </div>
        </div>
    );
}
