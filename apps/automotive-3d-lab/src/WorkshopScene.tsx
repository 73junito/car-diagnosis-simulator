import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { OrbitControls } from '@react-three/drei'
import { RealisticBattery, RealisticMeter, RealisticLead, type Probe } from './RealisticObjects'
import type { ProbePlacement } from './simulation/circuit'

export type InspectionView = 'workshop' | 'battery' | 'multimeter' | 'leads'

export type WorkshopSceneProps = {
  voltage: number
  red: ProbePlacement
  black: ProbePlacement
  selected: Probe
  view: InspectionView
  onTerminal: (terminal: 'positive' | 'negative') => void
}

const perspectives: Record<InspectionView, {
  position: [number, number, number]
  target: [number, number, number]
  minDistance: number
  maxDistance: number
}> = {
  workshop: { position: [0, 2.9, 9.2], target: [0, 0, 0], minDistance: 6, maxDistance: 17 },
  battery: { position: [-2.1, 1.9, 4.5], target: [-2, 0.1, 0], minDistance: 2.3, maxDistance: 9 },
  multimeter: { position: [2.45, 1.1, 4.7], target: [2.45, 0, 0], minDistance: 2.5, maxDistance: 9 },
  leads: { position: [0.6, 2.8, 6.6], target: [0.4, -0.85, 0.8], minDistance: 3.5, maxDistance: 12 }
}

function CameraView({ view }: { view: InspectionView }) {
  const { camera } = useThree()
  useEffect(() => {
    const perspective = perspectives[view]
    camera.position.set(...perspective.position)
    camera.lookAt(...perspective.target)
    camera.updateProjectionMatrix()
  }, [camera, view])
  return null
}

export default function WorkshopScene({ voltage, red, black, selected, view, onTerminal }: WorkshopSceneProps) {
  const camera = perspectives[view]
  return <Canvas shadows dpr={[1, 1.75]} camera={{position: camera.position, fov: 42}}>
    <color attach="background" args={['#e3eff9']}/>
    <ambientLight intensity={1.3}/>
    <hemisphereLight args={['#f5fbff','#9bafc0',1.0]}/>
    <directionalLight castShadow position={[4,7,5]} intensity={2.2} shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0001}/>
    <directionalLight position={[-5,3,-4]} intensity={0.7} color="#b8d9f3"/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-1.04,0]} receiveShadow>
      <planeGeometry args={[200,200]}/><shadowMaterial transparent opacity={0.25}/>
    </mesh>
    <RealisticBattery onTerminal={onTerminal} selected={selected}/>
    <RealisticMeter voltage={voltage}/>
    <RealisticLead probe="red" placement={red}/>
    <RealisticLead probe="black" placement={black}/>
    <CameraView view={view}/>
    <OrbitControls key={view} target={camera.target} enablePan={false} minDistance={camera.minDistance} maxDistance={camera.maxDistance}/>
  </Canvas>
}
