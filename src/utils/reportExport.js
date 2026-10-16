import { analyzeAthleteProfile } from './fullAnalyzer.js';

const PHYSICAL_HISTORY_PREFIX = 'box_phys_history_';

function readJson(key, fallback) {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function buildIntegratedReportPayload(athlete = {}, options = {}) {
  const physData = options.physData ?? readJson(`box_phys_${athlete.id}`, {});
  const physHistory = options.physHistory ?? readJson(`${PHYSICAL_HISTORY_PREFIX}${athlete.id}`, []);
  const analysis = analyzeAthleteProfile(athlete, physData, {
    competitionHistory: options.competitionHistory,
    physHistory,
    currentDate: options.currentDate,
  });

  return {
    schema: 'BOX-PROFILE.integrated-report',
    version: 1,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    athlete: analysis.athlete,
    cohort: analysis.cohort,
    summary: analysis.summary,
    competition: analysis.competition,
    longitudinal: analysis.longitudinal,
    physical: { current: physData, history: physHistory },
    validation: analysis.validation,
    comparisons: analysis.comparisons,
    coachNote: options.coachNote ?? readJson(`box_coach_note_${athlete.id}`, ''),
  };
}

export function serializeIntegratedReport(payload) {
  return JSON.stringify(payload, null, 2);
}

export function makeReportFilename(athlete, extension = 'json') {
  const safeName = String(athlete?.name || 'спортсмен')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_|_$/g, '') || 'спортсмен';
  return `BOX-PROFILE_${safeName}.${extension}`;
}
