import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const defaultSourcePath = path.join(rootDir, 'data', 'source', 'saas-directory.csv');
const outputPath = path.join(rootDir, 'public', 'data', 'master_directories.json');
const auditOutputPath = path.join(rootDir, 'reports', 'directory-link-audit.json');

const expectedHeaders = ['Name', 'Domain', 'URL', 'Category', 'DR', 'Dofollow/Nofollow', 'Price model', 'Usecase', 'bf'];
const urlHeaderCandidates = ['URL', 'Url', 'url'];
const homepageHeaderCandidates = ['Homepage URL', 'HomepageUrl', 'homepageUrl', 'Homepage', 'Website', 'Website URL'];
const submissionHeaderCandidates = ['Submission URL', 'SubmissionUrl', 'submissionUrl', 'Submit URL', 'SubmitUrl', 'submitUrl'];

export function slugify(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeUrl(value) {
  const trimmed = String(value ?? '').trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  }

  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }

  return url;
}

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return 'root';
  }

  return slugify(pathname.replace(/\/+/g, '/'));
}

function normalizeText(value) {
  return String(value ?? '').trim() || undefined;
}

function parseNumber(value) {
  if (!String(value ?? '').trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickFirst(row, headers) {
  for (const header of headers) {
    const value = normalizeText(row[header]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function normalizeDomain(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function normalizeBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'best', 'best-first', 'best first'].includes(normalized);
}

function normalizeOptionalUrl(value) {
  if (!value) {
    return undefined;
  }

  return normalizeUrl(value).toString();
}

export function normalizeTags(row) {
  const tagSources = [row.Tags, row.tags, row.Usecase, row.usecase, row.bf, row.BF]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[|,;/]+/));

  const normalized = [...new Set(tagSources.map((value) => slugify(value)).filter(Boolean))];
  return normalized.length ? normalized : undefined;
}

export function buildBaseId(record) {
  return [slugify(record.domain), normalizePathname(new URL(record.url).pathname), slugify(record.name)].filter(Boolean).join('__');
}

function buildContentFingerprint(record) {
  const payload = JSON.stringify({
    name: record.name,
    url: record.url,
    domain: record.domain,
    category: record.category ?? '',
    tags: record.tags ?? [],
    domainRating: record.domainRating ?? null,
    source: record.source ?? '',
  });

  return createHash('sha256').update(payload).digest('hex').slice(0, 8);
}

export function finalizeIds(records) {
  const seenIds = new Map();
  const fingerprintCounts = new Map();

  return records.map((record) => {
    const baseId = buildBaseId(record);
    const fingerprint = buildContentFingerprint(record);
    const fingerprintId = `${baseId}__${fingerprint}`;

    if (!seenIds.has(baseId)) {
      seenIds.set(baseId, fingerprint);
      return { ...record, id: baseId };
    }

    if (!seenIds.has(fingerprintId)) {
      seenIds.set(fingerprintId, fingerprint);
      return { ...record, id: fingerprintId };
    }

    const occurrence = (fingerprintCounts.get(fingerprintId) ?? 0) + 1;
    fingerprintCounts.set(fingerprintId, occurrence);
    const occurrenceId = `${fingerprintId}__${occurrence}`;
    seenIds.set(occurrenceId, fingerprint);
    return { ...record, id: occurrenceId };
  });
}

function compactRecord(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && !(Array.isArray(value) && value.length === 0)));
}

function getWarningCounts(records) {
  const counts = new Map();

  for (const record of records) {
    for (const warning of record.importerWarnings ?? []) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([warning, count]) => ({ warning, count }));
}

function countDuplicates(records, field) {
  const counts = new Map();

  for (const record of records) {
    const value = record[field];
    if (!value) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1);
}

function attachDuplicateWarnings(records, field, warning) {
  const duplicateValues = new Set(countDuplicates(records, field).map(([value]) => value));

  if (!duplicateValues.size) {
    return records;
  }

  return records.map((record) => {
    if (!duplicateValues.has(record[field])) {
      return record;
    }

    return {
      ...record,
      importerWarnings: [...new Set([...(record.importerWarnings ?? []), warning])],
      linkStatus: record.linkStatus === 'suspicious' ? record.linkStatus : 'needs_review',
    };
  });
}

