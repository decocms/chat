/** Extract executable inline source while retaining offsets into the original HTML/Svelte file. */
export function inventorySections(full: string, file: string) {
  if (!/\.(?:html|svelte)$/.test(file)) return [{ text: full, offset: 0 }];
  const sections: { text: string; offset: number }[] = [];
  for (const match of full.matchAll(
    /<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script\s*>/gi,
  )) {
    const attributes = new Map<string, string>();
    for (const attribute of match[1]!.matchAll(
      /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g,
    ))
      attributes.set(
        attribute[1]!.toLowerCase(),
        attribute[2] ?? attribute[3] ?? attribute[4] ?? "",
      );
    const type = (attributes.get("type") ?? "")
      .trim()
      .toLowerCase()
      .split(";", 1)[0]!
      .trim();
    if (
      attributes.has("src") ||
      ![
        "",
        "module",
        "text/javascript",
        "application/javascript",
        "text/ecmascript",
        "application/ecmascript",
      ].includes(type)
    )
      continue;
    sections.push({
      text: match[2]!,
      offset: match.index + "<script".length + match[1]!.length + 1,
    });
  }
  return sections;
}
