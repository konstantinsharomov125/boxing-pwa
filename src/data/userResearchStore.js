/**
 * Хранилище пользовательских записей исследовательской базы.
 *
 * Записи сохраняются в localStorage под ключом `box_research_user` и
 * объединяются со встроенной базой RESEARCH_DATABASE через getAllResearch().
 *
 * Схема записи (совместима с RESEARCH_DATABASE + поля модели):
 * {
 *   id: 'user_<timestamp>_<счётчик>',
 *   author, year, group, qualification, weightCategory, style,
 *   citation:              обязательная библиографическая ссылка;
 *   metrics:               { [metricId]: { mean, sd, unit } } — только заполненные;
 *   sampleSize:            число или null;
 *   protocol:              строка или null;
 *   sex:                   'male' | 'female' | null;
 *   dataStatus:            статус из DATA_QUALITY_STATUSES (кроме 'demo');
 *   admissionConditions:   [bool, bool, bool, bool] — отметки выполнения
 *                          условий допуска (см. ADMISSION_CONDITIONS);
 *   userProvided: true,
 *   createdAt: ISO-строка,
 * }
 *
 * Правила: неизвестные поля — null, нули не подставляются; запись без
 * валидной цитирования, корректного года и хотя бы одного корректного
 * показателя отклоняется валидацией.
 *
 * Перенос между устройствами: exportUserResearchJSON() формирует JSON-файл,
 * importUserResearchJSON(text, { mode }) принимает его обратно в режиме
 * 'merge' (пополнение без дубликатов) или 'replace' (полная замена базы).
 * Файл — конверт { app, kind, version, exportedAt, count, entries: [...] };
 * для совместимости принимается и голый массив записей.
 */

import { getMetricById, DATA_QUALITY_STATUSES } from './modelsConfig.js';

const STORAGE_KEY = 'box_research_user';

/** Показатели, по которым пользователь может вводить статистики. */
export const USER_ENTRY_METRICS = ['density', 'keu', 'kv', 'vo2maxRel', 'relPower', 'reactionTime'];

/**
 * Фиксированные условия допуска референтной модели к научному сравнению.
 * Определены здесь (а не в modelsConfig.js), чтобы не создавать циклический
 * импорт: modelsConfig импортирует их из этого модуля.
 */
export const ADMISSION_CONDITIONS = [
  'Числовые значения сверены с полным текстом первоисточника',
  'Протокол измерения каждого показателя документирован',
  'Указаны размер и состав выборки',
  'Подтверждены единицы измерения и оборудование',
];

/** Статусы, при которых допуск к сравнению возможен в принципе. */
export const ADMISSIBLE_STATUSES = ['verified_fulltext', 'verified_primary'];

/** Статусы, доступные пользователю (demo — только для встроенных демо-данных). */
export function getUserAllowedStatuses() {
  return Object.keys(DATA_QUALITY_STATUSES).filter((s) => s !== 'demo');
}

// ---------------------------------------------------------------------------
// CRUD над localStorage
// ---------------------------------------------------------------------------

function safeGetItem(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Читает пользовательские записи; повреждённый JSON → пустой массив. */
export function loadUserResearch() {
  const raw = safeGetItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e === 'object' && e.id) : [];
  } catch {
    return [];
  }
}

