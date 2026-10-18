/** Temporary startup bridge. No algorithms or editable state live here.
 * Removal: migration slice 20. Each binding is deleted at final composition. */
import {schedule} from '../training/progress.js';
export function bindMigratedScript(path, host) {
  if (path === 'durable-state.js' || path === 'motion-layer.js') return true;
  if (path === 'schedule.js') { host.RepForgeSchedule = schedule; return true; }
  return false;
}
