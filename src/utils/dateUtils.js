/**
 * Утилиты для работы с датами в BOX-PROFILE.
 *
 * Принципы:
 *  - возраст вычисляется на конкретную дату события;
 *  - при отсутствии или некорректности даты рождения возвращается null;
 *  - високосные года учитываются через Date;
 *  - внутренний формат дат — ISO (YYYY-MM-DD) и ISO-8601 с временем.
 */

/**
 * Проверяет, является ли строка валидной датой в формате YYYY-MM-DD.
 * Отклоняет несуществующие календарные даты (например, 2024-02-30).
 */
export function isValidIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!Number.isFinite(year) || year <= 0) return false;
  if (!Number.isFinite(month) || month < 1 || month > 12) return false;
  if (!Number.isFinite(day) || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Парсит дату в формате DD.MM.YYYY в строку YYYY-MM-DD.
 * Возвращает null при некорректном вводе.
 */
export function parseLocaleDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidIsoDate(iso) ? iso : null;
}

/**
 * Возвращает сегодняшнюю дату в формате YYYY-MM-DD в локальном часовом поясе.
 */
export function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Форматирует дату в строку DD.MM.YYYY.
 * Принимает Date, ISO-строку или timestamp.
 */
export function formatDate(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

/**
 * Форматирует дату и время в строку DD.MM.YYYY HH:mm.
 */
export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return null;
  return `${formatDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Приводит значение к Date. Возвращает null при некорректном вводе.
 * Для строк формата YYYY-MM-DD выполняет строгую валидацию.
 */
export function toDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      if (!isValidIsoDate(normalized)) return null;
      const [year, month, day] = normalized.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const date = new Date(normalized);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

/**
 * Вычисляет возраст в полных годах на дату события.
 *
 * Правило для 29 февраля:
 *  В високосном году день рождения определяется как 29 февраля;
 *  в невисокосном — как 28 февраля (согласно распространённой календарной
 *  конвенции «последний день февраля»).
 *
 * @param {string|Date|null} dateOfBirth — дата рождения (YYYY-MM-DD или Date)
 * @param {string|Date|null} [eventDate] — дата события; если не передана,
 *        используется текущая дата. Явно переданные некорректные даты
 *        не заменяются текущей.
 * @returns {number|null} возраст в полных годах или null
 */
export function calculateAge(dateOfBirth, eventDate = null) {
  const birth = toDate(dateOfBirth);
  if (!birth) return null;

  if (eventDate === null || eventDate === undefined) {
    const now = new Date();
    return computeAge(birth, now);
  }

  const event = toDate(eventDate);
  if (!event) return null;

  return computeAge(birth, event);
}

function computeAge(birth, event) {
  // Будущая дата рождения или событие до рождения — некорректно.
  if (event.getTime() < birth.getTime()) return null;

  let years = event.getFullYear() - birth.getFullYear();
  const monthDiff = event.getMonth() - birth.getMonth();
  const dayDiff = event.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }

  return years >= 0 ? years : null;
}
