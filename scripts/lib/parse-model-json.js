function tryParseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseModelJson(content) {
  if (content && typeof content === 'object') {
    return content;
  }

  const text = String(content || '').trim();
  if (!text) {
    throw new Error('Model response was empty.');
  }

  const direct = tryParseJson(text);
  if (direct) {
    return direct;
  }

  const fenced = text.match(/^\s*\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`\s*$/i);
  if (fenced) {
    const parsedFence = tryParseJson(fenced[1].trim());
    if (parsedFence) {
      return parsedFence;
    }
  }

  const firstObject = text.indexOf('{');
  const lastObject = text.lastIndexOf('}');
  if (firstObject !== -1 && lastObject > firstObject) {
    const extracted = tryParseJson(text.slice(firstObject, lastObject + 1));
    if (extracted) {
      return extracted;
    }
  }

  throw new Error('Model response did not contain a valid JSON object.');
}

module.exports = { parseModelJson };
