export type ProductionLab = {
  id: string
  title: string
  path: string
  sharedEquipment: readonly string[]
  integrationPhase: 'first' | 'next' | 'advanced'
  boundary: string
}

export const productionLabs: readonly ProductionLab[] = [
  { id:'circuit-lab', title:'Charging-System Circuit Lab',path:'/dashboard/student/circuit-lab/',sharedEquipment:['battery','digital multimeter','test leads'],integrationPhase:'first',boundary:'Charging-system runtime owns test points, readings, faults and operating states.' },
  { id:'sensor-lab', title:'Three-Wire Sensor Lab',path:'/dashboard/student/sensor-lab/',sharedEquipment:['multimeter','test leads'],integrationPhase:'next',boundary:'Sensor runtime owns supply, ground and signal truth.' },
  { id:'actuator-lab', title:'PWM Actuator Lab',path:'/dashboard/student/actuator-lab/',sharedEquipment:['multimeter','test leads'],integrationPhase:'next',boundary:'Actuator runtime owns command, feedback and PWM measurements.' },
  { id:'starting-system-lab', title:'Starting-System Lab',path:'/dashboard/student/starting-system-lab/',sharedEquipment:['battery','multimeter','test leads'],integrationPhase:'next',boundary:'Starting-system runtime owns starting events and electrical values.' },
  { id:'multivoltage-lab', title:'Electrified Multi-Voltage Lab',path:'/dashboard/student/multivoltage-lab/',sharedEquipment:['multimeter','test leads'],integrationPhase:'advanced',boundary:'Domain-specific safety restrictions and voltage rules must be verified before reuse.' },
  { id:'relay-load-lab', title:'Relay-Controlled Load Lab',path:'/dashboard/student/relay-load-lab/',sharedEquipment:['multimeter','test leads'],integrationPhase:'next',boundary:'Relay-load runtime owns coil, switch and load states.' },
  { id:'network-lab', title:'CAN/LIN Network Lab',path:'/dashboard/student/network-lab/',sharedEquipment:['test leads'],integrationPhase:'advanced',boundary:'Network diagnostics require dedicated signal and protocol models.' },
  { id:'circuit-lab-calculator', title:'Theoretical DC Circuit Calculator',path:'/dashboard/student/circuit-lab-calculator/',sharedEquipment:[],integrationPhase:'first',boundary:'Idealized calculator outputs must not be represented as live battery measurements.' },
  { id:'aut250-lab-ui', title:'AUT-250 Diagnostic Laboratory',path:'/dashboard/student/aut250-lab-ui/',sharedEquipment:['multimeter','test leads'],integrationPhase:'advanced',boundary:'Assessment eligibility, diagnosis and repair decisions remain entirely governed by AUT-250.' },
  { id:'aut250-lab-assets', title:'AUT-250 Interactive Laboratory Assets',path:'/dashboard/student/aut250-lab-assets/',sharedEquipment:['multimeter','test leads'],integrationPhase:'advanced',boundary:'Asset visuals must not determine diagnostic, grading or engineering truth.' }
]

export const productionLabUrl = (path: string) => 'https://app.autolearnpro.com' + path
