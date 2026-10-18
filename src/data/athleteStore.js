/**
 * Хранилище лонгитюдной модели спортсмена.
 *
 * Сущности:
 *  - athlete: постоянный профиль (id, name, dateOfBirth, sex, group, preferredStyle);
 *  - attribute snapshot: неизменяемый снимок квалификации/веса/массы на дату;
 *  - examination: датированное физическое обследование;
 *  - fight: датированный поединок;
 *  - style classification: результат классификации стиля на дату;
 *  - coach note: тренерская заметка.
 *
 * Все ID — строки с префиксами. Данные хранятся в localStorage.
 *
 * Совместимость со старой схемой (до миграции):
 *  - Профили старой схемы хранятся в том же ключе `box_athletes`, но имеют
 *    числовой id, поля age, qualification, weightCategory, style, weight.
 *    Этот файл НЕ записывает новые профили в `box_athletes` автоматически;
 *    для записи новой схемы предназначены `addAthlete` и `saveAthletes`,
 *    которые должны вызываться только после согласования с App.jsx.
 *  - Старые заметки из `box_coach_note_<id>` читаются функцией
 *    `loadLegacyNotes()` и могут быть перенесены в новый формат отдельно.
 *  - Миграция: при появлении старых профилей следует:
 *      1. Создать для каждого ath_<uuid> и сохранить связь старый id → новый.
 *      2. Перенести поля age → dateOfBirth (приближённо), qualification,
 *         weightCategory, weight в первый attribute snapshot.
 *      3. Перенести данные из box_phys_<oldId>, box_phys_history_<oldId>,
 *         box_fights_history_<oldId>, box_coach_note_<oldId> под новый id.
 *    Массовая миграция не реализована, так как в текущей базе реальных
 *    спортсменов нет.
 */

import { isValidIsoDate, todayIso } from '../utils/dateUtils.js';

export const ATHLETE_SCHEMA_VERSION = 1;
export const ATHLETE_SCHEMA_KEY = 'box_athlete_schema_version';

// ---------------------------------------------------------------------------
// Утилиты localStorage
// ---------------------------------------------------------------------------

let storageBackend = globalThis.localStorage ?? null;

export function setStorageBackend(backend) {
  storageBackend = backend;
}

export function resetStorageBackend() {
  storageBackend = globalThis.localStorage ?? null;
}

