/** Service composition of the shared portable contract. The PWA and service
 * validate the same schema; no browser client/storage enters this graph. */
import {createTransferContract} from '../../../src/interchange/transfer-contract.js';
import {compiler} from '../../../src/training/generation.js';
import metrics from '../../../src/training/metrics.js';
import {createEntryRules} from '../../../src/training/authoring.js';
import {createWorkoutRules} from '../../../src/training/workout.js';
import catalog from '../../../assets/exercise-catalog.json' with {type:'json'};

const entry=createEntryRules(catalog);
const workout=createWorkoutRules(catalog);
export default createTransferContract({compiler,metrics,entry,workout,catalog,
  crypto:globalThis.crypto,TextEncoder,TextDecoder});
