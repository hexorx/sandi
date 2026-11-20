import { describe, expect, it } from 'vitest';
import { detectSensitivePatterns, runGuardrails } from './pii-phi.js';

describe('PII/PHI guardrails', () => {
  it('detects supported patterns without returning matched values', () => {
    const text = 'Patient: Example Person; SSN: 123-45-6789; MRN: DEMO-MRN-0001; DOB: 2000-01-01; demo@example.invalid; (202) 555-0100; 123 Example St; Diagnosis: Example condition';
    const findings = detectSensitivePatterns(text);
    expect(new Set(findings.map(({ category }) => category))).toEqual(new Set(['name', 'ssn', 'mrn', 'dob', 'email', 'phone', 'address', 'diagnosis']));
    expect(findings.every(({ start, end, confidence }) => start >= 0 && end > start && ['high', 'medium', 'low'].includes(confidence))).toBe(true);
    expect(findings.every((finding) => !('value' in finding))).toBe(true);
  });

  it('blocks high confidence findings and can locally redact medium findings', () => {
    expect(runGuardrails('Email me at demo@example.invalid').action).toBe('block');
    const result = runGuardrails('Call me at (202) 555-0100', 'redact-medium');
    expect(result.action).toBe('redact');
    expect(result.redactedText).toBe('Call me at [REDACTED:PHONE]');
  });

  it('rejects impossible SSN shapes and reports clean text without claiming it is PII-free', () => {
    expect(detectSensitivePatterns('Synthetic sample without supported patterns.')).toEqual([]);
    expect(detectSensitivePatterns('SSN: 000-00-0000')).toEqual([]);
    expect(runGuardrails('Synthetic sample without supported patterns.')).toMatchObject({ action: 'allow', reasonCode: 'no_findings' });
  });

  it('fails closed for a DOB cue with an invalid date that needs review', () => {
    expect(runGuardrails('DOB: 2000-19-42')).toMatchObject({ action: 'review', reasonCode: 'needs_review' });
  });
});
