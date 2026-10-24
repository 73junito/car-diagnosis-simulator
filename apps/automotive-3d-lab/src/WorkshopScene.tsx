import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { RealisticBattery, RealisticMeter, RealisticLead, type Probe } from './RealisticObjects'
import type { ProbePlacement } from './simulation/circuit'

export type WorkshopSceneProps = {
  voltage: number
  red: ProbePlacement
  black: ProbePlacement
  selected: Probe
  onTerminal: (terminal: 'positive' | 'negative') => void
}

export default function WorkshopScene({ voltage, red, black, selected, onTerminal }: WorkshopSceneProps) {
  return <>        <Canvas shadows dpr={[1,1.75]} camera={{position:[0,2.9,9.2],fov:42}}>
          <color attach="background" args={['#e3eff9']}/>
          <ambientLight intensity={1.3}/><hemisphereLight args={['#f5fbff','#9bafc0',1.0]}/><directionalLight castShadow position={[4,7,5]} intensity={2.2} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0001}/><directionalLight position={[-5,3,-4]} intensity={0.7} color="#b8d9f3"/><mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.04,0]} receiveShadow><planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={0.25}/></mesh>
          <RealisticBattery onTerminal={onTerminal} selected={selected}/>
          <RealisticMeter voltage={voltage}/>
          <RealisticLead probe="red" placement={red}/><RealisticLead probe="black" placement={black}/>
          <OrbitControls target={[0,0,0]} enablePan={false} minDistance={6} maxDistance={17}/>
        </Canvas>
  </>
}