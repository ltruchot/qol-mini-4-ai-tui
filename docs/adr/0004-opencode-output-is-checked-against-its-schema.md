# 0004 — OpenCode output is checked against its schema

## Context

- OpenCode 2.1 decodes its config with Effect schemas published as
  `@opencode/schema`. A markdown command or agent that fails to decode is
  dropped on load with no message; a config key in the wrong shape is
  dropped with a diagnostic only the debug output shows.
- OpenCode 2.1 reads two shapes for most config: a legacy one (`permission`
  map, flat `mcp.<name>`, `tools`) migrated on load, and the native one
  (`permissions` array, `mcp.servers`). Only the native shapes are in
  `@opencode/schema`; the legacy migration lives in `@opencode/core`, which
  carries native binaries.
- Precedence differs: Claude Code applies deny, then ask, then allow;
  OpenCode applies the last matching rule, legacy rules before native ones,
  an agent's rules after the project's.

## Decision

- The harmonizer writes the native 2.1 shapes only, and reads both.
- The test suite decodes every generated file with `@opencode/schema`,
  pinned in the catalog as a dev dependency: the same code OpenCode runs.
- Order encodes Claude Code's precedence: allow, ask, deny; converted rules
  before the user's native rules; an agent allowlist restates the project's
  ask and deny rules after its own.
- A user JSON file is patched in place, never reserialized.

## Consequences

- An OpenCode release that changes a shape fails the suite once the pin
  moves: bump `@opencode/schema` with OpenCode.
- The legacy migration is not under test: a repo whose rules live in the
  legacy map is read through a copy of OpenCode's normalization
  (`src/core/harmonize/perm-read.ts`), verified by hand against
  `config/normalize.ts` of OpenCode 2.1.2.
- Verified on OpenCode 2.1.2: the converted config, agent and command load;
  a `permission` array and a command with `model: haiku` are dropped.
