import { motion } from 'framer-motion';
import type { DockEntry } from '../types';
import { HeaderLiveStats } from './HeaderLiveStats';
import { AlertPanel } from './AlertPanel';
import { LiveDockBoard } from './LiveDockBoard';
import { DeliveryTimeline } from './DeliveryTimeline';
import { DockPlanningBoard } from './DockPlanningBoard';
import { PerformanceGauge } from './PerformanceGauge';

interface MonitorLayoutProps {
  dockPlan: DockEntry[];
}

export function MonitorLayout({ dockPlan }: MonitorLayoutProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        maxWidth: 1920,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: '#050816',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient orbs */}
      <div
        className="orb orb-blue"
        style={{
          width: 800,
          height: 800,
          top: -200,
          left: -150,
          opacity: 0.25,
          animationDelay: '0s',
        }}
      />
      <div
        className="orb orb-violet"
        style={{
          width: 700,
          height: 700,
          top: -100,
          right: -100,
          opacity: 0.2,
          animationDelay: '-4s',
        }}
      />
      <div
        className="orb orb-cyan"
        style={{
          width: 500,
          height: 500,
          bottom: 50,
          left: '30%',
          opacity: 0.12,
          animationDelay: '-8s',
        }}
      />
      <div
        className="orb orb-amber"
        style={{
          width: 400,
          height: 400,
          bottom: -100,
          right: '20%',
          opacity: 0.1,
          animationDelay: '-2s',
        }}
      />

      {/* Header */}
      <HeaderLiveStats />

      {/* Main 3-column area */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '20% 1fr 25%',
          gap: 12,
          padding: '12px 16px 0',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left: Alert Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 18,
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AlertPanel />
        </motion.div>

        {/* Center: Live Dock Board */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          style={{
            background: 'rgba(15,23,42,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 18,
            padding: '14px 14px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <LiveDockBoard />
        </motion.div>

        {/* Right: Delivery Timeline */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <DeliveryTimeline />
        </motion.div>
      </div>

      {/* Bottom: Dock Planning + Performance */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 380px',
          gap: 12,
          padding: '12px 16px 14px',
          height: 200,
        }}
      >
        {/* Gantt */}
        <div
          style={{
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 18,
            padding: '12px 16px',
            overflow: 'hidden',
          }}
        >
          <DockPlanningBoard dockPlan={dockPlan} />
        </div>

        {/* Performance Gauge */}
        <div
          style={{
            background: 'rgba(15,23,42,0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 18,
            padding: '12px 16px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Indicateurs de performance
          </div>
          <PerformanceGauge />
        </div>
      </motion.div>
    </div>
  );
}
