import { notificationOffer } from "../notifications/device";
import { installOffer } from "../pwa/platform";

/**
 * How many rows the user center shows on a phone: a new version, the install
 * offer, the notifications offer, and each invite and message request. The
 * phone's bar shows this number, so a room needs no banner over its chat.
 */
export function userCenterCount(input: {
  update: boolean;
  pwa: Parameters<typeof installOffer>[0] &
    Parameters<typeof notificationOffer>[0];
  me:
    | { invites?: readonly unknown[]; requests: readonly unknown[] }
    | null
    | undefined;
}) {
  return (
    Number(input.update) +
    Number(installOffer(input.pwa)) +
    Number(notificationOffer(input.pwa)) +
    (input.me?.invites?.length ?? 0) +
    (input.me?.requests.length ?? 0)
  );
}
