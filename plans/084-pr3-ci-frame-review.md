# Plan 084 PR 3: CI frame review

Source: run [43430310391](https://github.com/pedrochagasmaster/repforge/actions/runs/43430310391), head `f8e75c7c8b0fdb1a8a82260deffd52d4b9c32c0d`. Fetched with `node tools/fetch-ci-captures.mjs 43430310391`.

Reviewed all 63 changed PNGs at native size: Solid 8, checked 8, agreeing 8, summary 6, first 6, maintained 6, declined 6, finding 7, lifts 8. The three profile states were compared with the approved finish prototype before/after; the six existing summary states were compared with main `28a39d51d1a7ae226f6b1f16f04b58afc61ca95c`. No existing catalog frame was captured locally.

All 24 new frames are actual CI replacements. None remain local placeholders or rely only on comparison. Each committed PNG was byte-compared with its producer artifact; hashes for all 63 are below. Both links appear in the ordinary finish variants. At text200, content wraps vertically and the reader link is below the initial viewport in some variants; the scrolling journey is covered by the existing focused finish proof. No horizontal clipping was introduced by the profile block. Dark-mode ink, EN/PT approved copy, 320 layout and reduced-motion final arcs were checked. Unchanged saves retain the ring and navigation without a change paragraph, covered by the 92-assertion focused proof already passed on the source head.

The profile occupies the final #736 slot after share cards and before findings/statistics. Summary finding/lifts captures intentionally scroll farther down: the insertion changes the preceding content height and therefore their framing, while retaining the existing finding and lift rows. Main's share cards, controls and existing wording remain. The requested `summary__phone-390-light-pt-text200.png` was captured and passed zero-tolerance comparison (capture shard 6/6, output line 132); it was not published because it matches. Its retained bytes also match main. The profile is below that viewport.

## Prototype differences awaiting owner fidelity approval

- All `profile-finish-{solid,checked,agreeing}__*`: #736 share cards above the slot and Share/Done footer, compared with compact totals and Done-only in the prototype. The catalog scrolls to the profile slot. The production heading/body typography and spacing follow the existing summary; the extra quiet Overview link keeps both destinations accessible.
- `profile-finish-solid__*`: actual shorter featured history gives 138.5 to 149.5, compared with prototype 149 to 160. Checked is 157 to 168. Agreeing is 141 to 152, compared with 157 to 168: the other three lifts have one valid check each so this save releases the first global effort-reading finding. Every fixture still adds four dates (3 units) and one stage (8 units).
- Canonical lift names and approved final copy replace the prototype candidate wording. Existing summary findings remain alongside the profile; they award no additional credit.

## Contact sheets

Outside the repository, under `/home/ubuntu/taurifer-design-refs/fidelity/761/run-43430310391/`:

- `solid-prototype-v-ci.png`: approved Solid after-save prototype, 390 EN light, beside CI. Separate `prototype-solid-before-390-en-light.png` records the previous reading from the same approved disposable HTML.
- `summary-main-v-ci-pt-text200.png`: main beside the retained, zero-tolerance CI-verified 390 PT text200 frame.
- `review/ci-01.png` through `ci-32.png`: native-size review pairs; `review/main-v-ci-*.png`: existing summary comparisons; `review/ci-provenance.json`: artifact and SHA-256 map.

Owner fidelity sign-off and green `ci` / `ci-full` on the new head remain pending. The worker does not dispatch or watch CI.

## All 24 new-frame provenance

| Frame in `docs/ui-screens/screens/session/` | Run 43430310391 producer | Artifact |
|---|---|---|
| `profile-finish-agreeing__phone-320-light-en.png` | `verify-5-6` | `ci-captures-full-capture-4-1` |
| `profile-finish-agreeing__phone-390-dark-en.png` | `verify-3-6` | `ci-captures-full-capture-2-1` |
| `profile-finish-agreeing__phone-390-light-en-reduced.png` | `verify-2-6` | `ci-captures-full-capture-1-1` |
| `profile-finish-agreeing__phone-390-light-en-text200.png` | `verify-1-6` | `ci-captures-full-capture-0-1` |
| `profile-finish-agreeing__phone-390-light-en.png` | `verify-2-6` | `ci-captures-full-capture-1-1` |
| `profile-finish-agreeing__phone-390-light-pt-text200.png` | `verify-3-6` | `ci-captures-full-capture-2-1` |
| `profile-finish-agreeing__phone-390-light-pt.png` | `verify-4-6` | `ci-captures-full-capture-3-1` |
| `profile-finish-agreeing__phone-430-light-en.png` | `verify-6-6` | `ci-captures-full-capture-5-1` |
| `profile-finish-checked__phone-320-light-en.png` | `verify-3-6` | `ci-captures-full-capture-2-1` |
| `profile-finish-checked__phone-390-dark-en.png` | `verify-1-6` | `ci-captures-full-capture-0-1` |
| `profile-finish-checked__phone-390-light-en-reduced.png` | `verify-6-6` | `ci-captures-full-capture-5-1` |
| `profile-finish-checked__phone-390-light-en-text200.png` | `verify-5-6` | `ci-captures-full-capture-4-1` |
| `profile-finish-checked__phone-390-light-en.png` | `verify-6-6` | `ci-captures-full-capture-5-1` |
| `profile-finish-checked__phone-390-light-pt-text200.png` | `verify-1-6` | `ci-captures-full-capture-0-1` |
| `profile-finish-checked__phone-390-light-pt.png` | `verify-2-6` | `ci-captures-full-capture-1-1` |
| `profile-finish-checked__phone-430-light-en.png` | `verify-4-6` | `ci-captures-full-capture-3-1` |
| `profile-finish-solid__phone-320-light-en.png` | `verify-1-6` | `ci-captures-full-capture-0-1` |
| `profile-finish-solid__phone-390-dark-en.png` | `verify-5-6` | `ci-captures-full-capture-4-1` |
| `profile-finish-solid__phone-390-light-en-reduced.png` | `verify-4-6` | `ci-captures-full-capture-3-1` |
| `profile-finish-solid__phone-390-light-en-text200.png` | `verify-3-6` | `ci-captures-full-capture-2-1` |
| `profile-finish-solid__phone-390-light-en.png` | `verify-4-6` | `ci-captures-full-capture-3-1` |
| `profile-finish-solid__phone-390-light-pt-text200.png` | `verify-5-6` | `ci-captures-full-capture-4-1` |
| `profile-finish-solid__phone-390-light-pt.png` | `verify-6-6` | `ci-captures-full-capture-5-1` |
| `profile-finish-solid__phone-430-light-en.png` | `verify-2-6` | `ci-captures-full-capture-1-1` |

## All 63 committed-frame hashes

| Frame | Producer | SHA-256 |
|---|---|---|
| `profile-finish-agreeing__phone-320-light-en.png` | `verify-5-6` | `d1094eb232b30994cc4693b0ac473a7f57dbc0ef6f025202a9e0fcdf5a79ac1a` |
| `profile-finish-agreeing__phone-390-dark-en.png` | `verify-3-6` | `beb6124fb10a5eed46dbbe20dab5dc37327efb66cc8a3117ea630558576dc970` |
| `profile-finish-agreeing__phone-390-light-en-reduced.png` | `verify-2-6` | `0bc73284304dae6a5d80cf985ab378f1a7502ec49ccc3b3730a951ea6d58fedb` |
| `profile-finish-agreeing__phone-390-light-en-text200.png` | `verify-1-6` | `5bb57f247f190314df60248efa120c71f272cf465ccd360dfb4ab1dccabc1775` |
| `profile-finish-agreeing__phone-390-light-en.png` | `verify-2-6` | `0bc73284304dae6a5d80cf985ab378f1a7502ec49ccc3b3730a951ea6d58fedb` |
| `profile-finish-agreeing__phone-390-light-pt-text200.png` | `verify-3-6` | `15404395d7054160afcdc875c7ce0304a633bb8482912ff73dd1c8513484fbec` |
| `profile-finish-agreeing__phone-390-light-pt.png` | `verify-4-6` | `ea03252ceecf0a0a9fc823b248bccd4d0dae2c7dd145f1145c4c49151119563c` |
| `profile-finish-agreeing__phone-430-light-en.png` | `verify-6-6` | `ebd7334bb8f3cfc6aebec4c1aea45203b1f93995b26cd4009897c292fd8bd28c` |
| `profile-finish-checked__phone-320-light-en.png` | `verify-3-6` | `17a4798551fa307ff08dde4fda77a92d36104e83311aacc4259df4ad9ab7b97f` |
| `profile-finish-checked__phone-390-dark-en.png` | `verify-1-6` | `30d262ddda779d1844ea0484680d9500700eeed3ebfda3c18dffeaf162872dd3` |
| `profile-finish-checked__phone-390-light-en-reduced.png` | `verify-6-6` | `3159e9a240bc876b87443cb89105a4998aeabb9c3d8d105b78ef71b596627d2c` |
| `profile-finish-checked__phone-390-light-en-text200.png` | `verify-5-6` | `38ad3bafa06fad04e1b8bbeae3602df7bda65bdcebdc124133671961fd5cbf11` |
| `profile-finish-checked__phone-390-light-en.png` | `verify-6-6` | `3159e9a240bc876b87443cb89105a4998aeabb9c3d8d105b78ef71b596627d2c` |
| `profile-finish-checked__phone-390-light-pt-text200.png` | `verify-1-6` | `8fcedaaf49ea18e89f6579eccd8eb90a62c0550b98193d6defbb3117e9ca0429` |
| `profile-finish-checked__phone-390-light-pt.png` | `verify-2-6` | `312d13e1ba4d27a9c46cee34dc67f6edabe4e9e6389b76eea209430d8658fed3` |
| `profile-finish-checked__phone-430-light-en.png` | `verify-4-6` | `ebc86252d995fddd894ad7daadc3b25faf865420ee925ad11de392499c304e06` |
| `profile-finish-solid__phone-320-light-en.png` | `verify-1-6` | `4839506b1dcdc2f21c147110935cc515fd5de90eb2d06da477040a1da6526e25` |
| `profile-finish-solid__phone-390-dark-en.png` | `verify-5-6` | `5f4c80ea6154de8392ab74d694fbd51bf572a76c13c3763c4f205b8754be429f` |
| `profile-finish-solid__phone-390-light-en-reduced.png` | `verify-4-6` | `27254a9681a421e59a476398802e19936cd16df945f7a265d51ea9866e587c45` |
| `profile-finish-solid__phone-390-light-en-text200.png` | `verify-3-6` | `52623c9f63476031a598e90b7051af38027e155f2914698102c1c183cb76f910` |
| `profile-finish-solid__phone-390-light-en.png` | `verify-4-6` | `27254a9681a421e59a476398802e19936cd16df945f7a265d51ea9866e587c45` |
| `profile-finish-solid__phone-390-light-pt-text200.png` | `verify-5-6` | `aff786a8f94a76dd0b224ccb02c72ff4e652582d340930a21245dabbe0fc80a2` |
| `profile-finish-solid__phone-390-light-pt.png` | `verify-6-6` | `89458468ee17209aaaf025d3f92f8dc51c472b062144456f86a83e2e2c7e58c9` |
| `profile-finish-solid__phone-430-light-en.png` | `verify-2-6` | `15be51e788cbfc0bb321f8a400dbd556f3dc51df2142c9bab3d794d01787714b` |
| `summary-declined__phone-320-light-en.png` | `verify-4-6` | `9900f2ccd336c6dd7a9ba68fa409dabe9619042db06e387dbbae4a2ea423f7ba` |
| `summary-declined__phone-390-dark-en.png` | `verify-2-6` | `cdcae11be45fcb63e18998f0d7998dee18856468a8e236cd6a03575574100258` |
| `summary-declined__phone-390-light-en-reduced.png` | `verify-1-6` | `ff1b96a952ac40f9e6e2c5b581c84dbef9e800e78e4022dd069fc4eef0163bdf` |
| `summary-declined__phone-390-light-en.png` | `verify-1-6` | `ff1b96a952ac40f9e6e2c5b581c84dbef9e800e78e4022dd069fc4eef0163bdf` |
| `summary-declined__phone-390-light-pt.png` | `verify-3-6` | `d9459a46558a56a14330373bb0eb8a02b06e02e01b0020bd98ee6a4732038de3` |
| `summary-declined__phone-430-light-en.png` | `verify-5-6` | `2cca2f34fab5ffda387c9f88030ab44a232931cfcd5909fbbb457e3ee51c27a0` |
| `summary-finding__phone-390-dark-en.png` | `verify-2-6` | `f2672dff397629f7cf9a520c0df943fe56c85775fe5f5039e5ea3753ef637344` |
| `summary-finding__phone-390-light-en-reduced.png` | `verify-1-6` | `0503686a31de24c16905b77349b9032bc08c3b8bb3c9e54c2d71c4ba45a3f260` |
| `summary-finding__phone-390-light-en-text200.png` | `verify-6-6` | `52a0e1bdd5e98934adbc743b947acb16ee927e497470d5247892dfd951001217` |
| `summary-finding__phone-390-light-en.png` | `verify-1-6` | `0503686a31de24c16905b77349b9032bc08c3b8bb3c9e54c2d71c4ba45a3f260` |
| `summary-finding__phone-390-light-pt-text200.png` | `verify-2-6` | `420b75e2da10568afda0a2379dcc3c8ff9f240f7daec0cbef60676252d06d494` |
| `summary-finding__phone-390-light-pt.png` | `verify-3-6` | `ef96a518c7c573d5bd43c508e423d3128f85cbe4d0a709bd5dc635ce630b2966` |
| `summary-finding__phone-430-light-en.png` | `verify-5-6` | `844d070f09d541d3911eb5435ba592a56bc3b2949823e82441aeb5650663887d` |
| `summary-first__phone-320-light-en.png` | `verify-4-6` | `284efaba807802f05417af3e62177fa51e4378d70efa84559a0d15e4be8314e8` |
| `summary-first__phone-390-dark-en.png` | `verify-2-6` | `ccfce3a9ee0b7f78105f067d7e1312c437d912328fab7e69cd7cf2f96ae722b2` |
| `summary-first__phone-390-light-en-reduced.png` | `verify-1-6` | `6824302e17e892d904f68083c63933ff956a15fe25b7e6db34f93b31249d5336` |
| `summary-first__phone-390-light-en.png` | `verify-1-6` | `6824302e17e892d904f68083c63933ff956a15fe25b7e6db34f93b31249d5336` |
| `summary-first__phone-390-light-pt.png` | `verify-3-6` | `0a5603d5d257df7f6c316e34214ef3f7804a61de55314447300bce1ac479800d` |
| `summary-first__phone-430-light-en.png` | `verify-5-6` | `3b0ca2c7fb5549fd098dba18a46681e62c191b69a1e40897f8518d0b6fbd6222` |
| `summary-lifts__phone-320-light-en.png` | `verify-6-6` | `a2c3f9c347550f9af8e9c9d60a7bd6fe71e40623d4f71c5ce965e1d1274a2cb3` |
| `summary-lifts__phone-390-dark-en.png` | `verify-4-6` | `f0d152b82c2e3d736d2bc535c83dc0b740049c3c1e4672592a5b261fe71ea568` |
| `summary-lifts__phone-390-light-en-reduced.png` | `verify-3-6` | `9cfb3fda3c2d35e37e5f0759a8c031b2f23eba330b451ae42a729c50bbb01a09` |
| `summary-lifts__phone-390-light-en-text200.png` | `verify-2-6` | `d50794d4a18d368fa1a3767a244e1185528cb1d6dcb6bfb91729e3b239166fc4` |
| `summary-lifts__phone-390-light-en.png` | `verify-3-6` | `9cfb3fda3c2d35e37e5f0759a8c031b2f23eba330b451ae42a729c50bbb01a09` |
| `summary-lifts__phone-390-light-pt-text200.png` | `verify-4-6` | `4558c67e30f31638622aff8ba9815cdcdec381ea54f23c73ed9df73f75e2404c` |
| `summary-lifts__phone-390-light-pt.png` | `verify-5-6` | `ddb574f3045751d008b4b37354fcb7db22e717b1b34c44ac6b126138dfd9af9b` |
| `summary-lifts__phone-430-light-en.png` | `verify-1-6` | `6b58ca6b622d39a1c8e4c94059ce90c8ad3d966a6f2a4456c22a619078f8ff2b` |
| `summary-maintained__phone-320-light-en.png` | `verify-2-6` | `c1299174da3c9fa15a9aa80db3835ca92b1f96479960affe08542ff7b6729472` |
| `summary-maintained__phone-390-dark-en.png` | `verify-6-6` | `19fd72b7841eef412456329581d34ca609a00c48e4a9c707616f8f81a8cd6aa8` |
| `summary-maintained__phone-390-light-en-reduced.png` | `verify-5-6` | `60cd0d11d028b2ae31164e87da46c7fbb91c6b9ea4e3fe83b6cfe7d71342dada` |
| `summary-maintained__phone-390-light-en.png` | `verify-5-6` | `60cd0d11d028b2ae31164e87da46c7fbb91c6b9ea4e3fe83b6cfe7d71342dada` |
| `summary-maintained__phone-390-light-pt.png` | `verify-1-6` | `c955e230152479ba4dc62701b82c6b2775ca7ec6c18e11388eb8f500872ef51d` |
| `summary-maintained__phone-430-light-en.png` | `verify-3-6` | `244c5e95437db49c6d460c2ea993da932635c1a5bc4999f6268e444dd736e0f9` |
| `summary__phone-320-light-en.png` | `verify-2-6` | `73d7899136a9cb8614d67a0b744a99c019fda64718ca831bad96ed9947ce1df5` |
| `summary__phone-390-dark-en.png` | `verify-6-6` | `b200e9bba97281f4372a76b7819d2b3e2ab4c9058c16af2ba8b4ca138d2e2bd3` |
| `summary__phone-390-light-en-reduced.png` | `verify-5-6` | `2e075866499ed73cdbb1bbbe96d28dca2ad83b214d78a38b41e268506e394309` |
| `summary__phone-390-light-en.png` | `verify-5-6` | `2e075866499ed73cdbb1bbbe96d28dca2ad83b214d78a38b41e268506e394309` |
| `summary__phone-390-light-pt.png` | `verify-1-6` | `119cf04d1396fe7b5a16973be9a7ec7ce16f7740308e5fa412a63a87540d3274` |
| `summary__phone-430-light-en.png` | `verify-3-6` | `95297c008f38891174007b23012af7ea96bf4558a94a774f11f4b597b3a20129` |
