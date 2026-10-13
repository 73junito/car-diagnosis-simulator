const fs = require('fs')
const path = require('path')
const {
  DiagnosticContracts,
  DiagnosticCopilot,
  createDiagnosticCopilotAgent
} = require('../src/ai')

function approvedEvidence(overrides = {}) {
  return DiagnosticContracts.createEvidenceRecord({
    evidenceId: 'ev-1',
    claimId: 'claim-1',
    sourceId: 'source-1',
    sourceType: 'technical-reference',
    sourceAuthority: 'primary',
    sourceApproval: 'approved',
    claimScope: 'general',
    vehicleMatch: 'generic',
    evidenceStatus: 'supported',
    directlyRelevant: true,
    currentEnough: true,
    ...overrides
  })
}

function baseSession(overrides = {}) {
  return {
    sessionId: 'diag-session-1',
    mode: 'technician',
    vehicle: {
      year: 2020,
      make: 'Example',
      model: 'Vehicle',
      match: 'partial'
    },
    complaint: 'slow cranking',
    symptoms: ['slow starter speed'],
    ...overrides
  }
}

describe('Hybrid agentic roadmap Stage 1: bounded Automotive Diagnostic Copilot', () => {
  test('fails closed when required session context is missing', () => {
    const result = DiagnosticCopilot.planDiagnosticCopilot({
      session: {
        sessionId: 'missing-context',
        mode: 'training',
        vehicle: { match: 'unknown' }
      }
    })

    expect(result.status).toBe('needs-input')
    expect(result.decision).toBeNull()
    expect(result.boundary.advisoryOnly).toBe(true)
    expect(result.boundary.verificationRequired).toBe(true)
  })

  test('fails closed when approved evidence is missing', () => {
    const result = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession(),
      evidence: []
    })

    expect(result.status).toBe('needs-evidence')
    expect(result.evidenceGate.allowed).toBe(false)
    expect(result.nextActions.join(' ')).toMatch(/approved evidence/i)
    expect(result.decision).toBeNull()
  })

  test('does not accept unapproved evidence as authority', () => {
    const evidence = [approvedEvidence({ sourceApproval: 'pending' })]
    const result = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession(),
      evidence
    })

    expect(result.status).toBe('needs-evidence')
    expect(result.evidenceGate.reasons.join(' ')).toMatch(/not approved/i)
  })

  test('approved evidence enables hypothesis preparation but does not invent a diagnosis', () => {
    const result = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession(),
      evidence: [approvedEvidence()]
    })

    expect(result.status).toBe('ready-for-hypothesis')
    expect(result.decision).toBeNull()
    expect(result.nextActions.join(' ')).toMatch(/bounded hypothesis/i)
  })

  test('supported proposed decision still requires technician verification', () => {
    const decision = DiagnosticContracts.createDiagnosticDecision({
      decisionId: 'decision-1',
      hypothesis: 'high resistance is present in the starter ground path',
      supportingEvidenceIds: ['ev-1'],
      recommendedNextCheck: 'repeat the voltage-drop measurement under load'
    })

    const result = DiagnosticCopilot.planDiagnosticCopilot({
      intent: 'evaluate-proposed-decision',
      session: baseSession(),
      evidence: [approvedEvidence()],
      decision
    })

    expect(result.status).toBe('ready-for-technician-verification')
    expect(result.decision.status).toBe('evidence-supported')
    expect(result.decision.verificationRequired).toBe(true)
    expect(result.boundary.verificationRequired).toBe(true)
  })

  test('vehicle-specific procedure fails closed without primary applicable evidence', () => {
    const evidence = [approvedEvidence({
      claimScope: 'vehicle-specific',
      sourceAuthority: 'instructional',
      vehicleMatch: 'generic'
    })]

    const result = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession({
        vehicle: {
          year: 2020,
          make: 'Example',
          model: 'Vehicle',
          match: 'generic'
        }
      }),
      evidence
    })

    expect(result.status).toBe('needs-evidence')
    expect(result.evidenceGate.reasons.join(' ')).toMatch(/primary authoritative source/i)
    expect(result.nextActions.join(' ')).toMatch(/primary authoritative evidence/i)
  })

  test('training and technician modes preserve distinct response policy', () => {
    const training = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession({ mode: 'training' }),
      evidence: [approvedEvidence()]
    })
    const technician = DiagnosticCopilot.planDiagnosticCopilot({
      session: baseSession({ mode: 'technician' }),
      evidence: [approvedEvidence()]
    })

    expect(training.boundary.hintsAllowed).toBe(true)
    expect(training.boundary.guidedQuestionsAllowed).toBe(true)
    expect(technician.boundary.hintsAllowed).toBe(false)
    expect(technician.boundary.guidedQuestionsAllowed).toBe(false)
  })

  test('copilot boundary explicitly denies consequential authority', () => {
    const result = DiagnosticCopilot.prepareDiagnosticReport({
      session: baseSession(),
      evidence: []
    })

    expect(result.boundary).toMatchObject({
      advisoryOnly: true,
      mayGrade: false,
      mayApprove: false,
      mayRelease: false,
      mayPublish: false,
      mayChangeAssessmentEligibility: false,
      verificationRequired: true
    })
  })

  test('agent exposes preparation capabilities only', async () => {
    const agent = createDiagnosticCopilotAgent()

    expect(agent.id).toBe('diagnostic-copilot-agent')
    expect(agent.capabilities).toEqual([
      'diagnostic-plan-preparation',
      'diagnostic-report-preparation'
    ])
    expect(agent.mayHumanApprove).toBe(false)
    expect(agent.mayRelease).toBe(false)

    const result = await agent.execute({
      input: { session: baseSession(), evidence: [] },
      process: { capability: 'diagnostic-plan-preparation' }
    })
    expect(result.status).toBe('needs-evidence')
  })

  test('governance catalog cannot grant approval or release authority to the copilot', () => {
    const catalog = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '../data/architecture/agent-orchestration-foundation.json'),
        'utf8'
      )
    )
    const agent = catalog.agents.find((item) => item.id === 'diagnostic-copilot-agent')

    expect(agent).toBeDefined()
    expect(agent.may_prepare).toBe(true)
    expect(agent.may_human_approve).toBe(false)
    expect(agent.may_release).toBe(false)
    expect(catalog.global_invariants.join(' ')).toMatch(/diagnostic copilot is advisory-only/i)
  })

  test('text normalization policy is validator-backed', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
    const ci = fs.readFileSync(path.join(__dirname, '../.github/workflows/ci.yml'), 'utf8')

    expect(pkg.scripts['validate:text-normalization-policy'])
      .toBe('node scripts/verify-text-normalization-policy.js')
    expect(ci).toContain('npm run validate:text-normalization-policy')
  })
})
