/**
 * Hono route: GET /api/scenario-questions-approved
 *
 * Returns scenario questions with strict approval validation:
 * - question_provenance.status = 'approved'
 * - source_chunks.status = 'approved'
 * - approved_sources.status = 'approved'
 *
 * This enforces database-level approval, not client-side heuristics.
 */
import { createClient } from '@supabase/supabase-js'

export async function handleScenarioQuestionsApproved(c) {
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Method not allowed' }, 405)
  }

  // Get scenario_id from query parameters (support both scenarioId and scenario_id)
  const scenario_id = c.req.query('scenarioId') ?? c.req.query('scenario_id')

  if (!scenario_id || typeof scenario_id !== 'string') {
    return c.json({ error: 'Missing or invalid scenario_id parameter' }, 400)
  }

  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(scenario_id)) {
    return c.json({ error: 'Invalid scenario_id format' }, 400)
  }

  try {
    const supabaseUrl = c.env.SUPABASE_URL
    const supabaseServiceRoleKey = c.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables')
      return c.json({ error: 'Server configuration incomplete' }, 500)
    }

    // Execute the database query with strict approval validation
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    // 1. Get all questions in the scenario
    const { data: questions, error: questionsError } = await supabase
      .from('scenario_questions')
      .select(
        `
        id,
        question_id,
        scenario_id,
        question_text,
        option_a,
        option_b,
        option_c,
        option_d,
        difficulty,
        topic,
        ase_area
      `
      )
      .eq('scenario_id', scenario_id)

    if (questionsError) {
      console.error('Database query error:', questionsError)
      return c.json({ error: 'Failed to fetch questions' }, 500)
    }

    if (!questions || questions.length === 0) {
      return c.json({
        scenario_id: scenario_id,
        questions: [],
        approved_questions: [],
        count: 0
      }, 200)
    }

    // 2. For each question, check if there's approved provenance with valid citations
    // Fail-closed: only return questions that have:
    // - question_provenance with status='approved'
    // - citation_validations with result='valid' for that provenance
    // - referenced approved_sources with status='approved'
    // - referenced source_chunks with status='approved'
    const approvedQuestions = []

    for (const question of questions) {
      // A UUID-only or unmapped question must fail closed.
      if (!question.question_id) {
        continue
      }

      // Check for approved provenance record
      const { data: provenance, error: provenanceError } = await supabase
        .from('question_provenance')
        .select('id, question_id, status')
        .eq('question_id', question.question_id)
        .eq('status', 'approved')
        .single()

      if (provenanceError || !provenance) {
        // No approved provenance for this question; skip it
        continue
      }

      // Check for valid citation validation result
      const { data: validation, error: validationError } = await supabase
        .from('citation_validations')
        .select(
          'id, result, validator_version, validation_method, ' +
          'source_hashes_verified, excerpts_verified, ' +
          'urls_verified, validated_at'
        )
        .eq('question_provenance_id', provenance.id)
        .eq('result', 'valid')
        .single()

      if (validationError || !validation) {
        // No valid citation validation for this provenance; skip it
        continue
      }

      // Check that all citations reference approved sources and chunks
      const { data: citations, error: citationsError } = await supabase
        .from('question_citations')
        .select('source_id, chunk_id')
        .eq('question_provenance_id', provenance.id)

      if (citationsError || !citations || citations.length === 0) {
        // No citations or error retrieving them; skip this question
        continue
      }

      let allCitationsApproved = true

      for (const citation of citations) {
        // Verify source is approved
        const { data: source, error: sourceError } = await supabase
          .from('approved_sources')
          .select('id, status')
          .eq('id', citation.source_id)
          .eq('status', 'approved')
          .single()

        if (sourceError || !source) {
          allCitationsApproved = false
          break
        }

        // Verify chunk is approved
        const { data: chunk, error: chunkError } = await supabase
          .from('source_chunks')
          .select('chunk_id, status')
          .eq('chunk_id', citation.chunk_id)
          .eq('status', 'approved')
          .single()

        if (chunkError || !chunk) {
          allCitationsApproved = false
          break
        }
      }

      // Only add this question if all citations passed approval checks
      if (allCitationsApproved) {
        approvedQuestions.push({
          id: question.id,
          scenario_id: question.scenario_id,
          question_text: question.question_text,
          option_a: question.option_a,
          option_b: question.option_b,
          option_c: question.option_c,
          option_d: question.option_d,
          difficulty: question.difficulty,
          topic: question.topic,
          ase_area: question.ase_area,
        question_id: question.question_id,
        question_provenance: {
          id: provenance.id,
          question_id: provenance.question_id,
          status: provenance.status,
          citation_validation: {
            valid: validation.result === 'valid',
            validator_version: validation.validator_version,
            validation_method: validation.validation_method,
            source_hashes_verified:
              validation.source_hashes_verified,
            excerpts_verified:
              validation.excerpts_verified,
            urls_verified:
              validation.urls_verified,
            validated_at: validation.validated_at
          }
        },
        citations: citations.map(citation => ({
          source_id: citation.source_id,
          chunk_id: citation.chunk_id
        }))
        })
      }
    }

    return c.json(
      {
        scenario_id: scenario_id,
        questions: approvedQuestions,
        approved_questions: approvedQuestions,
        count: approvedQuestions.length
      },
      200
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return c.json({ error: 'Server error' }, 500)
  }
}
