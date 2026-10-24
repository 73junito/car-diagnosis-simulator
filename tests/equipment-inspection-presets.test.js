/** @jest-environment node */
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../src/presentation/equipment-inspection-presets.js'),'utf8');
function api(){const context={};vm.runInNewContext(source,context);return context.AutoLearnProEquipmentInspection}
describe('presentation-only inspection views',()=>{
 test('four camera presets and no measurements or assessment state',()=>{
  const instance=api();expect(Object.keys(instance.presets)).toEqual(['overview','front','terminals','detail']);
  const viewer={drawables:[{}],yaw:9,pitch:9,zoom:9,render:jest.fn(),voltage:12.6,assessmentEligible:false};
  expect(instance.apply(viewer,'terminals')).toBe(true);expect(viewer.render).toHaveBeenCalledTimes(1);
  expect(viewer.voltage).toBe(12.6);expect(viewer.assessmentEligible).toBe(false);
 });
 test('unknown presets and unloaded equipment cannot mutate viewer',()=>{
  const instance=api(),viewer={drawables:[],render:jest.fn(),yaw:1};
  expect(instance.apply(viewer,'detail')).toBe(false);expect(instance.apply(viewer,'bogus')).toBe(false);
  expect(viewer.render).not.toHaveBeenCalled();expect(viewer.yaw).toBe(1);
 });
});
