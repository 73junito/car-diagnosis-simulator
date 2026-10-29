import { Html, CatmullRomLine } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useEffect } from 'react'
import { CanvasTexture, SRGBColorSpace, Shape, ExtrudeGeometry } from 'three'
import type { ProbePlacement } from './simulation/circuit'

export type Probe = 'red' | 'black'
export const terminals: Record<'positive'|'negative', [number,number,number]> = {
  positive: [-3.08,0.81,0.1], negative: [-0.92,0.81,0.1]
}
const socket: Record<Probe,[number,number,number]> = {
  red: [3.19,-1.06,0.36], black: [1.70,-1.06,0.36]
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
function PolarityDecal({positive}:{positive:boolean}) {
  const texture=useMemo(()=>{
    const canvas=document.createElement('canvas')
    canvas.width=128;canvas.height=128
    const ctx=canvas.getContext('2d')
    if(!ctx) throw new Error('Polarity decal canvas unavailable')
    ctx.fillStyle=positive?'#c92939':'#24313a'
    ctx.fillRect(0,0,128,128)
    ctx.fillStyle='#ffffff';ctx.font='bold 96px Arial';ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText(positive?'+':'-',64,64)
    const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;return t
  },[positive])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh position={[positive?-1.1:1.1,0.42,0.805]}><planeGeometry args={[0.32,0.32]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}
export function RealisticBattery({ onTerminal, selected }: {onTerminal:(terminal:'positive'|'negative')=>void; selected:Probe}) {
  return <group position={[-2,0,0]}>
    <mesh position={[0,-0.1,0]} castShadow receiveShadow><boxGeometry args={[3.2,1.45,1.58]}/><meshStandardMaterial color="#171e24" roughness={0.77}/></mesh>
    <mesh position={[0,0.66,0]} castShadow><boxGeometry args={[3.16,0.17,1.54]}/><meshStandardMaterial color="#313c44" roughness={0.55}/></mesh>
    <BatterySpecDecal/>
    <PolarityDecal positive={true}/><PolarityDecal positive={false}/>
    <Html center position={[-1.08,1.22,0.45]}><button className="terminal" onClick={() => onTerminal('positive')} aria-label="Attach selected probe to positive terminal">+</button></Html>
    <mesh position={[0,0.77,-0.42]}><boxGeometry args={[1.3,0.11,0.27]}/><meshStandardMaterial color="#20292f"/></mesh>
    {(['positive','negative'] as const).map(terminal => {
      const positive=terminal==='positive'
      const at:[number,number,number]=[terminals[terminal][0]+2,terminals[terminal][1],terminals[terminal][2]]
      const cap=(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();onTerminal(terminal)}
      return <group key={terminal} position={at}>
        <mesh position={[0,-0.10,0]}><cylinderGeometry args={[0.29,0.29,0.09,24]}/><meshStandardMaterial color={positive?'#ad2737':'#222a31'}/></mesh>
        <mesh onClick={cap} castShadow><cylinderGeometry args={[0.14,0.17,0.3,24]}/><meshStandardMaterial color="#b0b9bc" metalness={0.82} roughness={0.27}/></mesh>
        <Html center position={[0,0.51,0]}><button className="terminal" onClick={()=>onTerminal(terminal)} aria-label={`Attach ${selected} lead to ${terminal} battery post`}>{positive?'+':'-'}</button></Html>
      </group>
    })}
    <mesh position={[0,-0.94,0]} receiveShadow><boxGeometry args={[4,0.13,2.2]}/><meshStandardMaterial color="#263341" roughness={0.8}/></mesh>
  </group>
}
function MeterScreen({voltage}:{voltage:number}) {
  const texture = useMemo(() => {
    const canvas=document.createElement('canvas')
    canvas.width=512; canvas.height=160
    const ctx=canvas.getContext('2d')
    if(!ctx) throw new Error('LCD texture canvas unavailable')
    ctx.fillStyle='#1b3b35'; ctx.fillRect(0,0,512,160)
    ctx.fillStyle='#a3ffcd'; ctx.font='bold 94px monospace'
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(voltage.toFixed(2)+' V',256,78)
    const t=new CanvasTexture(canvas);t.colorSpace=SRGBColorSpace;return t
  },[voltage])
  useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh position={[0,1.01,0.356]}><planeGeometry args={[1.32,0.41]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}
function RoundedShell({width,height,depth,radius,color,z}:{width:number;height:number;depth:number;radius:number;color:string;z:number}) {
  const geometry=useMemo(()=>{
    const w=width/2,h=height/2,r=radius
    const s=new Shape()
    s.moveTo(-w+r,-h);s.lineTo(w-r,-h);s.quadraticCurveTo(w,-h,w,-h+r)
    s.lineTo(w,h-r);s.quadraticCurveTo(w,h,w-r,h)
    s.lineTo(-w+r,h);s.quadraticCurveTo(-w,h,-w,h-r)
    s.lineTo(-w,-h+r);s.quadraticCurveTo(-w,-h,-w+r,-h)
    const g=new ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:0.035,bevelSize:0.035,bevelSegments:3,steps:1,curveSegments:8})
    g.computeVertexNormals();return g
  },[width,height,depth,radius])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  return <mesh geometry={geometry} position={[0,0,z]} castShadow><meshStandardMaterial color={color} roughness={0.67}/></mesh>
}
export function RealisticMeter({ voltage }: {voltage:number}) {
  return <group position={[2.45,0.1,0]}>
    <RoundedShell width={2.13} height={3.10} depth={0.48} radius={0.28} color="#e8b12c" z={-0.25}/>
    <RoundedShell width={1.80} height={2.76} depth={0.052} radius={0.20} color="#26343e" z={0.24}/>
    <mesh position={[0,1.01,0.31]}><boxGeometry args={[1.51,0.64,0.07]}/><meshStandardMaterial color="#141e25"/></mesh>
    <MeterScreen voltage={voltage}/>
    <Html center transform distanceFactor={5} position={[0,1.43,0.33]}><span className="meter-brand">AUTOLEARNPRO DMM-01</span></Html>
    {([-0.54,-0.17,0.2,0.57] as const).map((x,i)=><group key={x}>
      <mesh position={[x,0.51,0.34]}><boxGeometry args={[0.25,0.16,0.09]}/><meshStandardMaterial color={i===0?'#cd4255':'#515e68'}/></mesh>
      <Html center position={[x,0.51,0.40]} transform distanceFactor={3}><span className="meter-button-label">{['PWR','HOLD','MODE','SELECT'][i]}</span></Html>
    </group>)}
    {/* Dial on a face-facing axis; pointer locked to the only simulated DCV mode. */}
    <mesh position={[0,-0.19,0.35]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.56,0.56,0.08,48]}/><meshStandardMaterial color="#131e25"/></mesh>
    <mesh position={[0,-0.19,0.41]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.44,0.44,0.12,48]}/><meshStandardMaterial color="#27343d" roughness={0.46}/></mesh>
    <mesh position={[0.16,-0.02,0.49]} rotation={[0,0,-0.72]}><boxGeometry args={[0.12,0.46,0.055]}/><meshStandardMaterial color="#d6dee3"/></mesh>
    <mesh position={[0.60,0.19,0.36]}><planeGeometry args={[0.37,0.17]}/><meshBasicMaterial color="#f9efb3"/></mesh>
    <Html center transform distanceFactor={3} position={[0.60,0.19,0.39]}><span className="dial-face-label">V DC</span></Html>
    <Html center position={[-0.62,-0.41,0.49]}><span className="dial-marking meter-disabled">Ω</span></Html>
    <Html center position={[-0.60,0.1,0.49]}><span className="dial-marking meter-disabled">A</span></Html>
    {/* Both modeled sockets are aligned with the lead attachment world coordinates below. */}
    {([-0.75,0.74] as const).map((x,i)=><group key={x} position={[x,-1.16,0.32]}>
      <mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[0.13,0.13,0.09,24]}/><meshStandardMaterial color={i?'#b42f40':'#161e25'}/></mesh>
      <Html center position={[0,0.23,0.09]}><span className="jack-marking">{i?'V/Ω':'COM'}</span></Html>
    </group>)}
    <Html center position={[0,-1.48,0.32]}><span className="meter-rating-small">DCV ONLY · TRAINING MODEL</span></Html>
  </group>
}
export function RealisticLead({probe,placement}: {probe:Probe;placement:ProbePlacement}) {
  const start=socket[probe]
  const end:[number,number,number]=placement==='disconnected'?
    [probe==='red'?4.3:1.0,-1.05,1.8]:terminals[placement]
  const color=probe==='red'?'#d63644':'#222c34'
  const outerX = probe === 'red' ? 3.35 : 1.35
  const points: [number,number,number][] = [start,[outerX,-0.95,0.65],[outerX,-1.28,1.65],[(outerX+end[0])/2,-1.18,2.05],[end[0],end[1]+0.25,1.2],end]
  return <group>
    <CatmullRomLine points={points} color={color} lineWidth={6} segments={64}/><CatmullRomLine points={points} color={probe==='red'?'#ff7881':'#526170'} lineWidth={1.15} segments={64}/>
    <mesh position={[end[0],end[1]-0.16,end[2]]} castShadow>
      <cylinderGeometry args={[0.095,0.12,0.44,20]}/><meshStandardMaterial color={color} roughness={0.76}/>
    </mesh>
    {[-0.28,-0.2,-0.12].map(offset=><mesh key={offset} position={[end[0],end[1]+offset,end[2]]}>
      <torusGeometry args={[0.101,0.012,8,20]}/><meshStandardMaterial color={probe==='red'?'#b52b35':'#4b555d'}/>
    </mesh>)}
    <mesh position={[end[0],end[1]+0.21,end[2]]}><coneGeometry args={[0.045,0.22,12]}/><meshStandardMaterial color="#bfc9d1" metalness={0.85} roughness={0.2}/></mesh>
    {placement!=='disconnected' && <group position={[end[0],end[1]+0.08,end[2]]}>
      {/* A sprung training clamp. The clamp is visual only; terminal placement
          remains controlled by the existing simulation state. */}
      <mesh position={[0,-0.16,-0.05]} castShadow>
        <cylinderGeometry args={[0.13,0.09,0.40,24]}/>
        <meshStandardMaterial color={color} roughness={0.83}/>
      </mesh>
      {[-0.24,-0.18,-0.12].map(y=><mesh key={y} position={[0,y,-0.06]}>
        <torusGeometry args={[0.132,0.014,8,24]}/>
        <meshStandardMaterial color={probe==='red'?'#a82c3d':'#4c545c'} roughness={0.65}/>
      </mesh>)}
      <mesh position={[0,0.03,0.01]} rotation={[0,0,Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.065,0.065,0.25,16]}/>
        <meshStandardMaterial color="#788893" metalness={0.67} roughness={0.3}/>
      </mesh>
      {([-1,1] as const).map(side=><group key={side} position={[side*0.105,0.13,0.03]} rotation={[0,0,side*0.18]}>
        <mesh castShadow><boxGeometry args={[0.065,0.32,0.16]}/>
          <meshStandardMaterial color="#bac5ca" metalness={0.85} roughness={0.26}/>
        </mesh>
        {[-0.09,0,0.09].map(y=><mesh key={y} position={[side*-0.037,y,0.012]}>
          <boxGeometry args={[0.022,0.032,0.125]}/>
          <meshStandardMaterial color="#697981" metalness={0.72} roughness={0.34}/>
        </mesh>)}
      </group>)}
    </group>}
  </group>
}
