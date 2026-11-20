export type GuardrailCategory = 'name' | 'ssn' | 'mrn' | 'dob' | 'email' | 'phone' | 'address' | 'diagnosis';
export type GuardrailConfidence = 'high' | 'medium' | 'low';
export type GuardrailAction = 'allow' | 'redact' | 'block' | 'review';
export type GuardrailPolicy = 'strict' | 'redact-medium';

export interface GuardrailFinding {
  category: GuardrailCategory;
  start: number;
  end: number;
  confidence: GuardrailConfidence;
}

export interface GuardrailResult {
  action: GuardrailAction;
  findings: GuardrailFinding[];
  redactedText?: string;
  reasonCode: 'no_findings' | 'sensitive_pattern' | 'needs_review' | 'detector_error';
}

const categoryOrder: GuardrailCategory[] = ['ssn', 'email', 'mrn', 'phone', 'dob', 'address', 'name', 'diagnosis'];
const rank: Record<GuardrailConfidence, number> = { high: 3, medium: 2, low: 1 };

function collect(text: string, category: GuardrailCategory, regex: RegExp, confidence: GuardrailConfidence, validate?: (match: string) => boolean): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || (validate && !validate(match[0]))) continue;
    findings.push({ category, start: match.index, end: match.index + match[0].length, confidence });
  }
  return findings;
}

function validDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
}

export function detectSensitivePatterns(text: string): GuardrailFinding[] {
  const findings = [
    ...collect(text, 'ssn', /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g, 'high'),
    ...collect(text, 'email', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, 'high'),
    ...collect(text, 'mrn', /\b(?:MRN|medical record(?: number)?)\s*[:#]?\s*[A-Z0-9][A-Z0-9-]{2,19}\b/gi, 'high'),
    ...collect(text, 'phone', /(?<![A-Z0-9])(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]\d{4}(?!\d)/gi, 'medium'),
    ...collect(text, 'dob', /\b(?:DOB\s*[:#]?\s*)?(\d{4}-\d{2}-\d{2})\b/gi, 'medium', (match) => validDate(match.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '')),
    ...collect(text, 'dob', /\bDOB\s*[:#]?\s*\d{4}-\d{2}-\d{2}\b/gi, 'low', (match) => !validDate(match.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '')),
    ...collect(text, 'address', /\b\d{1,5}\s+[A-Z0-9][A-Z0-9 .'-]{0,40}\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Lane|Ln|Dr|Drive)\b/gi, 'medium'),
    ...collect(text, 'name', /\b(?:Patient|Name)\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g, 'medium'),
    ...collect(text, 'diagnosis', /\bDiagnosis\s*:\s*[A-Z][A-Za-z -]{2,60}/gi, 'medium'),
  ];
  findings.sort((a, b) => a.start - b.start || rank[b.confidence] - rank[a.confidence] || categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category));
  const merged: GuardrailFinding[] = [];
  for (const finding of findings) {
    const previous = merged.at(-1);
    if (previous && finding.start < previous.end) {
      if (rank[finding.confidence] > rank[previous.confidence]) merged[merged.length - 1] = { ...finding, start: previous.start, end: Math.max(previous.end, finding.end) };
      else previous.end = Math.max(previous.end, finding.end);
    } else merged.push({ ...finding });
  }
  return merged;
}

export function runGuardrails(text: string, policy: GuardrailPolicy = 'strict'): GuardrailResult {
  if (!text.trim() || text.length > 5000) throw new TypeError('Text must be between 1 and 5000 characters.');
  if (policy !== 'strict' && policy !== 'redact-medium') throw new TypeError('Choose a supported guardrail policy.');
  const findings = detectSensitivePatterns(text);
  if (findings.length === 0) return { action: 'allow', findings, reasonCode: 'no_findings' };
  if (findings.some(({ confidence }) => confidence === 'low')) return { action: 'review', findings, reasonCode: 'needs_review' };
  if (findings.some(({ confidence }) => confidence === 'high') || policy === 'strict') return { action: 'block', findings, reasonCode: 'sensitive_pattern' };
  const redactedText = [...findings].reverse().reduce((result, finding) => result.slice(0, finding.start) + `[REDACTED:${finding.category.toUpperCase()}]` + result.slice(finding.end), text);
  return { action: 'redact', findings, redactedText, reasonCode: 'sensitive_pattern' };
}
