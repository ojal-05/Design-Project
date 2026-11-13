import landingCommandBayImg from '../assets/images/landing_command_bay_1793681642605.jpg';
import scenarioCardiacBayImg from '../assets/images/scenario_cardiac_bay_1793681643659.jpg';
import scenarioTriageWardImg from '../assets/images/scenario_triage_ward_1793681643485.jpg';
import missionNightArrestImg from '../assets/images/mission_night_arrest_1793692733060.jpg';
import missionTraumaSurgeImg from '../assets/images/mission_trauma_surge_1793692733863.jpg';
import trainingArenaBannerImg from '../assets/images/training_arena_banner_1793692734477.jpg';
import type { ScenarioDefinition, ScenarioMode } from '../types/simulation';

export const VISUAL_ASSETS = {
  landingHero: landingCommandBayImg,
  cardiacScenario: scenarioCardiacBayImg,
  triageScenario: scenarioTriageWardImg,
  nightArrestScenario: missionNightArrestImg,
  traumaSurgeScenario: missionTraumaSurgeImg,
  trainingArenaBanner: trainingArenaBannerImg,
};

export function getScenarioVisual(
  modeOrScenario: ScenarioMode | ScenarioDefinition
): string {
  if (typeof modeOrScenario === 'string') {
    return modeOrScenario === 'cardiac_arrest'
      ? VISUAL_ASSETS.cardiacScenario
      : VISUAL_ASSETS.triageScenario;
  }

  if (modeOrScenario.mode === 'cardiac_arrest') {
    if (
      modeOrScenario.environmentConfig.lightingMode !== 'Clinical Standard' ||
      modeOrScenario.difficulty === 'High Acuity' ||
      modeOrScenario.id.includes('02')
    ) {
      return VISUAL_ASSETS.nightArrestScenario;
    }
    return VISUAL_ASSETS.cardiacScenario;
  }

  if (
    modeOrScenario.difficulty === 'High Acuity' ||
    modeOrScenario.id.includes('02')
  ) {
    return VISUAL_ASSETS.traumaSurgeScenario;
  }
  return VISUAL_ASSETS.triageScenario;
}
