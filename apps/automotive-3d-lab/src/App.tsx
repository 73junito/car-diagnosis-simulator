import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState } from 'react'
import { measure, type Fault, type ProbePlacement } from './simulation/circuit'
import { RealisticBattery, RealisticMeter, RealisticLead, type Probe } from './RealisticObjects'
export default function App() {
  const [red,setRed] = useState<ProbePlacement>('positive')
  const [black,setBlack] = useState<ProbePlacement>('negative')
  const [selected,setSelected] = useState<Probe>('red')
  const [fault,setFault] = useState<Fault>('healthy')
  const result = measure(red,black,fault)
  const attach = (terminal:'positive'|'negative') => selected === 'red' ? setRed(terminal) : setBlack(terminal)
  return <main>
    <header><small>AUTOLEARNPRO · DOCKER PILOT · MILESTONE B</small><h1>Automotive Circuit Lab</h1><p>Explore DC voltage and probe polarity on a 3D battery and multimeter. Training only; no scored assessment or real vehicle diagnosis.</p></header>
    <section className="layout">
      <div className="scene" aria-label="Interactive 3D battery and multimeter; all controls are also available in the adjacent panel">
        <Canvas camera={{position:[4.1,3.5,6.8],fov:47}}>
          <color attach="background" args={['#0e1726']}/>
          <ambientLight intensity={1.8}/><directionalLight position={[4,6,4]} intensity={2}/>
          <RealisticBattery onTerminal={attach} selected={selected}/>
          <RealisticMeter voltage={result.voltage}/>
          <RealisticLead probe="red" placement={red}/><RealisticLead probe="black" placement={black}/>
          <OrbitControls enablePan={false} minDistance={4} maxDistance={12}/>
        </Canvas>
      </div>
      <div className="panel">
        <h2>Digital multimeter</h2><output aria-live="polite">{result.voltage.toFixed(2)} V DC</output>
        <p className="status" role="status">{result.status}</p>
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
  </main>
}
