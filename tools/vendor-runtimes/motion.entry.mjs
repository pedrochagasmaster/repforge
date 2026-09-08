/* The exact Motion surface the Taurifer motion layer is allowed to use.
 *
 * Everything reachable from these two exports is bundled; everything else in
 * the package is tree-shaken away. Widening this list is a deliberate act: it
 * grows a payload that every lifter downloads before their first set, so add an
 * export only when `motion-layer.js` genuinely needs it and the interaction
 * audit records why. */
export { animate, motionValue } from "motion";
