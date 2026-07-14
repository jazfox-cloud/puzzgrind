export const PAGE_SEMANTIC_FIELDS = ["canonical", "ogUrl", "title", "description", "robots", "mainText"];

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["copy", "©"],
  ["gt", ">"],
  ["hellip", "…"],
  ["lt", "<"],
  ["mdash", "—"],
  ["ndash", "–"],
  ["nbsp", " "],
  ["quot", '"'],
  ["reg", "®"],
]);

function decodeEntities(value) {
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/giu, (entity, reference) => {
    if (!reference.startsWith("#")) return NAMED_ENTITIES.get(reference.toLowerCase()) ?? entity;
    const hexadecimal = reference[1]?.toLowerCase() === "x";
    const codePoint = Number.parseInt(reference.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}

function normalizeText(value) {
  return decodeEntities(value).replace(/\s+/gu, " ").trim();
}

function attributes(tag) {
  const opening = tag.match(/^<\s*[^\s/>]+/u)?.[0] ?? "";
  const source = tag.slice(opening.length, tag.endsWith(">") ? -1 : undefined);
  const result = new Map();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu;
  for (const match of source.matchAll(pattern)) {
    result.set(match[1].toLowerCase(), normalizeText(match[2] ?? match[3] ?? match[4] ?? ""));
  }
  return result;
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "giu"))].map(([tag]) => ({ tag, attributes: attributes(tag) }));
}

function exactlyOne(values, label) {
  if (values.length !== 1) throw new Error(`Expected exactly one ${label}, found ${values.length}`);
  if (!values[0]) throw new Error(`${label} is empty`);
  return values[0];
}

function metaValues(html, selector, expected) {
  return tags(html, "meta")
    .filter(({ attributes: values }) => values.get(selector)?.toLowerCase() === expected)
    .map(({ attributes: values }) => values.get("content") ?? "");
}

function extractMainText(html) {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/iu);
  if (!match) throw new Error("Expected a <main> element");
  const visible = match[1]
    .replace(/<([a-z][\w:-]*)\b(?=[^>]*(?:\shidden(?:\s|=|>)|\saria-hidden\s*=\s*(?:"true"|'true'|true)))[^>]*>[\s\S]*?<\/\1\s*>/giu, " ")
    .replace(/<!--([\s\S]*?)-->/gu, " ")
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ");
  const mainText = normalizeText(visible);
  if (!mainText) throw new Error("<main> has no visible text");
  return mainText;
}

export function extractPageSemantics(html) {
  if (typeof html !== "string") throw new TypeError("HTML must be a string");
  const canonical = exactlyOne(
    tags(html, "link")
      .filter(({ attributes: values }) => values.get("rel")?.toLowerCase().split(/\s+/u).includes("canonical"))
      .map(({ attributes: values }) => values.get("href") ?? ""),
    "canonical link",
  );
  const ogUrl = exactlyOne(metaValues(html, "property", "og:url"), "og:url meta");
  const title = exactlyOne(
    [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/giu)].map((match) => normalizeText(match[1].replace(/<[^>]+>/gu, " "))),
    "title",
  );
  const description = exactlyOne(metaValues(html, "name", "description"), "description meta");
  const robotsValues = metaValues(html, "name", "robots");
  if (robotsValues.length > 1) throw new Error(`Expected at most one robots meta, found ${robotsValues.length}`);

  return {
    canonical,
    ogUrl,
    title,
    description,
    robots: robotsValues[0] ?? "",
    mainText: extractMainText(html),
  };
}

export function differingPageSemanticFields(left, right) {
  return PAGE_SEMANTIC_FIELDS.filter((field) => left[field] !== right[field]);
}
