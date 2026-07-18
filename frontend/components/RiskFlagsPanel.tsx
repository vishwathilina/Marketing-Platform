'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, MessageCircle } from 'lucide-react';

type RiskReaction = {
    agent_id?: string;
    reasoning?: string;
};

type RiskFlag = {
    flag_type: string;
    severity: string;
    description: string;
    affected_demographics?: Record<string, unknown> | null;
    sample_agent_reactions?: RiskReaction[] | null;
};

const SEVERITY_ORDER: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
};

const SEVERITY_STYLES: Record<string, { border: string; badge: string; label: string }> = {
    CRITICAL: {
        border: 'border-l-red-600',
        badge: 'bg-red-100 text-red-800 border-red-200',
        label: 'text-red-700',
    },
    HIGH: {
        border: 'border-l-orange-500',
        badge: 'bg-orange-100 text-orange-800 border-orange-200',
        label: 'text-orange-700',
    },
    MEDIUM: {
        border: 'border-l-amber-500',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        label: 'text-amber-700',
    },
    LOW: {
        border: 'border-l-slate-400',
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        label: 'text-slate-600',
    },
};

function humanizeLabel(value: string): string {
    return value
        .replace(/[_=]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryFromFlagType(flagType: string): string {
    return flagType.replace(/_BACKLASH$/i, '').toLowerCase();
}

function parseFlag(flag: RiskFlag) {
    const category = categoryFromFlagType(flag.flag_type || 'unknown');
    const severity = (flag.severity || 'LOW').toUpperCase();

    let segment = '';
    if (flag.affected_demographics && typeof flag.affected_demographics === 'object') {
        const values = Object.values(flag.affected_demographics);
        if (values.length > 0 && values[0] != null) {
            segment = String(values[0]);
        }
    }

    const descMatch = flag.description?.match(
        /^(\d+)%\s+of\s+(?:([^=\s]+)=)?(.+?)\s+reacted\s+negatively/i
    );
    const pct = descMatch ? Number(descMatch[1]) : null;
    if (!segment && descMatch) {
        segment = descMatch[3] || '';
    }

    const isOverall = category === 'overall';
    const segmentLabel = isOverall
        ? 'all agents'
        : humanizeLabel(segment || 'Unknown segment');
    const categoryLabel = isOverall ? 'Overall' : humanizeLabel(category);

    return {
        ...flag,
        category,
        categoryLabel,
        segmentLabel,
        severity,
        pct,
        isOverall,
        summary: pct != null
            ? `${pct}% of ${segmentLabel} reacted negatively`
            : flag.description,
    };
}

function worstSeverity(severities: string[]): string {
    return [...severities].sort(
        (a, b) => (SEVERITY_ORDER[a] ?? 9) - (SEVERITY_ORDER[b] ?? 9)
    )[0] || 'LOW';
}

function SeverityBadge({ severity }: { severity: string }) {
    const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW;
    return (
        <span className={`text-xs font-semibold px-2 py-0.5 border ${styles.badge}`}>
            {severity}
        </span>
    );
}

function ReactionList({ reactions }: { reactions: RiskReaction[] }) {
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? reactions : reactions.slice(0, 1);
    const remaining = reactions.length - 1;

    return (
        <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-slate-500">Sample reactions</p>
            {visible.map((reaction, i) => {
                const text = reaction.reasoning || '';
                return (
                    <div key={i} className="text-xs text-slate-600 flex items-start gap-2">
                        <MessageCircle className="w-3 h-3 mt-0.5 flex-shrink-0 text-slate-400" />
                        <span className="leading-relaxed">
                            &ldquo;{text}{text.length >= 120 ? '…' : ''}&rdquo;
                        </span>
                    </div>
                );
            })}
            {remaining > 0 && (
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                    {expanded ? 'Show fewer reactions' : `Show ${remaining} more reaction${remaining === 1 ? '' : 's'}`}
                </button>
            )}
        </div>
    );
}

function OverallCard({ flag }: { flag: ReturnType<typeof parseFlag> }) {
    const styles = SEVERITY_STYLES[flag.severity] || SEVERITY_STYLES.LOW;
    const reactions = flag.sample_agent_reactions || [];

    return (
        <div className={`border border-slate-200 border-l-4 ${styles.border} bg-white p-4`}>
            <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                    <p className="text-sm font-semibold text-slate-900">Overall backlash</p>
                    <p className="text-sm text-slate-600 mt-1">{flag.summary}</p>
                </div>
                <SeverityBadge severity={flag.severity} />
            </div>
            {reactions.length > 0 && <ReactionList reactions={reactions} />}
        </div>
    );
}

function SegmentGroup({
    categoryLabel,
    severity,
    flags,
    defaultOpen,
}: {
    categoryLabel: string;
    severity: string;
    flags: ReturnType<typeof parseFlag>[];
    defaultOpen: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const styles = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW;
    const preview = flags.map((f) => f.segmentLabel).join(', ');

    return (
        <div className={`border border-slate-200 border-l-4 ${styles.border} bg-white`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50/80"
            >
                <div className="flex items-start gap-2 min-w-0">
                    {open ? (
                        <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                    ) : (
                        <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">
                            {categoryLabel}
                            <span className="ml-2 text-xs font-medium text-slate-400">
                                ({flags.length})
                            </span>
                        </p>
                        {!open && (
                            <p className="text-xs text-slate-500 mt-1 truncate">{preview}</p>
                        )}
                    </div>
                </div>
                <SeverityBadge severity={severity} />
            </button>

            {open && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {flags.map((flag, index) => {
                        const reactions = flag.sample_agent_reactions || [];
                        return (
                            <div key={`${flag.segmentLabel}-${index}`} className="px-4 py-3 pl-10">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">
                                            {flag.segmentLabel}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-0.5">{flag.summary}</p>
                                    </div>
                                    <SeverityBadge severity={flag.severity} />
                                </div>
                                {reactions.length > 0 && <ReactionList reactions={reactions} />}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default function RiskFlagsPanel({ flags }: { flags: RiskFlag[] }) {
    const { overall, groups, counts, takeaway } = useMemo(() => {
        const parsed = flags.map(parseFlag);
        const overallFlags = parsed.filter((f) => f.isOverall);
        const segmentFlags = parsed.filter((f) => !f.isOverall);

        const byCategory = new Map<string, ReturnType<typeof parseFlag>[]>();
        for (const flag of segmentFlags) {
            const list = byCategory.get(flag.category) || [];
            list.push(flag);
            byCategory.set(flag.category, list);
        }

        const grouped = Array.from(byCategory.entries())
            .map(([category, items]) => {
                const sorted = [...items].sort(
                    (a, b) =>
                        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
                        a.segmentLabel.localeCompare(b.segmentLabel)
                );
                return {
                    category,
                    categoryLabel: humanizeLabel(category),
                    severity: worstSeverity(sorted.map((f) => f.severity)),
                    flags: sorted,
                };
            })
            .sort(
                (a, b) =>
                    (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
                    a.categoryLabel.localeCompare(b.categoryLabel)
            );

        const severityCounts: Record<string, number> = {
            CRITICAL: 0,
            HIGH: 0,
            MEDIUM: 0,
            LOW: 0,
        };
        for (const flag of parsed) {
            severityCounts[flag.severity] = (severityCounts[flag.severity] || 0) + 1;
        }

        const criticalCategories = grouped
            .filter((g) => g.severity === 'CRITICAL' || g.severity === 'HIGH')
            .map((g) => g.categoryLabel.toLowerCase());

        let takeawayText = '';
        if (criticalCategories.length === 1) {
            takeawayText = `Strongest backlash in ${criticalCategories[0]} segments`;
        } else if (criticalCategories.length === 2) {
            takeawayText = `Strongest backlash in ${criticalCategories[0]} and ${criticalCategories[1]} segments`;
        } else if (criticalCategories.length > 2) {
            const head = criticalCategories.slice(0, -1).join(', ');
            const tail = criticalCategories[criticalCategories.length - 1];
            takeawayText = `Strongest backlash in ${head}, and ${tail} segments`;
        } else if (overallFlags[0]) {
            takeawayText = overallFlags[0].summary;
        }

        return {
            overall: overallFlags[0] || null,
            groups: grouped,
            counts: severityCounts,
            takeaway: takeawayText,
        };
    }, [flags]);

    const summaryParts = (['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const)
        .filter((level) => counts[level] > 0)
        .map((level) => `${counts[level]} ${humanizeLabel(level)}`);

    return (
        <div className="border border-slate-200 bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                <div>
                    <h3 className="text-lg font-semibold flex items-center">
                        <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
                        Risk Flags
                    </h3>
                    {takeaway && (
                        <p className="text-sm text-slate-500 mt-1">{takeaway}</p>
                    )}
                </div>
                <p className="text-xs font-medium text-slate-500 sm:text-right">
                    {summaryParts.join(' · ')}
                </p>
            </div>

            <div className="space-y-3">
                {overall && <OverallCard flag={overall} />}

                {groups.length > 0 && (
                    <div className="space-y-3">
                        {overall && (
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2">
                                Segment risks
                            </p>
                        )}
                        {groups.map((group, index) => (
                            <SegmentGroup
                                key={group.category}
                                categoryLabel={group.categoryLabel}
                                severity={group.severity}
                                flags={group.flags}
                                defaultOpen={index === 0 && group.severity === 'CRITICAL'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
