import { boxingStandards } from '../data/boxingStandards';

export function getNormsForAthlete(athleteAge) {
  if (athleteAge >= 17) return boxingStandards.stagesConfig.vsp;
  if (athleteAge >= 14) return boxingStandards.stagesConfig.ss;
  if (athleteAge >= 12) return boxingStandards.stagesConfig.tr;
  return boxingStandards.stagesConfig.np;
}