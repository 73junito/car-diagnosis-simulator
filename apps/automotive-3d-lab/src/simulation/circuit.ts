export type ProbePlacement = 'positive' | 'negative' | 'disconnected'
export function batteryVoltage(red: ProbePlacement, black: ProbePlacement, nominalVoltage = 12.6): number {
  if (red === 'disconnected' || black === 'disconnected' || red === black) return 0
  return red === 'positive' && black === 'negative' ? nominalVoltage : -nominalVoltage
}
