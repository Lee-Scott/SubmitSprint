import { describe, expect, it } from 'vitest';

import { buildBaseId, finalizeIds, importCsvFromText, mapRowToRecord } from '../../scripts/import-saas-directory.mjs';

describe('importer mapping', () => {
  it('requires name and url and derives domain from url', () => {
    const record = mapRowToRecord({ Name: 'Acme', URL: 'https://www.acme.io/listing', Domain: '', DR: '45', Category: 'SaaS' });
    expect(record?.domain).toBe('acme.io');
    expect(record?.domainRating).toBe(45);
    expect(record?.category).toBe('saas');
  });

  it('maps the URL column to url and mirrors homepageUrl when no homepage column exists', () => {
    const record = mapRowToRecord({ Name: 'Acme', URL: 'https://acme.io/submit', Domain: 'acme.io', DR: '45', Category: 'SaaS' });

    expect(record?.url).toBe('https://acme.io/submit');
    expect(record?.homepageUrl).toBe('https://acme.io/submit');
    expect(record?.submissionUrl).toBeUndefined();
  });

  it('supports explicit homepage and submission URL columns without changing url mapping', () => {
    const record = mapRowToRecord({
      Name: 'Acme',
      URL: 'https://acme.io/directory',
      'Homepage URL': 'https://acme.io',
      'Submission URL': 'https://acme.io/submit',
      Domain: 'acme.io',
      DR: '45',
      Category: 'SaaS',
    });

    expect(record?.url).toBe('https://acme.io/directory');
    expect(record?.homepageUrl).toBe('https://acme.io/');
    expect(record?.submissionUrl).toBe('https://acme.io/submit');
  });

  it('preserves URL paths, query params, and hashes', () => {
    const record = mapRowToRecord({
      Name: 'Acme',
      URL: 'https://acme.io/submit/new?ref=abc#requirements',
      Domain: 'acme.io',
      DR: '45',
      Category: 'SaaS',
    });

    expect(record?.url).toBe('https://acme.io/submit/new?ref=abc#requirements');
  });

  it('adds row metadata and source attributes', () => {
    const record = mapRowToRecord(
      {
        Name: 'Acme',
        URL: 'https://acme.io',
        Domain: 'acme.io',
        Category: 'SaaS',
        DR: '45',
        'Dofollow/Nofollow': 'do',
        'Price model': 'free',
        Usecase: 'Launch discovery',
        bf: 'yes',
      },
      { sourceRowNumber: 8 },
    );

    expect(record?.sourceRowNumber).toBe(8);
    expect(record?.dofollow).toBe('do');
    expect(record?.priceModel).toBe('free');
    expect(record?.usecase).toBe('Launch discovery');
    expect(record?.bestFirst).toBe(true);
  });

  it('warns on domain URL mismatches', () => {
    const record = mapRowToRecord({ Name: 'Acme', URL: 'https://discord.com/invite/abc', Domain: 'discord.gg', DR: '45', Category: 'community' });

    expect(record?.linkStatus).toBe('suspicious');
    expect(record?.importerWarnings).toContain('domain_url_mismatch');
  });

  it('builds stable ids from domain path and name', () => {
    const record = mapRowToRecord({ Name: 'Acme', URL: 'https://acme.io/listing', Domain: '' });
    expect(buildBaseId(record)).toBe('acme-io__listing__acme');
  });

  it('handles collisions deterministically', () => {
    const records = finalizeIds([
      { id: '', name: 'Acme', url: 'https://acme.io/listing', domain: 'acme.io', source: 'x' },
      { id: '', name: 'Acme', url: 'https://acme.io/listing', domain: 'acme.io', source: 'y' },
    ]);

    expect(records[0].id).toBe('acme-io__listing__acme');
    expect(records[1].id.startsWith('acme-io__listing__acme__')).toBe(true);
  });

  it('imports csv text into a dataset payload', async () => {
    const payload = await importCsvFromText(`Name,URL,Category,DR\nAcme,https://acme.io,AI,80\n`);
    expect(payload.totalRecords).toBe(1);
    expect(payload.records[0].dataVersion).toBe(payload.dataVersion);
    expect(payload.audit.importedRecords).toBe(1);
  });

  it('reports duplicate URLs without blocking import', async () => {
    const payload = await importCsvFromText(
      `Name,Domain,URL,Category,DR\nAcme,acme.io,https://acme.io,AI,80\nAcme Copy,acme.io,https://acme.io,AI,80\n`,
    );

    expect(payload.totalRecords).toBe(2);
    expect(payload.audit.duplicateUrls).toBe(1);
    expect(payload.audit.recordsWithWarnings).toBe(2);
    expect(payload.records.every((record) => record.importerWarnings?.includes('duplicate_url'))).toBe(true);
  });

  it('preserves repeated-domain paths in stable IDs', async () => {
    const payload = await importCsvFromText(
      `Name,Domain,URL,Category,DR\nReddit A,reddit.com,https://reddit.com/r/a,community,95\nReddit B,reddit.com,https://reddit.com/r/b,community,95\n`,
    );

    expect(payload.records.map((record) => record.id)).toEqual(['reddit-com__r-a__reddit-a', 'reddit-com__r-b__reddit-b']);
  });
});
