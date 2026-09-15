/**
 * API endpoint: GET /api/scenario-questions-approved
 *
 * Returns scenario questions with strict RALA approval validation:
 * 1. question_provenance.status = 'approved'
 * 2. citation_validations.result = 'valid'
 * 3. question_citations exist with valid roles
 * 4. referenced approved_sources.status = 'approved'
 * 5. referenced source_chunks.status = 'approved' and approved = true
 *
 * Uses explicit queries (not nested relationships) to enforce fail-closed semantics.
 * Schema: question_provenance -> citation_validations(validator_version, validation_method, result)
 * Correct_answer and explanation are NEVER sent to clients.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { scenarioId } = req.query;
  if (!scenarioId || typeof scenarioId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid scenarioId parameter' });
  }
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(scenarioId)) {
    return res.status(400).json({ error: 'Invalid scenarioId format' });
  }
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: 'Server configuration incomplete' });
    }
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

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
        competency_area_id
      `
      )
      .eq('scenario_id', scenarioId);

    if (questionsError) {
      console.error('Database query error:', JSON.stringify(questionsError, null, 2));
      return res.status(500).json({ error: 'Failed to fetch questions' });
    }

    if (!questions || questions.length === 0) {
      return res.status(200).json({
        scenario_id: scenarioId,
        questions: [],
        count: 0
      });
    }

    // 1a. Fetch competency codes for all unique competency_area_ids
    const competencyAreaIds = [...new Set(questions.map(q => q.competency_area_id).filter(Boolean))];
    let competencyCodeMap = {};
    if (competencyAreaIds.length > 0) {
      const { data: competencies, error: competenciesError } = await supabase
        .from('competency_areas')
        .select('id, competency_code')
        .in('id', competencyAreaIds);
      if (!competenciesError && competencies) {
        competencies.forEach(c => {
          competencyCodeMap[c.id] = c.competency_code;
        });
      }
    }

    // 2. For each question, check if there's approved provenance with valid citations
    // Fail-closed: only return questions that have:
    // - question_provenance with status='approved'
    // - citation_validations with result='valid' for that provenance
    // - referenced approved_sources with status='approved'
    // - referenced source_chunks with status='approved' and approved=true
    const approvedQuestions = [];

    for (const question of questions) {
      // A UUID-only or unmapped question must fail closed.
      if (!question.question_id) {
        continue;
      }

      // Check for approved provenance record
      const { data: provenance, error: provenanceError } = await supabase
        .from('question_provenance')
        .select('id, question_id, status')
        .eq('question_id', question.id)
        .eq('status', 'approved')
        .single();

      if (provenanceError || !provenance) {
        // No approved provenance for this question; skip it
        continue;
      }

      // Check for valid citation validation result
      // Verify validator_version comes from citation_validations, not question_provenance
      const { data: validation, error: validationError } = await supabase
        .from('citation_validations')
        .select('id, result, validator_version, validation_method, source_hashes_verified, excerpts_verified, urls_verified')
        .eq('question_provenance_id', provenance.id)
        .eq('result', 'valid')
        .single();

      if (validationError || !validation) {
        // No valid citation validation; skip this question
        continue;
      }

      // Retrieve citations for this provenance
      const { data: citations, error: citationsError } = await supabase
        .from('question_citations')
        .select('id, source_id, chunk_id, role, quote')
        .eq('question_provenance_id', provenance.id);

      if (citationsError || !citations || citations.length === 0) {
        // No citations found; skip
        continue;
      }

      // Verify all citations have required roles (supports-answer, supports-explanation)
      const roles = new Set(citations.map(c => c.role));
      if (!roles.has('supports-answer') || !roles.has('supports-explanation')) {
        continue;
      }

      // Verify each citation's source is approved
      let allSourcesApproved = true;
      for (const citation of citations) {
        const { data: source, error: sourceError } = await supabase
          .from('approved_sources')
          .select('id, status')
          .eq('id', citation.source_id)
          .eq('status', 'approved')
          .single();

        if (sourceError || !source) {
          allSourcesApproved = false;
          break;
        }

        // Verify chunk is approved
        const { data: chunk, error: chunkError } = await supabase
          .from('source_chunks')
          .select('id, status, approved, text_hash')
          .eq('chunk_id', citation.chunk_id)
          .eq('status', 'approved')
          .eq('approved', true)
          .single();

        if (chunkError || !chunk) {
          allSourcesApproved = false;
          break;
        }
      }

      if (!allSourcesApproved) {
        continue;
      }

      // All gates passed; add to approved questions
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
        competency_code: competencyCodeMap[question.competency_area_id] ?? null,
        question_id: question.question_id,
        question_provenance: {
          id: provenance.id,
          question_id: provenance.question_id,
          status: provenance.status,
          citation_validation: {
            valid: validation.result === 'valid',
            validator_version: validation.validator_version,
            validation_method: validation.validation_method,
            source_hashes_verified: validation.source_hashes_verified,
            excerpts_verified: validation.excerpts_verified,
            urls_verified: validation.urls_verified
          }
        },
        citations: citations.map(c => ({
          id: c.id,
          source_id: c.source_id,
          chunk_id: c.chunk_id,
          role: c.role,
          quote: c.quote
        }))
      });
    }

    return res.status(200).json({
      scenario_id: scenarioId,
      questions: approvedQuestions,
      count: approvedQuestions.length
    });
  } catch (err) {
    console.error('Error in scenario-questions-approved handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
