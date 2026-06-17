import { describe, expect, it } from 'vitest';

import { createDirectoryReportMailto, createMailtoLink } from '../lib/feedback';

describe('feedback mailto links', () => {
  it('encodes mailto subjects and bodies safely', () => {
    const href = createMailtoLink({
      to: 'support@example.test',
      subject: 'A & B',
      body: 'Line 1\nhttps://example.test/a?x=1&y=2',
    });
    const params = new URLSearchParams(href.split('?')[1]);

    expect(href).toContain('mailto:support%40example.test?');
    expect(params.get('subject')).toBe('A & B');
    expect(params.get('body')).toBe('Line 1\nhttps://example.test/a?x=1&y=2');
  });

  it('includes directory context in report links', () => {
    const href = createDirectoryReportMailto(
      {
        id: 'dir-1',
        name: 'Acme Directory',
        domain: 'acme.test',
        url: 'https://acme.test',
        submissionUrl: 'https://acme.test/submit',
        category: 'saas',
      },
      { directoryId: 'dir-1', status: 'opened', lastUpdatedAt: '2026-01-01T00:00:00.000Z' },
    );
    const body = new URLSearchParams(href.split('?')[1]).get('body');

    expect(body).toContain('Directory ID: dir-1');
    expect(body).toContain('Submission URL: https://acme.test/submit');
    expect(body).toContain('Current status: opened');
  });
});
