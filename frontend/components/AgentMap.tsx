'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup } from 'react-leaflet';
import {
    X,
    User,
    MapPin,
    Users,
    Loader2,
    Angry,
    Frown,
    Smile,
    AlertTriangle,
    Sparkles,
    Octagon,
    Meh,
    type LucideIcon,
} from 'lucide-react';
import { simulationsApi } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface MapAgent {
    agent_id: string;
    coordinates: [number, number];
    opinion: string;
    friends: string[];
}

interface AgentDetail {
    agent_id: string;
    coordinates: [number, number];
    opinion: string;
    emotion: string;
    emotion_intensity: number;
    reasoning: string;
    friends: string[];
    profile: {
        age: number | null;
        gender: string | null;
        location: string | null;
        occupation: string | null;
        education: string | null;
        income_level: string | null;
        religion: string | null;
        ethnicity: string | null;
        social_media_usage: string | null;
        political_leaning: string | null;
        personality_traits: string[];
        name: string | null;
        bio: string | null;
        values: string[];
    };
}

interface AgentMapProps {
    simulationId: string;
}

// ── Color helpers ────────────────────────────────────────────────────────────

const OPINION_COLORS: Record<string, string> = {
    POSITIVE: '#10b981',
    NEUTRAL: '#94a3b8',
    NEGATIVE: '#ef4444',
};

const EMOTION_BADGES: Record<string, LucideIcon> = {
    angry: Angry,
    sad: Frown,
    happy: Smile,
    fearful: AlertTriangle,
    surprised: Sparkles,
    disgusted: Octagon,
    neutral: Meh,
};

