/** Who a picture belongs to: emails compare trimmed and lowercased (`Ana@X.com` is `ana@x.com`), as the server stores
 *  them; also the seed of the face drawn without a picture. */
export const avatarKey = (email: string) => email.trim().toLowerCase();
/** A person's picture (src/index.ts `/api/avatar/:email`) at the version that keeps a changed one from being cached;
 *  undefined without a version: the face their email draws is shown instead. The one place this URL is built. */
export const avatarUrl = (email: string, version: number | null | undefined) =>
  version
    ? `/api/avatar/${encodeURIComponent(avatarKey(email))}?v=${version}`
    : undefined;
