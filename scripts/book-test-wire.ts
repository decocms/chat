/**
 * The part of Book.sendTo that the guard tests observe: the JSON frame reaches
 * each socket and is returned. Per-hour byte accounting (ws_bytes) lives in
 * Book.sendTo itself and is not what these fakes check.
 */
export function sendTo(
  to: { send(frame: string): unknown }[],
  data: { t: string },
): string {
  const frame = JSON.stringify(data);
  for (const ws of to) ws.send(frame);
  return frame;
}
