import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

const storage = new Map();
const stubLocalStorage = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear(),
};
const brokenLocalStorage = {
  getItem: () => { throw new Error('storage unavailable'); },
  setItem: () => { throw new Error('storage unavailable'); },
  removeItem: () => { throw new Error('storage unavailable'); },
  clear: () => { throw new Error('storage unavailable'); },
};


const {
  ATHLETE_SCHEMA_VERSION,
  createAthleteId,
  createAttributeId,
  createExamId,
  createFightId,
  createStyleClassificationId,
  createNoteId,
  setStorageBackend,
  resetStorageBackend,
  loadAthletes,
  addAthlete,
  updateAthlete,
  deleteAthlete,
  loadAttributes,
  addAttributeSnapshot,
  resolveAttributesSnapshot,
  loadExaminations,
  addExamination,
  loadFights,
  addFight,
  loadStyleClassifications,
  addStyleClassification,
  loadNotes,
  addNote,
  deleteNote,
  ensureSchemaVersion,
} = await import('../src/data/athleteStore.js');

const {
  loadLegacyNote,
} = await import('../src/data/athleteStore.js');

beforeEach(() => {
  storage.clear();
  setStorageBackend(stubLocalStorage);
});

afterEach(() => {
  resetStorageBackend();
});

test('ID-генераторы возвращают строки с префиксами', () => {
  assert.ok(createAthleteId().startsWith('ath_'));
  assert.ok(createAttributeId().startsWith('attr_'));
  assert.ok(createExamId().startsWith('exam_'));
  assert.ok(createFightId().startsWith('fight_'));
  assert.ok(createStyleClassificationId().startsWith('style_'));
  assert.ok(createNoteId().startsWith('note_'));
});

test('addAthlete создаёт профиль с UUID и сохраняет в localStorage', () => {
  const result = addAthlete({ name: 'Иванов Иван', dateOfBirth: '2005-03-15', sex: 'male' });
  assert.equal(result.saved, true);
  assert.ok(result.athlete.id.startsWith('ath_'));
  assert.equal(result.athlete.name, 'Иванов Иван');
  assert.equal(result.athlete.dateOfBirth, '2005-03-15');
  assert.equal(result.athlete.age, undefined);
  assert.equal(loadAthletes().length, 1);
});

test('updateAthlete изменяет поля профиля', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван', dateOfBirth: '2005-03-15' });
  const result = updateAthlete(athlete.id, { name: 'Петров Петр', preferredStyle: 'Темповик' });
  assert.equal(result.saved, true);
  assert.equal(result.athlete.name, 'Петров Петр');
  assert.equal(result.athlete.preferredStyle, 'Темповик');
  assert.equal(loadAthletes()[0].name, 'Петров Петр');
});

test('deleteAthlete удаляет профиль', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const list = deleteAthlete(athlete.id);
  assert.equal(list.length, 0);
  assert.equal(loadAthletes().length, 0);
});

test('addAttributeSnapshot сохраняет снимок с validFrom и recordedAt', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addAttributeSnapshot(athlete.id, {
    validFrom: '2024-01-01',
    qualification: 'МС / КМС',
    weightCategory: 'Средний вес (63.5–75 кг)',
    weight: 70,
  });
  assert.equal(result.saved, true);
  assert.ok(result.snapshot.id.startsWith('attr_'));
  assert.equal(result.snapshot.athleteId, athlete.id);
  assert.equal(result.snapshot.validFrom, '2024-01-01');
  assert.equal(result.snapshot.qualification, 'МС / КМС');
  assert.equal(loadAttributes(athlete.id).length, 1);
});

test('resolveAttributesSnapshot находит актуальные атрибуты на дату', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  addAttributeSnapshot(athlete.id, { validFrom: '2023-01-01', qualification: '1-й разряд' });
  addAttributeSnapshot(athlete.id, { validFrom: '2024-01-01', qualification: 'МС / КМС' });

  const snapshot = resolveAttributesSnapshot(athlete.id, '2024-06-01');
  assert.equal(snapshot.qualification, 'МС / КМС');

  const oldSnapshot = resolveAttributesSnapshot(athlete.id, '2023-06-01');
  assert.equal(oldSnapshot.qualification, '1-й разряд');

  const unknown = resolveAttributesSnapshot(athlete.id, '2022-06-01');
  assert.equal(unknown, null);
});

