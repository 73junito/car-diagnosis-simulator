import { describe, expect, it } from 'vitest'
import { batteryVoltage, measure } from './circuit'
describe('battery measurement model', () => {
  it('reads correct polarity', () => expect(batteryVoltage('positive', 'negative')).toBe(12.6))
  it('reads reverse polarity', () => expect(batteryVoltage('negative', 'positive')).toBe(-12.6))
  it('reads zero for same and disconnected terminals', () => {
    expect(batteryVoltage('positive','positive')).toBe(0)
    expect(batteryVoltage('disconnected','negative')).toBe(0)
  })
  it.each([['healthy',12.6],['discharged',10.5],['open',0],['resistance',11.8]] as const)('applies %s condition deterministically', (fault,value) => {
    expect(measure('positive','negative',fault).voltage).toBe(value)
  })
  it('never fabricates a voltage with an unconnected probe', () => expect(measure('disconnected','negative','healthy').voltage).toBe(0))
  it('maintains negative polarity under faults', () => expect(measure('negative','positive','discharged').voltage).toBe(-10.5))
})
