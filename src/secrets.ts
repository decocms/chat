// Secrets never land in a room. Known key shapes only: a generic entropy check would flag hashes and URLs.
const PATTERNS: [string, RegExp][] = [
  ["chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["chave de API (sk-)", /\bsk-(?:ant-|proj-|or-)?[A-Za-z0-9_-]{20,}/],
  ["chave Stripe", /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/],
  ["token Shopify", /\bshp(?:at|ss|ca|pa)_[a-fA-F0-9]{32}\b/],
  ["token GitHub", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{40,})/],
  ["chave AWS", /\bAKIA[0-9A-Z]{16}\b/],
  ["chave AWS", /\baws_?secret_?access_?key\s*[:=]\s*["']?[A-Za-z0-9/+]{40}\b/i],
  ["chave Google", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["token Slack", /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["senha", /\b(?:password|senha|passwd|secret|api[_-]?key|token)\s*[:=]\s*\S{8,}/i],
];

const EN: Record<string, string> = {
  "chave privada": "private key",
  "chave de API (sk-)": "API key (sk-)",
  "chave Stripe": "Stripe key",
  "token Shopify": "Shopify token",
  "token GitHub": "GitHub token",
  "chave AWS": "AWS key",
  "chave Google": "Google key",
  "token Slack": "Slack token",
  senha: "password",
};
/** A name findSecret returned, in English (for a person who reads English; agents and the app's events keep the Portuguese). */
export const secretName = (name: string) => EN[name] ?? name;

// A key's prefix with its body pushed onto the next line (`AKIA\n…`, `ghp_ …`) still reads as the key.
const SPLIT_PREFIX = /\b(AKIA|gh[pousr]_|github_pat_|sk-|[rs]k_(?:live|test)_|shp(?:at|ss|ca|pa)_|AIza|xox[abprs]-)\s+/g;

/** Name of the first secret shape found in `text`, or null. */
export const findSecret = (text: string) => {
  const joined = text.replace(SPLIT_PREFIX, "$1");
  return PATTERNS.find(([, re]) => re.test(text) || re.test(joined))?.[0] ?? null;
};

// Env assignments whose name says secret (AWS_SECRET_ACCESS_KEY=…, GITHUB_TOKEN=…), with the name kept.
const SECRET_ASSIGNMENT = /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*)=\S+/gi;
const REDACT_PATTERNS = PATTERNS.map(([, re]) => new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`));

/** Masks every shape findSecret knows (and secret-named env assignments) before text reaches an agent. */
export const redactSecrets = (s: string) =>
  REDACT_PATTERNS.reduce(
    (out, re) => out.replace(re, "[redacted]"),
    s
      .replace(/"(access_token|refresh_token|code|verifier)"\s*:\s*"[^"]*"/g, '"$1":"[redacted]"')
      .replace(SECRET_ASSIGNMENT, "$1=[redacted]"),
  );
