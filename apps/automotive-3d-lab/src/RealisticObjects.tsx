import { Html, CatmullRomLine } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useEffect } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { ProbePlacement } from './simulation/circuit'

export type Probe = 'red' | 'black'
export const terminals: Record<'positive'|'negative', [number,number,number]> = {
  positive: [-3.08,0.81,0.1], negative: [-0.92,0.81,0.1]
}
const socket: Record<Probe,[number,number,number]> = {
  red: [3.15,-0.34,0.30], black: [1.65,-0.34,0.30]
}
function Label({ children, position }: {children: string; position: [number,number,number]}) {
  return <Html center position={position}><span className="model-label">{children}</span></Html>
}
function BatterySpecDecal() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 360
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas required for battery label')
    ctx.fillStyle = '#f0f3ee'
    ctx.fillRect(0, 0, 1024, 360)
    ctx.fillStyle = '#be2434'
    ctx.fillRect(0, 0, 1024, 42)
    ctx.fillStyle = '#162a3b'
    ctx.font = 'bold 54px Arial'
    ctx.fillText('AUTOLEARNPRO', 32, 114)
    ctx.font = 'bold 27px Arial'
    ctx.fillText('ILLUSTRATIVE 12 V TRAINING BATTERY', 34, 154)
    ctx.fillStyle = '#142c3d'
    ctx.font = 'bold 83px Arial'
    ctx.fillText('650 CCA', 30, 257)
    ctx.font = 'bold 31px Arial'
    ctx.fillText('800 CA  |  RC 110 MIN  |  60 Ah', 35, 307)
    ctx.font = 'bold 19px Arial'
    ctx.fillText('EXAMPLE RATINGS - NOT A REAL PRODUCT', 35, 339)
    const output = new CanvasTexture(canvas)
    output.colorSpace = SRGBColorSpace
    output.anisotropy = 4
    return output
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={[0,-0.07,0.805]}>
    <planeGeometry args={[2.72,0.95]}/>
    <meshBasicMaterial map={texture} toneMapped={false}/>
  </mesh>
}
export function RealisticBattery({ onTerminal, selected }: {onTerminal:(terminal:'positive'|'negative')=>void; selected:Probe}) {
  return <group position={[-2,0,0]}>
    <mesh position={[0,-0.1,0]} castShadow receiveShadow><boxGeometry args={[3.2,1.45,1.58]}/><meshStandardMaterial color="#171e24" roughness={0.77}/></mesh>
    <mesh position={[0,0.66,0]} castShadow><boxGeometry args={[3.16,0.17,1.54]}/><meshStandardMaterial color="#313c44" roughness={0.55}/></mesh>
    <BatterySpecDecal/>
    <mesh position={[0,0.77,-0.42]}><boxGeometry args={[1.3,0.11,0.27]}/><meshStandardMaterial color="#20292f"/></mesh>
    {(['positive','negative'] as const).map(terminal => {
      const positive=terminal==='positive'
      const at:[number,number,number]=[terminals[terminal][0]+2,terminals[terminal][1],terminals[terminal][2]]
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
  return <group position={[2.40,-0.05,0]}>
    <mesh castShadow><boxGeometry args={[2.25,1.12,0.42]}/><meshStandardMaterial color="#dda925" roughness={0.48}/></mesh>
    <mesh position={[0,0.30,0.221]}><planeGeometry args={[1.95,0.40]}/><meshBasicMaterial color="#1b3533"/></mesh>
    <Html center position={[0,0.30,0.24]} transform distanceFactor={5}><span className="meter-face">{voltage.toFixed(2)} V DC</span></Html>
    <Html center position={[0,0.57,0.26]} transform distanceFactor={5}><span className="meter-brand">AUTOLEARNPRO DMM-01</span></Html>
    <mesh position={[0,-0.17,0.245]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.235,0.235,0.09,32]}/><meshStandardMaterial color="#26333f" roughness={0.45}/></mesh>
    <mesh position={[0,-0.17,0.30]} rotation={[0,0,-0.30]}><boxGeometry args={[0.095,0.31,0.04]}/><meshStandardMaterial color="#f3f3f0"/></mesh>
    <Html center position={[0.42,-0.14,0.27]} transform distanceFactor={5}><span className="dial-marking">V DC</span></Html>
    {([-0.75,0.74] as const).map((x,i)=><group key={x} position={[x,-0.34,0.226]}>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.125,0.125,0.06,24]}/><meshStandardMaterial color={i?'#c93645':'#242b32'}/></mesh>
      <Html center position={[0,-0.19,0.05]} transform distanceFactor={4}><span className="jack-marking">{i?'V/Ω':'COM'}</span></Html>
    </group>)}
  </group>
}export function RealisticLead({probe,placement}: {probe:Probe;placement:ProbePlacement}) {
  const start=socket[probe]
  const end:[number,number,number]=placement==='disconnected'?
    [probe==='red'?4.3:1.0,-1.05,1.8]:terminals[placement]
  const color=probe==='red'?'#d63644':'#222c34'
  const outerX = probe === 'red' ? 3.35 : 1.35
  const points: [number,number,number][] = [start,[outerX,-0.95,0.65],[outerX,-1.28,1.65],[(outerX+end[0])/2,-1.18,2.05],[end[0],end[1]+0.25,1.2],end]
  return <group>
    <CatmullRomLine points={points} color={color} lineWidth={6} segments={64}/><CatmullRomLine points={points} color={probe==='red'?'#ff7881':'#526170'} lineWidth={1.15} segments={64}/>
    <mesh position={end} rotation={[Math.PI/2,0,0]} castShadow>
      <cylinderGeometry args={[0.065,0.08,0.38,16]}/><meshStandardMaterial color={color} roughness={0.78}/>
    </mesh>
    <mesh position={[end[0],end[1]+0.21,end[2]]}><coneGeometry args={[0.045,0.22,12]}/><meshStandardMaterial color="#bfc9d1" metalness={0.85} roughness={0.2}/></mesh>
  </group>
}
