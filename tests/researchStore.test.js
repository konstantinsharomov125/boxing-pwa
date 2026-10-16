/**
 * Тесты пользовательской базы исследований (node:test).
 *
 * localStorage подменяется стабом; каждый тест начинает с чистого хранилища.
 * Проверяется взаимодействие с фактическими моделями проекта.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Стаб localStorage (должен быть установлен ДО импорта модулей данных)
// ---------------------------------------------------------------------------

const storage = new Map();
globalThis.localStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};

const {
  addUserResearch,
  deleteUserResearch,
  loadUserResearch,
  validateUserEntry,
  normalizeUserEntry,
  exportUserResearchJSON,
  importUserResearch,
  peekUserResearchImport,
  userResearchFileName,
  MAX_IMPORT_ENTRIES,
  ADMISSION_CONDITIONS,
} = await import('../src/data/userResearchStore.js');
const { getAllResearch } = await import('../src/data/researchDatabase.js');
const {
  userEntryToModel,
  getAllReferenceModels,
  REFERENCE_MODELS,
} = await import('../src/data/modelsConfig.js');
const { analyzeAthleteProfile } = await import('../src/utils/fullAnalyzer.js');

beforeEach(() => storage.clear());

// ---------------------------------------------------------------------------
// Вспомогательные фабрики
// ---------------------------------------------------------------------------

function validForm(overrides = {}) {
  return {
    author: 'Иванов И.И.',
    year: 2020,
    citation: 'Иванов И.И. Исследование показателей боксёров. — М.: Издательство, 2020.',
    group: 'Взрослые (ЭВСМ)',
    qualification: 'МСМК / Сборная РФ',
    weightCategory: null,
    sex: null,
    style: null,
    sampleSize: 24,
    protocol: 'Газоанализатор, тредмил, протокол до отказа.',
    dataStatus: 'unverified',
    admissionConditions: [false, false, false, false],
    metrics: {
      vo2maxRel: { mean: 60.0, sd: 3.0 },
    },
    ...overrides,
  };
}

function collectNonFinite(value, path = 'root', found = []) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) found.push(path);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => collectNonFinite(v, `${path}[${i}]`, found));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) collectNonFinite(v, `${path}.${k}`, found);
  }
  return found;
}

// ---------------------------------------------------------------------------
// 1. Добавление валидной записи
// ---------------------------------------------------------------------------

test('валидная пользовательская запись появляется в объединённой базе и моделях', () => {
  const form = validForm();
  assert.equal(validateUserEntry(form).valid, true);
  const entry = addUserResearch(normalizeUserEntry(form));

  const all = getAllResearch();
  assert.ok(all.some((r) => r.id === entry.id));
  assert.equal(all.filter((r) => r.userProvided).length, 1);

  const models = getAllReferenceModels();
  assert.equal(models.length, REFERENCE_MODELS.length + 1);
  const model = models.find((m) => m.id === `model_${entry.id}`);
  assert.ok(model);
  assert.equal(model.sourceLocation, 'user');
  assert.deepEqual(model.coversMetrics, ['vo2maxRel']);
});

// ---------------------------------------------------------------------------
// 2. Валидация отклоняет некорректные записи
// ---------------------------------------------------------------------------

test('запись без цитирования отклоняется', () => {
  const v = validateUserEntry(validForm({ citation: 'слишком коротко' }));
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => /ссылка/i.test(e)));
});

test('запись с sd = 0 отклоняется', () => {
  const form = validForm({ metrics: { vo2maxRel: { mean: 60, sd: 0 } } });
  const v = validateUserEntry(form);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => /стандартное отклонение/i.test(e)));
});

test('запись с неверной единицей измерения отклоняется', () => {
  const form = validForm({ metrics: { vo2maxRel: { mean: 60, sd: 3, unit: 'л/мин' } } });
  const v = validateUserEntry(form);
  assert.equal(v.valid, false);
  assert.ok(v.errors.some((e) => /единиц/i.test(e)));
});

test('запись без показателей и с некорректным годом отклоняется', () => {
  assert.equal(validateUserEntry(validForm({ metrics: {} })).valid, false);
  assert.equal(validateUserEntry(validForm({ year: 1800 })).valid, false);
  assert.equal(validateUserEntry(validForm({ year: 2999 })).valid, false);
});

// ---------------------------------------------------------------------------
// 3. Допуск к сравнению: условия + верифицированный статус
// ---------------------------------------------------------------------------

test('eligibleForComparison = true только при всех условиях и статусе verified_*', () => {
  const allChecked = [true, true, true, true];

  const verified = userEntryToModel(normalizeUserEntry(validForm({
    dataStatus: 'verified_fulltext',
    admissionConditions: allChecked,
  })));
  assert.equal(verified.admission.eligibleForComparison, true);

  const primary = userEntryToModel(normalizeUserEntry(validForm({
    dataStatus: 'verified_primary',
    admissionConditions: allChecked,
  })));
  assert.equal(primary.admission.eligibleForComparison, true);

  // abstract_only + все отметки → допуска нет
  const abstract = userEntryToModel(normalizeUserEntry(validForm({
    dataStatus: 'abstract_only',
    admissionConditions: allChecked,
  })));
  assert.equal(abstract.admission.eligibleForComparison, false);

  // verified + не все отметки → допуска нет
  const partial = userEntryToModel(normalizeUserEntry(validForm({
    dataStatus: 'verified_fulltext',
    admissionConditions: [true, true, false, true],
  })));
  assert.equal(partial.admission.eligibleForComparison, false);

  assert.equal(ADMISSION_CONDITIONS.length, 4);
});

// ---------------------------------------------------------------------------
// 4. Допущенная пользовательская модель даёт нормативное сравнение
// ---------------------------------------------------------------------------

test('допущенная пользовательская модель с полной когортой → статус ok; недопущенная → research_result', () => {
  const athlete = {
    id: 1, age: 25,
    qualification: 'МСМК / Сборная РФ',
    examinationProtocol: 'Газоанализатор, тредмил, протокол до отказа.',
  };

  // Недопущенная запись → нормативного сравнения нет
  addUserResearch(normalizeUserEntry(validForm()));
  let report = analyzeAthleteProfile(athlete, { vo2maxRel: 62.5 });
  let cmp = report.comparisons.vo2maxRel;
  assert.notEqual(cmp.status, 'ok');
  const userCmp = cmp.comparisons.find((c) => c.sourceRef?.startsWith('user_'));
  assert.ok(userCmp);
  assert.equal(userCmp.status, 'research_result');
  assert.equal(userCmp.zScore, undefined);

  // Допускаем запись → нормативное сравнение появляется
  storage.clear();
  addUserResearch(normalizeUserEntry(validForm({
    dataStatus: 'verified_fulltext',
    admissionConditions: [true, true, true, true],
  })));
  report = analyzeAthleteProfile(athlete, { vo2maxRel: 62.5 });
  cmp = report.comparisons.vo2maxRel;
  const admitted = cmp.comparisons.find((c) => c.sourceRef?.startsWith('user_'));
  assert.ok(admitted);
  assert.equal(admitted.status, 'ok');
  assert.ok(Number.isFinite(admitted.zScore));
  // z = (62.5 - 60.0) / 3.0 ≈ 0.83
  assert.ok(Math.abs(admitted.zScore - 0.83) < 0.01);
});

// ---------------------------------------------------------------------------
// 5. Повреждённый JSON → пустой список без падения
// ---------------------------------------------------------------------------

test('повреждённый JSON в localStorage → пустой список', () => {
  storage.set('box_research_user', '{не-json');
  assert.deepEqual(loadUserResearch(), []);
  assert.equal(getAllReferenceModels().length, REFERENCE_MODELS.length);
});

// ---------------------------------------------------------------------------
// 6. Удаление записи
// ---------------------------------------------------------------------------

test('удаление пользовательской записи убирает её из базы и моделей', () => {
  const entry = addUserResearch(normalizeUserEntry(validForm()));
  assert.equal(getAllReferenceModels().length, REFERENCE_MODELS.length + 1);
  deleteUserResearch(entry.id);
  assert.equal(loadUserResearch().length, 0);
  assert.equal(getAllReferenceModels().length, REFERENCE_MODELS.length);
});

// ---------------------------------------------------------------------------
// 7. Нет NaN / Infinity при анализе с пользовательскими моделями
// ---------------------------------------------------------------------------

test('отчёт с пользовательскими моделями не содержит NaN/Infinity', () => {
  addUserResearch(normalizeUserEntry(validForm({
    dataStatus: 'verified_fulltext',
    admissionConditions: [true, true, true, true],
  })));
  addUserResearch(normalizeUserEntry(validForm({
    metrics: { reactionTime: { mean: 200, sd: 15 } },
  })));
  const report = analyzeAthleteProfile(
    { id: 1, age: 25, qualification: 'МСМК / Сборная РФ' },
    { vo2maxRel: 62.5, reactionTime: 220 },
  );
  assert.deepEqual(collectNonFinite(report), []);
});

// ---------------------------------------------------------------------------
// 8. Экспорт базы: конверт файла и состав записей
// ---------------------------------------------------------------------------

test('экспорт формирует конверт BOX-PROFILE со всеми пользовательскими записями', () => {
  const first = addUserResearch(normalizeUserEntry(validForm()));
  const second = addUserResearch(normalizeUserEntry(validForm({
    author: 'Петров П.П.',
    metrics: { reactionTime: { mean: 210, sd: 12 } },
  })));

  const doc = JSON.parse(exportUserResearchJSON());
  assert.equal(doc.app, 'BOX-PROFILE');
  assert.equal(doc.kind, 'box_research_user');
  assert.equal(doc.version, 1);
  assert.equal(doc.count, 2);
  assert.deepEqual(doc.entries.map((e) => e.id), [first.id, second.id]);
  assert.ok(!Number.isNaN(Date.parse(doc.exportedAt)));
});

test('имя файла переноса содержит локальную дату и расширение .json', () => {
  assert.equal(userResearchFileName(new Date('2026-02-15T10:00:00')), 'Исследовательская_база_2026-02-15.json');
});

// ---------------------------------------------------------------------------
// 9. Круговой перенос между устройствами
// ---------------------------------------------------------------------------

test('экспорт на одном устройстве → импорт на чистом восстанавливает базу и допуск к сравнению', () => {
  addUserResearch(normalizeUserEntry(validForm()));
  addUserResearch(normalizeUserEntry(validForm({
    dataStatus: 'verified_fulltext',
    admissionConditions: [true, true, true, true],
    metrics: { density: { mean: 14.5, sd: 0.8 } },
  })));
  const file = exportUserResearchJSON();

  // «второе устройство» — пустое хранилище
  storage.clear();
  assert.equal(loadUserResearch().length, 0);

  const res = importUserResearch(file);
  assert.equal(res.ok, true);
  assert.equal(res.mode, 'merge');
  assert.equal(res.added, 2);
  assert.equal(res.skipped, 0);
  assert.equal(loadUserResearch().length, 2);

  const restored = loadUserResearch().find((e) => e.dataStatus === 'verified_fulltext');
  assert.equal(restored.metrics.density.mean, 14.5);
  assert.equal(restored.metrics.density.sd, 0.8);
  assert.ok(restored.metrics.density.unit);
  assert.equal(restored.admissionConditions.every(Boolean), true);

  // Воссозданная запись так же допускается к нормативному сравнению
  const model = getAllReferenceModels().find((m) => m.id === `model_${restored.id}`);
  assert.equal(model.admission.eligibleForComparison, true);
});

test('повторный импорт того же файла не создаёт дубликатов', () => {
  addUserResearch(normalizeUserEntry(validForm()));
  const file = exportUserResearchJSON();

  const res = importUserResearch(file);
  assert.equal(res.ok, true);
  assert.equal(res.added, 0);
  assert.equal(res.skipped, 1);
  assert.equal(loadUserResearch().length, 1);
});

test('режим replace заменяет пользовательскую базу, встроенные записи не затрагиваются', () => {
  addUserResearch(normalizeUserEntry(validForm({ author: 'Даль В.В.' })));
  addUserResearch(normalizeUserEntry(validForm({ author: 'Доде А.А.' })));
  const incoming = exportUserResearchJSON();

  storage.clear();
  addUserResearch(normalizeUserEntry(validForm({ author: 'Локальный Б.Б.' })));

  const res = importUserResearch(incoming, { mode: 'replace' });
  assert.equal(res.ok, true);
  assert.equal(res.added, 2);
  assert.equal(res.removed, 1);

  const list = loadUserResearch();
  assert.equal(list.length, 2);
  assert.equal(list.some((e) => e.author === 'Локальный Б.Б.'), false);
  assert.ok(getAllResearch().some((r) => r.id === 'filimonov_2000_ms_mid'));
});

// ---------------------------------------------------------------------------
// 10. Отклонение некорректных файлов и записей
// ---------------------------------------------------------------------------

test('битый JSON, пустой файл, чужой формат и слишком большой файл не меняют хранилище', () => {
  const saved = addUserResearch(normalizeUserEntry(validForm()));
  const before = loadUserResearch();

  const tooMany = Array.from({ length: MAX_IMPORT_ENTRIES + 1 }, () => '{}').join(',');
  const badFiles = [
    '{не json',
    '',
    '   ',
    '{"entries": "не массив"}',
    '[1, 2, 3]',
    '{"kind":"box_fights_history","entries":[]}',
    `{"kind":"box_research_user","version":1,"entries":[${tooMany}]}`,
  ];

  for (const text of badFiles) {
    const res = importUserResearch(text);
    assert.equal(res.ok, false, `ожидался отказ: ${text.slice(0, 30)}`);
    assert.ok(res.errors.length > 0);
  }

  assert.deepEqual(loadUserResearch(), before);
  assert.equal(loadUserResearch()[0].id, saved.id);
});

test('некорректные записи отклоняются построчно, остальные импортируются', () => {
  const good = normalizeUserEntry(validForm());
  const badYear = { ...normalizeUserEntry(validForm({ author: 'Старый В.В.' })), year: 1890 };
  const badMean = { ...normalizeUserEntry(validForm({ author: 'Пустой В.В.' })), metrics: { vo2maxRel: { mean: 'нет' } } };
  const unknownMetric = { ...normalizeUserEntry(validForm({ author: 'Чужой В.В.' })), metrics: { bogusMetric: { mean: 1 } } };
  const demoStatus = { ...normalizeUserEntry(validForm({ author: 'Демо В.В.' })), dataStatus: 'demo' };

  const file = JSON.stringify({
    app: 'BOX-PROFILE',
    kind: 'box_research_user',
    version: 1,
    entries: [good, badYear, badMean, unknownMetric, demoStatus],
  });

  const preview = peekUserResearchImport(file);
  assert.equal(preview.ok, true);
  assert.equal(preview.total, 5);
  assert.equal(preview.validCount, 1);
  assert.equal(preview.newCount, 1);
  assert.equal(preview.duplicateCount, 0);
  assert.equal(preview.rejected.length, 4);
  assert.ok(preview.rejected.some((row) => row.errors.some((e) => /каталоге/.test(e))));
  assert.ok(preview.rejected.some((row) => /Год публикации/.test(row.errors.join(' '))));

  const res = importUserResearch(file);
  assert.equal(res.ok, true);
  assert.equal(res.added, 1);
  assert.equal(res.rejected.length, 4);
  const list = loadUserResearch();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, good.id);
});

test('файл без единой корректной записи не меняет хранилище', () => {
  addUserResearch(normalizeUserEntry(validForm()));
  const before = loadUserResearch();

  const file = JSON.stringify({ kind: 'box_research_user', version: 1, entries: [{ author: 'X' }] });
  const res = importUserResearch(file);
  assert.equal(res.ok, false);
  assert.equal(res.rejected.length, 1);
  assert.deepEqual(loadUserResearch(), before);
});

// ---------------------------------------------------------------------------
// 11. Разбор недоверенного файла: только известные поля схемы
// ---------------------------------------------------------------------------

test('импорт берёт только поля схемы, не переносит мусор и не трогает прототипы', () => {
  const raw = JSON.parse(
    '{"__proto__":{"polluted":"yes"},"id":"user_proto","extraField":"x",' +
    '"author":"  Прототип П.П.  ","year":"2019",' +
    '"citation":"Прототип П.П. Проверка переноса полей. — М.: Тест, 2019.",' +
    '"dataStatus":"unverified","sex":"unknown","sampleSize":-5,' +
    '"admissionConditions":[true,false,true],"metrics":{"keu":{"mean":"0.35","sd":"0.02"}}}',
  );

  const res = importUserResearch(JSON.stringify([raw]));
  assert.equal(res.ok, true);

  const [entry] = loadUserResearch();
  assert.equal(entry.id, 'user_proto');
  assert.equal(entry.author, 'Прототип П.П.');
  assert.equal(entry.year, 2019);
  assert.equal(entry.extraField, undefined);
  assert.equal(entry.polluted, undefined);
  assert.equal(Object.getPrototypeOf(entry), Object.prototype);
  assert.equal({}.polluted, undefined);
  // недоступный пол и некорректная выборка → null, условия допуска дополнены до четырёх
  assert.equal(entry.sex, null);
  assert.equal(entry.sampleSize, null);
  assert.deepEqual(entry.admissionConditions, [true, false, true, false]);
  assert.equal(entry.userProvided, true);
  assert.ok(!Number.isNaN(Date.parse(entry.createdAt)));
  assert.equal(entry.metrics.keu.mean, 0.35);
  assert.equal(entry.metrics.keu.sd, 0.02);

  // импорт голого массива без конверта сопровождается предупреждением
  assert.equal(res.warnings.length, 1);
});

test('файл более новой версии формата импортируется с предупреждением', () => {
  const file = JSON.stringify({
    kind: 'box_research_user',
    version: 99,
    entries: [normalizeUserEntry(validForm())],
  });
  const res = importUserResearch(file);
  assert.equal(res.ok, true);
  assert.equal(res.added, 1);
  assert.ok(res.warnings.some((w) => /более новой версией/.test(w)));
});

test('импорт отклоняет запись с единицей измерения, не совпадающей с каталожной', () => {
  const entry = normalizeUserEntry(validForm());
  const wrongUnit = {
    ...entry,
    metrics: { vo2maxRel: { mean: 60, sd: 3, unit: 'л/мин' } },
  };
  const file = JSON.stringify({ kind: 'box_research_user', version: 1, entries: [entry, wrongUnit] });

  const res = importUserResearch(file);
  assert.equal(res.ok, true);
  assert.equal(res.added, 1);
  assert.equal(res.rejected.length, 1);
  assert.ok(res.rejected[0].errors.some((e) => /единиц/i.test(e)));

  const saved = loadUserResearch();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, entry.id);
});