function buildAudit({ rows, records, skippedRows, headers }) {
  const duplicateIdEntries = countDuplicates(records, 'id');
  const duplicateUrlEntries = countDuplicates(records, 'url');
  const duplicateDomainEntries = countDuplicates(records, 'domain');
  const topWarnings = getWarningCounts(records);

  return {
    appName: 'SubmitSprint',
    generatedAt: new Date().toISOString(),
    source: 'data/source/saas-directory.csv',
    headers,
    expectedHeaders,
    totalSourceRows: rows.length,
    importedRecords: records.length,
    skippedRecords: skippedRows.length,
    invalidUrls: skippedRows.filter((row) => row.reason === 'invalid_url').length,
    missingNames: skippedRows.filter((row) => row.reason === 'missing_name').length,
    missingUrls: skippedRows.filter((row) => row.reason === 'missing_url').length,
    missingCategories: records.filter((record) => !record.category).length,
    missingDr: records.filter((record) => record.domainRating === undefined).length,
    duplicateIds: duplicateIdEntries.length,
    duplicateUrls: duplicateUrlEntries.length,
    duplicateDomains: duplicateDomainEntries.length,
    suspiciousLinks: records.filter((record) => record.linkStatus === 'suspicious').length,
    domainUrlMismatches: records.filter((record) => record.importerWarnings?.includes('domain_url_mismatch')).length,
    recordsWithWarnings: records.filter((record) => record.importerWarnings?.length).length,
    topWarnings: topWarnings.slice(0, 12),
    examples: {
      skippedRows: skippedRows.slice(0, 20),
      duplicateUrls: duplicateUrlEntries.slice(0, 20).map(([url, count]) => ({ url, count })),
      duplicateDomains: duplicateDomainEntries
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 20)
        .map(([domain, count]) => ({
          domain,
          count,
          examples: records
            .filter((record) => record.domain === domain)
            .slice(0, 5)
            .map((record) => ({ id: record.id, name: record.name, url: record.url })),
        })),
      domainUrlMismatches: records
        .filter((record) => record.importerWarnings?.includes('domain_url_mismatch'))
        .slice(0, 20)
        .map((record) => ({ id: record.id, name: record.name, domain: record.domain, url: record.url })),
      warnings: records
        .filter((record) => record.importerWarnings?.length)
        .slice(0, 30)
        .map((record) => ({ id: record.id, name: record.name, url: record.url, warnings: record.importerWarnings })),
    },
  };
}

function stableRecordForHash(record) {
  const { dataVersion, lastVerifiedAt, linkReviewedAt, ...stable } = record;
  return stable;
}

export function mapRowToRecord(row, options = {}) {
  const sourceRowNumber = options.sourceRowNumber;
  const name = normalizeText(row.Name);
  const rawUrl = pickFirst(row, urlHeaderCandidates);
  const warnings = [];

  if (!name || !rawUrl) {
    return null;
  }

  let url;
  let homepageUrl;
  let submissionUrl;

  try {
    url = normalizeUrl(rawUrl);
    homepageUrl = normalizeOptionalUrl(pickFirst(row, homepageHeaderCandidates)) ?? url.toString();
    submissionUrl = normalizeOptionalUrl(pickFirst(row, submissionHeaderCandidates));
  } catch {
    return null;
  }

  const rawDomain = normalizeText(row.Domain);
  const urlDomain = url.hostname.replace(/^www\./, '');
  const domain = rawDomain ? normalizeDomain(rawDomain) : urlDomain;
  const category = normalizeText(row.Category)?.toLowerCase();
  const domainRating = parseNumber(row.DR);
  const tags = normalizeTags(row);
  const dofollow = normalizeText(row['Dofollow/Nofollow']);
  const priceModel = normalizeText(row['Price model']);
  const usecase = normalizeText(row.Usecase);
  const bestFirst = normalizeBoolean(row.bf);

  if (!category) {
    warnings.push('missing_category');
  }

  if (domainRating === undefined) {
    warnings.push('missing_dr');
  }

  if (rawDomain && normalizeDomain(rawDomain) !== urlDomain) {
    warnings.push('domain_url_mismatch');
  }

  const linkStatus = warnings.includes('domain_url_mismatch') ? 'suspicious' : warnings.length ? 'needs_review' : 'untested';

  return compactRecord({
    id: '',
    name,
    url: url.toString(),
    domain,
    domainRating,
    category,
    tags,
    source: 'saas-directory.csv',
    homepageUrl,
    submissionUrl,
    sourceRowNumber,
    priceModel,
    dofollow,
    usecase,
    bestFirst,
    linkStatus,
    importerWarnings: warnings,
  });
}

