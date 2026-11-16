// Writes public/pt/mcp-identity.html and public/en/mcp-identity.html: how vibebook tells an MCP server who is calling
// (X-Vibebook-Identity, src/mcpauth.ts), how to check it safely, and a prompt to paste into the server owner's Claude.
// Edit the copy here, then `bun scripts/mcp-identity.ts`. Keep it true to src/mcpauth.ts and src/mcpconn.ts; the
// verification snippet was checked against real tokens (valid passes; wrong aud, wrong iss, tampered signature fail).
import { writeFileSync } from "node:fs";

type Lang = "pt" | "en";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CODE = `import { createRemoteJWKSet, jwtVerify } from "jose";

// vibebook's public keys, cached; an unknown kid refetches at most once a minute.
const VIBEBOOK_KEYS = createRemoteJWKSet(new URL("https://vibebook.dev/.well-known/jwks.json"), {
  cacheMaxAge: 60 * 60 * 1000,
  cooldownDuration: 60 * 1000,
});

// MY_URL = this server's MCP URL exactly as it was connected in vibebook (scheme, host and path).
export async function vibebookIdentity(req: Request, MY_URL: string) {
  const token = req.headers.get("x-vibebook-identity");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, VIBEBOOK_KEYS, {
      issuer: "https://vibebook.dev",
      audience: MY_URL,
      algorithms: ["EdDSA"],
      clockTolerance: 30,
    });
    return { email: String(payload.email ?? payload.sub), room: String(payload.room ?? "") };
  } catch {
    return null; // bad signature, wrong iss/aud, expired: not vibebook
  }
}`;

const PROMPT: Record<Lang, string> = {
  pt: `Quero que este servidor MCP aceite chamadas do vibebook (vibebook.dev) sabendo quem está chamando, sem token colado.

Como o vibebook chama: toda requisição (inclusive o initialize) traz o header X-Vibebook-Identity com um JWT assinado em EdDSA (Ed25519), válido por 5 minutos. Claims: iss = "https://vibebook.dev"; sub e email = o email da pessoa; room = o id da sala; aud = a URL deste MCP exatamente como foi conectada no vibebook; iat, exp, jti. Chaves públicas: https://vibebook.dev/.well-known/jwks.json (o header traz kid).

Faça assim:
1. Uma função vibebookIdentity(req) que lê o header e verifica com a lib jose: createRemoteJWKSet na URL da JWKS (cache de 1 h, nova busca por kid desconhecido no máximo 1 vez por minuto) e jwtVerify com issuer "https://vibebook.dev", audience = a URL pública exata deste MCP, algorithms ["EdDSA"], clockTolerance 30 s. Qualquer erro = sem identidade.
2. Sem identidade válida: responda 401 (ou só a parte pública, se existir). Nunca confie num email que venha do corpo, de outro header ou de argumento de tool.
3. Com identidade: mapeie email (e, se fizer sentido, room) para as permissões que já existem aqui. Email desconhecido = 403 ou visão pública. A identidade diz quem é; quem decide o que pode é este servidor.
4. Tools que escrevem: guarde os jti vistos até o exp e recuse um repetido.
5. Testes: token válido passa; aud de outra URL, iss diferente, assinatura alterada, token expirado e header ausente falham.

Não mude o comportamento pra quem não vem do vibebook.`,
  en: `I want this MCP server to accept calls from vibebook (vibebook.dev) knowing who is calling, with no pasted token.

How vibebook calls: every request (initialize included) carries the header X-Vibebook-Identity, an EdDSA (Ed25519) signed JWT valid for 5 minutes. Claims: iss = "https://vibebook.dev"; sub and email = the person's email; room = the room id; aud = this MCP's URL exactly as it was connected in vibebook; iat, exp, jti. Public keys: https://vibebook.dev/.well-known/jwks.json (the header carries kid).

Do this:
1. A function vibebookIdentity(req) that reads the header and verifies it with the jose library: createRemoteJWKSet on the JWKS URL (1 h cache, refetch for an unknown kid at most once a minute) and jwtVerify with issuer "https://vibebook.dev", audience = this MCP's exact public URL, algorithms ["EdDSA"], clockTolerance 30 s. Any error = no identity.
2. No valid identity: answer 401 (or only the public part, if there is one). Never trust an email that comes from the body, another header or a tool argument.
3. With an identity: map email (and room, if it makes sense) to the permissions that already exist here. Unknown email = 403 or the public view. The identity says who it is; this server decides what they may do.
4. Tools that write: keep the jti values seen until their exp and refuse a repeat.
5. Tests: a valid token passes; aud of another URL, a different iss, an altered signature, an expired token and a missing header fail.

Don't change the behavior for callers that don't come from vibebook.`,
};

