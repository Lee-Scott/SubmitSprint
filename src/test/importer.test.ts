import { describe, expect, it } from 'vitest';

import { buildBaseId, finalizeIds, importCsvFromText, mapRowToRecord } from '../../scripts/import-saas-directory.mjs';

describe('importer mapping', () => {
  it('requires name and url and derives domain from url', () => {
    const record = mapRowToRecord({ Name: 'Acme', URL: 'https://www.acme.io/listing', Domain: '', DR: '45', Category: 'SaaS' });
    expect(record?.domain).toBe('acme.io');
    expect(record?.domainRating).toBe(45);
    expect(record?.category).toBe('saas');
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
  });
});
