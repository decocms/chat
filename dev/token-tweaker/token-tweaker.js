// Token tweaker: a local design tool (never shipped). It overrides two semantic tokens on :root, live:
// --vb-composer (the message box, ChatField) and --vb-user-area (the sidebar foot and the call panel).
// Loaded only by the local build (dev/token-tweaker/inject.ts adds it to dist/index.html), and shown only on
// localhost/127.0.0.1 or with ?tokens=1. Choices are per theme and stay in localStorage.

const TARGETS = [
  {
    key: "composer",
    variable: "--vb-composer",
    label: "Caixa de mensagem",
    hint: "ChatField (salas e Home)",
    fallback: { token: "--vb-muted", alpha: 100 },
  },
  {
    key: "userArea",
    variable: "--vb-user-area",
    label: "Área do usuário",
    hint: "Pé da sidebar e painel da chamada",
    fallback: { token: "--vb-sidebar-accent", alpha: 50 },
  },
];

// Surfaces first; every other --vb-* color after them.
const PREFERRED = [
  "--vb-background",
  "--vb-card",
  "--vb-popover",
  "--vb-muted",
  "--vb-secondary",
  "--vb-secondary-hover",
  "--vb-accent",
  "--vb-sidebar",
  "--vb-sidebar-accent",
  "--vb-input",
  "--vb-border",
  "--vb-sidebar-border",
  "--vb-highlight",
  "--vb-glass",
  "--vb-glass-raised",
];

const STORE = "vb-token-tweaker";
const OWN = new Set(TARGETS.map((target) => target.variable));

const host = location.hostname;
const local =
  host === "localhost" ||
  host === "127.0.0.1" ||
  host === "[::1]" ||
  host.endsWith(".localhost");
const asked = new URLSearchParams(location.search).get("tokens");

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) || "{}");
    return {
      open: Boolean(parsed.open),
      theme: parsed.theme ?? null,
      values: parsed.values ?? {},
    };
  } catch {
    return { open: false, theme: null, values: {} };
  }
}

function save(state) {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
  } catch {
    /* private window: the session still works */
  }
}

