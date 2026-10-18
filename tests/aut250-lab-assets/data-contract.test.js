const path = require('path');
const DC = require('../../dashboard/student/aut250-lab-assets/src/data-contract');
const SD = require('../../dashboard/student/aut250-lab-assets/src/scenario-data');

describe('AUT-250 lab assets — external data contract', () => {
  test('converts only within a unit family and refuses incompatible units', () => {
    const millivolts = DC.convert(12.62, 'V', 'mV');
    expect(millivolts.ok).toBe(true);
    expect(millivolts.unit).toBe('mV');
    expect(millivolts.value).toBeCloseTo(12620, 6);
    const kiloOhms = DC.convert(820, 'ohm', 'kohm');
    expect(kiloOhms.ok).toBe(true);
    expect(kiloOhms.unit).toBe('kohm');
    expect(kiloOhms.value).toBeCloseTo(0.82, 6);
    const mismatch = DC.convert(5, 'V', 'ohm');
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toMatch(/Cannot convert/);
    expect(DC.convert(5, 'V', 'furlong').ok).toBe(false);
    expect(DC.convert('five', 'V', 'mV').ok).toBe(false);
  });

  test('lists display units per measurement mode', () => {
    expect(DC.listUnitsForMode('dc-voltage')).toEqual(['V', 'mV']);
    expect(DC.listUnitsForMode('resistance')).toEqual(['ohm', 'kohm', 'Mohm']);
    expect(DC.listUnitsForMode('continuity')).toEqual([]);
    expect(DC.listUnitsForMode('made-up-mode')).toEqual([]);
  });

  test('rejects measurements that lack supplied value, unit, or a supported mode', () => {
    expect(SD.normalizeMeasurement(null).ok).toBe(false);
    expect(SD.normalizeMeasurement({ mode: 'dc-voltage' }).ok).toBe(false);
    expect(SD.normalizeMeasurement({ mode: 'dc-voltage', value: 12 }).issues[0]).toMatch(/unit/);
    expect(SD.normalizeMeasurement({ mode: 'capacitance', value: 1, unit: 'F' }).ok).toBe(false);
    expect(SD.normalizeMeasurement({ mode: 'dc-voltage', value: 12, unit: 'ohm' }).ok).toBe(false);
    expect(SD.normalizeMeasurement({ mode: 'continuity', continuity: 'maybe' }).ok).toBe(false);
    expect(SD.normalizeMeasurement({ mode: 'continuity', continuity: 'closed' }).ok).toBe(true);
  });

  test('accepts only finite, ordered waveform samples and never invents points', () => {
    const result = SD.normalizeSamples([{ t: 2, v: 3 }, { t: 1, v: 1 }, { t: 'x', v: 2 }, { t: 3 }]);
    expect(result.samples).toEqual([{ t: 1, v: 1 }, { t: 2, v: 3 }]);
    expect(result.issues).toHaveLength(2);
    expect(SD.normalizeSamples('not-an-array').ok).toBe(false);
    expect(SD.normalizeSamples([]).ok).toBe(false);
  });

  test('computes descriptive statistics and reports absent triggers honestly', () => {
    const stats = SD.computeStats([{ t: 0, v: 2 }, { t: 1, v: 6 }, { t: 2, v: 4 }]);
    expect(stats).toEqual({
      count: 3, min: 2, max: 6, mean: 4, peakToPeak: 4, firstT: 0, lastT: 2, span: 2
    });
    const samples = [{ t: 0, v: 0 }, { t: 1, v: 5 }];
    expect(SD.findTrigger(samples, 3, 'rising').found).toBe(true);
    expect(SD.findTrigger(samples, 3, 'falling').found).toBe(false);
    expect(SD.findTrigger(samples, 3, 'falling').reason).toMatch(/No falling crossing/);
    expect(SD.findTrigger(samples, 3, 'rising').t).toBe(1);
  });
});
