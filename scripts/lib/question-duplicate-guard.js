'use strict';

const STOPWORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'does', 'for', 'from', 'how', 'in',
  'into', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'which', 'with'
]);

function words(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function answerText(item) {
  return item && item.options && item.options[item.correct_answer] || '';
}

function answerKey(item) {
  return words(answerText(item)).filter((word) => !['a', 'an', 'the'].includes(word)).join(' ');
}

function stemTokens(item) {
  return new Set(words(item.question || item.question_text).filter((word) => !STOPWORDS.has(word)));
}

function similarity(left, right) {
  const a = stemTokens(left);
  const b = stemTokens(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const word of a) if (b.has(word)) common += 1;
  return common / new Set([...a, ...b]).size;
}

function duplicateReason(candidate, reference) {
  const candidateStem = words(candidate.question || candidate.question_text).join(' ');
  const referenceStem = words(reference.question || reference.question_text).join(' ');
  if (candidateStem === referenceStem) return 'same stem';
  const overlap = similarity(candidate, reference);
  if (overlap >= 0.72) return 'near-identical stem';
  if (answerKey(candidate) && answerKey(candidate) === answerKey(reference) && overlap >= 0.35) {
    return 'same keyed answer and overlapping stem';
  }
  return null;
}

function findDuplicate(candidate, references) {
  for (const reference of references) {
    const reason = duplicateReason(candidate, reference);
    if (reason) return { question_id: reference.question_id, reason };
  }
  return null;
}

module.exports = { answerKey, duplicateReason, findDuplicate, similarity };