export function saveUserResearch(list) {
  return safeSetItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

export function addUserResearch(entry) {
  const list = loadUserResearch();
  list.push(entry);
  saveUserResearch(list);
  return entry;
}

export function deleteUserResearch(id) {
  const list = loadUserResearch().filter((e) => e.id !== id);
  saveUserResearch(list);
  return list;
}

export function updateUserResearch(id, patch) {
  const list = loadUserResearch().map((e) => (e.id === id ? { ...e, ...patch, id: e.id } : e));
  saveUserResearch(list);
  return list.find((e) => e.id === id) || null;
}

// ---------------------------------------------------------------------------
// Валидация записи
// ---------------------------------------------------------------------------

/**
 * Проверяет пользовательскую запись перед сохранением.
 * Возвращает { valid: boolean, errors: string[] }.
 */
export function validateUserEntry(entry) {
  const errors = [];

  if (!entry.author || !String(entry.author).trim()) {
    errors.push('Не указан автор(ы) исследования.');
  }
  const year = Number(entry.year);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(year) || year < 1950 || year > currentYear) {
    errors.push(`Год публикации должен быть числом от 1950 до ${currentYear}.`);
  }
  if (!entry.citation || String(entry.citation).trim().length < 20) {
    errors.push('Библиографическая ссылка обязательна (не короче 20 символов).');
  }
  if (!getUserAllowedStatuses().includes(entry.dataStatus)) {
    errors.push('Недопустимый статус достоверности данных.');
  }

  // Размер выборки: null допустим, но если задан — конечное положительное число
  if (entry.sampleSize != null) {
    const n = Number(entry.sampleSize);
    if (!Number.isFinite(n) || n <= 0) {
      errors.push('Размер выборки должен быть положительным числом или отсутствовать.');
    }
  }

  // Показатели: хотя бы один с валидным mean; sd конечно и > 0; единица = каталожной
  const metrics = entry.metrics || {};
  let validMetricCount = 0;
  for (const metricId of Object.keys(metrics)) {
    const metric = getMetricById(metricId);
    if (!metric) {
      errors.push(`Показатель «${metricId}» отсутствует в каталоге.`);
      continue;
    }
    const m = metrics[metricId];
    if (!m || typeof m !== 'object') continue;
    const hasMean = m.mean !== null && m.mean !== undefined && m.mean !== '';
    const hasSd = m.sd !== null && m.sd !== undefined && m.sd !== '';
    if (!hasMean && !hasSd) continue; // показатель не заполнен — пропускаем

    const mean = Number(m.mean);
    if (!hasMean || !Number.isFinite(mean)) {
      errors.push(`${metric.nameRu}: среднее значение отсутствует или не является конечным числом.`);
      continue;
    }
    if (hasSd) {
      const sd = Number(m.sd);
      if (!Number.isFinite(sd) || sd <= 0) {
        errors.push(`${metric.nameRu}: стандартное отклонение должно быть конечным числом > 0.`);
        continue;
      }
    }
    const catalogUnit = metric.unit;
    if (m.unit != null && catalogUnit != null && m.unit !== catalogUnit) {
      errors.push(`${metric.nameRu}: единица измерения «${m.unit}» не совпадает с каталожной «${catalogUnit}».`);
      continue;
    }
    validMetricCount += 1;
  }
  if (validMetricCount === 0) {
    errors.push('Заполните хотя бы один показатель с корректным средним значением.');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Экспорт / импорт пользовательской базы (перенос между устройствами)
// ---------------------------------------------------------------------------

/** Идентификатор формата файла переноса (в конверте поле kind). */
export const RESEARCH_FILE_KIND = 'box_research_user';

/** Версия формата: повышаете при несовместимом изменении схемы записей. */
export const RESEARCH_FILE_VERSION = 1;

/** Предупреждение/отказ при слишком большом числе записей в одном файле. */
export const MAX_IMPORT_ENTRIES = 2000;

/** Ограничения длины текстовых полей, читаемых из файла. */
const TEXT_LIMIT = 4000;
const SHORT_TEXT_LIMIT = 200;

let importIdCounter = 0;

/** Уникальный id записи: метка времени + счётчик, чтобы не столкнуться в одну миллисекунду. */
function makeEntryId() {
  importIdCounter += 1;
  return `user_${Date.now()}_${importIdCounter.toString(36)}`;
}

function textOrNull(value, limit = TEXT_LIMIT) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > limit ? text.slice(0, limit) : text;
}

/** Собирает объект файла-конверта из списка записей (по умолчанию — из localStorage). */
export function buildUserResearchExport(entries = loadUserResearch()) {
  const list = Array.isArray(entries)
    ? entries.filter((e) => e && typeof e === 'object' && typeof e.id === 'string' && e.id)
    : [];
  return {
    app: 'BOX-PROFILE',
    kind: RESEARCH_FILE_KIND,
    version: RESEARCH_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    count: list.length,
    entries: list,
  };
}

/** JSON-строка файла переноса (отступ 2 пробела, без BOM). */
export function exportUserResearchJSON(entries) {
  return JSON.stringify(buildUserResearchExport(entries), null, 2);
}

/** Имя файла переноса по умолчанию с датой в локальном часовом поясе. */
export function userResearchFileName(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return `Исследовательская_база_${local.toISOString().slice(0, 10)}.json`;
}

/**
 * Приводит элемент файла к схеме хранения и собирает список замечаний.
 * Возвращает { label, entry } при успехе или { label, errors } при отклонении.
 * Обязательные поля не чинятся: при них отклоняется вся запись; необязательные (пол, выборка) приводятся к null.
 */
function sanitizeImportedEntry(raw, index) {
  const labelBase = `запись №${index + 1}`;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { label: labelBase, errors: ['Элемент не является объектом записи исследования.'] };
  }

  const errors = [];
  const author = textOrNull(raw.author, 300);
  const citation = textOrNull(raw.citation);
  const label = author ? `${author}${raw.year ? ` (${raw.year})` : ''}` : labelBase;

  if (!author) errors.push('Не указан автор(ы) исследования.');
  if (!citation || citation.length < 20) {
    errors.push('Библиографическая ссылка отсутствует или короче 20 символов.');
  }

  const rawMetrics = raw.metrics && typeof raw.metrics === 'object' && !Array.isArray(raw.metrics) ? raw.metrics : {};
  const metrics = {};
  for (const [metricId, m] of Object.entries(rawMetrics)) {
    const metric = getMetricById(metricId);
    if (!metric) {
      errors.push(`Показатель «${metricId}» отсутствует в каталоге.`);
      continue;
    }
    if (!m || typeof m !== 'object') {
      errors.push(`${metric.nameRu}: значение показателя должно быть объектом { mean, sd, unit }.`);
      continue;
    }
    const mean = Number(m.mean);
    if (!Number.isFinite(mean)) {
      errors.push(`${metric.nameRu}: среднее значение отсутствует или не является числом.`);
      continue;
    }
    const hasSd = m.sd !== null && m.sd !== undefined && m.sd !== '';
    const sd = hasSd ? Number(m.sd) : null;
    if (hasSd && (!Number.isFinite(sd) || sd <= 0)) {
      errors.push(`${metric.nameRu}: стандартное отклонение должно быть конечным числом > 0.`);
      continue;
    }
    // Единицу из файла не подменяем каталожной: рассогласование = отказ записи
    if (m.unit != null && m.unit !== '' && m.unit !== metric.unit) {
      errors.push(`${metric.nameRu}: единица измерения «${m.unit}» не совпадает с каталожной «${metric.unit}».`);
      continue;
    }
    metrics[metricId] = { mean, sd: hasSd ? sd : null, unit: metric.unit ?? null };
  }
  if (Object.keys(metrics).length === 0) {
    errors.push('В записи нет ни одного показателя с корректным средним значением.');
  }

  const dataStatus = getUserAllowedStatuses().includes(raw.dataStatus) ? raw.dataStatus : null;
  if (!dataStatus) {
    errors.push(
      raw.dataStatus == null
        ? 'Не указан статус достоверности данных.'
        : `Статус достоверности «${raw.dataStatus}» недоступен для пользовательских записей.`,
    );
  }

  // Необязательные поля, которые незначимы для анализа: приводим к null, не отклоняя запись
  const rawSample = raw.sampleSize == null || raw.sampleSize === '' ? null : Number(raw.sampleSize);
  const sampleSize = Number.isFinite(rawSample) && rawSample > 0 ? rawSample : null;

  if (errors.length > 0) return { label, errors };

  const id = typeof raw.id === 'string' && /^[\w.:-]{1,80}$/.test(raw.id) ? raw.id : makeEntryId();
  const createdAt =
    typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
      ? raw.createdAt
      : new Date().toISOString();

  return {
    label,
    entry: {
      id,
      author,
      year: Number(raw.year),
      group: textOrNull(raw.group, SHORT_TEXT_LIMIT),
      qualification: textOrNull(raw.qualification, SHORT_TEXT_LIMIT),
      weightCategory: textOrNull(raw.weightCategory, SHORT_TEXT_LIMIT),
      style: textOrNull(raw.style, SHORT_TEXT_LIMIT),
      citation,
      metrics,
      sampleSize,
      protocol: textOrNull(raw.protocol),
      sex: raw.sex === 'male' || raw.sex === 'female' ? raw.sex : null,
      dataStatus,
      admissionConditions: [0, 1, 2, 3].map((i) => Boolean(raw.admissionConditions?.[i])),
      userProvided: true,
      createdAt,
    },
  };
}

