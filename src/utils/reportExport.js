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
    recommendations: analysis.recommendations,
    globalDisclaimer: analysis.globalDisclaimer,
    cohortLimitations: analysis.cohortLimitations,
    coachNote: options.coachNote ?? readJson(`box_coach_note_${athlete.id}`, ''),
  };
}

/**
 * Безопасная сериализация с защитой от циклических ссылок и функций
 */
export function serializeIntegratedReport(payload) {
  const seen = new WeakSet();
  return JSON.stringify(payload, (key, value) => {
    if (typeof value === 'function' || value instanceof HTMLElement) {
      return undefined;
    }
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  }, 2);
}

export function makeReportFilename(athlete, extension = 'json') {
  const safeName = String(athlete?.name || 'спортсмен')
    .trim()
    .replace(/[^\p{L}\p{N}_-]+/gu, '_')
    .replace(/^_|_$/g, '') || 'спортсмен';
  return `BOX-PROFILE_${safeName}.${extension}`;
}

/**
 * Безопасный экспорт отчета в JSON с защитой от зависаний
 */
export function exportReportToJson(athlete, options = {}) {
  try {
    const payload = buildIntegratedReportPayload(athlete, options);
    const jsonString = serializeIntegratedReport(payload);
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(jsonString);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", makeReportFilename(athlete, 'json'));
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (error) {
    console.error("Ошибка при экспорте JSON:", error);
    alert("Не удалось сформировать JSON-файл: " + error.message);
  }
}

/**
 * Безопасная печать / PDF с освобождением главного потока
 */
export function exportReportToPdfOrPrint() {
  try {
    setTimeout(() => {
      window.print();
    }, 150);
  } catch (error) {
    console.error("Ошибка при печати:", error);
    alert("Не удалось запустить печать отчета.");
  }
}