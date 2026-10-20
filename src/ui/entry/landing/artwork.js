export const LANDING_SCENES=["focus","rest","actions","note"];
/** @type {Record<string,Record<string,[number,number,number,number]>>} */
export const LANDING_SPOTS={
  focus:{cue:[50,31.61,91.79,6.59],log:[50,90.88,91.79,6.4],last:[50,48,91.79,11.98]},
  rest:{dial:[50,32.66,91.79,6.98]},
  actions:{swap:[50,52.38,91.79,6.16]},
  note:{text:[50,64.93,91.28,2.94]}};
/** How the lens reads each element: magnification, shape, padding (px at 390 wide)
 *  and, for a button read edge to edge, the app's corner radius. */
/** @type {Record<string,{scene:string,m:number,shape:string,pad:number,r?:number}>} */
export const LANDING_READ={
  cue:{scene:"focus",m:1.95,shape:"pill",pad:10},
  log:{scene:"focus",m:1.5,shape:"rect",pad:0,r:14},
  dial:{scene:"rest",m:1.3,shape:"pill",pad:6},
  swap:{scene:"actions",m:1.5,shape:"rect",pad:0,r:14},
  text:{scene:"note",m:1.4,shape:"pill",pad:8},
  last:{scene:"focus",m:1.55,shape:"rect",pad:10}};
/** The import-review capture: its size per language, the counts its screen shows
 *  (they differ by language: the sample's names classify differently) and the
 *  library movement its first row suggests. Written by tools/capture-landing-proof.mjs
 *  into assets/brand/landing-proof-spots.json, which test/landing-variants.mjs compares. */
export const LANDING_PASTE_SHOT={dims:{en:[780,1138],pt:[780,1266]},counts:{en:{linked:2,review:2},pt:{linked:0,review:4}},exercise:"19f5c6f170d8808bb424e98de4472a7e"};
