import type { RoomCommand } from "../../shared/commands";
import { receiveRoomMessage, sendRoomCommand } from "./transport";

type Socket = Pick<
  WebSocket,
  "readyState" | "send" | "close" | "onopen" | "onmessage" | "onclose"
>;

/**
 * Send one command to a room you don't have open (the home's 👍 on an ask):
 * open its socket, send the command as a request, wait for the answer, close.
 * Resolves true when the room accepted it; false when it refused, the socket
 * dropped or `timeoutMs` passed. The room answers asks over its socket only
 * (`react` has no HTTP route), so this is the same command the room sends.
 */
export function sendRoomCommandOnce(
  url: string,
  command: RoomCommand,
  options: { createSocket?: (url: string) => Socket; timeoutMs?: number } = {},
): Promise<boolean> {
  const createSocket =
    options.createSocket ?? ((address: string) => new WebSocket(address));
  const id = `once-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise<boolean>((resolve) => {
    let done = false;
    const socket = createSocket(url);
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket.onopen = socket.onmessage = socket.onclose = null;
      socket.close();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), options.timeoutMs ?? 8000);
    socket.onopen = () => {
      if (!sendRoomCommand(socket, command, id)) finish(false);
    };
    socket.onmessage = (message) => {
      try {
        const received = receiveRoomMessage(message.data);
        if (received.kind === "response" && received.id === id)
          finish(received.outcome.ok);
      } catch {
        /* Not ours or not readable: keep waiting for the answer. */
      }
    };
    socket.onclose = () => finish(false);
  });
}
