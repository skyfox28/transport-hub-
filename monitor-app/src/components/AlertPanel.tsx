import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../App';
import type { AlertItem } from '../types';

const SEVERITY_CONFIG = {
  critical: {
    border: '#FF5252',
    bg: 'rgba(255,82,82,0.08)',
    dot: '#FF5252',
    dotGlow: 'rgba(255,82,82,0.6)',
    label: 'Critique',
    labelColor: '#FF5252',
    labelBg: 'rgba(255,82,82,0.15)',
  },
  warning: {
    border: '#FFB020',
    bg: 'rgba(255,176,32,0.07)',
    dot: '#FFB020',
    dotGlow: 'rgba(255,176,32,0.5)',
    label: 'Attention',
    labelColor: '#FFB020',
    labelBg: 'rgba(255,176,32,0.12)',
  },
  info: {
    border: 'rgba(0,209,255,0.35)',
    bg: 'rgba(0,209,255,0.05)',
    dot: '#00D1FF',
    dotGlow: 'rgba(0,209,255,0.4)',
    label: 'Info',
    labelColor: '#00D1FF',
    labelBg: 'rgba(0,209,255,0.1)',
  },
};

export function AlertPanel() {
  const { alerts, dismissAlert, selectDelivery } = useAppContext();

  const sorted = [...alerts].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Panel header */}
      <div className="flex-shrink-0 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#FF5252',
                  boxShadow: '0 0 8px rgba(255,82,82,0.8)',
                }}
              />
            )}
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase' }}>
              Alertes
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {criticalCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#FF5252',
                  background: 'rgba(255,82,82,0.15)',
                  border: '1px solid rgba(255,82,82,0.3)',
                  borderRadius: 40,
                  padding: '1px 7px',
                }}
              >
                {criticalCount} crit.
              </span>
            )}
            {warningCount > 0 && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#FFB020',
                  background: 'rgba(255,176,32,0.12)',
                  border: '1px solid rgba(255,176,32,0.25)',
                  borderRadius: 40,
                  padding: '1px 7px',
                }}
              >
                {warningCount}
              </span>
            )}
          </div>
        </div>

        {/* Summary bar */}
        <div
          style={{
            display: 'flex',
            height: 3,
            borderRadius: 2,
            overflow: 'hidden',
            gap: 1,
          }}
        >
          {criticalCount > 0 && (
            <motion.div
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{
                flex: criticalCount,
                background: '#FF5252',
                borderRadius: 2,
              }}
            />
          )}
          {warningCount > 0 && (
            <div style={{ flex: warningCount, background: '#FFB020', borderRadius: 2 }} />
          )}
          <div
            style={{
              flex: alerts.filter(a => a.severity === 'info').length,
              background: '#00D1FF',
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Alert list */}
      <div
        className="flex-1 overflow-y-auto flex flex-col gap-2"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
      >
        <AnimatePresence mode="popLayout">
          {sorted.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDismiss={() => dismissAlert(alert.id)}
              onSelect={() => selectDelivery(alert.deliveryId)}
            />
          ))}
        </AnimatePresence>

        {alerts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-32 gap-2"
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="12" stroke="rgba(0,230,118,0.3)" strokeWidth="1.5"/>
              <path d="M9 14l3.5 3.5L19 10" stroke="#00E676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 12, color: '#00E676', opacity: 0.7 }}>Aucune alerte active</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  onDismiss,
  onSelect,
}: {
  alert: AlertItem;
  onDismiss: () => void;
  onSelect: () => void;
}) {
  const cfg = SEVERITY_CONFIG[alert.severity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20, height: 0 }}
      animate={{ opacity: 1, x: 0, height: 'auto' }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.border}`,
        borderRadius: 12,
        padding: '10px 12px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
      onClick={onSelect}
    >
      {/* Animated shimmer on critical */}
      {alert.severity === 'critical' && (
        <motion.div
          animate={{ opacity: [0, 0.06, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,82,82,0.15), transparent)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Top row: severity + number + time */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <motion.div
            animate={
              alert.severity === 'critical'
                ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }
                : {}
            }
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: cfg.dot,
              boxShadow: `0 0 6px ${cfg.dotGlow}`,
            }}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: cfg.labelColor,
              background: cfg.labelBg,
              borderRadius: 5,
              padding: '1px 5px',
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
            }}
          >
            {cfg.label}
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#e2e8f0',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}
          >
            {alert.number}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 9, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
            {alert.timestamp}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(148,163,184,0.5)',
              padding: '0 2px',
              lineHeight: 1,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* City + creneau */}
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>
          {alert.city}
        </span>
        <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
          {alert.creneau}
        </span>
      </div>

      {/* Message */}
      <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4, margin: '0 0 8px' }}>
        {alert.message}
      </p>

      {/* Bottom row: delay + dock + action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {alert.delayMinutes !== undefined && alert.delayMinutes > 0 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: alert.delayMinutes > 30 ? '#FF5252' : '#FFB020',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              +{alert.delayMinutes} min
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              color: alert.dock ? '#00D1FF' : 'rgba(255,82,82,0.8)',
              background: alert.dock ? 'rgba(0,209,255,0.08)' : 'rgba(255,82,82,0.08)',
              border: `1px solid ${alert.dock ? 'rgba(0,209,255,0.25)' : 'rgba(255,82,82,0.25)'}`,
              borderRadius: 6,
              padding: '1px 6px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 600,
            }}
          >
            {alert.dock || 'Quai non assigné'}
          </span>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: cfg.labelColor,
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${cfg.border}`,
            borderRadius: 6,
            padding: '3px 8px',
            cursor: 'pointer',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Voir détail
        </motion.button>
      </div>
    </motion.div>
  );
}