export function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  const [headerRow = [], ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim());
  const parsedRows = dataRows
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));

  return parsedRows;
}

export function parseCsvWithHeaders(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const headers = firstLine.split(',').map((header) => header.trim());
  return {
    headers,
    rows: parseCsv(text),
  };
}

export async function importCsvFromText(text) {
  const { rows, headers } = parseCsvWithHeaders(text);
  const skippedRows = [];
  const mapped = [];

  rows.forEach((row, index) => {
    const sourceRowNumber = index + 2;
    const hasName = Boolean(normalizeText(row.Name));
    const hasUrl = Boolean(pickFirst(row, urlHeaderCandidates));

    if (!hasName) {
      skippedRows.push({ sourceRowNumber, reason: 'missing_name' });
      return;
    }

    if (!hasUrl) {
      skippedRows.push({ sourceRowNumber, reason: 'missing_url', name: normalizeText(row.Name) });
      return;
    }

    const record = mapRowToRecord(row, { sourceRowNumber });

    if (!record) {
      skippedRows.push({ sourceRowNumber, reason: 'invalid_url', name: normalizeText(row.Name), url: pickFirst(row, urlHeaderCandidates) });
      return;
    }

    mapped.push(record);
  });

  let records = finalizeIds(mapped);
  records = attachDuplicateWarnings(records, 'url', 'duplicate_url');
  records = attachDuplicateWarnings(records, 'id', 'duplicate_id');

  const normalizedRecords = records.map(stableRecordForHash);
  const hash = createHash('sha256').update(JSON.stringify(normalizedRecords)).digest('hex').slice(0, 12);
  const dataVersion = `dataset-${hash}`;
  const generatedAt = new Date().toISOString();
  const recordsWithVersion = records.map((record) => ({ ...record, dataVersion }));
  const audit = buildAudit({ rows, records: recordsWithVersion, skippedRows, headers });

  return {
    appName: 'SubmitSprint',
    dataVersion,
    generatedAt,
    totalRecords: recordsWithVersion.length,
    records: recordsWithVersion,
    audit: {
      totalSourceRows: audit.totalSourceRows,
      importedRecords: audit.importedRecords,
      skippedRecords: audit.skippedRecords,
      invalidUrls: audit.invalidUrls,
      missingNames: audit.missingNames,
      missingUrls: audit.missingUrls,
      missingCategories: audit.missingCategories,
      missingDr: audit.missingDr,
      duplicateIds: audit.duplicateIds,
      duplicateUrls: audit.duplicateUrls,
      duplicateDomains: audit.duplicateDomains,
      suspiciousLinks: audit.suspiciousLinks,
      domainUrlMismatches: audit.domainUrlMismatches,
      recordsWithWarnings: audit.recordsWithWarnings,
      topWarnings: audit.topWarnings,
    },
    auditReport: {
      ...audit,
      dataVersion,
      generatedAt,
    },
  };
}

async function resolveInput(argument) {
  if (!argument) {
    return readFile(defaultSourcePath, 'utf8');
  }

  if (/^https?:\/\//i.test(argument)) {
    const response = await fetch(argument);
    if (!response.ok) {
      throw new Error(`Unable to fetch CSV from ${argument}`);
    }
    return response.text();
  }

  return readFile(path.resolve(rootDir, argument), 'utf8');
}

async function main() {
  const source = process.argv[2];
  const csvText = await resolveInput(source);
  const payload = await importCsvFromText(csvText);
  const { auditReport, ...dataset } = payload;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.dirname(auditOutputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  await writeFile(auditOutputPath, `${JSON.stringify(auditReport, null, 2)}\n`, 'utf8');

  console.log(`Wrote ${dataset.totalRecords} records to ${path.relative(rootDir, outputPath)} (${dataset.dataVersion})`);
  console.log(`Audit: ${auditReport.importedRecords}/${auditReport.totalSourceRows} imported, ${auditReport.recordsWithWarnings} records with warnings`);
  console.log(`Audit report: ${path.relative(rootDir, auditOutputPath)}`);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
