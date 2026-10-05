export type TruckStatus = 'on-time' | 'delayed' | 'critical' | 'resolved';

export interface Truck {
  id: string;
  cargoValue: number;
  velocity: number;
  status: TruckStatus;
  position: [number, number];
  destination: [number, number];
  route: [number, number][];
  driver: string;
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
}
