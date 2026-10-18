import {escapeHtml as esc} from "./format.js";
/** @param {{media?:unknown}|null|undefined} e */
export const exerciseMedia=e=>(e&&typeof e.media==="string"&&e.media)||null;
/* The paper colour the illustration is drawn on, sampled per file at build time
   (tools/sample-media-bg.mjs). The detail page lays the artwork on a field of
   this colour so the opaque square dissolves rather than reading as a pasted
   tile. Re-checked here because the value reaches a style attribute, and a
   generated file is still a file somebody can edit. */
const HEX_COLOR=/^#[0-9a-f]{6}$/i;
/** @param {{mediaBg?:unknown}|null|undefined} e */
export const exerciseMediaBg=e=>(e&&typeof e.mediaBg==="string"&&HEX_COLOR.test(e.mediaBg)&&e.mediaBg)||null;
export const emptyThumb=({size="md"}={})=>
  `<span class="exthumb exthumb--${esc(size)} exthumb--empty" aria-hidden="true"></span>`;
/** @param {{media?:unknown}|null|undefined} e @param {{size?:string}} [options] */
export function exerciseThumb(e,{size="md"}={}){
  const src=exerciseMedia(e);
  if(!src)return emptyThumb({size});
  // alt is empty on purpose: the exercise name sits next to it in every list,
  // so describing the drawing again would only repeat the row to a screen reader.
  return `<img class="exthumb exthumb--${esc(size)}" src="${esc(src)}" alt="" `+
    `loading="lazy" decoding="async" width="768" height="768">`}

