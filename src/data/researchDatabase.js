import { loadUserResearch } from './userResearchStore.js';
import { getReactionTimeResearchEntries } from './reactionTimeLiterature.js';

export const RESEARCH_DATABASE = [];

/**
 * Объединённая база: встроенные записи (пусто) + записи библиотеки времени реакции +
 * пользовательские из localStorage (box_research_user). Пользовательские записи
 * не изменяют встроенные данные и помечены userProvided: true.
 */
const REACTION_TIME_ENTRIES = getReactionTimeResearchEntries();

export function getAllResearch() {
  return RESEARCH_DATABASE.concat(REACTION_TIME_ENTRIES).concat(loadUserResearch());
}