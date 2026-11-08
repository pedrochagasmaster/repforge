# Taurifer iPhone Lab

An isolated WKWebView experiment that loads https://taurifer.com/ with persistent on-device WebKit storage. It does not alter the production PWA or use FairPlay decryption. PostHog is opted out inside this WebView; Cloudflare traffic may still count.

## No-Mac build and installation

Pushes to this branch compile an unsigned IPA using GitHub's hosted macOS runner:
https://github.com/pedrochagasmaster/repforge/actions/workflows/ios-wrapper-spike.yml

Open the successful workflow run, download the TauriferLab-unsigned-IPA artifact and extract the IPA from its ZIP. On a Windows PC, install Sideloadly from https://sideloadly.io/, connect and trust your iPhone via USB, select the IPA, and sign/sideload using your free Apple Account. Enable Developer Mode on the iPhone when prompted. Free signing expires in seven days. Refresh using the same account and bundle ID; avoid uninstalling because that may delete WebView data.

Linux users can evaluate SideStore (https://docs.sidestore.io/docs/installation/prerequisites). This route is not verified for this IPA.

## Test plan

Use dummy workouts, not production data. The WebView has separate localStorage and IndexedDB from Safari/PWA. Check launch, logging, draft persistence, forced-restart restoration, offline behavior, imports/exports, links, timer and keyboard UX. The remote app requires an initial online load; native haptics, notifications, HealthKit, StoreKit and universal links are not implemented. The successful cloud build does not prove device behavior.

See docs/business-product-thesis.md and docs/adr/0010-product-business-thesis-and-validation-sequencing.md. Native commercialization remains evidence-gated.
