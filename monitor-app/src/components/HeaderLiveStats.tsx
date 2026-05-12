import React from 'react'; // needed for React.ReactNode
import { motion } from 'framer-motion';
import { useLiveClock } from '../hooks/useLiveClock';
import { useAppContext } from '../App';

export function HeaderLiveStats() {
  const { time, date } = useLiveClock();
  const { kpis } = useAppContext();

  const kpiChips = [
    {
      label: 'En attente',
      value: kpis.waiting,
      color: '#94a3b8',
      bg: 'rgba(148,163,184,0.08)',
      border: 'rgba(148,163,184,0.2)',
      pulse: false,
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="5" stroke="#94a3b8" strokeWidth="1.2"/>
          <path d="M6 3v3.5l2 1" stroke="#94a3b8" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Chargement',
      value: kpis.loading,
      color: '#FFB020',
      bg: 'rgba(255,176,32,0.1)',
      border: 'rgba(255,176,32,0.3)',
      pulse: kpis.loading > 0,
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v6M3 4l3-3 3 3" stroke="#FFB020" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1 9h10" stroke="#FFB020" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label: 'Retards',
      value: kpis.delayed,
      color: '#FF5252',
      bg: 'rgba(255,82,82,0.1)',
      border: 'rgba(255,82,82,0.3)',
      pulse: kpis.delayed > 2,
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v4M6 8.5v.5" stroke="#FF5252" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M1.5 10.5l4.5-9 4.5 9H1.5z" stroke="#FF5252" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Partis',
      value: kpis.departed,
      color: '#00E676',
      bg: 'rgba(0,230,118,0.08)',
      border: 'rgba(0,230,118,0.25)',
      pulse: false,
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 6h9M8 3l3 3-3 3" stroke="#00E676" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Quais libres',
      value: kpis.freeDocks,
      color: '#00D1FF',
      bg: 'rgba(0,209,255,0.08)',
      border: 'rgba(0,209,255,0.25)',
      pulse: false,
      icon: (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <rect x="1.5" y="3.5" width="9" height="7" rx="1" stroke="#00D1FF" strokeWidth="1.1"/>
          <path d="M4 3.5V2.5a2 2 0 014 0v1" stroke="#00D1FF" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  // Split seconds out of time for big clock styling
  const [hhmm, ss] = [time.slice(0, 5), time.slice(6)];

  return (
    <header
      style={{
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(5,8,22,0.85)',
        backdropFilter: 'saturate(180%) blur(28px)',
        WebkitBackdropFilter: 'saturate(180%) blur(28px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.5)',
        flexShrink: 0,
        zIndex: 50,
      }}
    >
      {/* Left: Branding */}
      <div className="flex items-center gap-3" style={{ flex: 1 }}>
        {/* Logo mark */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(0,209,255,0.2), rgba(124,77,255,0.3))',
            border: '1px solid rgba(0,209,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,209,255,0.15)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M2 7l8-5 8 5v6l-8 5-8-5V7z" stroke="#00D1FF" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M2 7l8 5 8-5" stroke="#00D1FF" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M10 12v6" stroke="#00D1FF" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </div>

        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            TruckFlow Monitor
          </div>
          <div style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.08em' }}>
            HUB LOGISTIQUE · v1.120
          </div>
        </div>

        {/* Live indicator */}
        <div
          className="flex items-center gap-1.5 ml-4"
          style={{
            background: 'rgba(0,230,118,0.07)',
            border: '1px solid rgba(0,230,118,0.2)',
            borderRadius: 40,
            padding: '3px 10px',
          }}
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00E676',
              boxShadow: '0 0 6px rgba(0,230,118,0.8)',
            }}
          />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#00E676', letterSpacing: '0.08em' }}>
            EN DIRECT
          </span>
        </div>
      </div>

      {/* Center: XXL Clock */}
      <div className="flex flex-col items-center" style={{ flex: '0 0 auto' }}>
        <div
          className="flex items-baseline"
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 200,
            letterSpacing: '-0.02em',
          }}
        >
          <span
            style={{
              fontSize: 36,
              color: '#e2e8f0',
              textShadow: '0 0 30px rgba(0,209,255,0.25)',
            }}
          >
            {hhmm}
          </span>
          <motion.span
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ fontSize: 36, color: 'rgba(0,209,255,0.6)', margin: '0 1px' }}
          >
            :
          </motion.span>
          <span style={{ fontSize: 28, color: '#475569' }}>{ss}</span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#475569',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginTop: -2,
          }}
        >
          Mardi 12 mai 2026
        </div>
      </div>

      {/* Right: KPI chips */}
      <div className="flex items-center gap-2" style={{ flex: 1, justifyContent: 'flex-end' }}>
        {kpiChips.map((chip) => (
          <KpiChip key={chip.label} {...chip} />
        ))}
      </div>
    </header>
  );
}

function KpiChip({
  label,
  value,
  color,
  bg,
  border,
  pulse,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
  border: string;
  pulse: boolean;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      animate={
        pulse
          ? {
              boxShadow: [
                `0 0 0px ${color}00`,
                `0 0 10px ${color}44`,
                `0 0 0px ${color}00`,
              ],
            }
          : {}
      }
      transition={{ duration: 2, repeat: Infinity }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 40,
        padding: '5px 12px 5px 8px',
      }}
    >
      {icon}
      <div className="flex flex-col" style={{ lineHeight: 1 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color,
            fontFamily: 'JetBrains Mono, monospace',
            lineHeight: 1,
            textShadow: pulse ? `0 0 10px ${color}66` : 'none',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 8.5, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
    </motion.div>
  );
}
