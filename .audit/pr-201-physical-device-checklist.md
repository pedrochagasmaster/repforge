# PR #201 physical-device validation checklist

Run this checklist on the exact PR #201 release build. Record `PASS` or `FAIL`
for every item. Add the device, OS version, browser version, build or commit,
and a short note for each failure.

## Run record

| Field | iOS | Android |
|---|---|---|
| Device |  |  |
| OS version |  |  |
| Browser version | Safari | Chrome |
| Installed app | Home Screen PWA | Installed PWA |
| Build or commit |  |  |
| Tester and date |  |  |

## iOS real iPhone

Test in Safari and in the installed Home Screen PWA. Enable VoiceOver for the
accessibility pass.

- [ ] PASS / FAIL: first run presents the install and program choices without
  claiming an install that did not occur.
- [ ] PASS / FAIL: Recommend reaches the generated result and common preview.
- [ ] PASS / FAIL: Edit before using changes the draft and does not activate it.
- [ ] PASS / FAIL: explicit activation installs the reviewed program.
- [ ] PASS / FAIL: replacing an existing program explains archival, archives an
  outgoing used program once when appropriate, and preserves workout history.
- [ ] PASS / FAIL: incomplete Build can be saved and resumed, and cannot be
  activated.
- [ ] PASS / FAIL: Import reaches review before activation.
- [ ] PASS / FAIL: Shared setup works when practical, including its consent
  gate.
- [ ] PASS / FAIL: reload and resume preserve the expected draft or active
  program.
- [ ] PASS / FAIL: after installation, offline boot opens the cached app.
- [ ] PASS / FAIL: Dynamic Type or large text keeps controls visible and
  unclipped.
- [ ] PASS / FAIL: keyboard and text-input interactions do not hide the active
  field or action.
- [ ] PASS / FAIL: Back and Cancel follow the visible keep, discard, or leave
  choice.
- [ ] PASS / FAIL: VoiceOver reaches controls in order and announces headings,
  selected states, disabled reasons, validation errors, and activation status.
- [ ] PASS / FAIL: no control is clipped, obscured, or unreachable.

## Android real phone

Test in Chrome and in the installed PWA. Enable TalkBack for the accessibility
pass.

- [ ] PASS / FAIL: first run presents the install and program choices without
  claiming an install that did not occur.
- [ ] PASS / FAIL: Recommend reaches the generated result and common preview.
- [ ] PASS / FAIL: Edit before using changes the draft and does not activate it.
- [ ] PASS / FAIL: explicit activation installs the reviewed program.
- [ ] PASS / FAIL: replacing an existing program explains archival, archives an
  outgoing used program once when appropriate, and preserves workout history.
- [ ] PASS / FAIL: incomplete Build can be saved and resumed, and cannot be
  activated.
- [ ] PASS / FAIL: Import reaches review before activation.
- [ ] PASS / FAIL: Shared setup works when practical, including its consent
  gate.
- [ ] PASS / FAIL: reload and resume preserve the expected draft or active
  program.
- [ ] PASS / FAIL: after installation, offline boot opens the cached app.
- [ ] PASS / FAIL: text scaling keeps controls visible and unclipped.
- [ ] PASS / FAIL: the Android Back button follows the visible keep, discard,
  or leave choice.
- [ ] PASS / FAIL: keyboard and text-input interactions do not hide the active
  field or action.
- [ ] PASS / FAIL: TalkBack reaches controls in order and announces headings,
  selected states, disabled reasons, validation errors, and activation status.
- [ ] PASS / FAIL: no control is clipped, obscured, or unreachable.

## Result

- iOS: `PASS` / `FAIL`
- Android: `PASS` / `FAIL`
- VoiceOver: `PASS` / `FAIL`
- TalkBack: `PASS` / `FAIL`
- Notes and defect links:
