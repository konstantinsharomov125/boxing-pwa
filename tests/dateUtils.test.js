import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidIsoDate,
  parseLocaleDate,
  todayIso,
  formatDate,
  formatDateTime,
  toDate,
  calculateAge,
} from '../src/utils/dateUtils.js';

test('isValidIsoDate принимает корректные даты', () => {
  assert.equal(isValidIsoDate('2000-01-01'), true);
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('1995-12-31'), true);
});

test('isValidIsoDate отклоняет некорректные даты', () => {
  assert.equal(isValidIsoDate('2024-02-30'), false);
  assert.equal(isValidIsoDate('2023-02-29'), false);
  assert.equal(isValidIsoDate('2024-13-01'), false);
  assert.equal(isValidIsoDate('not-a-date'), false);
  assert.equal(isValidIsoDate(null), false);
});

test('parseLocaleDate парсит DD.MM.YYYY', () => {
  assert.equal(parseLocaleDate('15.03.2005'), '2005-03-15');
  assert.equal(parseLocaleDate('01.01.1990'), '1990-01-01');
});

test('parseLocaleDate отклоняет некорректный ввод', () => {
  assert.equal(parseLocaleDate('31.02.2000'), null);
  assert.equal(parseLocaleDate('2000-01-01'), null);
  assert.equal(parseLocaleDate(''), null);
  assert.equal(parseLocaleDate(null), null);
});

test('todayIso возвращает строку YYYY-MM-DD', () => {
  const result = todayIso();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(isValidIsoDate(result), true);
});

test('formatDate форматирует дату в DD.MM.YYYY', () => {
  assert.equal(formatDate('2005-03-15'), '15.03.2005');
  assert.equal(formatDate(new Date(2005, 2, 15)), '15.03.2005');
  assert.equal(formatDate(null), null);
});

test('formatDateTime форматирует дату и время', () => {
  const result = formatDateTime(new Date(2005, 2, 15, 9, 5));
  assert.equal(result, '15.03.2005 09:05');
});

test('toDate приводит значения к Date', () => {
  const fromString = toDate('2005-03-15');
  assert.ok(fromString instanceof Date);
  assert.equal(fromString.getFullYear(), 2005);
  assert.equal(fromString.getMonth(), 2);
  assert.equal(fromString.getDate(), 15);

  const fromNumber = toDate(new Date(2005, 2, 15).getTime());
  assert.ok(fromNumber instanceof Date);

  assert.equal(toDate('invalid'), null);
  assert.equal(toDate(null), null);
});

test('calculateAge вычисляет возраст на дату события', () => {
  assert.equal(calculateAge('2000-01-01', '2024-01-01'), 24);
  assert.equal(calculateAge('2000-01-01', '2024-12-31'), 24);
  assert.equal(calculateAge('2000-01-01', '2025-01-01'), 25);
  assert.equal(calculateAge('2000-02-29', '2024-02-29'), 24);
  assert.equal(calculateAge('2000-02-29', '2023-02-28'), 22);
});

test('calculateAge возвращает null при отсутствии даты рождения', () => {
  assert.equal(calculateAge(null), null);
  assert.equal(calculateAge(''), null);
  assert.equal(calculateAge(undefined), null);
});

test('calculateAge возвращает null для будущих дат рождения или событий до рождения', () => {
  assert.equal(calculateAge('2030-01-01', '2024-01-01'), null);
  assert.equal(calculateAge('2000-01-01', '1999-12-31'), null);
});

test('calculateAge возвращает 0 для младенцев', () => {
  assert.equal(calculateAge('2024-01-01', '2024-01-01'), 0);
  assert.equal(calculateAge('2024-01-01', '2024-12-31'), 0);
});

test('calculateAge отклоняет некорректную дату события', () => {
  assert.equal(calculateAge('2000-01-01', 'not-a-date'), null);
  assert.equal(calculateAge('2000-01-01', ''), null);
  assert.equal(calculateAge('2000-01-01', '2024-02-30'), null);
  assert.equal(calculateAge('2000-01-01', '2024-13-01'), null);
});

test('calculateAge отклоняет невозможные календарные даты рождения', () => {
  assert.equal(calculateAge('2024-02-30', '2024-03-01'), null);
  assert.equal(calculateAge('2023-02-29', '2024-03-01'), null);
  assert.equal(calculateAge('2024-13-01', '2024-03-01'), null);
  assert.equal(calculateAge('2024-01-32', '2024-03-01'), null);
});

test('toDate не нормализует невозможные ISO-даты', () => {
  assert.equal(toDate('2024-02-30'), null);
  assert.equal(toDate('2023-02-29'), null);
  assert.equal(toDate('2024-04-31'), null);
});

test('isValidIsoDate отклоняет несуществующие календарные даты', () => {
  assert.equal(isValidIsoDate('2024-02-30'), false);
  assert.equal(isValidIsoDate('2023-02-29'), false);
  assert.equal(isValidIsoDate('2024-04-31'), false);
  assert.equal(isValidIsoDate('2024-06-31'), false);
  assert.equal(isValidIsoDate('0000-01-01'), false);
});
