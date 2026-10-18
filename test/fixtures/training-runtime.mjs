/** Test composition of shipped public modules, with one verified catalog and
 * one generation authority. No training/schema policy is implemented here. */
import {readFile} from 'node:fs/promises';
import {createGenerationRules} from '../../src/training/generation.js';
import {createCatalog} from '../../src/platform/catalog.js';
import {createEntryRules,createEntryAdapter} from '../../src/training/authoring.js';
import {createWorkoutRules} from '../../src/training/workout.js';
import Metrics from '../../src/training/metrics.js';
import {progression as Progression,evidence as Progress} from '../../src/training/progress.js';
import * as librarySource from '../../exercises.js';
export const generation=createGenerationRules();
export const {compiler:Compiler,identity:Identity,transition:Transition}=generation;
const catalogReader=createCatalog({identity:Identity,librarySource,
 fetcher:async url=>({ok:true,text:()=>readFile(new URL(url),'utf8')})});
export const Catalog=await catalogReader.load();
export const Entry=createEntryRules(Catalog);
export const Adapter=createEntryAdapter({compiler:Compiler});
export const Draft=createWorkoutRules(Catalog);
export {Metrics,Progression,Progress,librarySource};
