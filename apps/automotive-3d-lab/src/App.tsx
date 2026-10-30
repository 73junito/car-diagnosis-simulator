import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { measure, type Fault, type ProbePlacement } from './simulation/circuit'
import type { Probe } from './RealisticObjects'
import type { InspectionView } from './WorkshopScene'
import { productionLabs, productionLabUrl } from './productionLabBridge'
const WorkshopScene = lazy(() => import('./WorkshopScene'))
export default function App() {
  const [red,setRed] = useState<ProbePlacement>('positive')
  const [black,setBlack] = useState<ProbePlacement>('negative')
  const [selected,setSelected] = useState<Probe>('red')
  const [fault,setFault] = useState<Fault>('healthy')
  const [inspectionView,setInspectionView] = useState<InspectionView>('workshop')
  const sceneContainer = useRef<HTMLDivElement>(null)
  const [sceneRequested, setSceneRequested] = useState(false)
  useEffect(() => {
    if (sceneRequested) return
    const node = sceneContainer.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setSceneRequested(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSceneRequested(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px', threshold: 0 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [sceneRequested])
  const result = measure(red,black,fault)
  const attach = (terminal:'positive'|'negative') => selected === 'red' ? setRed(terminal) : setBlack(terminal)
  return <main>
    <header><small>BRIGHT WORKSHOP THEME ACTIVE · AUTOLEARNPRO · DOCKER PILOT · MILESTONE B</small><h1>Automotive Circuit Lab</h1><p>Explore DC voltage and probe polarity on a 3D battery and multimeter. Training only; no scored assessment or real vehicle diagnosis.</p></header>
    <section className="layout">
      <div className="workshop-column"><nav className="inspection-nav" aria-label="Equipment inspection views">
        {([['workshop','Full Workshop'],['battery','Battery'],['multimeter','Multimeter'],['leads','Test Leads']] as const).map(([id,label]) => <button key={id} type="button" className={inspectionView===id?'inspection-active':''} aria-pressed={inspectionView===id} onClick={()=>setInspectionView(id)}>{label}</button>)}
      </nav>
      <div ref={sceneContainer} className="scene" aria-label="Interactive 3D battery and multimeter; all controls are also available in the adjacent panel">
        {sceneRequested ? (
          <Suspense fallback={<div className="scene-loading" role="status">Loading interactive 3D workshop...</div>}>
            <WorkshopScene voltage={result.voltage} red={red} black={black} selected={selected} view={inspectionView} onTerminal={attach}/>
          </Suspense>
        ) : (
          <div className="scene-loading">
            <span>3D workshop loads when this section enters view.</span>
            <button className="reset" onClick={() => setSceneRequested(true)}>Load 3D workshop</button>
          </div>
        )}
      </div>
      </div>
      <div className="panel">
        <h2>Digital multimeter</h2><output aria-live="polite">{result.voltage.toFixed(2)} V DC</output>
        <p className="status" role="status">{result.status}</p>
        <section className="meter-ratings" aria-label="Illustrative multimeter specifications">
          <h3>DMM-01 · Training instrument ratings</h3>
          <dl><dt>DC voltage range</dt><dd>0–20 V</dd><dt>Display resolution</dt><dd>0.01 V</dd><dt>Nominal input impedance</dt><dd>10 MΩ</dd><dt>Measurement mode</dt><dd>DC voltage only</dd></dl>
          <p>Illustrative specifications. No CAT rating or safety certification; not for real electrical testing.</p>
        </section>
        <fieldset><legend>Probe to place by clicking a terminal</legend>
          <label className="radio"><input type="radio" name="selected" checked={selected==='red'} onChange={()=>setSelected('red')}/> Red probe</label>
          <label className="radio"><input type="radio" name="selected" checked={selected==='black'} onChange={()=>setSelected('black')}/> Black probe</label>
        </fieldset>
        <label>Red lead connection<select value={red} onChange={e=>setRed(e.target.value as ProbePlacement)}><option value="positive">Positive terminal (+)</option><option value="negative">Negative terminal (−)</option><option value="disconnected">Disconnected</option></select></label>
        <label>Black lead connection<select value={black} onChange={e=>setBlack(e.target.value as ProbePlacement)}><option value="negative">Negative terminal (−)</option><option value="positive">Positive terminal (+)</option><option value="disconnected">Disconnected</option></select></label>
        <label>Training condition<select value={fault} onChange={e=>setFault(e.target.value as Fault)}><option value="healthy">Healthy reference battery (12.6 V)</option><option value="discharged">Discharged battery (10.5 V)</option><option value="open">Open-circuit training fault (0 V)</option><option value="resistance">Simulated load / voltage drop (11.8 V)</option></select></label>
        <button className="reset" onClick={()=>{setRed('positive');setBlack('negative');setFault('healthy');setSelected('red')}}>Reset lab</button>
        <p className="note">Use the dropdowns as a keyboard-accessible alternative to clicking the 3D terminals. Values are deliberately simplified presets; an open circuit in a real system does not universally imply zero volts.</p>
      </div>
    </section>
    <section className="production-pathways" aria-labelledby="production-pathways-title">
      <h2 id="production-pathways-title">Continue in the production laboratories</h2>
      <p>Practice instrument identification and DC polarity here, then explore a governed production lab. These are separate experiences: this pilot does not send measurements, assessment decisions, or learner progress to production.</p>
      <div className="production-pathway-grid">
        {productionLabs.map(lab => <article key={lab.id} className="production-pathway">
          <h3><a href={productionLabUrl(lab.path)} target="_blank" rel="noopener noreferrer">{lab.title} <span aria-hidden="true">↗</span></a></h3>
          <p className="pathway-phase">{lab.integrationPhase === 'first' ? 'First integration candidate' : lab.integrationPhase === 'next' ? 'Next-stage integration' : 'Advanced / governed integration'}</p>
          <p><strong>Reusable equipment:</strong> {lab.sharedEquipment.length ? lab.sharedEquipment.join(', ') : 'Conceptual learning bridge'}</p>
          <p className="pathway-boundary">{lab.boundary}</p>
        </article>)}
      </div>
    </section>
  </main>
}
