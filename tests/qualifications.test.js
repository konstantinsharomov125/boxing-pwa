/**
 * Тесты единого справочника квалификаций и модельных ориентиров.
 *
 * Запуск: node --test tests/qualifications.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  QUALIFICATIONS,
  normalizeAthleteQualification,
  getQualificationOptions,
  getQualificationName,
  isValidQualificationId,
} from '../src/data/qualifications.js';
import {
  getOrientirGroups,
  getOrientirValue,
  getOrientirComparison,
  getGroupsWithOrientirs,
  getOrientirGroupName,
} from '../src/data/competitionModelOrientirs.js';

// ---------------------------------------------------------------------------
// Справочник квалификаций
// ---------------------------------------------------------------------------

test('справочник содержит все обязательные звания и разряды', () => {
  const ids = QUALIFICATIONS.map((q) => q.id);
  assert.deepEqual(ids, ['zms', 'msmk', 'ms', 'kms', 'first_rank', 'second_rank', 'third_rank']);
});

test('старые названия групп нормализуются к каноническим id', () => {
  assert.equal(normalizeAthleteQualification('МСМК / Сборная РФ'), 'msmk');
  assert.equal(normalizeAthleteQualification('МСМК / Сборная'), 'msmk');
  assert.equal(normalizeAthleteQualification('МС / КМС'), 'ms');
  assert.equal(normalizeAthleteQualification('1-й разряд / КМС'), 'first_rank');
  assert.equal(normalizeAthleteQualification('1-й разряд / Юниоры'), 'first_rank');
  assert.equal(normalizeAthleteQualification('КМС'), 'kms');
  assert.equal(normalizeAthleteQualification('ЗМС'), 'zms');
  assert.equal(normalizeAthleteQualification('II спортивный разряд'), 'second_rank');
});

test('нормализация не выдумывает значения: неизвестное → null, "Без разряда" → null', () => {
  assert.equal(normalizeAthleteQualification('Без разряда'), null);
  assert.equal(normalizeAthleteQualification(''), null);
  assert.equal(normalizeAthleteQualification(null), null);
  assert.equal(normalizeAthleteQualification('Нечто неизвестное'), null);
});

test('id уже в каноническом виде проходят нормализацию', () => {
  assert.equal(normalizeAthleteQualification('msmk'), 'msmk');
  assert.equal(normalizeAthleteQualification('third_rank'), 'third_rank');
});

test('опции селекта и отображение имён', () => {
  const options = getQualificationOptions();
  assert.equal(options.length, QUALIFICATIONS.length);
  assert.ok(options.every((o) => o.value && o.label));
  assert.equal(getQualificationName('МСМК / Сборная РФ'), 'МСМК');
  assert.equal(getQualificationName('ms'), 'МС');
  assert.ok(isValidQualificationId('kms'));
  assert.ok(!isValidQualificationId('nope'));
});

// ---------------------------------------------------------------------------
// Модельные ориентиры
// ---------------------------------------------------------------------------

test('ориентиры существуют для всех групп справочника', () => {
  const groups = getOrientirGroups();
  assert.equal(groups.length, QUALIFICATIONS.length);
  for (const q of QUALIFICATIONS) {
    const group = groups.find((g) => g.id === q.id);
    assert.ok(group, `нет группы ориентиров для ${q.id}`);
  }
});

test('существующие авторские значения сохранены и помечены как author_hypothesis', () => {
  assert.equal(getOrientirValue('msmk', 'density').value, 14.5);
  assert.equal(getOrientirValue('msmk', 'keu').value, 0.38);
  assert.equal(getOrientirValue('msmk', 'kv').value, 1.05);
  assert.equal(getOrientirValue('msmk', 'jabsAcc').value, 42);
  assert.equal(getOrientirValue('msmk', 'powerAcc').value, 32);

  assert.equal(getOrientirValue('ms', 'density').value, 12.8);
  assert.equal(getOrientirValue('first_rank', 'density').value, 11.2);

  for (const groupId of ['msmk', 'ms', 'first_rank']) {
    for (const metricId of ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc']) {
      const entry = getOrientirValue(groupId, metricId);
      assert.equal(entry.status, 'author_hypothesis');
      assert.ok(entry.unit, `${groupId}.${metricId}: должна быть единица измерения`);
      assert.ok(entry.source, `${groupId}.${metricId}: должен быть источник`);
      assert.equal(entry.qualificationGroup, groupId);
    }
  }
});

test('отсутствующие ориентиры — null, без интерполяции между группами', () => {
  for (const groupId of ['zms', 'kms', 'second_rank', 'third_rank']) {
    for (const metricId of ['density', 'keu', 'kv', 'jabsAcc', 'powerAcc']) {
      const entry = getOrientirValue(groupId, metricId);
      assert.equal(entry.value, null, `${groupId}.${metricId} не должен быть выдуман`);
      assert.equal(entry.source, null);
      assert.equal(entry.status, null);
    }
  }
});

test('сравнение сообщает об отсутствии подтверждённого ориентира', () => {
  const result = getOrientirComparison('zms', { density: 10, keu: 0.3, kv: 1, jabsAcc: 30, powerAcc: 20 });
  assert.equal(result.hasAnyOrientir, false);
  for (const metric of Object.values(result.comparison)) {
    assert.equal(metric.hasOrientir, false);
    assert.equal(metric.missingReason, 'Нет подтверждённого модельного ориентира');
  }
});

test('сравнение по группе с ориентирами возвращает значения и статусы', () => {
  const result = getOrientirComparison('msmk', { density: 13.1, keu: 0.35, kv: 1.1, jabsAcc: 40, powerAcc: 30 });
  assert.equal(result.hasAnyOrientir, true);
  assert.equal(result.groupName, 'МСМК');
  const density = result.comparison.density;
  assert.equal(density.orientirValue, 14.5);
  assert.equal(density.actualValue, 13.1);
  assert.equal(density.missingReason, null);
});

test('список групп с подтверждёнными ориентирами не включает пустые группы', () => {
  const withValues = getGroupsWithOrientirs();
  assert.deepEqual(withValues.sort(), ['first_rank', 'ms', 'msmk'].sort());
});

test('неизвестная группа не ломает селекторы', () => {
  const entry = getOrientirValue('unknown_group', 'density');
  assert.equal(entry.value, null);
  assert.equal(getOrientirGroupName('unknown_group'), 'unknown_group');
  const result = getOrientirComparison('unknown_group', {});
  assert.equal(result.hasAnyOrientir, false);
});
