import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { DockEntry } from '../types';

const STATUS_COLORS = {
  free:    { fill: 'rgba(100,116,139,0.1)',  stroke: 'rgba(100,116,139,0.2)',  label: '#64748b' },
  planned: { fill: 'rgba(0,209,255,0.12)',   stroke: 'rgba(0,209,255,0.4)',    label: '#00D1FF' },
  active:  { fill: 'rgba(255,176,32,0.15)',  stroke: 'rgba(255,176,32,0.5)',   label: '#FFB020' },
  done:    { fill: 'rgba(0,230,118,0.1)',    stroke: 'rgba(0,230,118,0.4)',    label: '#00E676' },
  delayed: { fill: 'rgba(255,82,82,0.12)',   stroke: 'rgba(255,82,82,0.5)',    label: '#FF5252' },
};

const STATUS_LABELS = {
  free:    'Libre',
  planned: 'Planifié',
  active:  'En cours',
  done:    'Terminé',
  delayed: 'Retard',
};

// Timeline: 20:00 to 04:00 next day = 8 hours = 480 minutes
const START_MINUTES = 20 * 60; // 1200
const END_MINUTES = 28 * 60;   // 1680 (04:00 next day)
const TOTAL_MINUTES = END_MINUTES - START_MINUTES; // 480

const DOCKS = ['Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11'];
const ROW_HEIGHT = 32;
const LABEL_WIDTH = 54;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 8;

function minuteToX(minutes: number, width: number): number {
  // minutes from midnight
  let m = minutes;
  if (m < START_MINUTES) m += 24 * 60; // next day
  const clamped = Math.max(START_MINUTES, Math.min(END_MINUTES, m));
  return LABEL_WIDTH + ((clamped - START_MINUTES) / TOTAL_MINUTES) * (width - LABEL_WIDTH);
}

