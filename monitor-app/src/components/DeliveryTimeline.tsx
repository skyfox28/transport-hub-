import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../App';
import type { Step } from '../types';

const STEP_ICONS: Record<string, React.ReactNode> = {
  arrival: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1l2 4h4l-3 2.5 1 4L7 9l-4 2.5 1-4L1 5h4z" fill="currentColor" />
    </svg>
  ),
  dock: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="5" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  loadingStart: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v6M4 5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  loadingEnd: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  departure: (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 7h10M9 4l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export function DeliveryTimeline() {
  const { deliveries, selectedDeliveryId, selectDelivery } = useAppContext();
  const delivery = deliveries.find(d => d.id === selectedDeliveryId) ?? null;

  return (
    <AnimatePresence mode="wait">
      {delivery ? (
        <motion.div
          key={delivery.id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 30 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="flex flex-col h-full"
          style={{
            background: 'rgba(15,23,42,0.8)',
            border: '1px solid rgba(0,209,255,0.2)',
            borderRadius: 18,
            padding: '20px 18px',
            boxShadow: '0 0 30px rgba(0,209,255,0.08)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5 flex-shrink-0">
            <div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#64748b',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                Détail livraison
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', marginTop: 2 }}>
                {delivery.destination}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: '#00D1FF',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 2,
                }}
              >
                {delivery.number}
              </div>
            </div>
            <button
              onClick={() => selectDelivery(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#94a3b8',
                cursor: 'pointer',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Info grid */}
          <div
            className="grid grid-cols-2 gap-2 mb-5 flex-shrink-0"
            style={{ fontSize: 11 }}
          >
            <InfoCell label="Transporteur" value={delivery.carrier} />
            <InfoCell
              label="Quai"
              value={delivery.dock ?? 'Non assigné'}
              valueColor={delivery.dock ? '#00D1FF' : '#FF5252'}
            />
            <InfoCell label="Créneau" value={delivery.creneau} mono />
            {delivery.departureETA && (
              <InfoCell label="ETA départ" value={delivery.departureETA} mono valueColor="#00D1FF" />
            )}
            <InfoCell
              label="Palettes"
              value={`${delivery.palettesLoaded} / ${delivery.palettesExpected}`}
              mono
              valueColor={delivery.palettesLoaded === delivery.palettesExpected ? '#00E676' : '#e2e8f0'}
            />
            {delivery.delayMinutes && delivery.delayMinutes > 0 ? (
              <InfoCell
                label="Retard"
                value={`+${delivery.delayMinutes} min`}
                valueColor={delivery.delayMinutes > 30 ? '#FF5252' : '#FFB020'}
                mono
              />
            ) : (
              <InfoCell label="Retard" value="À l'heure" valueColor="#00E676" />
            )}
          </div>

          {/* Progress */}
          <div className="mb-5 flex-shrink-0">
            <div className="flex justify-between mb-1.5">
              <span style={{ fontSize: 10, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Progression
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace' }}>
                {Math.round(delivery.progress)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <motion.div
                animate={{ width: `${delivery.progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                style={{
                  height: '100%',
                  borderRadius: 6,
                  background:
                    delivery.status === 'ALERT'
                      ? 'linear-gradient(90deg, #FF5252, #ff8080)'
                      : delivery.status === 'LOADING' || delivery.status === 'AT_DOCK'
                      ? 'linear-gradient(90deg, #00D1FF, #7C4DFF)'
                      : 'linear-gradient(90deg, #00E676, #00D1FF)',
                  boxShadow: '0 0 8px rgba(0,209,255,0.4)',
                }}
              />
            </div>
          </div>

          {/* Vertical Timeline */}
          <div
            className="flex-1 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}
          >
            <span
              style={{
                fontSize: 10,
                color: '#64748b',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: 14,
              }}
            >
              Étapes de passage
            </span>
            <div className="flex flex-col gap-0">
              {delivery.steps.map((step, idx) => (
                <TimelineStep
                  key={step.key}
                  step={step}
                  isLast={idx === delivery.steps.length - 1}
                />
              ))}
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center justify-center h-full gap-4"
          style={{
            background: 'rgba(15,23,42,0.4)',
            border: '1px dashed rgba(255,255,255,0.08)',
            borderRadius: 18,
          }}
        >
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" stroke="rgba(0,209,255,0.2)" strokeWidth="1.5"/>
              <path
                d="M24 14v12l7 4"
                stroke="rgba(0,209,255,0.35)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
          <div className="text-center">
            <p style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              Sélectionner une livraison
            </p>
            <p style={{ fontSize: 11, color: '#334155', marginTop: 4 }}>
              Cliquez sur une carte pour voir le détail
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function InfoCell({
  label,
  value,
  valueColor = '#e2e8f0',
  mono = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '7px 10px',
      }}
    >
      <div style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: valueColor,
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TimelineStep({ step, isLast }: { step: Step; isLast: boolean }) {
  const color = step.done ? '#00E676' : step.active ? '#00D1FF' : 'rgba(148,163,184,0.3)';
  const lineColor = step.done ? 'rgba(0,230,118,0.3)' : 'rgba(255,255,255,0.06)';

  return (
    <div className="flex gap-3">
      {/* Left column: icon + line */}
      <div className="flex flex-col items-center" style={{ width: 28 }}>
        <motion.div
          animate={
            step.active
              ? {
                  boxShadow: [
                    '0 0 0 0 rgba(0,209,255,0)',
                    '0 0 0 6px rgba(0,209,255,0.2)',
                    '0 0 0 0 rgba(0,209,255,0)',
                  ],
                }
              : {}
          }
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: step.done
              ? 'rgba(0,230,118,0.12)'
              : step.active
              ? 'rgba(0,209,255,0.12)'
              : 'rgba(255,255,255,0.03)',
            border: `1.5px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            flexShrink: 0,
          }}
        >
          {step.done ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="#00E676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            STEP_ICONS[step.key]
          )}
        </motion.div>

        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              minHeight: 24,
              background: lineColor,
              margin: '3px 0',
            }}
          />
        )}
      </div>

      {/* Right column: label + time */}
      <div
        style={{
          paddingBottom: isLast ? 0 : 20,
          paddingTop: 4,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: step.active ? 700 : 500,
            color: step.done ? '#00E676' : step.active ? '#00D1FF' : '#64748b',
            marginBottom: 2,
          }}
        >
          {step.label}
        </div>
        {step.time ? (
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace',
              color: step.done ? 'rgba(0,230,118,0.9)' : step.active ? '#00D1FF' : '#94a3b8',
            }}
          >
            {step.time}
          </span>
        ) : step.active ? (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{
              fontSize: 11,
              color: '#00D1FF',
              fontStyle: 'italic',
            }}
          >
            En cours…
          </motion.span>
        ) : (
          <span style={{ fontSize: 11, color: '#334155' }}>—</span>
        )}
      </div>
    </div>
  );
}
