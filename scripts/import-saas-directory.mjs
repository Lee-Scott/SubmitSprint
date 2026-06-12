import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const defaultSourcePath = path.join(rootDir, 'data', 'source', 'saas-directory.csv');
const outputPath = path.join(rootDir, 'public', 'data', 'master_directories.json');

export function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function normalizeUrl(value) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  url.hash = '';
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
  return value?.trim() || undefined;
}

function parseNumber(value) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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

export function mapRowToRecord(row) {
  const name = normalizeText(row.Name);
  const rawUrl = normalizeText(row.URL ?? row.Url ?? row.url);

  if (!name || !rawUrl) {
    return null;
  }

  const url = normalizeUrl(rawUrl);
  const domain = normalizeText(row.Domain) ?? url.hostname.replace(/^www\./, '');
  const category = normalizeText(row.Category)?.toLowerCase();
  const tags = normalizeTags(row);

  return {
    name,
    url: url.toString(),
    domain,
    domainRating: parseNumber(row.DR),
    category,
    tags,
    source: 'saas-directory.csv',
    lastVerifiedAt: new Date().toISOString(),
  };
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

  const [headerRow, ...dataRows] = rows;
  return dataRows
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
    .map((cells) => Object.fromEntries(headerRow.map((header, index) => [header, cells[index] ?? ''])));
}

export async function importCsvFromText(text) {
  const rows = parseCsv(text);
  const mapped = rows.map(mapRowToRecord).filter(Boolean);
  const records = finalizeIds(mapped);
  const normalizedRecords = records.map((record) => ({ ...record, dataVersion: undefined }));
  const hash = createHash('sha256').update(JSON.stringify(normalizedRecords)).digest('hex').slice(0, 12);
  const dataVersion = `dataset-${hash}`;

  return {
    appName: 'SubmitSprint',
    dataVersion,
    generatedAt: new Date().toISOString(),
    totalRecords: records.length,
    records: records.map((record) => ({ ...record, dataVersion })),
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
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${payload.totalRecords} records to ${path.relative(rootDir, outputPath)} (${payload.dataVersion})`);
}

if (process.argv[1] === __filename) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