/** Every --vb-* color declared on :root in the app's stylesheet, read from the CSSOM. */
function colorTokens() {
  const names = new Set();
  const visit = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules) visit(rule.cssRules);
      if (!rule.style || !/(^|,)\s*:root\b/.test(rule.selectorText || ""))
        continue;
      for (const prop of rule.style)
        if (prop.startsWith("--vb-") && !OWN.has(prop)) names.add(prop);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      /* cross-origin sheet */
    }
  }
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.append(probe);
  const colors = [...names].filter((name) => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    if (!raw || !CSS.supports("color", raw)) return false;
    probe.style.color = "";
    probe.style.color = `var(${name})`;
    return probe.style.color !== "";
  });
  probe.remove();
  const rank = (name) => {
    const at = PREFERRED.indexOf(name);
    return at === -1 ? PREFERRED.length : at;
  };
  return colors.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function effectiveTheme() {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function cssValue(choice) {
  if (!choice) return null;
  if (choice.kind === "custom") return choice.custom || null;
  const alpha = Number(choice.alpha ?? 100);
  return alpha >= 100
    ? `var(${choice.token})`
    : `color-mix(in oklab, var(${choice.token}) ${alpha}%, transparent)`;
}

function defaultValue(target) {
  return cssValue({ kind: "token", ...target.fallback });
}

function start(openOnLoad) {
  const state = load();
  if (openOnLoad) state.open = true;
  if (state.theme)
    document.documentElement.setAttribute("data-theme", state.theme);

  const apply = () => {
    const theme = effectiveTheme();
    for (const target of TARGETS) {
      const value = cssValue(state.values[theme]?.[target.key]);
      if (value)
        document.documentElement.style.setProperty(target.variable, value);
      else document.documentElement.style.removeProperty(target.variable);
    }
  };
  apply();

  const mount = document.createElement("div");
  mount.setAttribute("data-token-tweaker", "");
  const root = mount.attachShadow({ mode: "open" });
  document.body.append(mount);

  let tokens = [];
  let openPicker = null; // `${theme}:${target}` whose token list is open

  const persist = () => {
    save(state);
    apply();
    render();
  };

  const choiceFor = (theme, target) =>
    state.values[theme]?.[target.key] ?? null;
  const setChoice = (theme, target, choice) => {
    state.values[theme] ??= {};
    if (choice) state.values[theme][target.key] = choice;
    else delete state.values[theme][target.key];
    persist();
  };

  const css = () => {
    const block = (theme) =>
      TARGETS.map((target) => {
        const value =
          cssValue(choiceFor(theme, target)) ?? defaultValue(target);
        return `  ${target.variable}: ${value};`;
      }).join("\n");
    const dark = block("dark");
    return (
      `:root {\n${block("light")}\n}\n\n:root[data-theme="dark"],\n.dark {\n${dark}\n}\n\n` +
      `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]):not([data-theme="dark"]) {\n` +
      `${dark.replace(/^/gm, "  ")}\n  }\n}\n`
    );
  };

  const hexOf = (value) => {
    // The color input needs #rrggbb: resolve anything (oklch, var()) through a canvas.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const probe = document.createElement("span");
    probe.style.color = value;
    probe.style.display = "none";
    document.body.append(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    context.fillStyle = "#000";
    context.fillStyle = resolved;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === null || value === false) continue;
      if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
      else if (name === "class") node.className = value;
      else if (name === "style") node.style.cssText = value;
      else node.setAttribute(name, value === true ? "" : value);
    }
    for (const child of children.flat())
      if (child !== null && child !== undefined && child !== false)
        node.append(child);
    return node;
  }

  function targetRow(theme, target) {
    const choice = choiceFor(theme, target);
    const id = `${theme}:${target.key}`;
    const live = theme === effectiveTheme();
    const shown = choice?.kind === "token" ? choice.token : null;
    const alpha =
      choice?.kind === "token"
        ? Number(choice.alpha ?? 100)
        : target.fallback.alpha;
    const custom = choice?.kind === "custom" ? choice.custom : "";

    const pickerButton = el(
      "button",
      {
        class: `pick ${choice?.kind === "token" ? "on" : ""}`,
        type: "button",
        disabled: !live,
        title: live ? "" : "Troque para este tema para escolher",
        onclick: () => {
          openPicker = openPicker === id ? null : id;
          render();
        },
      },
      el("span", {
        class: "sw",
        style: `background:var(${shown ?? target.fallback.token})`,
      }),
      el(
        "span",
        { class: "name" },
        shown
          ? shown.replace("--vb-", "")
          : choice?.kind === "custom"
            ? "valor próprio"
            : `padrão (${target.fallback.token.replace("--vb-", "")}${
                target.fallback.alpha < 100 ? ` ${target.fallback.alpha}%` : ""
              })`,
      ),
      el("span", { class: "caret" }, "▾"),
    );

    const list =
      openPicker === id
        ? el(
            "div",
            { class: "list", role: "listbox" },
            tokens.map((token) =>
              el(
                "button",
                {
                  type: "button",
                  class: `opt ${token === shown ? "on" : ""}`,
                  onclick: () => {
                    openPicker = null;
                    setChoice(theme, target, {
                      kind: "token",
                      token,
                      alpha,
                    });
                  },
                },
                el("span", {
                  class: "sw",
                  style: `background:var(${token})`,
                }),
                el("span", { class: "name" }, token.replace("--vb-", "")),
                el(
                  "span",
                  { class: "val" },
                  getComputedStyle(document.documentElement)
                    .getPropertyValue(token)
                    .trim(),
                ),
              ),
            ),
          )
        : null;

    const alphaInput = el("input", {
      type: "range",
      min: "0",
      max: "100",
      step: "5",
      value: String(alpha),
      disabled: !live || choice?.kind !== "token",
      oninput: (event) => {
        const next = { ...choice, alpha: Number(event.target.value) };
        state.values[theme][target.key] = next;
        save(state);
        apply();
        event.target.nextSibling.textContent = `${next.alpha}%`;
      },
      onchange: () => render(),
    });

    const customText = el("input", {
      class: `text ${choice?.kind === "custom" ? "on" : ""}`,
      type: "text",
      placeholder: "#f0efed ou oklch(95% 0 0)",
      value: custom,
      disabled: !live,
      onchange: (event) => {
        const value = event.target.value.trim();
        if (!value) return setChoice(theme, target, null);
        if (!CSS.supports("color", value)) {
          event.target.classList.add("bad");
          return;
        }
        setChoice(theme, target, { kind: "custom", custom: value });
      },
    });
    const colorInput = el("input", {
      type: "color",
      value: hexOf(cssValue(choice) ?? `var(${target.fallback.token})`),
      disabled: !live,
      oninput: (event) => {
        state.values[theme] ??= {};
        state.values[theme][target.key] = {
          kind: "custom",
          custom: event.target.value,
        };
        customText.value = event.target.value;
        save(state);
        apply();
      },
      onchange: () => render(),
    });

    return el(
      "div",
      { class: `target ${live ? "" : "off"}` },
      el(
        "div",
        { class: "head" },
        el("strong", {}, target.label),
        el("span", { class: "hint" }, target.hint),
        choice
          ? el(
              "button",
              {
                type: "button",
                class: "link",
                disabled: !live,
                onclick: () => setChoice(theme, target, null),
              },
              "padrão",
            )
          : null,
      ),
      el(
        "label",
        { class: "row" },
        el("span", { class: "lab" }, "Token"),
        pickerButton,
      ),
      list,
      el(
        "label",
        { class: "row" },
        el("span", { class: "lab" }, "Opacidade"),
        alphaInput,
        el("span", { class: "num" }, `${alpha}%`),
      ),
      el(
        "label",
        { class: "row" },
        el("span", { class: "lab" }, "Próprio"),
        colorInput,
        customText,
      ),
    );
  }

  function render() {
    tokens = tokens.length ? tokens : colorTokens();
    const theme = effectiveTheme();
    root.replaceChildren(
      el("style", {}, STYLES),
      state.open
        ? el(
            "section",
            { class: "panel", "aria-label": "Token tweaker" },
            el(
              "header",
              {},
              el("strong", {}, "Tokens"),
              el(
                "div",
                { class: "seg" },
                ["light", "dark"].map((name) =>
                  el(
                    "button",
                    {
                      type: "button",
                      class: theme === name ? "on" : "",
                      onclick: () => {
                        state.theme = name;
                        document.documentElement.setAttribute(
                          "data-theme",
                          name,
                        );
                        openPicker = null;
                        persist();
                      },
                    },
                    name === "light" ? "Claro" : "Escuro",
                  ),
                ),
              ),
              el(
                "button",
                {
                  type: "button",
                  class: "x",
                  "aria-label": "Fechar",
                  onclick: () => {
                    state.open = false;
                    openPicker = null;
                    persist();
                  },
                },
                "×",
              ),
            ),
            el(
              "p",
              { class: "note" },
              `Editando o tema ${theme === "dark" ? "escuro" : "claro"}. Cada tema guarda sua escolha.`,
            ),
            TARGETS.map((target) => targetRow(theme, target)),
            el(
              "footer",
              {},
              el(
                "button",
                {
                  type: "button",
                  class: "primary",
                  onclick: async (event) => {
                    const text = css();
                    try {
                      await navigator.clipboard.writeText(text);
                      event.target.textContent = "Copiado";
                    } catch {
                      event.target.textContent = "Veja abaixo";
                    }
                    output.value = text;
                    output.hidden = false;
                    setTimeout(
                      () => (event.target.textContent = "Copiar CSS"),
                      1500,
                    );
                  },
                },
                "Copiar CSS",
              ),
              el(
                "button",
                {
                  type: "button",
                  onclick: () => {
                    state.values = {};
                    openPicker = null;
                    persist();
                  },
                },
                "Resetar",
              ),
            ),
            (output = el("textarea", {
              class: "out",
              readonly: true,
              hidden: true,
              rows: "9",
            })),
          )
        : el(
            "button",
            {
              type: "button",
              class: "pill",
              onclick: () => {
                state.open = true;
                persist();
              },
            },
            el("span", { class: "dot" }),
            "Tokens",
          ),
    );
  }
  let output;

  // The app may set data-theme itself (settings, system changes): follow it.
  new MutationObserver(() => {
    apply();
    render();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "class"],
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    apply();
    render();
  });
  render();
}

