export type TruckStatus = 'on-time' | 'delayed' | 'critical' | 'resolved' | 'signal-lost';

export interface Truck {
  id: string;
  cargoValue: number;
  velocity: number;
  status: TruckStatus;
  position: [number, number];
  destination: [number, number];
  route: [number, number][];
  driver: string;
  // Decision-engine fields (present when connected to the backend)
  contractId?: string;
  stopped?: boolean;
  stoppedMinutes?: number;
  incident?: string;
  incidentId?: string;
  incidentSource?: '' | 'telematics' | 'dispatcher';
  silentMinutes?: number;
  recommendation?: string;
  summary?: string;
  exposure?: number;
  etaHours?: number;
  slackHours?: number;
  remainingKm?: number;
  latenessHours?: number;
  deadlineHoursLeft?: number;
  netSavings?: number;
  confidence?: number;
  best?: string;
  options?: DecisionOption[];
  client?: string;
  slaHours?: number;
  penaltyPerHour?: number;
  maxPenalty?: number;
  graceMinutes?: number;
}

export interface AgentEvent {
  id: string;
  timestamp: Date;
  type: 'sensor' | 'contract' | 'market' | 'alert' | 'arbitrage' | 'system';
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ArbitrageOpportunity {
  truckId: string;
  projectedPenalty: number;
  solutionType: string;
  solutionCost: number;
  netSavings: number;
  details: string;
  incidentId?: string;
  recommendation?: string;
  confidence?: number;
  etaHours?: number;
  extraCo2Kg?: number;
  spoilageAvoided?: number;
  options?: DecisionOption[];
}

// One way of handling an incident, as scored by the decision engine
export interface DecisionOption {
  kind: 'wait' | 'relief';
  label: string;
  provider: string;
  direct_cost: number;
  expected_cost: number;
  arrival_hours: number;
  lateness_hours: number;
  reliability: number;
  extra_co2_kg: number;
}

// An operator decision (executed or ignored)
export interface DecisionRecord {
  id: string;
  time: string;
  truckId: string;
  contractId: string;
  incident: string;
  action: 'execute' | 'dismiss';
  option: string;
  exposure: number;
  cost: number;
  netSavings: number;
  penaltyAvoided: number;
  extraCo2Kg: number;
}
