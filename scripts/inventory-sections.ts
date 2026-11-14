import { parse as parseHTML, type DefaultTreeAdapterTypes } from "parse5";
import { parse as parseSvelte } from "svelte/compiler";

type Section = { text: string; offset: number };
const executable = (type: string) => {
  const value = type.trim().toLowerCase();
  return (
    value === "" ||
    value === "module" ||
    [
      "text/javascript",
      "application/javascript",
      "text/ecmascript",
      "application/ecmascript",
    ].includes(value.split(";", 1)[0]!.trim())
  );
};

/** Parser-owned ranges preserve original bytes; no regex interpretation of HTML comments/attributes. */
export function inventorySections(full: string, file: string): Section[] {
  const sections: Section[] = [];
  if (file.endsWith(".svelte")) {
    const component = parseSvelte(full, { filename: file, modern: true });
    for (const script of [component.instance, component.module]) {
      if (!script) continue;
      const content = script.content;
      if (
        !("start" in content) ||
        !("end" in content) ||
        typeof content.start !== "number" ||
        typeof content.end !== "number"
      )
        throw new Error(`Missing Svelte script source ranges: ${file}`);
      sections.push({
        text: full.slice(content.start, content.end),
        offset: content.start,
      });
    }
  } else if (file.endsWith(".html")) {
    const document = parseHTML(full, {
      sourceCodeLocationInfo: true,
      scriptingEnabled: true,
    });
    const visit = (node: DefaultTreeAdapterTypes.Node) => {
      if ("tagName" in node && node.tagName === "script") {
        // parse5 applies first-attribute-wins, entity decoding and raw-text parsing.
        const attributes = new Map(
          node.attrs.map((attribute) => [attribute.name, attribute.value]),
        );
        const start = node.sourceCodeLocation?.startTag?.endOffset;
        const end = node.sourceCodeLocation?.endTag?.startOffset;
        if (
          !attributes.has("src") &&
          executable(attributes.get("type") ?? "") &&
          start !== undefined &&
          end !== undefined
        )
          sections.push({ text: full.slice(start, end), offset: start });
      }
      // Inert template.content is deliberately not traversed.
      if ("childNodes" in node)
        for (const child of node.childNodes) visit(child);
    };
    visit(document);
  } else return [{ text: full, offset: 0 }];
  return sections.sort((a, b) => a.offset - b.offset);
}