function safeGetItem(key) {
  try {
    return storageBackend?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    if (!storageBackend || typeof storageBackend.setItem !== 'function') {
      return false;
    }
    storageBackend.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readJson(key, fallback) {
  const raw = safeGetItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  return safeSetItem(key, JSON.stringify(value));
}

// ---------------------------------------------------------------------------
// Генераторы ID
// ---------------------------------------------------------------------------

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${timestamp}_${random}`;
}

export function createAthleteId() {
  return generateId('ath');
}

export function createAttributeId() {
  return generateId('attr');
}

export function createExamId() {
  return generateId('exam');
}

export function createFightId() {
  return generateId('fight');
}

export function createStyleClassificationId() {
  return generateId('style');
}

export function createNoteId() {
  return generateId('note');
}

// ---------------------------------------------------------------------------
// Ключи хранилища
// ---------------------------------------------------------------------------

export const storageKeys = {
  athletes: () => 'box_athletes',
  attributes: (athleteId) => `box_athlete_attributes_${athleteId}`,
  examinations: (athleteId) => `box_phys_history_${athleteId}`,
  examinationsCache: (athleteId) => `box_phys_${athleteId}`,
  fights: (athleteId) => `box_fights_history_${athleteId}`,
  styleClassifications: (athleteId) => `box_style_classifications_${athleteId}`,
  notes: (athleteId) => `box_coach_notes_${athleteId}`,
  legacyNotes: (athleteId) => `box_coach_note_${athleteId}`,
};

// ---------------------------------------------------------------------------
// Профили спортсменов
// ---------------------------------------------------------------------------

export function loadAthletes() {
  const list = readJson(storageKeys.athletes(), []);
  return Array.isArray(list) ? list.filter((a) => a && typeof a === 'object' && a.id) : [];
}

export function saveAthletes(list) {
  return writeJson(storageKeys.athletes(), Array.isArray(list) ? list : []);
}

export function getAthleteById(id) {
  return loadAthletes().find((a) => a.id === id) || null;
}

function normalizeAthlete(athlete, now) {
  const id = athlete.id && String(athlete.id).startsWith('ath_') ? athlete.id : createAthleteId();
  const name = athlete.name ? String(athlete.name).trim() : '';
  const dateOfBirth = isValidIsoDate(athlete.dateOfBirth) ? athlete.dateOfBirth : null;
  return {
    id,
    name,
    dateOfBirth,
    sex: athlete.sex || null,
    group: athlete.group || null,
    preferredStyle: athlete.preferredStyle || null,
    createdAt: athlete.createdAt || now,
    updatedAt: now,
  };
}

export function addAthlete(athlete) {
  const existing = loadAthletes();
  const now = new Date().toISOString();
  const created = normalizeAthlete(athlete, now);
  if (!created.name) {
    return { saved: false, athlete: created, athletes: existing, error: 'Имя спортсмена обязательно.' };
  }
  const updated = [...existing, created];
  const saved = saveAthletes(updated);
  return { saved, athlete: created, athletes: updated };
}

export function updateAthlete(id, patch) {
  const list = loadAthletes();
  let updatedAthlete = null;
  const updated = list.map((a) => {
    if (a.id !== id) return a;
    const normalizedPatch = { ...patch };
    if (normalizedPatch.dateOfBirth != null && !isValidIsoDate(normalizedPatch.dateOfBirth)) {
      delete normalizedPatch.dateOfBirth;
    }
    updatedAthlete = {
      ...a,
      ...normalizedPatch,
      id: a.id,
      updatedAt: new Date().toISOString(),
    };
    return updatedAthlete;
  });
  if (!updatedAthlete) return { saved: false, athlete: null, athletes: list, error: 'Спортсмен не найден.' };
  const saved = saveAthletes(updated);
  return { saved, athlete: updatedAthlete, athletes: updated };
}

export function deleteAthlete(id) {
  const list = loadAthletes().filter((a) => a.id !== id);
  saveAthletes(list);
  return list;
}

// ---------------------------------------------------------------------------
// Снимки атрибутов
// ---------------------------------------------------------------------------

export function loadAttributes(athleteId) {
  const list = readJson(storageKeys.attributes(athleteId), []);
  return Array.isArray(list) ? list.filter((a) => a && typeof a === 'object' && a.id) : [];
}

export function saveAttributes(athleteId, list) {
  return writeJson(storageKeys.attributes(athleteId), Array.isArray(list) ? list : []);
}

export function addAttributeSnapshot(athleteId, attributes) {
  const list = loadAttributes(athleteId);
  const now = new Date().toISOString();
  const validFrom = isValidIsoDate(attributes?.validFrom) ? attributes.validFrom : todayIso();
  const weight = attributes?.weight != null ? Number(attributes.weight) : null;
  const snapshot = {
    id: createAttributeId(),
    athleteId,
    validFrom,
    recordedAt: now,
    qualification: attributes?.qualification || null,
    weightCategory: attributes?.weightCategory || null,
    weight: Number.isFinite(weight) && weight >= 0 ? weight : null,
    competitionLevel: attributes?.competitionLevel || null,
    notes: attributes?.notes || null,
  };
  const updated = [...list, snapshot];
  const saved = saveAttributes(athleteId, updated);
  return { saved, snapshot, attributes: updated };
}

/**
 * Находит актуальный снимок атрибутов на дату.
 * Возвращает null, если подходящий снимок отсутствует.
 */
export function resolveAttributesSnapshot(athleteId, date) {
  const list = loadAttributes(athleteId);
  if (list.length === 0) return null;
  const target = isValidIsoDate(date) ? date : todayIso();
  const sorted = list
    .slice()
    .filter((a) => a.validFrom && a.validFrom <= target)
    .sort((a, b) => (a.validFrom > b.validFrom ? -1 : 1));
  return sorted[0] || null;
}

// ---------------------------------------------------------------------------
// Обследования
// ---------------------------------------------------------------------------

export function loadExaminations(athleteId) {
  const list = readJson(storageKeys.examinations(athleteId), []);
  return Array.isArray(list) ? list.filter((e) => e && typeof e === 'object' && e.id) : [];
}

export function saveExaminations(athleteId, list) {
  return writeJson(storageKeys.examinations(athleteId), Array.isArray(list) ? list : []);
}

export function loadExaminationCache(athleteId) {
  return readJson(storageKeys.examinationsCache(athleteId), null);
}

export function saveExaminationCache(athleteId, values) {
  return writeJson(storageKeys.examinationsCache(athleteId), values);
}

export function addExamination(athleteId, examination) {
  const list = loadExaminations(athleteId);
  const now = new Date().toISOString();
  const entry = {
    id: examination?.id && String(examination.id).startsWith('exam_') ? examination.id : createExamId(),
    athleteId,
    recordedAt: examination?.recordedAt || now,
    protocol: examination?.protocol || null,
    examiner: examination?.examiner || null,
    attributesSnapshotId: examination?.attributesSnapshotId || null,
    values: examination?.values && typeof examination.values === 'object' ? examination.values : {},
  };
  const updated = [...list, entry];
  const saved = saveExaminations(athleteId, updated);
  if (saved) {
    saveExaminationCache(athleteId, entry.values);
  }
  return { saved, examination: entry, examinations: updated };
}

// ---------------------------------------------------------------------------
// Поединки
// ---------------------------------------------------------------------------

export function loadFights(athleteId) {
  const list = readJson(storageKeys.fights(athleteId), []);
  return Array.isArray(list) ? list.filter((f) => f && typeof f === 'object' && f.id) : [];
}

export function saveFights(athleteId, list) {
  return writeJson(storageKeys.fights(athleteId), Array.isArray(list) ? list : []);
}

export function addFight(athleteId, fight) {
  const list = loadFights(athleteId);
  const entry = {
    id: fight?.id && String(fight.id).startsWith('fight_') ? fight.id : createFightId(),
    athleteId,
    date: isValidIsoDate(fight?.date) ? fight.date : todayIso(),
    opponent: fight?.opponent || 'Турнирный бой',
    format: fight?.format && typeof fight.format === 'object' ? fight.format : {},
    rounds: Array.isArray(fight?.rounds) ? fight.rounds : [],
    metrics: fight?.metrics && typeof fight.metrics === 'object' ? fight.metrics : {},
    attributesSnapshotId: fight?.attributesSnapshotId || null,
  };
  const updated = [...list, entry];
  const saved = saveFights(athleteId, updated);
  return { saved, fight: entry, fights: updated };
}

// ---------------------------------------------------------------------------
// Классификации стиля
// ---------------------------------------------------------------------------

export function loadStyleClassifications(athleteId) {
  const list = readJson(storageKeys.styleClassifications(athleteId), []);
  return Array.isArray(list) ? list.filter((s) => s && typeof s === 'object' && s.id) : [];
}

export function saveStyleClassifications(athleteId, list) {
  return writeJson(storageKeys.styleClassifications(athleteId), Array.isArray(list) ? list : []);
}

export function addStyleClassification(athleteId, classification) {
  const list = loadStyleClassifications(athleteId);
  const now = new Date().toISOString();
  const entry = {
    id: classification?.id && String(classification.id).startsWith('style_') ? classification.id : createStyleClassificationId(),
    athleteId,
    classifiedAt: isValidIsoDate(classification?.classifiedAt) ? classification.classifiedAt : todayIso(),
    recordedAt: now,
    sourceType: classification?.sourceType || 'examination',
    sourceId: classification?.sourceId || null,
    style: classification?.style || null,
    scoreBreakdown: classification?.scoreBreakdown && typeof classification.scoreBreakdown === 'object' ? classification.scoreBreakdown : {},
    modelVersion: classification?.modelVersion || '1.0',
    rationale: classification?.rationale || null,
  };
  const updated = [...list, entry];
  const saved = saveStyleClassifications(athleteId, updated);
  return { saved, classification: entry, classifications: updated };
}

// ---------------------------------------------------------------------------
// Тренерские заметки
// ---------------------------------------------------------------------------

export function loadNotes(athleteId) {
  const list = readJson(storageKeys.notes(athleteId), []);
  return Array.isArray(list) ? list.filter((n) => n && typeof n === 'object' && n.id) : [];
}

export function saveNotes(athleteId, list) {
  return writeJson(storageKeys.notes(athleteId), Array.isArray(list) ? list : []);
}

/**
 * Читает заметку старого формата из `box_coach_note_<athleteId>`.
 * Возвращает строку или null. Не изменяет хранилище.
 */
export function loadLegacyNote(athleteId) {
  const raw = safeGetItem(storageKeys.legacyNotes(athleteId));
  if (!raw) return null;
  try {
    // Старый формат мог быть просто строкой или JSON-строкой.
    if (raw.startsWith('"') || raw.startsWith('{') || raw.startsWith('[')) {
      return JSON.parse(raw);
    }
    return raw;
  } catch {
    return raw;
  }
}

export function addNote(athleteId, note) {
  const list = loadNotes(athleteId);
  const now = new Date().toISOString();
  const entry = {
    id: note?.id && String(note.id).startsWith('note_') ? note.id : createNoteId(),
    athleteId,
    recordedAt: note?.recordedAt || now,
    text: note?.text != null ? String(note.text) : '',
    relatedEventId: note?.relatedEventId || null,
    relatedEventType: note?.relatedEventType || null,
  };
  const updated = [...list, entry];
  const saved = saveNotes(athleteId, updated);
  return { saved, note: entry, notes: updated };
}

export function deleteNote(athleteId, noteId) {
  const updated = loadNotes(athleteId).filter((n) => n.id !== noteId);
  saveNotes(athleteId, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Схема
// ---------------------------------------------------------------------------

export function loadSchemaVersion() {
  const raw = safeGetItem(ATHLETE_SCHEMA_KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function saveSchemaVersion(version = ATHLETE_SCHEMA_VERSION) {
  return safeSetItem(ATHLETE_SCHEMA_KEY, String(version));
}

/**
 * Проверяет, что текущая версия схемы соответствует ожидаемой.
 * Если в хранилище версии нет, записывает текущую.
 */
export function ensureSchemaVersion() {
  const current = loadSchemaVersion();
  if (current === null) {
    const saved = saveSchemaVersion();
    if (!saved) {
      return { ok: false, version: null, expected: ATHLETE_SCHEMA_VERSION, error: 'Не удалось сохранить версию схемы.' };
    }
    return { ok: true, version: ATHLETE_SCHEMA_VERSION, migrated: false };
  }
  if (current !== ATHLETE_SCHEMA_VERSION) {
    return { ok: false, version: current, expected: ATHLETE_SCHEMA_VERSION };
  }
  return { ok: true, version: current, migrated: false };
}
