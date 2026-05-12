import React from 'react';
import { motion } from 'framer-motion';
import type { Step } from '../types';

interface TimestampStepperProps {
  steps: Step[];
  compact?: boolean;
}

export function TimestampStepper({ steps, compact = false }: TimestampStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full">
      {steps.map((step, idx) => (
        <React.Fragment key={step.key}>
          {/* Step node */}
          <div className="flex flex-col items-center" style={{ minWidth: compact ? 52 : 64 }}>
            <StepNode step={step} compact={compact} />
            <span
              className="mt-1 text-center leading-tight"
              style={{
                fontSize: compact ? '9px' : '10px',
                color: step.done
                  ? '#00E676'
                  : step.active
                  ? '#00D1FF'
                  : 'rgba(148,163,184,0.6)',
                fontWeight: step.active ? 600 : 400,
                letterSpacing: '0.02em',
              }}
            >
              {step.label}
            </span>
            {step.time && (
              <span
                style={{
                  fontSize: '9px',
                  color: step.done
                    ? 'rgba(0,230,118,0.7)'
                    : step.active
                    ? 'rgba(0,209,255,0.8)'
                    : 'rgba(100,116,139,0.7)',
                  fontFamily: 'JetBrains Mono, monospace',
                  marginTop: 1,
                }}
              >
                {step.time}
              </span>
            )}
          </div>

          {/* Connector line */}
          {idx < steps.length - 1 && (
            <div
              className="flex-1 h-px"
              style={{
                background: step.done
                  ? 'linear-gradient(90deg, #00E676 0%, rgba(0,230,118,0.4) 100%)'
                  : step.active
                  ? 'linear-gradient(90deg, rgba(0,209,255,0.5) 0%, rgba(148,163,184,0.15) 100%)'
                  : 'rgba(148,163,184,0.12)',
                minWidth: 8,
                marginBottom: compact ? 18 : 22,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function StepNode({ step, compact }: { step: Step; compact: boolean }) {
  const size = compact ? 22 : 26;

  if (step.done) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(0,230,118,0.15)',
          border: '1.5px solid #00E676',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(0,230,118,0.3)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="#00E676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }

  if (step.active) {
    return (
      <motion.div
        animate={{ boxShadow: ['0 0 8px rgba(0,209,255,0.4)', '0 0 18px rgba(0,209,255,0.7)', '0 0 8px rgba(0,209,255,0.4)'] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'rgba(0,209,255,0.18)',
          border: '2px solid #00D1FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#00D1FF',
          }}
        />
      </motion.div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
        border: '1.5px solid rgba(148,163,184,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'rgba(148,163,184,0.25)',
        }}
      />
    </div>
  );
}
