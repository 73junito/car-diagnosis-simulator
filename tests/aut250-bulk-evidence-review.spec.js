const fs = require('fs');
const path = require('path');

describe('AUT-250 bulk citation/provenance review', () => {
  const review = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'evidence', 'review-queues', 'aut250-training-question-bulk-review-20260927.json'),
    'utf8'
  ));
  const curriculum = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'data', 'curriculum', 'lesson-content.json'),
    'utf8'
  ));
  const aut250 = curriculum.lessonContentPlans.find((plan) => plan.lessonPlanId === 'ug-hev-foundations');
  const questions = (aut250.courseModules || []).flatMap((module) => module.trainingQuestions || []);

  test('reviews every question exactly once', () => {
    expect(questions).toHaveLength(20);
    expect(review.questions).toHaveLength(20);
    expect(new Set(review.questions.map((item) => item.question_id)).size).toBe(20);
    expect(new Set(review.questions.map((item) => item.question_id)))
      .toEqual(new Set(questions.map((item) => item.id)));
  });

  test('records the fail-closed disposition totals', () => {
    const supported = review.questions.filter((item) => item.disposition === 'candidate-supported');
    const held = review.questions.filter((item) => item.disposition === 'hold-for-stronger-evidence');
    expect(supported).toHaveLength(14);
    expect(held).toHaveLength(6);
    expect(review.summary.candidate_supported).toBe(14);
    expect(review.summary.hold_for_stronger_evidence).toBe(6);
    expect(review.summary.approved).toBe(0);
    expect(review.summary.citation_validated).toBe(0);
  });

  test('does not create any approval or assessment eligibility', () => {
    expect(review.approval_effect).toBe('none');
    expect(review.question_status_after_review).toBe('draft');
    expect(review.assessment_eligibility_after_review).toBe(false);
    for (const item of review.questions) {
      expect(item.approval_effect).toBe('none');
      expect(item.technical_review_status).toBe('pending-human-review');
      expect(item.instructional_review_status).toBe('pending-human-review');
      expect(item.safety_review_status).toBe('pending-human-review');
    }
  });

  test('keeps candidate sources citation-only and blocks ingestion', () => {
    expect(review.source_policy.repository_ingestion).toBe('blocked');
    expect(review.source_policy.source_text_chunking).toBe('blocked');
    expect(review.source_policy.verbatim_quote_storage).toBe('blocked');
    expect(review.candidate_sources.length).toBeGreaterThanOrEqual(7);
    for (const source of review.candidate_sources) {
      expect(source.ingestion_status).toBe('metadata-and-link-only');
      expect(source.review_use).toMatch(/candidate citation support only|secondary corroboration only/);
    }
  });

  test('records duplicate and safety screening without claiming human completion', () => {
    expect(review.duplicate_review.exact_question_id_duplicates).toBe(0);
    expect(review.duplicate_review.exact_stem_duplicates).toBe(0);
    expect(review.duplicate_review.material_semantic_duplicates).toBe(0);
    expect(review.safety_review.universal_wait_times_present).toBe(false);
    expect(review.safety_review.universal_ppe_classes_present).toBe(false);
    expect(review.safety_review.universal_numeric_service_thresholds_present).toBe(false);
    expect(review.safety_review.review_complete).toBe(false);
  });
});
