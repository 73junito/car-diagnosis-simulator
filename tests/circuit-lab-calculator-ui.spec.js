'use strict';
const {renderCalculation,mount}=require('../dashboard/student/circuit-lab-calculator/src/calculator-entry');
const fs=require('fs'),path=require('path');
test('illustrative example displays correct calculation with missing measurement',()=>{
 const r=Object.fromEntries(renderCalculation({voltageText:'12',resistanceText:'6',measuredText:''}));
 expect(r['Predicted current']).toBe('2 A');
 expect(r['Predicted power']).toBe('24 W');
 expect(r.Measurement).toBe('Not supplied');
 expect(r['Technical compliance']).toMatch(/Not determined/);
});
test('independent measured input produces signed discrepancy but no verdict',()=>{
 const r=Object.fromEntries(renderCalculation({voltageText:'12',resistanceText:'6',measuredText:'1.8'}));
 expect(r['Difference (measured − predicted)']).toBe('-0.2 A');
 expect(r['Percent magnitude difference']).toBe('10%');
 expect(r['Technical compliance']).toMatch(/Not determined/);
});
test('invalid input rejected without silent coercion',()=>{
 for(const vals of [['','6',''],['12','0',''],['12','-1',''],['12','6','bad']])
 expect(()=>renderCalculation({voltageText:vals[0],resistanceText:vals[1],measuredText:vals[2]})).toThrow();
});
test('page is separate from the instrument showcase and has accessible controls',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dashboard/student/circuit-lab-calculator/index.html'),'utf8');
 expect(html).toContain('id="calculator"');
 expect(html).toContain('aria-live="polite"');
 expect(html).toContain('role="alert"');
 expect(html).toContain('calculator.bundle.js');
 expect(mount({getElementById:()=>null})).toBe(false);
});
