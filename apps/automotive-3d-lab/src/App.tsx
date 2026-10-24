import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html, Line } from '@react-three/drei'
import { useState } from 'react'
import { measure, type Fault, type ProbePlacement } from './simulation/circuit'

type Probe = 'red' | 'black'
const positions: Record<Exclude<ProbePlacement,'disconnected'>,[number,number,number]> = {
  positive: [-1,0.85,0], negative: [1,0.85,0]
}
const meterSocket: Record<Probe,[number,number,number]> = {
  red: [0.95,-1.25,0], black: [0.45,-1.25,0]
}
function Lead({ probe, placement }: { probe: Probe; placement: ProbePlacement }) {
  const end: [number,number,number] = placement === 'disconnected'
    ? [meterSocket[probe][0] + (probe === 'red' ? -1.8 : 1.8),-1.4,0.4]
    : positions[placement]
  const start = meterSocket[probe]
  const color = probe === 'red' ? '#f45b61' : '#30363e'
  return <group>
    <Line points={[start,[start[0],-1.7,0.8],[end[0],-1.6,0.8],end]} color={color} lineWidth={5}/>
    <mesh position={end} rotation={[Math.PI/2,0,0]}>
      <cylinderGeometry args={[0.07,0.07,0.32,12]}/>
      <meshStandardMaterial color={color}/>
    </mesh>
  </group>
}
function Battery({ onTerminal, selected }: { onTerminal: (terminal: 'positive'|'negative') => void; selected: Probe }) {
  return <group position={[0,0.65,0]}>
    <mesh><boxGeometry args={[3,1.35,1.4]}/><meshStandardMaterial color="#243448" roughness={0.72}/></mesh>
    {(['positive','negative'] as const).map(terminal => {
      const isPositive = terminal === 'positive'
      return <group key={terminal} position={positions[terminal]}>
        <mesh onClick={e => { e.stopPropagation(); onTerminal(terminal) }}>
          <cylinderGeometry args={[0.19,0.19,0.3,20]}/>
          <meshStandardMaterial color={isPositive ? '#e35151':'#9bb5cb'} metalness={0.65} roughness={0.25}/>
        </mesh>
        <Html position={[0,0.3,0]} center><button className="terminal" onClick={() => onTerminal(terminal)} aria-label={`Attach ${selected} probe to ${terminal} terminal`}>{isPositive ? '+' : '−'}</button></Html>
      </group>
    })}
  </group>
}
function Meter({ voltage }: { voltage: number }) {
  return <group position={[0,-1.15,0]}>
    <mesh><boxGeometry args={[2.3,1.0,0.35]}/><meshStandardMaterial color="#dda62c" roughness={0.6}/></mesh>
    <mesh position={[0,0.15,0.19]}><planeGeometry args={[1.8,0.43]}/><meshBasicMaterial color="#142324"/></mesh>
    <Html center position={[0,0.16,0.22]} transform distanceFactor={5}>
      <div className="meter-face">{voltage.toFixed(2)} V</div>
    </Html>
    <mesh position={[0,-0.29,0.2]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.16,0.16,0.07]}/><meshStandardMaterial color="#30343a"/></mesh>
  </group>
}
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
          <Battery onTerminal={attach} selected={selected}/>
          <Meter voltage={result.voltage}/>
          <Lead probe="red" placement={red}/><Lead probe="black" placement={black}/>
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
