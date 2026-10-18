/**
 * Расширенная научная библиотека:
 * "Время реакции и психомоторика квалифицированных боксёров".
 *
 * Этот модуль — источник структурированных метаданных и наблюдений.
 * Он НЕ импортирует modelsConfig.js, чтобы избежать циклических зависимостей.
 */

const DATA_QUALITY_STATUSES = [
  'metadata_only',
  'verified_fulltext',
  'verified_primary',
  'abstract_only',
  'secondary_source',
  'provisional',
  'unverified',
  'demo',
  'derived_from_verified_data',
];

function assertStatus(status) {
  if (!DATA_QUALITY_STATUSES.includes(status)) {
    throw new Error(`Недопустимый статус достоверности: ${status}`);
  }
  return status;
}

// ---------------------------------------------------------------------------
// Когорты участников (очищено от демо-данных)
// ---------------------------------------------------------------------------
export const REACTION_TIME_COHORTS = [];

// ---------------------------------------------------------------------------
// Протоколы измерения (очищено от демо-данных)
// ---------------------------------------------------------------------------
export const REACTION_TIME_PROTOCOLS = [];

// ---------------------------------------------------------------------------
// Публикации (очищено от демо-данных)
// ---------------------------------------------------------------------------
export const REACTION_TIME_PUBLICATIONS = [];

// ---------------------------------------------------------------------------
// Вспомогательные селекторы
// ---------------------------------------------------------------------------
export function getCohortById(id) {
  return REACTION_TIME_COHORTS.get?.(id) || REACTION_TIME_COHORTS.find((c) => c.id === id) || null;
}

export function getProtocolById(id) {
  return REACTION_TIME_PROTOCOLS.find((p) => p.id === id) || null;
}

export function getPublicationById(id) {
  return REACTION_TIME_PUBLICATIONS.find((p) => p.id === id) || null;
}

// ---------------------------------------------------------------------------
// Свертка в формат RESEARCH_DATABASE
// ---------------------------------------------------------------------------
function observationToResearchEntry(publication, observation) {
  const cohort = getCohortById(observation.cohortId);
  const protocol = getProtocolById(observation.protocolId);

  const metrics = {};
  if (typeof observation.value === 'number' && Number.isFinite(observation.value)) {
    metrics[observation.metricId] = {
      mean: observation.value,
      sd: observation.sd != null && Number.isFinite(observation.sd) && observation.sd > 0 ? observation.sd : null,
      unit: observation.unit || null,
    };
  }

  return {
    id: `rtl_${publication.id}_${observation.id}`,
    author: publication.bibliography.authors,
    year: publication.bibliography.year,
    group: cohort?.ageGroup ?? null,
    qualification: cohort?.qualification ?? null,
    weightCategory: cohort?.weightCategory ?? null,
    sex: cohort?.sex ?? null,
    style: null,
    citation: `${publication.bibliography.authors} (${publication.bibliography.year}). ${publication.bibliography.title}. ${publication.bibliography.source}.`,
    metrics,
    sampleSize: cohort?.sampleSize ?? null,
    protocol: protocol
      ? `${protocol.name}. Оборудование: ${protocol.equipment}. Стимул: ${protocol.stimulus}. Ответ: ${protocol.responseMode}. Состояние: ${protocol.state}.`
      : null,
    dataStatus: publication.dataQualityStatus === 'demo' ? 'unverified' : publication.dataQualityStatus,
    originalDataStatus: publication.dataQualityStatus,
    abstractOnly: publication.abstractOnly,
    admissionConditions: publication.admission.requiredConditions.map(() => false),
    limitations: publication.limitations,
    sourceLocator: observation.sourceLocator,
    sourceType: 'reactionTimeLiterature',
  };
}

export function getReactionTimeResearchEntries() {
  const entries = [];
  for (const publication of REACTION_TIME_PUBLICATIONS) {
    for (const observation of publication.observations || []) {
      entries.push(observationToResearchEntry(publication, observation));
    }
  }
  return entries;
}