test('addExamination сохраняет обследование и обновляет кэш', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const { snapshot } = addAttributeSnapshot(athlete.id, { validFrom: '2024-01-01', qualification: 'МС / КМС' });
  const result = addExamination(athlete.id, {
    recordedAt: '2024-03-15T10:30',
    attributesSnapshotId: snapshot.id,
    values: { vo2maxRel: 62.5, weight: 70 },
  });
  assert.equal(result.saved, true);
  assert.ok(result.examination.id.startsWith('exam_'));
  assert.equal(result.examination.attributesSnapshotId, snapshot.id);
  assert.equal(loadExaminations(athlete.id).length, 1);
});

test('addFight сохраняет поединок с атрибутами', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const { snapshot } = addAttributeSnapshot(athlete.id, { validFrom: '2024-01-01', weightCategory: 'Средний вес' });
  const result = addFight(athlete.id, {
    date: '2024-04-20',
    opponent: 'Соперник',
    attributesSnapshotId: snapshot.id,
    rounds: [{ id: 1, jabsTotal: 10, jabsTarget: 5, powerTotal: 5, powerTarget: 2 }],
  });
  assert.equal(result.saved, true);
  assert.ok(result.fight.id.startsWith('fight_'));
  assert.equal(result.fight.attributesSnapshotId, snapshot.id);
  assert.equal(loadFights(athlete.id).length, 1);
});

test('addStyleClassification сохраняет результат классификации', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addStyleClassification(athlete.id, {
    classifiedAt: '2024-03-15',
    sourceType: 'examination',
    style: 'Темповик',
    scoreBreakdown: { tempScore: 90, powerScore: 30, gamerScore: 40 },
  });
  assert.equal(result.saved, true);
  assert.ok(result.classification.id.startsWith('style_'));
  assert.equal(result.classification.style, 'Темповик');
  assert.equal(loadStyleClassifications(athlete.id).length, 1);
});

test('addNote и deleteNote управляют заметками', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addNote(athlete.id, { text: 'Первая заметка', relatedEventType: 'examination' });
  assert.equal(result.saved, true);
  assert.ok(result.note.id.startsWith('note_'));
  assert.equal(loadNotes(athlete.id).length, 1);

  deleteNote(athlete.id, result.note.id);
  assert.equal(loadNotes(athlete.id).length, 0);
});

test('ensureSchemaVersion записывает версию при первом вызове', () => {
  const result = ensureSchemaVersion();
  assert.equal(result.ok, true);
  assert.equal(result.version, ATHLETE_SCHEMA_VERSION);
  assert.equal(storage.get('box_athlete_schema_version'), String(ATHLETE_SCHEMA_VERSION));
});

test('ensureSchemaVersion сообщает об ошибке при недоступном хранилище', () => {
  setStorageBackend(brokenLocalStorage);
  const result = ensureSchemaVersion();
  assert.equal(result.ok, false);
  assert.equal(result.version, null);
  assert.ok(result.error);
});

test('addAthlete возвращает saved: false при недоступном хранилище', () => {
  setStorageBackend(brokenLocalStorage);
  const result = addAthlete({ name: 'Иванов Иван' });
  assert.equal(result.saved, false);
  assert.equal(loadAthletes().length, 0);
});

test('addAthlete отклоняет пустое имя', () => {
  const result = addAthlete({ name: '   ' });
  assert.equal(result.saved, false);
  assert.ok(result.error);
});

test('addAthlete отклоняет некорректную дату рождения', () => {
  const result = addAthlete({ name: 'Иванов Иван', dateOfBirth: '2024-02-30' });
  assert.equal(result.saved, true);
  assert.equal(result.athlete.dateOfBirth, null);
});

test('addAttributeSnapshot отклоняет некорректный вес', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addAttributeSnapshot(athlete.id, { weight: -5 });
  assert.equal(result.saved, true);
  assert.equal(result.snapshot.weight, null);
});

test('addAttributeSnapshot нормализует некорректную дату validFrom', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addAttributeSnapshot(athlete.id, { validFrom: '2024-02-30', qualification: 'МС' });
  assert.equal(result.saved, true);
  assert.notEqual(result.snapshot.validFrom, '2024-02-30');
});

test('addFight использует сегодняшнюю дату при некорректной', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  const result = addFight(athlete.id, { date: '2024-02-30' });
  assert.equal(result.saved, true);
  assert.notEqual(result.fight.date, '2024-02-30');
});

test('loadLegacyNote читает старые заметки из box_coach_note_<id>', () => {
  const { athlete } = addAthlete({ name: 'Иванов Иван' });
  storage.set(`box_coach_note_${athlete.id}`, 'Старая заметка');
  assert.equal(loadLegacyNote(athlete.id), 'Старая заметка');
});
