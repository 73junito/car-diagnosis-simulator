import { describe, expect, it } from 'vitest'
import { batteryVoltage } from './circuit'
describe('battery voltage training model', () => {
  it('reads nominal voltage with correct polarity', () => expect(batteryVoltage('positive','negative')).toBe(12.6))
  it('reads reverse polarity as negative', () => expect(batteryVoltage('negative','positive')).toBe(-12.6))
  it('reads zero with same or disconnected terminals', () => { expect(batteryVoltage('positive','positive')).toBe(0); expect(batteryVoltage('disconnected','negative')).toBe(0) })
})