function getColor(opinion: string): string {
    return OPINION_COLORS[opinion] || OPINION_COLORS.NEUTRAL;
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
    return (
        <div
            style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                zIndex: 1000,
                background: 'black',
                backdropFilter: 'blur(12px)',
                borderRadius: 12,
                padding: '14px 18px',
                color: '#e2e8f0',
                fontSize: 13,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 8px 32px rgba(222, 201, 201, 0.4)',
            }}
        >
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>
                Opinion
            </div>
            {Object.entries(OPINION_COLORS).map(([label, color]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: color, border: '2px solid rgba(255,255,255,0.2)' }} />
                    <span>{label.charAt(0) + label.slice(1).toLowerCase()}</span>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AgentMap({ simulationId }: AgentMapProps) {
    const [agents, setAgents] = useState<MapAgent[]>([]);
    const [selectedAgent, setSelectedAgent] = useState<AgentDetail | null>(null);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [mapRenderKey, setMapRenderKey] = useState(`leaflet-${simulationId}-0`);
    const [renderMap, setRenderMap] = useState(false);
    const mapInstanceRef = useRef<any>(null);

    useEffect(() => {
        // Force a fresh MapContainer mount when simulation changes to avoid
        // stale Leaflet container state during dev/hot-reload cycles.
        setMapRenderKey(`leaflet-${simulationId}-${Date.now()}`);

        // Delay map mount by one tick so old container fully unmounts first.
        setRenderMap(false);
        const timer = window.setTimeout(() => setRenderMap(true), 0);
        return () => window.clearTimeout(timer);
    }, [simulationId]);

    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Lookup for quick coordinate access
    const agentMap = useMemo(() => {
        const m = new Map<string, MapAgent>();
        agents.forEach((a) => m.set(a.agent_id, a));
        return m;
    }, [agents]);

    // Load map data
    useEffect(() => {
        async function load() {
            try {
                const data = await simulationsApi.getMapData(simulationId);
                setAgents(data.map_data || []);
            } catch (err) {
                console.error('Failed to load map data:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [simulationId]);

    // Handle agent click
    const handleAgentClick = async (agentId: string) => {
        if (selectedAgentId === agentId) {
            setSelectedAgentId(null);
            setSelectedAgent(null);
            return;
        }
        setSelectedAgentId(agentId);
        setDetailLoading(true);
        try {
            const detail = await simulationsApi.getAgentDetail(simulationId, agentId);
            setSelectedAgent(detail);
        } catch (err) {
            console.error('Failed to load agent detail:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    // Friend lines for selected agent
    const friendLines = useMemo(() => {
        if (!selectedAgentId) return [];
        const agent = agentMap.get(selectedAgentId);
        if (!agent) return [];

        return agent.friends
            .map((fid) => {
                const friend = agentMap.get(fid);
                if (!friend) return null;
                return {
                    from: agent.coordinates,
                    to: friend.coordinates,
                    friendId: fid,
                };
            })
            .filter(Boolean) as { from: [number, number]; to: [number, number]; friendId: string }[];
    }, [selectedAgentId, agentMap]);

    if (loading) {
        return (
            <div className="glass-card rounded-2xl h-[600px] flex items-center justify-center text-center">
                <div>
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary-400" />
                    <p className="text-white/60">Loading map data...</p>
                </div>
            </div>
        );
    }

    if (agents.length === 0) {
        return (
            <div className="glass-card rounded-2xl p-12 text-center">
                <MapPin className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/60">No agent map data available for this simulation.</p>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-2xl overflow-hidden" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', height: 600 }}>
                {/* Map */}
                <div style={{ flex: 1, position: 'relative' }}>
                    {renderMap ? (
                        <MapContainer
                            key={mapRenderKey}
                            center={[7.8731, 80.7718]}
                            zoom={8}
                            style={{ height: '100%', width: '100%', background: '#0f172a' }}
                            scrollWheelZoom={true}
                            ref={(map) => {
                                mapInstanceRef.current = map;
                            }}
                        >
                            <TileLayer
                                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            />

                            {/* Friend connection lines */}
                            {friendLines.map((line, i) => (
                                <Polyline
                                    key={`line-${i}`}
                                    positions={[line.from, line.to]}
                                    pathOptions={{
                                        color: '#8b5cf6',
                                        weight: 1.5,
                                        opacity: 0.6,
                                        dashArray: '4 4',
                                    }}
                                />
                            ))}

                            {agents.map((agent) => {
                                const isSelected = agent.agent_id === selectedAgentId;
                                const isFriend = selectedAgentId
                                    ? agentMap.get(selectedAgentId)?.friends.includes(agent.agent_id)
                                    : false;

                                return (
                                    <CircleMarker
                                        key={agent.agent_id}
                                        center={agent.coordinates}
                                        radius={isSelected ? 10 : isFriend ? 7 : 5}
                                        pathOptions={{
                                            color: isSelected
                                                ? '#ffffff'
                                                : isFriend
                                                ? '#8b5cf6'
                                                : 'rgba(255,255,255,0.2)',
                                            fillColor: getColor(agent.opinion),
                                            fillOpacity: isSelected || isFriend ? 1 : 0.75,
                                            weight: isSelected ? 3 : isFriend ? 2 : 1,
                                        }}
                                        eventHandlers={{
                                            click: () => handleAgentClick(agent.agent_id),
                                        }}
                                    >
                                        <Popup>
                                            <div style={{ color: '#1e293b', fontWeight: 500 }}>
                                                {agent.agent_id}
                                                <br />
                                                <span style={{ color: getColor(agent.opinion) }}>
                                                    {agent.opinion}
                                                </span>
                                            </div>
                                        </Popup>
                                    </CircleMarker>
                                );
                            })}
                        </MapContainer>
                    ) : (
                        <div style={{ height: '100%', width: '100%', background: '#0f172a' }} />
                    )}

                    <Legend />

                    {/* Stats badge */}
                    <div
                        style={{
                            position: 'absolute',
                            top: 16,
                            right: 16,
                            zIndex: 1000,
                            background: 'rgba(15, 23, 42, 0.9)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: 12,
                            padding: '10px 16px',
                            color: '#e2e8f0',
                            fontSize: 13,
                            border: '1px solid rgba(255,255,255,0.1)',
                        }}
                    >
                        <span style={{ fontWeight: 600 }}>{agents.length}</span> agents
                        {selectedAgentId && (
                            <span style={{ marginLeft: 12, color: '#8b5cf6' }}>
                                <span style={{ fontWeight: 600 }}>{friendLines.length}</span> links
                            </span>
                        )}
                    </div>
                </div>

                {/* Sidebar — Agent Detail */}
                {(selectedAgent || detailLoading) && (
                    <div
                        style={{
                            width: 340,
                            background: '#f1f5f9',
                            color: '#0f172a',
                            borderLeft: '1px solid #cbd5e1',
                            overflowY: 'auto',
                            padding: 0,
                        }}
                    >
                        {detailLoading ? (
                            <div style={{ padding: 32, textAlign: 'center' }}>
                                <div className="spinner mx-auto mb-4" />
                                <p style={{ color: '#334155', fontSize: 14 }}>Loading agent...</p>
                            </div>
                        ) : selectedAgent ? (
                            <div>
                                {/* Header */}
                                <div
                                    style={{
                                        padding: '20px 20px 16px',
                                        borderBottom: '1px solid #cbd5e1',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#475569', marginBottom: 4 }}>
                                            Agent Detail
                                        </div>
                                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                                            {selectedAgent.profile?.name || selectedAgent.agent_id}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedAgent(null); setSelectedAgentId(null); }}
                                        style={{
                                            background: '#e2e8f0',
                                            border: 'none',
                                            borderRadius: 8,
                                            padding: 6,
                                            cursor: 'pointer',
                                            color: '#0f172a',
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Opinion + Emotion */}
                                <div style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
                                    <div
                                        style={{
                                            flex: 1,
                                            background: `${getColor(selectedAgent.opinion)}22`,
                                            border: `1px solid ${getColor(selectedAgent.opinion)}44`,
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.6, marginBottom: 4 }}>
                                            Opinion
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: getColor(selectedAgent.opinion) }}>
                                            {selectedAgent.opinion}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            flex: 1,
                                            background: '#e2e8f0',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: 10,
                                            padding: '12px 14px',
                                            textAlign: 'center',
                                        }}
                                    >
                                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, opacity: 0.6, marginBottom: 4 }}>
                                            Emotion
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {(() => {
                                                const EmotionIcon = EMOTION_BADGES[selectedAgent.emotion] || Meh;
                                                return <EmotionIcon size={16} />;
                                            })()}
                                            {selectedAgent.emotion.charAt(0).toUpperCase() + selectedAgent.emotion.slice(1)}
                                        </div>
                                    </div>
                                </div>

                                {/* Reasoning */}
                                {selectedAgent.reasoning && (
                                    <div style={{ padding: '0 20px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                           
                                            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', fontWeight: 600 }}>
                                                Reasoning
                                            </span>
                                        </div>
                                        <div
                                            style={{
                                                background: 'rgba(139, 92, 246, 0.08)',
                                                border: '1px solid rgba(139, 92, 246, 0.15)',
                                                borderRadius: 10,
                                                padding: '12px 14px',
                                                color: '#0f172a',
                                                fontSize: 13,
                                                lineHeight: 1.6,
                                                fontStyle: 'italic',
                                            }}
                                        >
                                            "{selectedAgent.reasoning || 'No reasoning available.'}"
                                        </div>
                                    </div>
                                )}

                                {/* Profile */}
                                <div style={{ padding: '0 20px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                        <User size={14} style={{ color: '#38bdf8' }} />
                                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', fontWeight: 600 }}>
                                            Persona Profile
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 8,
                                        }}
                                    >
                                        {[
                                            { label: 'Age', value: selectedAgent.profile.age },
                                            { label: 'Gender', value: selectedAgent.profile.gender },
                                            { label: 'Location', value: selectedAgent.profile.location },
                                            { label: 'Ethnicity', value: selectedAgent.profile.ethnicity },
                                            { label: 'Religion', value: selectedAgent.profile.religion },
                                            { label: 'Income', value: selectedAgent.profile.income_level },
                                            { label: 'Occupation', value: selectedAgent.profile.occupation },
                                            { label: 'Social Media', value: selectedAgent.profile.social_media_usage },
                                            { label: 'Politics', value: selectedAgent.profile.political_leaning },
                                        ].map((item) => (
                                            item.value ? (
                                                <div
                                                    key={item.label}
                                                    style={{
                                                        background: '#e2e8f0',
                                                        borderRadius: 8,
                                                        padding: '8px 10px',
                                                    }}
                                                >
                                                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', marginBottom: 2 }}>
                                                        {item.label}
                                                    </div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {item.value || '—'}
                                                    </div>
                                                </div>
                                            ) : null
                                        ))}
                                    </div>
                                    
                                    {selectedAgent.profile.bio && (
                                        <div style={{ marginTop: 12, padding: 12, background: '#e2e8f0', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                                            <div style={{ fontSize: 10, textTransform: 'uppercase', color: '#64748b', marginBottom: 4 }}>Bio</div>
                                            <div style={{ fontSize: 12, color: '#0f172a', fontStyle: 'italic' }}>
                                                {selectedAgent.profile.bio}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Values */}
                                {selectedAgent.profile.values.length > 0 && (
                                    <div style={{ padding: '0 20px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                           
                                            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', fontWeight: 600 }}>
                                                Core Values
                                            </span>
                                        </div>
                                        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                                            {selectedAgent.profile.values.map((v) => (
                                                <div
                                                    key={v}
                                                    style={{
                                                        padding: '8px 10px',
                                                        fontSize: 13,
                                                        color: '#0f172a',
                                                        borderBottom: '1px solid #e2e8f0',
                                                    }}
                                                >
                                                    {v.replace(/_/g, ' ')}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Traits */}
                                {selectedAgent.profile.personality_traits && selectedAgent.profile.personality_traits.length > 0 && (
                                    <div style={{ padding: '0 20px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            
                                            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', fontWeight: 600 }}>
                                                Personality Traits
                                            </span>
                                        </div>
                                        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                                            {selectedAgent.profile.personality_traits.map((t) => (
                                                <div
                                                    key={t}
                                                    style={{
                                                        padding: '8px 10px',
                                                        fontSize: 13,
                                                        color: '#0f172a',
                                                        borderBottom: '1px solid #e2e8f0',
                                                    }}
                                                >
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Friends */}
                                <div style={{ padding: '0 20px 20px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <Users size={14} style={{ color: '#8b5cf6' }} />
                                        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#475569', fontWeight: 600 }}>
                                            Social Connections ({selectedAgent.friends.length})
                                        </span>
                                    </div>
                                    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, overflow: 'hidden', background: '#ffffff' }}>
                                        {selectedAgent.friends.slice(0, 20).map((fid) => {
                                            const friend = agentMap.get(fid);
                                            return (
                                                <div
                                                    key={fid}
                                                    onClick={() => handleAgentClick(fid)}
                                                    style={{
                                                        padding: '8px 10px',
                                                        fontSize: 13,
                                                        color: '#0f172a',
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #e2e8f0',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                    }}
                                                >
                                                    <span>{fid}</span>
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: '50%',
                                                            backgroundColor: friend ? getColor(friend.opinion) : '#94a3b8',
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}
                                        {selectedAgent.friends.length > 20 && (
                                            <div style={{ fontSize: 12, color: '#64748b', padding: '8px 10px' }}>
                                                +{selectedAgent.friends.length - 20} more
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}