const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Inter var", Inter, ui-sans-serif, system-ui, sans-serif; }
button, input, textarea { font: inherit; color: inherit; }
.pill, .panel { position: fixed; z-index: 2147483000; right: 16px; top: 16px; }
.pill {
  display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px; cursor: pointer;
  border: 1px solid var(--vb-border); background: var(--vb-popover); color: var(--vb-foreground); font-size: 12px; font-weight: 600;
  box-shadow: 0 4px 16px -6px rgb(0 0 0 / .25);
}
.dot { width: 8px; height: 8px; border-radius: 999px; background: var(--vb-composer); box-shadow: 0 0 0 1px var(--vb-foreground); }
.panel {
  width: 340px; max-height: calc(100vh - 32px); overflow: auto; padding: 12px; border-radius: 14px;
  border: 1px solid var(--vb-border); background: var(--vb-popover); color: var(--vb-foreground); font-size: 12px;
  box-shadow: 0 16px 48px -12px rgb(0 0 0 / .35);
}
header { display: flex; align-items: center; gap: 8px; }
header strong { font-size: 13px; flex: 1; }
.seg { display: flex; padding: 2px; border-radius: 8px; background: var(--vb-muted); }
.seg button { border: 0; background: transparent; padding: 4px 10px; border-radius: 6px; cursor: pointer; color: var(--vb-muted-foreground); }
.seg button.on { background: var(--vb-popover); color: var(--vb-foreground); box-shadow: 0 1px 2px rgb(0 0 0 / .15); }
.x { border: 0; background: transparent; font-size: 18px; line-height: 1; cursor: pointer; color: var(--vb-muted-foreground); padding: 0 4px; }
.note { margin: 8px 0 4px; color: var(--vb-muted-foreground); }
.target { border-top: 1px solid var(--vb-border); padding: 10px 0 6px; }
.target.off { opacity: .5; }
.head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
.head strong { font-size: 12px; }
.hint { color: var(--vb-muted-foreground); flex: 1; }
.link { border: 0; background: transparent; color: var(--vb-link); cursor: pointer; padding: 0; }
.row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.lab { width: 64px; flex: none; color: var(--vb-muted-foreground); }
.pick {
  flex: 1; display: flex; align-items: center; gap: 8px; height: 30px; padding: 0 8px; cursor: pointer; text-align: left;
  border: 1px solid var(--vb-border); border-radius: 8px; background: var(--vb-background);
}
.pick.on, .text.on { border-color: var(--vb-foreground); }
.pick .name { flex: 1; }
.caret { color: var(--vb-muted-foreground); }
.sw { width: 18px; height: 18px; flex: none; border-radius: 5px; box-shadow: inset 0 0 0 1px rgb(127 127 127 / .45); }
.list {
  margin: 2px 0 6px 72px; max-height: 240px; overflow: auto; border: 1px solid var(--vb-border); border-radius: 8px;
  background: var(--vb-background); padding: 2px;
}
.opt { display: flex; width: 100%; align-items: center; gap: 8px; padding: 4px 6px; border: 0; border-radius: 6px; background: transparent; cursor: pointer; text-align: left; }
.opt:hover { background: var(--vb-muted); }
.opt.on { background: var(--vb-accent); font-weight: 600; }
.opt .name { flex: 1; }
.opt .val { color: var(--vb-muted-foreground); font-size: 10px; font-family: ui-monospace, monospace; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
input[type="range"] { flex: 1; }
.num { width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
input[type="color"] { width: 30px; height: 30px; padding: 0; border: 1px solid var(--vb-border); border-radius: 8px; background: none; cursor: pointer; flex: none; }
.text { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid var(--vb-border); border-radius: 8px; background: var(--vb-background); font-family: ui-monospace, monospace; font-size: 11px; }
.text.bad { border-color: var(--vb-destructive); }
footer { display: flex; gap: 8px; margin-top: 10px; }
footer button { flex: 1; height: 32px; border-radius: 999px; border: 1px solid var(--vb-border); background: var(--vb-background); cursor: pointer; font-weight: 600; }
footer .primary { background: var(--vb-primary); color: var(--vb-primary-foreground); border-color: transparent; }
.out { width: 100%; margin-top: 8px; padding: 8px; border: 1px solid var(--vb-border); border-radius: 8px; background: var(--vb-background); font-family: ui-monospace, monospace; font-size: 11px; resize: vertical; }
button:disabled, input:disabled { cursor: not-allowed; }
`;

if (local || asked === "1") start(asked === "1");
