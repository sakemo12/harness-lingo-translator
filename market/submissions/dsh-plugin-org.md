# dsh-plugin.org (DSH Plugin Hub) submission

The hub crawls every public repository that carries the `dsh-plugin` topic, so the topic is the
submission. The issue is the faster route and gives a human a checklist to review.

## Open the prefilled issue

https://github.com/dshplugin/dsh-plugin-hub/issues/new?title=%5BPlugin%20submission%5D%20sakemo12%2Fharness-lingo-translator%20%E2%80%94%20On-screen%20translation%20for%20the%20DSH%20web%20UI&body=%23%23%23%20Repository%0Ahttps%3A%2F%2Fgithub.com%2Fsakemo12%2Fharness-lingo-translator%0A%0A%23%23%23%20One-line%20value%0AAfter%20installing%2C%20DSH's%20thinking%20and%20replies%20render%20in%20your%20language%20in%20the%20web%20UI%2C%20the%20original%20stays%20one%20hover%20away%2C%20and%20session%20logs%2C%20code%20and%20workspace%20files%20are%20never%20modified.%0A%0A%23%23%23%20Category%0AUI%20%26%20Experience%0A%0A%23%23%23%20Install%20command%0Adsh%20plugin%20--profile%20web%20add%20github%3Asakemo12%2Fharness-lingo-translator%0A(npm%3A%20%60dsh%20plugin%20--profile%20web%20add%20harness-lingo-translator%60%20once%20the%20package%20is%20published)%0A%0A%23%23%23%20Compatibility%0ADSH%20%3E%3D0.2.1-0%20%3C0.3.0%2C%20Node%20%5E22.19.0%20%7C%7C%20%3E%3D24.0.0%2C%20web%20profile%20only%20(the%20client%20bundle%20runs%20in%20the%20browser).%0A%0A%23%23%23%20License%0AApache-2.0%0A%0A%23%23%23%20Screenshots%20%2F%20demo%0A_None%20yet._%0A%0A%23%23%23%20Notes%0AOutbound%20HTTP(S)%20only%20to%20the%20OpenAI-compatible%20endpoint%20you%20configure%20(loopback%20or%20LAN%20by%20default)%20or%20to%20the%20host%20model%20route%3B%20the%20only%20file%20write%20is%20the%20per-workspace%20cache%20under%20~%2F.dsh%2Fcache%2Fharness-lingo-translator%2F.%20Images%2C%20canvas%20and%20PDF%20are%20not%20OCR'd%2C%20and%20a%201.8B%20model%20can%20still%20break%20a%20placeholder%20on%20a%20long%20segment%3B%20a%20failing%20segment%20is%20retried%20at%20most%20three%20times%20and%20then%20left%20in%20the%20original%20language.%0A%0A%23%23%23%20Pre-submission%20checklist%0A-%20%5Bx%5D%20Repository%20is%20public%0A-%20%5B%20%5D%20GitHub%20topic%20%60dsh-plugin%60%20added%0A-%20%5Bx%5D%20README%20includes%20the%20install%20command%0A-%20%5Bx%5D%20Plugin%20exports%20an%20%60apply(ctx)%60%20module%0A-%20%5Bx%5D%20Repository%20root%20includes%20a%20%60package.json%60%0A

## Body

### Repository
https://github.com/sakemo12/harness-lingo-translator

### One-line value
After installing, DSH's thinking and replies render in your language in the web UI, the original stays one hover away, and session logs, code and workspace files are never modified.

### Category
UI & Experience

### Install command
dsh plugin --profile web add github:sakemo12/harness-lingo-translator
(npm: `dsh plugin --profile web add harness-lingo-translator` once the package is published)

### Compatibility
DSH >=0.2.1-0 <0.3.0, Node ^22.19.0 || >=24.0.0, web profile only (the client bundle runs in the browser).

### License
Apache-2.0

### Screenshots / demo
_None yet._

### Notes
Outbound HTTP(S) only to the OpenAI-compatible endpoint you configure (loopback or LAN by default) or to the host model route; the only file write is the per-workspace cache under ~/.dsh/cache/harness-lingo-translator/. Images, canvas and PDF are not OCR'd, and a 1.8B model can still break a placeholder on a long segment; a failing segment is retried at most three times and then left in the original language.

### Pre-submission checklist
- [x] Repository is public
- [ ] GitHub topic `dsh-plugin` added
- [x] README includes the install command
- [x] Plugin exports an `apply(ctx)` module
- [x] Repository root includes a `package.json`