/**
 * Разбирает текст файла переноса без записи в хранилище.
 * Возвращает { ok, total, entries, rejected, errors, warnings }:
 * ok === false — файл не является базой исследований (errors описывают причину);
 * ok === true — записи проверены, корректные в entries, отклонённые в rejected.
 */
export function parseUserResearchFile(text) {
  const result = { ok: false, total: 0, entries: [], rejected: [], errors: [], warnings: [] };

  const raw = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
  if (!raw.trim()) {
    result.errors.push('Файл пуст или не содержит текста.');
    return result;
  }

  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    result.errors.push('Файл не является корректным JSON.');
    return result;
  }

  let list;
  if (Array.isArray(doc)) {
    list = doc;
    result.warnings.push('Конверт BOX-PROFILE отсутствует — файл обработан как массив записей.');
  } else if (doc && typeof doc === 'object' && !Array.isArray(doc)) {
    if (doc.kind != null && doc.kind !== RESEARCH_FILE_KIND) {
      result.errors.push(`Неподдерживаемый формат файла: kind = «${doc.kind}».`);
      return result;
    }
    if (!Array.isArray(doc.entries)) {
      result.errors.push('В файле нет массива entries с записями исследований.');
      return result;
    }
    const version = Number(doc.version);
    if (Number.isFinite(version) && version > RESEARCH_FILE_VERSION) {
      result.warnings.push(`Файл создан более новой версией приложения (v${version}).`);
    }
    list = doc.entries;
  } else {
    result.errors.push('Ожидался JSON-конверт базы исследований или массив записей.');
    return result;
  }

  if (list.length > MAX_IMPORT_ENTRIES) {
    result.errors.push(`В файле ${list.length} записей — превышает лимит импорта ${MAX_IMPORT_ENTRIES}.`);
    return result;
  }

  result.total = list.length;
  for (let i = 0; i < list.length; i += 1) {
    const sanitized = sanitizeImportedEntry(list[i], i);
    if (sanitized.errors) {
      result.rejected.push({ index: i + 1, label: sanitized.label, errors: sanitized.errors });
      continue;
    }
    const check = validateUserEntry(sanitized.entry);
    if (!check.valid) {
      result.rejected.push({ index: i + 1, label: sanitized.label, errors: check.errors });
      continue;
    }
    result.entries.push(sanitized.entry);
  }

  result.ok = true;
  return result;
}

