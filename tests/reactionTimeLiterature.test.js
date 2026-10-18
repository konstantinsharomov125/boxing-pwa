/**
 * Тесты расширенной библиотеки времени реакции и психомоторики.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  REACTION_TIME_PUBLICATIONS,
  REACTION_TIME_PROTOCOLS,
  REACTION_TIME_COHORTS,
  getCohortById,
  getProtocolById,
  getPublicationById,
  getReactionTimeResearchEntries,
} from '../src/data/reactionTimeLiterature.js';
import { validateUserEntry } from '../src/data/userResearchStore.js';
import { getMetricById } from '../src/data/modelsConfig.js';

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
// Целостность ссылок
// ---------------------------------------------------------------------------

test('все cohortId в публикациях существуют', () => {
  for (const publication of REACTION_TIME_PUBLICATIONS) {
    for (const cohortId of publication.cohortIds || []) {
      assert.ok(getCohortById(cohortId), `Когорта ${cohortId} не найдена в ${publication.id}`);
    }
  }
});

test('все protocolId в публикациях и наблюдениях существуют', () => {
  for (const publication of REACTION_TIME_PUBLICATIONS) {
    for (const protocolId of publication.protocolIds || []) {
      assert.ok(getProtocolById(protocolId), `Протокол ${protocolId} не найден в ${publication.id}`);
    }
    for (const observation of publication.observations || []) {
      assert.ok(getProtocolById(observation.protocolId), `Протокол наблюдения ${observation.protocolId} не найден`);
    }
  }
});

test('все observation.cohortId существуют', () => {
  for (const publication of REACTION_TIME_PUBLICATIONS) {
    for (const observation of publication.observations || []) {
      assert.ok(getCohortById(observation.cohortId), `Когорта наблюдения ${observation.cohortId} не найдена`);
    }
  }
});

// ---------------------------------------------------------------------------
// Валидация свёрнутых записей
// ---------------------------------------------------------------------------

test('все записи библиотеки проходят validateUserEntry', () => {
  const entries = getReactionTimeResearchEntries();
  assert.ok(entries.length > 0, 'библиотека должна содержать хотя бы одну запись');
  for (const entry of entries) {
    const result = validateUserEntry(entry);
    assert.equal(result.valid, true, `Запись ${entry.id}: ${result.errors.join('; ')}`);
  }
});

test('метрики свёрнутых записей присутствуют в каталоге и единицы совпадают', () => {
  const entries = getReactionTimeResearchEntries();
  for (const entry of entries) {
    for (const [metricId, m] of Object.entries(entry.metrics || {})) {
      const metric = getMetricById(metricId);
      assert.ok(metric, `Метрика ${metricId} отсутствует в каталоге`);
      assert.equal(m.unit, metric.unit, `Единица ${metricId} не совпадает с каталожной`);
      assert.ok(Number.isFinite(m.mean), `Среднее ${metricId} не является конечным числом`);
      if (m.sd != null) {
        assert.ok(Number.isFinite(m.sd) && m.sd > 0, `SD ${metricId} некорректно`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// Отсутствие выдуманных идентификаторов и чисел
// ---------------------------------------------------------------------------

test('демонстрационные записи явно помечены статусом demo и abstract_only', () => {
  for (const publication of REACTION_TIME_PUBLICATIONS) {
    if (publication.id.startsWith('pub_demo_')) {
      assert.equal(publication.dataQualityStatus, 'demo');
      assert.equal(publication.abstractOnly, true);
    }
  }
});

test('в библиотеке нет NaN, Infinity и undefined в числовых полях', () => {
  assert.deepEqual(collectNonFinite({ publications: REACTION_TIME_PUBLICATIONS, cohorts: REACTION_TIME_COHORTS, protocols: REACTION_TIME_PROTOCOLS }), []);
});

// ---------------------------------------------------------------------------
// Селекторы
// ---------------------------------------------------------------------------

test('селекторы возвращают null для несуществующих ID', () => {
  assert.equal(getCohortById('missing'), null);
  assert.equal(getProtocolById('missing'), null);
  assert.equal(getPublicationById('missing'), null);
});
