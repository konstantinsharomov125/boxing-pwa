import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildIntegratedReportPayload,
  makeReportFilename,
  serializeIntegratedReport,
} from '../src/utils/reportExport.js';
import { buildFightRecord } from '../src/utils/competitionAdapter.js';

test('интегральный JSON-отчёт содержит competition, physical и longitudinal блоки', () => {
  const payload = buildIntegratedReportPayload(
    { id: 77, name: 'Иван Петров', age: 25 },
    {
      exportedAt: '2026-10-17T00:00:00.000Z',
      physData: { vo2maxRel: 60, reactionTime: 220 },
      physHistory: [{ date: '01.01.2026', data: { vo2maxRel: 55 } }],
      competitionHistory: [
        buildFightRecord({
          id: 'fight-1',
          date: '10.01.2026',
          rounds: [{ id: 1, jabsTotal: 20, jabsTarget: 8, powerTotal: 10, powerTarget: 4 }],
          roundsCount: 1,
          roundDurationMin: 3,
        }),
      ],
    },
  );

  assert.equal(payload.schema, 'BOX-PROFILE.integrated-report');
  assert.equal(payload.exportedAt, '2026-10-17T00:00:00.000Z');
  assert.equal(payload.competition.metrics.density.value, 10);
  assert.equal(payload.physical.current.vo2maxRel, 60);
  assert.equal(payload.longitudinal.periods.length, 2);
  assert.equal(payload.longitudinal.source.competitionPeriods, 1);
  assert.equal(JSON.parse(serializeIntegratedReport(payload)).schema, payload.schema);
});

test('имя файла отчёта безопасно для файловой системы', () => {
  assert.equal(makeReportFilename({ name: 'Иван Петров / тест' }), 'BOX-PROFILE_Иван_Петров_тест.json');
  assert.equal(makeReportFilename({}, 'pdf'), 'BOX-PROFILE_спортсмен.pdf');
});
