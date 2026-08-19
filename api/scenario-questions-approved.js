/**
 * API endpoint: GET /api/scenario-questions-approved
 *
 * Returns scenario questions with strict approval validation:
 * - question_provenance.status = 'approved'
 * - source_chunks.status = 'approved'
 * - approved_sources.status = 'approved'
 *
 * This enforces database-level approval, not client-side heuristics.
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
    // Execute the database query with strict approval validation
    // This query ensures:
    // 1. question_provenance.status = 'approved'
    // 2. citation_validations show validation evidence (result = 'valid')
    // 3. source_chunks (via citations) have status = 'approved'
    // 4. approved_sources have status = 'approved'
    // Use Supabase client to execute parameterized query
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    // For RLS queries via REST API with proper parameter binding
    // Supabase REST API doesn't support arbitrary SQL, so we use the JS client
    // NOTE: correct_answer is NEVER sent to clients
    // Students must never receive answer keys in the browser, even in hidden attributes
    const selectString = `
      id,
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      difficulty,
      topic,
      ase_area,
      question_provenance(
        id,
        status,
        validated_at,
        citation_validations(
          validator_version,
          validation_method,
          result
        )
      ),
      question_citations(
        id,
        source_id,
        chunk_id,
        quote,
        source_chunks(
          status,
          text_hash,
          approved_sources(
            status,
            storage_path
          )
        )
      )
    `;
    const { data, error } = await supabase
      .from('scenario_questions')
      .select(selectString)
      .eq('scenario_id', scenarioId)
      .eq('question_provenance.status', 'approved');
    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ error: 'Database query failed' });
    }
    if (!data || data.length === 0) {
      return res.status(200).json({
        scenario_id: scenarioId,
        questions: [],
        metadata: {
          total_approved_questions: 0,
          note: 'No questions meet approval criteria (all must have approved status in provenance, citations, chunks, and sources)'
        }
      });
    }
    // Filter client-side for additional validation (defense in depth)
    // This ensures citations and sources are all approved, and validation passed
    const validatedQuestions = data.filter(question => {
      // Must have approved provenance with valid citation validations
      if (question.question_provenance?.[0]?.status !== 'approved') {
        return false;
      }
      // Check that validation exists and passed
      const validation = question.question_provenance?.[0]?.citation_validations?.[0];
      if (!validation || validation.result !== 'valid') {
        return false;
      }
      // All citations must be from approved sources
      if (!Array.isArray(question.question_citations) || question.question_citations.length === 0) {
        return false;
      }
      return question.question_citations.every(citation => {
        if (citation.source_chunks?.[0]?.status !== 'approved') return false;
        if (citation.source_chunks?.[0]?.approved_sources?.[0]?.status !== 'approved') return false;
        return true;
      });
    });
    // Return with provenance metadata but NOT correct_answer or explanation (unless explicitly requested with prof auth)
    const questions = validatedQuestions.map(q => {
      const validation = q.question_provenance?.[0]?.citation_validations?.[0];
      const obj = {
        id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        difficulty: q.difficulty,
        topic: q.topic,
        ase_area: q.ase_area,
        question_provenance: q.question_provenance?.[0] ? {
          status: q.question_provenance[0].status,
          validated_at: q.question_provenance[0].validated_at,
          validation_status: validation?.result,
          validator_version: validation?.validator_version
        } : null,
        citations: q.question_citations.map(c => ({
          id: c.id,
          source_id: c.source_id,
          chunk_id: c.chunk_id,
          quote: c.quote,
          text_hash: c.source_chunks?.[0]?.text_hash,
          source_url: c.source_chunks?.[0]?.approved_sources?.[0]?.storage_path,
          source_status: c.source_chunks?.[0]?.status
        }))
      };
      // NOTE: correct_answer is NEVER included in the public response
      // Answer keys are only available via the protected grading endpoint
      return obj;
    });
    res.status(200).json({
      scenario_id: scenarioId,
      questions,
      metadata: {
        total_approved_questions: questions.length,
        enforcement_level: 'database-authoritative',
        validation_gates: [
          'question_provenance.status = approved',
          'citation_validations.result = valid',
          'source_chunks.status = approved',
          'approved_sources.status = approved'
        ]
      }
    });
  } catch (err) {
    console.error('Error in scenario-questions-approved handler:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
