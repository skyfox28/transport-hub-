import { motion } from 'framer-motion';
import type { Delivery } from '../types';
import { TimestampStepper } from './TimestampStepper';
import { useAppContext } from '../App';

const STATUS_CONFIG = {
  WAITING:  { label: 'En attente',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.25)', glow: 'none' },
  AT_DOCK:  { label: 'À quai',       color: '#7C4DFF', bg: 'rgba(124,77,255,0.12)',  border: 'rgba(124,77,255,0.35)',  glow: '0 0 18px rgba(124,77,255,0.3)' },
  LOADING:  { label: 'Chargement',   color: '#FFB020', bg: 'rgba(255,176,32,0.1)',   border: 'rgba(255,176,32,0.35)',  glow: '0 0 18px rgba(255,176,32,0.25)' },
  LOADED:   { label: 'Chargé',       color: '#00E676', bg: 'rgba(0,230,118,0.1)',    border: 'rgba(0,230,118,0.35)',   glow: '0 0 18px rgba(0,230,118,0.25)' },
  DEPARTED: { label: 'Parti',        color: '#64748b', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)',  glow: 'none' },
  ALERT:    { label: 'Alerte',       color: '#FF5252', bg: 'rgba(255,82,82,0.1)',    border: 'rgba(255,82,82,0.45)',   glow: '0 0 20px rgba(255,82,82,0.3)' },
};

interface DeliveryCardProps {
  delivery: Delivery;
  index: number;
}

export function DeliveryCard({ delivery, index }: DeliveryCardProps) {
  const { selectedDeliveryId, selectDelivery } = useAppContext();
  const cfg = STATUS_CONFIG[delivery.status];
  const isSelected = selectedDeliveryId === delivery.id;
  const isAlert = delivery.status === 'ALERT';
  const pct = Math.min(100, Math.max(0, delivery.progress));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      onClick={() => selectDelivery(isSelected ? null : delivery.id)}
      style={{
        background: isSelected
          ? `linear-gradient(135deg, rgba(0,209,255,0.08) 0%, ${cfg.bg} 100%)`
          : cfg.bg,
        border: `1px solid ${isSelected ? '#00D1FF' : cfg.border}`,
        borderRadius: 18,
        padding: '14px 16px',
        cursor: 'pointer',
        boxShadow: isSelected
          ? `0 0 0 1px rgba(0,209,255,0.4), ${cfg.glow}`
          : cfg.glow,
        position: 'relative',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      {/* Alert pulse ring */}
      {isAlert && (
        <motion.div
          animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 18,
            border: '1.5px solid rgba(255,82,82,0.5)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Status stripe top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderRadius: '18px 18px 0 0',
          background: cfg.color,
          opacity: 0.8,
        }}
      />

      {/* Header row */}
      <div className="flex items-start justify-between mb-2 mt-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                fontWeight: 600,
                color: '#e2e8f0',
                letterSpacing: '0.04em',
              }}
            >
              {delivery.number}
            </span>
            {delivery.delayMinutes && delivery.delayMinutes > 0 && delivery.status !== 'DEPARTED' && (
              <motion.span
                animate={{ opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: delivery.delayMinutes > 30 ? '#FF5252' : '#FFB020',
                  background: delivery.delayMinutes > 30 ? 'rgba(255,82,82,0.15)' : 'rgba(255,176,32,0.12)',
                  border: `1px solid ${delivery.delayMinutes > 30 ? 'rgba(255,82,82,0.4)' : 'rgba(255,176,32,0.35)'}`,
                  borderRadius: 6,
                  padding: '1px 6px',
                  letterSpacing: '0.02em',
                }}
              >
                +{delivery.delayMinutes} min
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              {delivery.destination}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {delivery.carrier}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          {/* Status badge */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: cfg.color,
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              borderRadius: 40,
              padding: '2px 9px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            {cfg.label}
          </span>

          {/* Dock badge */}
          {delivery.dock ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#00D1FF',
                background: 'rgba(0,209,255,0.1)',
                border: '1px solid rgba(0,209,255,0.3)',
                borderRadius: 8,
                padding: '1px 8px',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {delivery.dock}
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(255,82,82,0.8)',
                fontStyle: 'italic',
              }}
            >
              Non assigné
            </span>
          )}
        </div>
      </div>

      {/* Middle row: créneau + ETA + palettes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="rgba(148,163,184,0.5)" strokeWidth="1"/>
              <path d="M5 2.5V5l2 1.5" stroke="rgba(148,163,184,0.6)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
              {delivery.creneau}
            </span>
          </div>
          {delivery.departureETA && delivery.status !== 'DEPARTED' && (
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 9, color: '#64748b' }}>ETA</span>
              <span style={{ fontSize: 10, color: '#00D1FF', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                {delivery.departureETA}
              </span>
            </div>
          )}
        </div>

        {/* Palettes */}
        <div className="flex items-center gap-1">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <rect x="1" y="4" width="9" height="6" rx="1" stroke="rgba(148,163,184,0.5)" strokeWidth="1"/>
            <path d="M3 4V2.5a2 2 0 014 0V4" stroke="rgba(148,163,184,0.5)" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#e2e8f0' }}>
            <span style={{ color: delivery.palettesLoaded === delivery.palettesExpected ? '#00E676' : '#e2e8f0' }}>
              {delivery.palettesLoaded}
            </span>
            <span style={{ color: '#64748b' }}>/</span>
            <span style={{ color: '#94a3b8' }}>{delivery.palettesExpected}</span>
          </span>
          <span style={{ fontSize: 9, color: '#64748b' }}>pal.</span>
        </div>
      </div>

      {/* Progress bar */}
      {delivery.status !== 'DEPARTED' && (
        <div className="mb-3">
          <div
            style={{
              height: 4,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                height: '100%',
                borderRadius: 4,
                background:
                  delivery.status === 'ALERT'
                    ? 'linear-gradient(90deg, #FF5252, #ff7b7b)'
                    : delivery.status === 'LOADING'
                    ? 'linear-gradient(90deg, #FFB020, #ffd060)'
                    : delivery.status === 'LOADED'
                    ? 'linear-gradient(90deg, #00E676, #60ffb0)'
                    : delivery.status === 'AT_DOCK'
                    ? 'linear-gradient(90deg, #7C4DFF, #a78bff)'
                    : 'linear-gradient(90deg, #94a3b8, #cbd5e1)',
                boxShadow:
                  delivery.status === 'LOADING'
                    ? '0 0 6px rgba(255,176,32,0.5)'
                    : delivery.status === 'LOADED'
                    ? '0 0 6px rgba(0,230,118,0.4)'
                    : 'none',
              }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span style={{ fontSize: 9, color: '#64748b' }}>Progression</span>
            <span style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      )}

      {/* Timestamp Stepper */}
      <TimestampStepper steps={delivery.steps} compact />
    </motion.div>
  );
}