const T = {
  title: { pt: "Identidade assinada: como seu MCP sabe quem chama", en: "Signed identity: how your MCP knows who's calling" },
  desc: { pt: "Toda chamada do vibebook a um servidor MCP leva X-Vibebook-Identity, um JWT EdDSA de 5 minutos. Como funciona, como verificar com segurança e um prompt pronto pro seu Claude.", en: "Every call vibebook makes to an MCP server carries X-Vibebook-Identity, a 5-minute EdDSA JWT. How it works, how to check it safely, and a ready prompt for your Claude." },
  h1: { pt: "Seu MCP sabe quem chama.<br /><em>Sem ninguém colar token.</em>", en: "Your MCP knows who's calling.<br /><em>Without anyone pasting a token.</em>" },
  lede: {
    pt: "Quando uma sala do vibebook se liga ao seu servidor MCP (aba <b>Apps</b> ou <code>connect_mcp</code>), cada chamada diz quem está olhando e de qual sala, assinada pelo vibebook. Seu servidor confere a assinatura e decide o que essa pessoa pode fazer.",
    en: "When a vibebook room connects to your MCP server (the <b>Apps</b> tab or <code>connect_mcp</code>), every call says who is looking and from which room, signed by vibebook. Your server checks the signature and decides what that person may do.",
  },
  how: { pt: "Como funciona", en: "How it works" },
  howP: {
    pt: "Toda requisição do vibebook ao seu MCP, inclusive o <code>initialize</code>, traz o header <code>X-Vibebook-Identity</code>: um JWT assinado em EdDSA (Ed25519), válido por 5 minutos.",
    en: "Every request vibebook sends your MCP, <code>initialize</code> included, carries the header <code>X-Vibebook-Identity</code>: an EdDSA (Ed25519) signed JWT, valid for 5 minutes.",
  },
  claims: {
    pt: [
      ["<code>iss</code>", "<code>https://vibebook.dev</code>"],
      ["<code>sub</code>, <code>email</code>", "o email de quem está olhando (ou de quem é o Claude que chamou)"],
      ["<code>room</code>", "o id da sala de onde veio a chamada"],
      ["<code>aud</code>", "a URL do seu MCP exatamente como foi conectada no vibebook"],
      ["<code>iat</code>, <code>exp</code>", "emitido agora, vence em 5 minutos"],
      ["<code>jti</code>", "id aleatório de cada token"],
      ["header", "<code>alg: EdDSA</code> e o <code>kid</code> da chave"],
    ],
    en: [
      ["<code>iss</code>", "<code>https://vibebook.dev</code>"],
      ["<code>sub</code>, <code>email</code>", "the email of whoever is looking (or whose Claude called)"],
      ["<code>room</code>", "the id of the room the call came from"],
      ["<code>aud</code>", "your MCP's URL exactly as it was connected in vibebook"],
      ["<code>iat</code>, <code>exp</code>", "issued now, expires in 5 minutes"],
      ["<code>jti</code>", "a random id per token"],
      ["header", "<code>alg: EdDSA</code> and the key's <code>kid</code>"],
    ],
  },
  keys: {
    pt: 'A chave pública está em <a href="https://vibebook.dev/.well-known/jwks.json">vibebook.dev/.well-known/jwks.json</a>. A privada nunca sai do vibebook.',
    en: 'The public key is at <a href="https://vibebook.dev/.well-known/jwks.json">vibebook.dev/.well-known/jwks.json</a>. The private one never leaves vibebook.',
  },
  login: {
    pt: "<b>Seu servidor também tem login próprio?</b> Responda 401 com o <code>WWW-Authenticate</code> do MCP. Cada pessoa entra uma vez pela aba Apps, e o vibebook segue o caminho padrão: RFC 9728 (resource metadata) → RFC 8414 (authorization server) → registro dinâmico de cliente → PKCE S256. O vibebook guarda esse acesso selado, por pessoa, e manda <code>Authorization: Bearer</code> junto com a identidade nas chamadas seguintes. Ninguém cola token, e nada disso chega ao navegador, a um iframe ou a um Claude.",
    en: "<b>Does your server have its own login too?</b> Answer 401 with the MCP <code>WWW-Authenticate</code>. Each person signs in once from the Apps tab, and vibebook follows the standard path: RFC 9728 (resource metadata) → RFC 8414 (authorization server) → dynamic client registration → PKCE S256. vibebook keeps that grant sealed, per person, and sends <code>Authorization: Bearer</code> along with the identity on later calls. Nobody pastes a token, and none of it reaches a browser, an iframe or a Claude.",
  },
  safe: { pt: "Como aceitar com segurança", en: "How to accept it safely" },
  checks: {
    pt: [
      "<b>Verifique a assinatura</b> com as chaves da JWKS. Guarde em cache e, pra um <code>kid</code> desconhecido, busque de novo no máximo uma vez por minuto.",
      "<b>Aceite só <code>EdDSA</code></b>; nunca <code>none</code> nem HS*.",
      "<b><code>iss</code></b> igual a <code>https://vibebook.dev</code>, exatamente.",
      "<b><code>aud</code></b> igual à URL do seu próprio MCP, exatamente. Assim um token feito pra outro servidor não serve no seu.",
      "<b><code>exp</code></b> no futuro (até 30 s de folga de relógio).",
      "<b>Depois</b>, mapeie <code>email</code> (e <code>room</code>, se fizer sentido) pras permissões que você já tem. Email desconhecido: 403 ou visão pública.",
      "<b>Sem header válido</b>: 401, ou só o que é público. Nunca confie num email que venha do corpo, de outro header ou de argumento de tool.",
      "<b>Tools que escrevem</b>: guarde os <code>jti</code> vistos até o <code>exp</code> e recuse um repetido.",
    ],
    en: [
      "<b>Verify the signature</b> with the JWKS keys. Cache them and, for an unknown <code>kid</code>, refetch at most once a minute.",
      "<b>Accept only <code>EdDSA</code></b>; never <code>none</code> or HS*.",
      "<b><code>iss</code></b> equals <code>https://vibebook.dev</code>, exactly.",
      "<b><code>aud</code></b> equals your own MCP's URL, exactly. That way a token made for another server is useless on yours.",
      "<b><code>exp</code></b> in the future (up to 30 s of clock leeway).",
      "<b>Then</b> map <code>email</code> (and <code>room</code>, if it makes sense) to the permissions you already have. Unknown email: 403 or the public view.",
      "<b>No valid header</b>: 401, or only what's public. Never trust an email from the body, another header or a tool argument.",
      "<b>Tools that write</b>: keep the <code>jti</code> values seen until their <code>exp</code> and refuse a repeat.",
    ],
  },
  who: { pt: "A identidade diz <b>quem</b> é. <b>O que</b> essa pessoa pode fazer, quem decide é o seu servidor.", en: "The identity says <b>who</b> it is. <b>What</b> that person may do is your server's call." },
  code: { pt: "Em TypeScript, com <code>jose</code>", en: "In TypeScript, with <code>jose</code>" },
  codeNote: { pt: "Conferido contra tokens de verdade do vibebook: o válido passa; <code>aud</code> errado, <code>iss</code> errado e assinatura alterada falham.", en: "Checked against real vibebook tokens: the valid one passes; wrong <code>aud</code>, wrong <code>iss</code> and an altered signature fail." },
  prompt: { pt: "Prompt pronto pro seu Claude", en: "A ready prompt for your Claude" },
  promptP: { pt: "Cole no Claude que cuida do código do seu MCP. Ele implementa a verificação e os testes.", en: "Paste it into the Claude that works on your MCP's code. It writes the check and the tests." },
  copy: { pt: "Copiar", en: "Copy" },
  copyCode: { pt: "Copiar código", en: "Copy code" },
  src: { pt: "Confira no código", en: "Check it in the code" },
  srcL: {
    pt: '<li><a href="https://github.com/decocms/chat/blob/main/src/mcpauth.ts" rel="noopener">src/mcpauth.ts</a>: como o token é feito e o login por pessoa.</li><li><a href="https://github.com/decocms/chat/blob/main/src/mcpconn.ts" rel="noopener">src/mcpconn.ts</a>: onde ele vai em cada chamada.</li>',
    en: '<li><a href="https://github.com/decocms/chat/blob/main/src/mcpauth.ts" rel="noopener">src/mcpauth.ts</a>: how the token is made, and the per-person sign-in.</li><li><a href="https://github.com/decocms/chat/blob/main/src/mcpconn.ts" rel="noopener">src/mcpconn.ts</a>: where it goes on every call.</li>',
  },
  home: { pt: "Início", en: "Home" }, sec: { pt: "Segurança", en: "Security" }, signin: { pt: "Entrar", en: "Sign in" },
};

