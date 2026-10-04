# TTime 0.9.15 recovery plan

This branch uses the last public source tree as the maintainable base and reconstructs useful
0.9.15 behavior into normal TypeScript/Vue source.

## Ground rules

- Keep the existing desktop workflow: selection translation, screenshot translation/OCR,
  multi-provider results, pin/always-on-top, local history, and global shortcuts.
- Prefer local and BYOK providers.
- Remove account/member/cloud-sync product plumbing as it becomes unnecessary.
- Use the 0.9.15 binary only to understand behavior, interfaces, data structures, model choices,
  and regressions. Reimplement recovered functionality in maintainable source.
- Do not commit extracted .jsc bytecode or server-side code.
- Replace server-only OCR paragraph merge with a local implementation.

## Recovery order

1. Reproducible Windows build in GitHub Actions.
2. Remove account/member/cloud-sync dependencies while preserving local config/history.
3. Recover 0.9.15 AI provider behavior:
   - OpenAI-compatible endpoint/model
   - multiple OpenAI instances
   - local custom system/user prompts
   - DeepSeek, Gemini, and Zhipu
4. Recover the modern OCR pipeline:
   - PP-OCRv4 / multilingual model selection
   - Chinese+English mixed recognition
   - structured line/bounding-box output
5. Implement local paragraph reconstruction from OCR geometry.
6. Fix user-visible 0.9.15 regressions and simplify the settings/UI.

## 0.9.15 evidence already mapped

The installed 0.9.15 app contains V8 cached bytecode for Electron main/preload code, while much of
the renderer remains ordinary bundled JavaScript. The highest-effort component is
`out/main/index.jsc`; `out/preload/textOcr.jsc` exposes enough symbols and model names to
reimplement the OCR pipeline against PaddleOCR/RapidOCR rather than reproducing the bytecode.

Observed OCR model families include PP-OCRv4 Chinese/English recognizers, multilingual/Latin/
Japanese/Korean/Traditional-Chinese models, orientation classification, and PP-StructureV2-related
layout support. The client also retains structured OCR line/box information. TTime's later
"segment merge" feature calls a server endpoint, so this branch will implement that behavior
locally from geometry instead.

## Branch policy

`reverse-0915` is the integration branch until the recovered build is stable enough to replace
the public baseline. Each recovery step should remain independently buildable.
