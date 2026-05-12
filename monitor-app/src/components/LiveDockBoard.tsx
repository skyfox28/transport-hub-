import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../App';
import { DeliveryCard } from './DeliveryCard';
import type { DeliveryStatus } from '../types';

const STATUS_ORDER: Record<DeliveryStatus, number> = {
  ALERT: 0,
  LOADING: 1,
  AT_DOCK: 2,
  LOADED: 3,
  WAITING: 4,
  DEPARTED: 5,
};

export function LiveDockBoard() {
  const { deliveries } = useAppContext();

  const sorted = [...deliveries].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
  );

  const active = sorted.filter(d => d.status !== 'DEPARTED');
  const departed = sorted.filter(d => d.status === 'DEPARTED');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#00D1FF',
              boxShadow: '0 0 8px rgba(0,209,255,0.7)',
            }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase' }}>
            Quais en direct
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: '#64748b',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 40,
            padding: '2px 10px',
          }}
        >
          {active.length} actifs · {departed.length} partis
        </span>
      </div>

      {/* Scrollable grid */}
      <div
        className="overflow-y-auto flex-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {/* Active deliveries grid */}
        <AnimatePresence>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: 12,
            }}
          >
            {active.map((d, i) => (
              <DeliveryCard key={d.id} delivery={d} index={i} />
            ))}
          </div>
        </AnimatePresence>

        {/* Departed section */}
        {departed.length > 0 && (
          <div className="mt-5">
            <div
              className="flex items-center gap-2 mb-3"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6h8M7 3l3 3-3 3" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Partis
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: '#64748b',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 40,
                  padding: '1px 7px',
                }}
              >
                {departed.length}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: 10,
                opacity: 0.65,
              }}
            >
              {departed.map((d, i) => (
                <DeliveryCard key={d.id} delivery={d} index={i} />
              ))}
            </div>
          </div>
        )}

        {deliveries.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="rgba(148,163,184,0.2)" strokeWidth="2"/>
              <path d="M12 20h16M20 12l8 8-8 8" stroke="rgba(148,163,184,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ color: '#475569', fontSize: 14 }}>Aucune livraison active</span>
          </div>
        )}
      </div>
    </div>
  );
}