/**
 * Предпросмотр импорта: сколько записей файл добавит, а сколько пропустит как
 * дубликаты по id. Запись в хранилище не производится.
 */
export function peekUserResearchImport(text) {
  const parsed = parseUserResearchFile(text);
  const existingIds = new Set(loadUserResearch().map((e) => e.id));
  const seen = new Set();
  let newCount = 0;
  let duplicateCount = 0;
  for (const entry of parsed.entries) {
    if (existingIds.has(entry.id) || seen.has(entry.id)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(entry.id);
    newCount += 1;
  }
  return {
    ...parsed,
    validCount: parsed.entries.length,
    newCount,
    duplicateCount,
  };
}

/**
 * Импортирует базу из текста файла.
 * mode = 'merge' (по умолчанию) пополняет текущую базу, пропуская дубликаты по id;
 * mode = 'replace' заменяет пользовательскую базу целиком (встроенные записи не затрагиваются).
 * Хранилище не изменяется, если в файле нет ни одной корректной записи.
 */
export function importUserResearch(text, { mode = 'merge' } = {}) {
  const result = {
    ok: false,
    mode: mode === 'replace' ? 'replace' : 'merge',
    total: 0,
    added: 0,
    skipped: 0,
    removed: 0,
    entries: [],
    rejected: [],
    errors: [],
    warnings: [],
  };

  const parsed = parseUserResearchFile(text);
  result.total = parsed.total;
  result.rejected = parsed.rejected;
  result.warnings = parsed.warnings;
  result.errors = parsed.errors;
  if (!parsed.ok) return result;

  if (parsed.entries.length === 0) {
    result.errors.push('В файле нет ни одной корректной записи — база не изменена.');
    return result;
  }

  const replace = result.mode === 'replace';
  const previous = loadUserResearch();
  const next = replace ? [] : previous.slice();
  const knownIds = new Set(next.map((e) => e.id));

  for (const entry of parsed.entries) {
    if (knownIds.has(entry.id)) {
      result.skipped += 1;
      continue;
    }
    knownIds.add(entry.id);
    next.push(entry);
    result.added += 1;
  }
  result.removed = replace ? previous.length : 0;

  if (!saveUserResearch(next)) {
    result.errors.push('Не удалось сохранить базу в localStorage — вероятно, превышена квота браузера.');
    return result;
  }

  result.entries = next;
  result.ok = true;
  return result;
}

/**
 * Нормализует запись формы к схеме хранения: неизвестные поля → null,
 * пустые показатели исключаются, числа приводятся к number.
 * Вызывать после успешной validateUserEntry.
 */
export function normalizeUserEntry(form) {
  const metrics = {};
  for (const metricId of USER_ENTRY_METRICS) {
    const m = form.metrics?.[metricId];
    if (!m) continue;
    const hasMean = m.mean !== null && m.mean !== undefined && m.mean !== '';
    if (!hasMean) continue;
    const metric = getMetricById(metricId);
    const hasSd = m.sd !== null && m.sd !== undefined && m.sd !== '';
    metrics[metricId] = {
      mean: Number(m.mean),
      sd: hasSd ? Number(m.sd) : null,
      unit: metric?.unit ?? null,
    };
  }

  return {
    id: makeEntryId(),
    author: String(form.author).trim(),
    year: Number(form.year),
    group: form.group || null,
    qualification: form.qualification || null,
    weightCategory: form.weightCategory || null,
    style: form.style || null,
    citation: String(form.citation).trim(),
    metrics,
    sampleSize: form.sampleSize != null && form.sampleSize !== '' ? Number(form.sampleSize) : null,
    protocol: form.protocol?.trim() || null,
    sex: form.sex || null,
    dataStatus: form.dataStatus,
    admissionConditions: ADMISSION_CONDITIONS.map((_, i) => Boolean(form.admissionConditions?.[i])),
    userProvided: true,
    createdAt: new Date().toISOString(),
  };
}
