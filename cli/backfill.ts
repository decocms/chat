// Backfill of a machine's older Claude Code token use (Gui #3646): the profile's live counter (x-vibebook-usage) only
// sees sessions from CLI 1.7.6 on. Once per machine the CLI reads every transcript in ~/.claude/projects, sums each
// model call's tokens (input, cache reads and writes, output; a call split over several lines with one message id
// counts once) by the UTC day of the entry, and sends the days with the usage_backfill tool. It counts all Claude Code
// use on the machine, not only sessions in deco.chat rooms. Sessions the live counter already reported are skipped
// (it keeps ~/.vibebook/usage/<session>.json); the ones scanned get that file at the scanned offset with total 0, so
// the live counter only adds what they write afterwards. Streamed line by line: transcripts reach GBs.
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

export type Scan = {
  days: Map<string, number>;
  sessions: { sid: string; bytes: number; last: string }[];
};

/** Sum the tokens of every transcript under `root` (one folder per project, `<session>.jsonl` inside), skipping
 *  sessions in `skip`. Days are UTC (YYYY-MM-DD) from each entry's timestamp, else the file's mtime. */
export async function scanTranscripts(
  root: string,
  skip: (sid: string) => boolean,
): Promise<Scan> {
  const days = new Map<string, number>();
  const sessions: Scan["sessions"] = [];
  if (!existsSync(root)) return { days, sessions };
  // <project>/<session>.jsonl, and the subagents a session ran (<project>/<session>/subagents/<agent>.jsonl): they
  // spend tokens too, and the live counter never sees them.
  const files: string[] = [];
  for (const dir of readdirSync(root)) {
    try {
      for (const f of readdirSync(join(root, dir))) {
        if (f.endsWith(".jsonl")) files.push(join(root, dir, f));
        else if (existsSync(join(root, dir, f, "subagents")))
          for (const g of readdirSync(join(root, dir, f, "subagents")))
            if (g.endsWith(".jsonl"))
              files.push(join(root, dir, f, "subagents", g));
      }
    } catch {}
  }
  {
    for (const path of files) {
      const sid = path.slice(path.lastIndexOf("/") + 1, -6);
      if (!/^[\w-]{8,80}$/.test(sid) || skip(sid)) continue;
      let bytes = 0,
        last = "",
        fallback = "";
      try {
        fallback = new Date(statSync(path).mtimeMs).toISOString().slice(0, 10);
      } catch {
        continue;
      }
      const lines = createInterface({
        input: createReadStream(path, { encoding: "utf8" }),
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        bytes += Buffer.byteLength(line, "utf8") + 1;
        if (!line.includes('"usage"')) continue;
        try {
          const e = JSON.parse(line);
          const m = e?.message,
            u = m?.usage;
          if (!u || (m.id && m.id === last)) continue;
          last = m.id ?? "";
          const n =
            (u.input_tokens || 0) +
            (u.output_tokens || 0) +
            (u.cache_read_input_tokens || 0) +
            (u.cache_creation_input_tokens || 0);
          if (!(n > 0)) continue;
          const day =
            typeof e.timestamp === "string" &&
            /^\d{4}-\d{2}-\d{2}T/.test(e.timestamp)
              ? new Date(e.timestamp).toISOString().slice(0, 10)
              : fallback;
          days.set(day, (days.get(day) ?? 0) + n);
        } catch {}
      }
      sessions.push({ sid, bytes, last });
    }
  }
  return { days, sessions };
}
