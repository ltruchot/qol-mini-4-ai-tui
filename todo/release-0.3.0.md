# Release 0.3.0

Everything is on `main`, `vp run ready` green, 96/96. Every live check is
done; the tag is the only step left.

- [x] fixes shipped: `oncePerEvent` dedup, the `kaizen-gated` entry title,
      the resume repaint (`permission.replied`, `form.replied`,
      `form.cancelled`), the refusal's modal and session-routed toast
- [x] live: the release path — `/kaizen` wrote the token, a `/compact`
      through the plugin's entry compacted and consumed it
- [x] live: one reminder per compaction — one `remind-` marker, one
      synthetic message, where the old bytes sent four
- [x] live: the refusal's feedback — a tokenless `/compact` through
      "Compact this session (kaizen-gated)" raised the modal "Compaction
      held back" and no compaction ran; the marker green through the
      resumed run and the attention sounds confirmed with it
- [ ] tag `v0.3.0`, push it, approve the run in the GitHub environment
      `release`
- [ ] if the job refuses trusted publishing after the rename:
      `npm trust github qol-mini --file release.yml --repo
      ltruchot/qol-mini-4-ai-tui --env release --allow-publish`
- [ ] after npm: the other machines move — `git remote set-url origin
      https://github.com/ltruchot/qol-mini-4-ai-tui.git`, then
      `git pull && ./install.sh --replace`, or
      `pnpm dlx qol-mini@latest install --replace`
