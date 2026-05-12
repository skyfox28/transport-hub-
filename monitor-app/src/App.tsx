import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { Delivery, KPIs, PerformanceData } from './types';
import type { AlertItem } from './types';
import { initialDeliveries, initialAlerts, initialPerformance, generateDockPlan } from './data/mockData';
import { MonitorLayout } from './components/MonitorLayout';

// ── Context ─────────────────────────────────────────────────────────────────

interface AppState {
  deliveries: Delivery[];
  alerts: AlertItem[];
  kpis: KPIs;
  performance: PerformanceData;
  selectedDeliveryId: string | null;
  selectDelivery: (id: string | null) => void;
  dismissAlert: (id: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useAppContext(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeKPIs(deliveries: Delivery[]): KPIs {
  const waiting = deliveries.filter(d => d.status === 'WAITING').length;
  const loading = deliveries.filter(d => d.status === 'LOADING' || d.status === 'AT_DOCK').length;
  const delayed = deliveries.filter(d => (d.delayMinutes ?? 0) > 0 && d.status !== 'DEPARTED').length;
  const departed = deliveries.filter(d => d.status === 'DEPARTED').length;
  const usedDocks = new Set(
    deliveries.filter(d => d.dock && d.status !== 'DEPARTED').map(d => d.dock)
  ).size;
  const totalDocks = 10; // Q02–Q11
  const freeDocks = totalDocks - usedDocks;
  return { waiting, loading, delayed, departed, freeDocks };
}

function tickDelivery(d: Delivery): Delivery {
  if (d.status === 'DEPARTED' || d.status === 'ALERT') return d;

  // Progress creep
  let newProgress = d.progress;
  if (d.status === 'LOADING') {
    newProgress = Math.min(100, d.progress + Math.random() * 3);
  } else if (d.status === 'AT_DOCK') {
    newProgress = Math.min(30, d.progress + Math.random() * 1.5);
  }

  // Palette sync
  const newLoaded = Math.min(
    d.palettesExpected,
    Math.round((newProgress / 100) * d.palettesExpected)
  );

  // Transition: LOADING → LOADED at 95%+
  let newStatus = d.status;
  const updatedSteps = [...d.steps];
  if (d.status === 'LOADING' && newProgress >= 95) {
    newStatus = 'LOADED';
    newProgress = 90;
    updatedSteps[3] = { ...updatedSteps[3], done: true, active: false };
    updatedSteps[4] = { ...updatedSteps[4], active: true };
  }

  return {
    ...d,
    status: newStatus,
    progress: newProgress,
    palettesLoaded: newLoaded,
    steps: updatedSteps,
  };
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [performance, setPerformance] = useState<PerformanceData>(initialPerformance);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const alertCounterRef = useRef(6);

  // Live update tick — every 4s
  useEffect(() => {
    const id = setInterval(() => {
      setDeliveries(prev => {
        // Pick one random LOADING delivery to progress
        const loadingIndexes = prev
          .map((d, i) => ({ d, i }))
          .filter(({ d }) => d.status === 'LOADING' || d.status === 'AT_DOCK');
        if (loadingIndexes.length === 0) return prev;
        const pick = loadingIndexes[Math.floor(Math.random() * loadingIndexes.length)];
        return prev.map((d, i) => (i === pick.i ? tickDelivery(d) : d));
      });

      // Update performance score slightly
      setPerformance(prev => ({
        ...prev,
        score: Math.min(99, Math.max(70, prev.score + (Math.random() - 0.45) * 1.2)),
        onTimeRate: Math.min(99, Math.max(60, prev.onTimeRate + (Math.random() - 0.45) * 0.8)),
      }));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // Alert injection — every 12s
  useEffect(() => {
    const cities = ['PERPIGNAN', 'MONTPELLIER', 'GRENOBLE', 'STRASBOURG', 'CAEN'];
    const severities: AlertItem['severity'][] = ['critical', 'warning', 'info'];
    const messages = [
      'Délai de chargement dépassé',
      'Transporteur signale un retard',
      'Quai libéré — prêt pour prochain',
      'Retard silo — marchandise non préparée',
      'Chargement terminé — départ imminent',
    ];
    const id = setInterval(() => {
      const n = alertCounterRef.current++;
      const sev = severities[Math.floor(Math.random() * severities.length)];
      const delay = sev === 'critical' ? 55 + Math.floor(Math.random() * 40) :
                    sev === 'warning'  ? 20 + Math.floor(Math.random() * 20) : undefined;
      const now = new Date();
      const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const newAlert: AlertItem = {
        id: `a${String(n).padStart(3,'0')}`,
        deliveryId: `d00${n}`,
        number: `804${10000 + n * 37}`,
        city: cities[n % cities.length],
        creneau: '22:00–00:00',
        delayMinutes: delay,
        dock: n % 3 === 0 ? undefined : `Q${String(2 + (n % 10)).padStart(2,'0')}`,
        severity: sev,
        message: messages[n % messages.length],
        timestamp: ts,
      };
      setAlerts(prev => [newAlert, ...prev].slice(0, 20));
    }, 12000);
    return () => clearInterval(id);
  }, []);

  const kpis = computeKPIs(deliveries);

  const selectDelivery = useCallback((id: string | null) => {
    setSelectedDeliveryId(id);
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  return (
    <AppContext.Provider
      value={{ deliveries, alerts, kpis, performance, selectedDeliveryId, selectDelivery, dismissAlert }}
    >
      <MonitorLayout dockPlan={generateDockPlan()} />
    </AppContext.Provider>
  );
}
