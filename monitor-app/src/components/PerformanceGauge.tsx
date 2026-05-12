import { motion } from 'framer-motion';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from 'recharts';
import { useAppContext } from '../App';

export function PerformanceGauge() {
  const { performance } = useAppContext();

  const gaugeData = [{ value: Math.round(performance.score), fill: '#00D1FF' }];

  const metrics = [
    {
      label: 'Livraisons traitées',
      value: performance.treated,
      unit: '',
      color: '#00E676',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7l3.5 3.5L12 4" stroke="#00E676" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Retard moyen',
      value: performance.avgDelay,
      unit: ' min',
      color: '#FFB020',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="#FFB020" strokeWidth="1.2"/>
          <path d="M7 4v3.5L9.5 9" stroke="#FFB020" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Taux à l’heure',
      value: Math.round(performance.onTimeRate),
      unit: '%',
      color: '#7C4DFF',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 10l3-4 2.5 3L10 5l2 5" stroke="#7C4DFF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Prod. quai',
      value: performance.dockProductivity,
      unit: '%',
      color: '#00D1FF',
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="7" width="2.5" height="5" rx="0.5" fill="#00D1FF"/>
          <rect x="5.75" y="4.5" width="2.5" height="7.5" rx="0.5" fill="#00D1FF" opacity="0.7"/>
          <rect x="9.5" y="2" width="2.5" height="10" rx="0.5" fill="#00D1FF" opacity="0.5"/>
        </svg>
      ),
    },
  ];

  // Score color
  const scoreColor =
    performance.score >= 85
      ? '#00E676'
      : performance.score >= 70
      ? '#FFB020'
      : '#FF5252';

  return (
    <div className="flex items-center gap-5 h-full">
      {/* Gauge */}
      <div className="flex flex-col items-center" style={{ width: 120, flexShrink: 0 }}>
        <div style={{ position: 'relative', width: 110, height: 110 }}>
          {/* Background ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(0,209,255,0.04)',
              border: '1px solid rgba(0,209,255,0.1)',
            }}
          />
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="100%"
              data={gaugeData}
              startAngle={230}
              endAngle={-50}
              barSize={10}
            >
              {/* Track */}
              <RadialBar
                dataKey="value"
                cornerRadius={5}
                background={{ fill: 'rgba(255,255,255,0.05)' }}
                fill={scoreColor}
                max={100}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <motion.span
              key={Math.round(performance.score)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: scoreColor,
                lineHeight: 1,
                textShadow: `0 0 16px ${scoreColor}66`,
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {Math.round(performance.score)}
            </motion.span>
            <span style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.08em', marginTop: 2 }}>
              SCORE
            </span>
          </div>
        </div>

        <span
          style={{
            fontSize: 10,
            color: '#64748b',
            textAlign: 'center',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: 6,
          }}
        >
          Performance globale
        </span>
      </div>

      {/* Metrics grid */}
      <div
        className="grid grid-cols-2 gap-2 flex-1"
        style={{ gridTemplateRows: 'repeat(2, auto)' }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div className="flex items-center gap-1.5">
              {m.icon}
              <span style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {m.label}
              </span>
            </div>
            <motion.span
              key={m.value}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: m.color,
                fontFamily: 'JetBrains Mono, monospace',
                lineHeight: 1,
                textShadow: `0 0 12px ${m.color}44`,
              }}
            >
              {m.value}
              <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(148,163,184,0.6)', marginLeft: 1 }}>
                {m.unit}
              </span>
            </motion.span>
          </div>
        ))}
      </div>
    </div>
  );
}
