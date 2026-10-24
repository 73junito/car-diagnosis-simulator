import { Html, CatmullRomLine } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProbePlacement } from './simulation/circuit'

export type Probe = 'red' | 'black'
export const terminals: Record<'positive'|'negative', [number,number,number]> = {
  positive: [-1.08,0.81,0.1], negative: [1.08,0.81,0.1]
}
const socket: Record<Probe,[number,number,number]> = {
  red: [4.05,-0.24,1.04], black: [2.55,-0.24,1.04]
}
function Label({ children, position }: {children: string; position: [number,number,number]}) {
  return <Html center position={position} transform distanceFactor={5}><span className="model-label">{children}</span></Html>
}
export function RealisticBattery({ onTerminal, selected }: {onTerminal:(terminal:'positive'|'negative')=>void; selected:Probe}) {
  return <group>
    <mesh position={[0,-0.1,0]} castShadow receiveShadow><boxGeometry args={[3.2,1.45,1.58]}/><meshStandardMaterial color="#171e24" roughness={0.77}/></mesh>
    <mesh position={[0,0.66,0]} castShadow><boxGeometry args={[3.16,0.17,1.54]}/><meshStandardMaterial color="#313c44" roughness={0.55}/></mesh>
    <mesh position={[0,-0.07,0.797]}><planeGeometry args={[2.72,0.84]}/><meshStandardMaterial color="#e9ecdf" roughness={0.9}/></mesh>
    <mesh position={[0,0.42,0.804]}><planeGeometry args={[2.72,0.14]}/><meshStandardMaterial color="#bf2939"/></mesh>
    <Label position={[0,-0.08,0.83]}>AUTOLEARNPRO • 12 V TRAINING BATTERY</Label>
    <mesh position={[0,0.77,-0.42]}><boxGeometry args={[1.3,0.11,0.27]}/><meshStandardMaterial color="#20292f"/></mesh>
    {(['positive','negative'] as const).map(terminal => {
      const positive=terminal==='positive'
      const at=terminals[terminal]
      const cap=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();onTerminal(terminal)}
      return <group key={terminal} position={at}>
        <mesh position={[0,-0.10,0]}><cylinderGeometry args={[0.29,0.29,0.09,24]}/><meshStandardMaterial color={positive?'#ad2737':'#222a31'}/></mesh>
        <mesh onClick={cap} castShadow><cylinderGeometry args={[0.14,0.17,0.3,24]}/><meshStandardMaterial color="#b0b9bc" metalness={0.82} roughness={0.27}/></mesh>
        <Html center position={[0,0.38,0]}><button className="terminal" onClick={()=>onTerminal(terminal)} aria-label={`Attach ${selected} lead to ${terminal} battery post`}>{positive?'+':'−'}</button></Html>
      </group>
    })}
    <mesh position={[0,-0.94,0]} receiveShadow><boxGeometry args={[4,0.13,2.2]}/><meshStandardMaterial color="#263341" roughness={0.8}/></mesh>
  </group>
}
export function RealisticMeter({ voltage }: {voltage:number}) {
  return <group position={[3.30,0,0.83]} rotation={[-0.14,-0.18,0]}>
    <mesh castShadow><boxGeometry args={[2.25,1.12,0.42]}/><meshStandardMaterial color="#dda925" roughness={0.48}/></mesh>
    <mesh position={[0,0.3,0.221]}><planeGeometry args={[1.95,0.4]}/><meshBasicMaterial color="#1b3533"/></mesh>
    <Html center position={[0,0.3,0.23]} transform distanceFactor={5}><span className="meter-face">{voltage.toFixed(2)} V DC</span></Html>
    <Label position={[0,0.57,0.25]}>DIGITAL MULTIMETER</Label>
    <mesh position={[0,-0.2,0.245]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.23,0.23,0.09,32]}/><meshStandardMaterial color="#2d3439" roughness={0.53}/></mesh>
    {([-0.75,0.74] as const).map((x,i)=><group key={x} position={[x,-0.34,0.226]}>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.125,0.125,0.06,24]}/><meshStandardMaterial color={i?'#c93645':'#242b32'}/></mesh>
    </group>)}
  </group>
}
export function RealisticLead({probe,placement}: {probe:Probe;placement:ProbePlacement}) {
  const start=socket[probe]
  const end:[number,number,number]=placement==='disconnected'?
    [probe==='red'?5.0:2.1,-0.95,1.6]:terminals[placement]
  const color=probe==='red'?'#e7484f':'#12161b'
  const outerX = probe === 'red' ? 5.15 : 2.45
  const points: [number,number,number][] = [start,[outerX,-0.9,1.6],[outerX,-1.35,2.0],[(outerX+end[0])/2,-1.3,2.2],[end[0],end[1]+0.36,1.2],end]
  return <group>
    <CatmullRomLine points={points} color={color} lineWidth={5} segments={54}/>
    <mesh position={end} rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[0.065,0.08,0.38,16]}/><meshStandardMaterial color={color} roughness={0.78}/>
    </mesh>
    <mesh position={[end[0],end[1]+0.21,end[2]]}><coneGeometry args={[0.045,0.22,12]}/><meshStandardMaterial color="#bfc9d1" metalness={0.85} roughness={0.2}/></mesh>
  </group>
}
