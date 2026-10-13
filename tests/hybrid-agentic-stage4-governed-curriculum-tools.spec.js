const fs=require('fs')
const path=require('path')
const {GovernedCurriculumAgent,ElectricalMeasurementAdapter,BoundedToolExecutor,ToolGateway}=require('../src/ai')
const root=path.resolve('.')
const route=fs.readFileSync(path.join(root,'worker/routes/curriculum-enhancements.js'),'utf8')
const catalog=JSON.parse(fs.readFileSync(path.join(root,'data/architecture/agent-orchestration-foundation.json'),'utf8'))

describe('Stage 4 governed curriculum and diagnostic tools',()=>{
  test('governed curriculum preparation rejects non-approved or assessment evidence',()=>{
    expect(()=>GovernedCurriculumAgent.prepareCurriculumEnhancement({
      lessonPlanId:'l1',goal:'Improve charging system lesson',
      draftPayload:{summary:'s',rationale:'r',proposed_steps:['x']},
      evidence:[{id:'e1',approved_source_id:'s1',review_status:'draft',license_status:'verified-for-use',scored_assessment_eligible:false}]
    })).toThrow(/evidence does not satisfy/)
  })
  test('governed curriculum boundary denies consequential authority',()=>{
    const out=GovernedCurriculumAgent.prepareCurriculumEnhancement({
      lessonPlanId:'l1',goal:'Improve charging system lesson',
      draftPayload:{summary:'Summary',rationale:'Rationale',proposed_steps:['Step'],source_notes:[],safety_notes:[]},
      evidence:[{id:'e1',approved_source_id:'s1',review_status:'approved',license_status:'verified-for-use',scored_assessment_eligible:false}]
    })
    expect(out.boundary).toMatchObject({preparationOnly:true,humanReviewRequired:true,publicationGranted:false,assessmentGenerationAllowed:false,scoredAssessmentEligible:false,mayApproveEvidence:false,mayApproveRights:false,mayPublish:false,mayRelease:false})
    expect(route).toContain('prepareCurriculumEnhancement')
    expect(route).toContain("publication: 'not-granted'")
    expect(route).toContain("assessmentGeneration: 'not-granted'")
  })
  test('electrical measurement tool is deterministic read-only math',async()=>{
    const gateway=new ToolGateway()
    gateway.register(ElectricalMeasurementAdapter)
    const result=await BoundedToolExecutor.executeBoundedTool({gateway,toolId:'electrical-measurement',input:{operation:'voltage-drop-percent',sourceVoltage:12.6,measuredDrop:0.63}})
    expect(result.result.normalizedData.dropPercent).toBeCloseTo(5)
    expect(result.result.normalizedData.advisory).toMatch(/Deterministic arithmetic only/)
  })
  test('ohms law rejects undefined division',async()=>{
    await expect(ElectricalMeasurementAdapter.execute({operation:'ohms-law',known:{voltage:12,current:0}})).rejects.toThrow(/non-zero/)
  })
  test('expanded default allowlist remains explicit',()=>{
    expect(BoundedToolExecutor.DEFAULT_ALLOWED_TOOLS).toEqual(['circuit-engine','electrical-measurement'])
  })
  test('governed curriculum agent remains preparation-only in catalog',()=>{
    const agent=catalog.agents.find(a=>a.id==='governed-curriculum-agent')
    expect(agent).toMatchObject({may_prepare:true,may_human_approve:false,may_release:false})
  })
})
