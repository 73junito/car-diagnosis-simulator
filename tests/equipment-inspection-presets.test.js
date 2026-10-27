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
 test('remount replaces buttons, updates active state, and resets without touching eligibility',()=>{
  const makeButton=()=>{
   const attrs={};const handlers={};
   return {type:'',textContent:'',dataset:{},setAttribute:(k,v)=>{attrs[k]=v},
    getAttribute:(k)=>attrs[k],addEventListener:(k,fn)=>{handlers[k]=fn},
    click:()=>handlers.click()};
  };
  const container={children:[],replaceChildren(){this.children=[]},
   append(button){this.children.push(button)},
   querySelectorAll(){return this.children.filter(x=>x.dataset.inspectionView)}};
  const context={document:{createElement:()=>makeButton()}};
  vm.runInNewContext(source,context);
  const instance=context.AutoLearnProEquipmentInspection;
  const status={textContent:''};
  const firstViewer={drawables:[{}],render:jest.fn(),assessmentEligible:false,voltage:12.6};
  instance.mount({viewer:firstViewer,container,status});
  expect(container.children).toHaveLength(4);
  const oldFront=container.children[1];
  const secondViewer={drawables:[{}],render:jest.fn(),assessmentEligible:false,voltage:5};
  instance.mount({viewer:secondViewer,container,status});
  expect(container.children).toHaveLength(4);
  expect(container.children[1]).not.toBe(oldFront);
  container.children[2].click();
  expect(secondViewer.render).toHaveBeenCalledTimes(1);
  expect(firstViewer.render).not.toHaveBeenCalled();
  expect(container.children.map(b=>b.getAttribute('aria-pressed'))).toEqual(['false','false','true','false']);
  expect(status.textContent).toContain('Top / terminals');
  instance.reset(container);
  expect(container.children.map(b=>b.getAttribute('aria-pressed'))).toEqual(['true','false','false','false']);
  expect(secondViewer.assessmentEligible).toBe(false);
  expect(secondViewer.voltage).toBe(5);
 });
 test('missing model does not change pressed state',()=>{
  const buttonAttrs={};const buttons=[];
  const context={document:{createElement:()=>({
   dataset:{},setAttribute(k,v){this[k]=v},getAttribute(k){return this[k]},
   addEventListener(k,fn){this[k]=fn},click(){this.click()},textContent:''
  })}};
  vm.runInNewContext(source,context);
  const container={replaceChildren(){buttons.length=0},append(x){buttons.push(x)}};
  const viewer={drawables:[],render:jest.fn()};
  const status={textContent:''};
  context.AutoLearnProEquipmentInspection.mount({viewer,container,status});
  buttons[1].click();
  expect(status.textContent).toContain('Select an enabled equipment model');
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  expect(viewer.render).not.toHaveBeenCalled();
 });

});
