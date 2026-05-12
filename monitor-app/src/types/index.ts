export type DeliveryStatus = 'WAITING' | 'AT_DOCK' | 'LOADING' | 'LOADED' | 'DEPARTED' | 'ALERT';
export type StepKey = 'arrival' | 'dock' | 'loadingStart' | 'loadingEnd' | 'departure';

export interface Step {
  key: StepKey;
  label: string;
  time?: string;
  done: boolean;
  active: boolean;
}

export interface Delivery {
  id: string;
  number: string;
  destination: string;
  carrier: string;
  dock?: string;
  creneau: string;
  status: DeliveryStatus;
  delayMinutes?: number;
  palettesExpected: number;
  palettesLoaded: number;
  departureETA?: string;
  steps: Step[];
  progress: number;
}

export interface DockEntry {
  dock: string;
  deliveryId?: string;
  carrier?: string;
  destination?: string;
  startHour: number; // minutes from midnight
  endHour: number;
  status: 'free' | 'planned' | 'active' | 'done' | 'delayed';
}

export interface KPIs {
  waiting: number;
  loading: number;
  delayed: number;
  departed: number;
  freeDocks: number;
}

export interface PerformanceData {
  score: number;
  treated: number;
  avgDelay: number;
  onTimeRate: number;
  dockProductivity: number;
}

export interface AlertItem {
  id: string;
  deliveryId: string;
  number: string;
  city: string;
  creneau: string;
  delayMinutes?: number;
  dock?: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}
