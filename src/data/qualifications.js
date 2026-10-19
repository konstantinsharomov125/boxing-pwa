/**
 * Единый справочник спортивных званий и разрядов.
 *
 * Используется в формах спортсмена, модельных ориентирах и фильтрах
 * исследовательской базы. Старые названия групп, сохранённые в профилях,
 * нормализуются к каноническим id через normalizeAthleteQualification.
 */

export const QUALIFICATIONS = [
  { id: 'zms', name: 'ЗМС', order: 10 },
  { id: 'msmk', name: 'МСМК', order: 20 },
  { id: 'ms', name: 'МС', order: 30 },
  { id: 'kms', name: 'КМС', order: 40 },
  { id: 'first_rank', name: 'I спортивный разряд', order: 50 },
  { id: 'second_rank', name: 'II спортивный разряд', order: 60 },
  { id: 'third_rank', name: 'III спортивный разряд', order: 70 },
];

const QUALIFICATIONS_BY_ID = Object.fromEntries(
  QUALIFICATIONS.map((q) => [q.id, q]),
);

const ALIASES = [
  { pattern: /^змс/i, id: 'zms' },
  { pattern: /^мсмк/i, id: 'msmk' },
  { pattern: /^мастер спорта международного класса/i, id: 'msmk' },
  { pattern: /^мс\s*\/\s*кмс/i, id: 'ms' },
  { pattern: /^мс\b/i, id: 'ms' },
  { pattern: /^мастер спорта\b/i, id: 'ms' },
  { pattern: /^кмс/i, id: 'kms' },
  { pattern: /^кандидат в мастера спорта/i, id: 'kms' },
  { pattern: /^1[-\s]?й?\s*(спортивный\s+)?разряд/i, id: 'first_rank' },
  { pattern: /^i{1}\s*(спортивный\s+)?разряд/i, id: 'first_rank' },
  { pattern: /^2[-\s]?й?\s*(спортивный\s+)?разряд/i, id: 'second_rank' },
  { pattern: /^i{2}\s*(спортивный\s+)?разряд/i, id: 'second_rank' },
  { pattern: /^3[-\s]?й?\s*(спортивный\s+)?разряд/i, id: 'third_rank' },
  { pattern: /^i{3}\s*(спортивный\s+)?разряд/i, id: 'third_rank' },
];

/**
 * Приводит произвольное значение квалификации к каноническому id.
 * Возвращает null для пустого значения или "Без разряда".
 */
export function normalizeAthleteQualification(raw) {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (QUALIFICATIONS_BY_ID[value]) return value;

  const lower = value.toLowerCase();
  if (lower === 'без разряда' || lower === 'безразрядная') return null;

  for (const alias of ALIASES) {
    if (alias.pattern.test(value)) return alias.id;
  }

  return null;
}

/** Возвращает каноническое название по id или исходную строку. */
export function getQualificationName(idOrRaw) {
  const id = normalizeAthleteQualification(idOrRaw);
  if (!id) return idOrRaw ? String(idOrRaw).trim() : '';
  return QUALIFICATIONS_BY_ID[id]?.name || id;
}

/** Список для селектов: { value, label }. */
export function getQualificationOptions() {
  return QUALIFICATIONS.slice()
    .sort((a, b) => a.order - b.order)
    .map((q) => ({ value: q.id, label: q.name }));
}

/** Проверяет, что id существует в справочнике. */
export function isValidQualificationId(id) {
  return id != null && QUALIFICATIONS_BY_ID[id] !== undefined;
}