const LOGO = `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="4" width="22" height="24" rx="5" fill="#fff"/><rect x="7" y="9" width="11" height="3" rx="1.5" fill="#1d5fc4"/><rect x="7" y="15" width="8" height="3" rx="1.5" fill="#1d5fc4"/><circle cx="24" cy="23" r="7" fill="#f2dc4a"/><path d="M24 19.5l1 2.4 2.5 1.1-2.5 1.1-1 2.4-1-2.4-2.5-1.1 2.5-1.1z" fill="#1d5fc4"/></svg>`;

function page(lang: Lang) {
  const o: Lang = lang === "pt" ? "en" : "pt";
  const t = (k: keyof typeof T) => (T[k] as Record<Lang, string>)[lang];
  return `<!doctype html>
<html lang="${lang === "pt" ? "pt-BR" : "en"}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${t("title")}</title>
<meta name="description" content="${esc(t("desc"))}" />
<link rel="canonical" href="https://vibebook.dev/${lang}/mcp-identity" />
<link rel="alternate" hreflang="pt-BR" href="https://vibebook.dev/pt/mcp-identity" />
<link rel="alternate" hreflang="en" href="https://vibebook.dev/en/mcp-identity" />
<meta name="theme-color" content="#0a0d13" />
<meta property="og:title" content="${esc(t("title"))}" />
<meta property="og:description" content="${esc(t("desc"))}" />
<meta property="og:image" content="https://vibebook.dev/og.png" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Caprasimo&family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..700,0..100,0..1&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/site.css" />
</head>
<body>
<nav><div class="w">
  <a class="logo" href="/${lang}" aria-label="vibebook">${LOGO}</a>
  <span class="sp"></span>
  <a class="l" href="/${lang}">${t("home")}</a>
  <a class="l" href="/${lang}/docs">Docs</a>
  <a class="l" href="/${lang}/how-it-works">${t("sec")}</a>
  <a class="l" href="/${o}/mcp-identity" hreflang="${o}" lang="${o}">${o.toUpperCase()}</a>
  <a class="btn sm" href="/app">${t("signin")}</a>
</div></nav>
<header class="top"><div class="w">
  <h1>${t("h1")}</h1>
  <p class="lede">${t("lede")}</p>
</div></header>

<main><div class="w">

  <section>
    <h2>${t("how")}</h2>
    <p>${t("howP")}</p>
    <table class="claims">${T.claims[lang].map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
    <p>${t("keys")}</p>
    <p>${t("login")}</p>
  </section>

  <section>
    <h2>${t("safe")}</h2>
    <ul class="list">${T.checks[lang].map((x) => `<li>${x}</li>`).join("")}</ul>
    <p>${t("who")}</p>
    <h3>${t("code")}</h3>
    <div class="codebox"><button type="button" class="btn sm copy" data-copy-from="code-ts">${t("copyCode")}</button><pre id="code-ts">${esc(CODE)}</pre></div>
    <p class="note">${t("codeNote")}</p>
  </section>

  <section>
    <h2>${t("prompt")}</h2>
    <p>${t("promptP")}</p>
    <div class="codebox"><button type="button" class="btn btn-sun sm copy" data-copy-from="prompt">${t("copy")}</button><pre id="prompt">${esc(PROMPT[lang])}</pre></div>
  </section>

  <section>
    <h2>${t("src")}</h2>
    <ul class="list">${t("srcL")}</ul>
  </section>

</div></main>

<footer><div class="w"><span>vibebook · ${lang === "pt" ? "feito com ✨ no Rio de Janeiro por" : "made with ✨ in Rio de Janeiro by"} <a href="https://vibegui.com" rel="noopener">vibegui</a></span><span><a href="https://github.com/decocms/chat" rel="noopener">GitHub</a></span></div></footer>
<script>
document.querySelectorAll(".copy").forEach((b) => b.addEventListener("click", () => {
  navigator.clipboard?.writeText(document.getElementById(b.dataset.copyFrom)?.textContent ?? "");
  const t = b.textContent; b.textContent = "✓"; setTimeout(() => (b.textContent = t), 1200);
}));
</script>
</body>
</html>
`;
}

for (const lang of ["pt", "en"] as const) writeFileSync(`public/${lang}/mcp-identity.html`, page(lang));
console.log("wrote public/{pt,en}/mcp-identity.html");
