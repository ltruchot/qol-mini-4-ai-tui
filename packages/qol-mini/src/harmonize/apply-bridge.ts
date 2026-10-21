import { BRIDGE_IMPORT } from "../core/harmonize/rules.ts";
import type { UndoOp } from "../core/schema/harmony.ts";
import { saveSlot } from "./backup.ts";
import type { Slots } from "./apply-intents.ts";
import type { Intent } from "./plan-types.ts";
import { link, put } from "./write.ts";

// The bridge CLAUDE.md, and the symlink where the platform allows one: a
// refused symlink becomes the bridge with a warning, Windows refuses symlinks
// without Developer Mode.
export async function bridge(
  root: string,
  file: string,
  rel: string,
  slots: Slots,
): Promise<UndoOp[]> {
  slots.next += 1;
  const had = await saveSlot(root, slots.next, file);
  await put(file, Buffer.from(BRIDGE_IMPORT));
  return had ? [{ op: "write", path: rel, slot: slots.next }] : [{ op: "write", path: rel }];
}

export async function bridgeOrLink(
  root: string,
  file: string,
  intent: Intent,
  slots: Slots,
): Promise<{ ops: UndoOp[]; warn: string }> {
  try {
    await link(intent.to ?? "AGENTS.md", file);
    return { ops: [{ op: "symlink", path: intent.path, to: intent.to }], warn: "" };
  } catch {
    return {
      ops: await bridge(root, file, intent.path, slots),
      warn: "symlink refused: wrote the @AGENTS.md bridge instead",
    };
  }
}
