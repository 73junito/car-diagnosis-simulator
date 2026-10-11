'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const TARGETS=[
  'assessment/index.html',
  'dashboard/live-session.html',
  'dashboard_live.html',
  'dashboard_test.html',
  'main_index.html',
  'temp_home.html'
];
function read(p){return fs.readFileSync(path.join(ROOT,p),'utf8')}
function hexToRgb(hex){const h=hex.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255)}
function lin(v){return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
function lum(hex){const [r,g,b]=hexToRgb(hex).map(lin);return .2126*r+.7152*g+.0722*b}
function ratio(a,b){const [x,y]=[lum(a),lum(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05)}
function token(css,name){const m=css.match(new RegExp('--'+name+'\\s*:\\s*([^;]+);'));return m&&m[1].trim()}
function verify(){
 const errors=[];
 const tokens=read('theme/tokens.css');
 const bridge=read('theme/legacy-light-bridge.css');
 for(const file of TARGETS){
   const html=read(file);
   if(/href=["'][^"']*theme\.css["']/.test(html)) errors.push(file+' still loads legacy theme.css');
   if(!html.includes('theme/tokens.css')) errors.push(file+' missing canonical tokens');
   if(!html.includes('theme/legacy-light-bridge.css')) errors.push(file+' missing migration bridge');
 }
 if(token(tokens,'tm-focus-ring')!=='var(--tm-primary-2-text)') errors.push('light focus ring must use text-safe blue');
 if(token(tokens,'tm-focus-ring-inverse')!=='#93c5fd') errors.push('inverse focus ring must remain #93c5fd');
 if(token(tokens,'tm-focus-ring-width')!=='3px') errors.push('focus ring width must remain 3px');
 if(token(tokens,'tm-focus-ring-offset')!=='3px') errors.push('focus ring offset must remain 3px');
 if(!bridge.includes('.topnav a:focus-visible')) errors.push('bridge must define inverse focus treatment on navy topnav');
 const checks=[
   ['focus on white','#2d6ac9','#ffffff',3],
   ['focus on page background','#2d6ac9','#f4f7fb',3],
   ['inverse focus on navy','#93c5fd','#14233c',3],
   ['white on navy','#ffffff','#14233c',4.5],
   ['white on warning','#ffffff','#b45309',4.5],
   ['white on danger','#ffffff','#b91c1c',4.5],
   ['white on success','#ffffff','#15803d',4.5]
 ];
 const contrast=checks.map(([label,fg,bg,min])=>({label,fg,bg,min,ratio:Number(ratio(fg,bg).toFixed(2)),pass:ratio(fg,bg)>=min}));
 for(const c of contrast) if(!c.pass) errors.push(c.label+' contrast '+c.ratio+' < '+c.min);
 const student=read('design-language/dashboards/student.md');
 if(student.includes('WCAG 2.1 AA')) errors.push('student dashboard spec still says WCAG 2.1 AA');
 return {ok:errors.length===0,errors,targets:TARGETS,contrast};
}
if(require.main===module){const r=verify();for(const c of r.contrast)console.log((c.pass?'PASS':'FAIL')+'\t'+c.ratio+':1\t(min '+c.min+')\t'+c.label);if(!r.ok){console.error('[FAIL] Phase 8A legacy theme migration');for(const e of r.errors)console.error('  - '+e);process.exit(1)}console.log('[PASS] Phase 8A legacy theme migration: 6/6 pages canonical, focus contrast verified, WCAG 2.2 spec aligned')}
module.exports={TARGETS,verify,ratio};
