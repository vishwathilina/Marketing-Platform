'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface OpinionTrajectoryChartProps {
  trajectoryData: Record<string, Array<{ day: number; opinion: string }>>;
}

export default function OpinionTrajectoryChart({ trajectoryData }: OpinionTrajectoryChartProps) {
  if (!trajectoryData || Object.keys(trajectoryData).length === 0) {
    return null;
  }

  // Aggregate by day
  const dayCounts: Record<number, { day: number, POSITIVE: number, NEUTRAL: number, NEGATIVE: number }> = {};

  Object.values(trajectoryData).forEach(agentHistory => {
    agentHistory.forEach(record => {
      const { day, opinion } = record;
      if (!dayCounts[day]) {
        dayCounts[day] = { day, POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };
      }
      if (opinion === 'POSITIVE' || opinion === 'NEUTRAL' || opinion === 'NEGATIVE') {
        dayCounts[day][opinion]++;
      }
    });
  });

  const chartData = Object.values(dayCounts).sort((a, b) => a.day - b.day);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: -10 }} />
          <YAxis label={{ value: 'Agents', angle: -90, position: 'insideLeft' }} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(17, 24, 39, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} 
            itemStyle={{ color: '#fff' }}
          />
          <Legend verticalAlign="top" height={36}/>
          <Area type="monotone" dataKey="POSITIVE" stackId="1" stroke="#22c55e" fill="#22c55e" />
          <Area type="monotone" dataKey="NEUTRAL" stackId="1" stroke="#94a3b8" fill="#94a3b8" />
          <Area type="monotone" dataKey="NEGATIVE" stackId="1" stroke="#ef4444" fill="#ef4444" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
