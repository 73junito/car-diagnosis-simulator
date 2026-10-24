export type ProbePlacement = 'positive' | 'negative' | 'disconnected'
export type Fault = 'healthy' | 'discharged' | 'open' | 'resistance'
export type Measurement = { voltage: number; status: string }
const FAULT_VOLTAGES: Record<Fault, number> = { healthy: 12.6, discharged: 10.5, open: 0, resistance: 11.8 }
export function batteryVoltage(red: ProbePlacement, black: ProbePlacement, nominalVoltage = 12.6): number {
  if (red === 'disconnected' || black === 'disconnected' || red === black) return 0
  return red === 'positive' && black === 'negative' ? nominalVoltage : -nominalVoltage
}
export function measure(red: ProbePlacement, black: ProbePlacement, fault: Fault): Measurement {
  const status = { healthy: 'Reference battery', discharged: 'Discharged battery', open: 'Open-circuit training fault', resistance: 'Simulated load / voltage drop' }[fault]
  return { voltage: batteryVoltage(red, black, FAULT_VOLTAGES[fault]), status }
}