function formatHour(minutesFromMidnight: number): string {
  const h = Math.floor(minutesFromMidnight / 60) % 24;
  const m = minutesFromMidnight % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

interface DockPlanningBoardProps {
  dockPlan: DockEntry[];
}

export function DockPlanningBoard({ dockPlan }: DockPlanningBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [currentMinutes, setCurrentMinutes] = useState(getCurrentMinutes());

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Tick current time every 30s
  useEffect(() => {
    const id = setInterval(() => setCurrentMinutes(getCurrentMinutes()), 30000);
    return () => clearInterval(id);
  }, []);

  const chartHeight = PADDING_TOP + DOCKS.length * ROW_HEIGHT + PADDING_BOTTOM;

  // Build tick marks every 30 minutes
  const ticks: number[] = [];
  for (let m = START_MINUTES; m <= END_MINUTES; m += 30) ticks.push(m);

  // Current time X position
  let curMins = currentMinutes;
  if (curMins < START_MINUTES) curMins += 24 * 60;
  const isCurrentVisible = curMins >= START_MINUTES && curMins <= END_MINUTES;
  const currentX = minuteToX(currentMinutes, width);

  // Build a map from dock name to entries
  const dockMap: Record<string, DockEntry[]> = {};
  for (const e of dockPlan) {
    if (!dockMap[e.dock]) dockMap[e.dock] = [];
    dockMap[e.dock].push(e);
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#94a3b8',
              textTransform: 'uppercase',
            }}
          >
            Planning des quais
          </span>
          <span
            style={{
              fontSize: 10,
              color: '#64748b',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 40,
              padding: '1px 8px',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            20:00 → 04:00
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3">
          {(['planned', 'active', 'done', 'delayed'] as const).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: STATUS_COLORS[s].fill,
                  border: `1px solid ${STATUS_COLORS[s].stroke}`,
                }}
              />
              <span style={{ fontSize: 10, color: '#64748b' }}>{STATUS_LABELS[s]}</span>
            </div>
          ))}
          {isCurrentVisible && (
            <div className="flex items-center gap-1.5">
              <div style={{ width: 2, height: 10, background: '#FF5252', borderRadius: 1 }} />
              <span style={{ fontSize: 10, color: '#FF5252' }}>Maintenant</span>
            </div>
          )}
        </div>
      </div>

      {/* SVG Gantt */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <svg
          width={width}
          height={chartHeight}
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Background grid lines */}
          {ticks.map((t, i) => {
            const x = minuteToX(t, width);
            const isHour = t % 60 === 0;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={PADDING_TOP}
                  x2={x}
                  y2={chartHeight - PADDING_BOTTOM}
                  stroke={isHour ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)'}
                  strokeWidth={isHour ? 1 : 0.5}
                  strokeDasharray={isHour ? undefined : '2,4'}
                />
                {/* Time label */}
                <text
                  x={x}
                  y={14}
                  textAnchor="middle"
                  fill={isHour ? '#64748b' : '#374151'}
                  fontSize={isHour ? 10 : 8}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatHour(t % (24 * 60))}
                </text>
              </g>
            );
          })}

          {/* Row backgrounds */}
          {DOCKS.map((dock, rowIdx) => {
            const y = PADDING_TOP + rowIdx * ROW_HEIGHT;
            return (
              <rect
                key={dock}
                x={LABEL_WIDTH}
                y={y}
                width={width - LABEL_WIDTH}
                height={ROW_HEIGHT - 2}
                fill={rowIdx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'}
                rx={2}
              />
            );
          })}

          {/* Dock labels */}
          {DOCKS.map((dock, rowIdx) => {
            const y = PADDING_TOP + rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
            const entries = dockMap[dock] ?? [];
            const isActive = entries.some(e => e.status === 'active' || e.status === 'delayed');
            return (
              <g key={dock}>
                <text
                  x={LABEL_WIDTH - 6}
                  y={y + 1}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill={isActive ? '#00D1FF' : '#475569'}
                  fontSize={11}
                  fontWeight={isActive ? 700 : 400}
                  fontFamily="JetBrains Mono, monospace"
                >
                  {dock}
                </text>
                {isActive && (
                  <circle
                    cx={LABEL_WIDTH - 40}
                    cy={y + 1}
                    r={3}
                    fill="#00D1FF"
                    opacity={0.8}
                  />
                )}
              </g>
            );
          })}

          {/* Dock bars */}
          {DOCKS.map((dock, rowIdx) => {
            const entries = dockMap[dock] ?? [];
            const y = PADDING_TOP + rowIdx * ROW_HEIGHT;

            return entries.map((entry, eIdx) => {
              const cfg = STATUS_COLORS[entry.status];
              const x1 = minuteToX(entry.startHour, width);
              const x2 = minuteToX(entry.endHour, width);
              const barW = Math.max(4, x2 - x1);
              const barH = ROW_HEIGHT - 6;
              const barY = y + 3;

              const label = entry.carrier && entry.destination
                ? `${entry.carrier} · ${entry.destination}`
                : '';

              return (
                <g key={`${dock}-${eIdx}`}>
                  <rect
                    x={x1}
                    y={barY}
                    width={barW}
                    height={barH}
                    rx={6}
                    fill={cfg.fill}
                    stroke={cfg.stroke}
                    strokeWidth={1}
                  />
                  {/* Label if bar is wide enough */}
                  {barW > 60 && label && (
                    <text
                      x={x1 + 8}
                      y={barY + barH / 2 + 1}
                      dominantBaseline="middle"
                      fill={cfg.label}
                      fontSize={9}
                      fontWeight={600}
                      fontFamily="Inter, system-ui, sans-serif"
                      style={{ userSelect: 'none' }}
                    >
                      {barW < 100 ? entry.carrier : label}
                    </text>
                  )}
                  {/* Pulsing overlay for active/delayed */}
                  {(entry.status === 'active' || entry.status === 'delayed') && (
                    <rect
                      x={x1}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx={6}
                      fill={entry.status === 'delayed' ? 'rgba(255,82,82,0.06)' : 'rgba(255,176,32,0.06)'}
                      stroke="none"
                    />
                  )}
                </g>
              );
            });
          })}

          {/* Current time line */}
          {isCurrentVisible && (
            <g>
              <line
                x1={currentX}
                y1={PADDING_TOP - 4}
                x2={currentX}
                y2={chartHeight - PADDING_BOTTOM}
                stroke="#FF5252"
                strokeWidth={1.5}
                strokeDasharray="4,3"
                className="current-time-line"
              />
              <polygon
                points={`${currentX - 5},${PADDING_TOP - 4} ${currentX + 5},${PADDING_TOP - 4} ${currentX},${PADDING_TOP + 4}`}
                fill="#FF5252"
              />
              <text
                x={currentX}
                y={PADDING_TOP - 8}
                textAnchor="middle"
                fill="#FF5252"
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                fontWeight={700}
              >
                {formatHour(currentMinutes)}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
