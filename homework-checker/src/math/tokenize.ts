export type KnownUnitCode =
  | "mm"
  | "cm"
  | "m"
  | "km"
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "sen"
  | "RM"
  | "s"
  | "min"
  | "h"
  | "day"
  | "mm2"
  | "cm2"
  | "m2"
  | "km2";

export type UnitCode = KnownUnitCode | "unknown";

export type Token =
  | { type: "number"; value: string; position: number }
  | { type: "fraction"; numerator: string; denominator: string; position: number }
  | { type: "unit"; value: UnitCode; position: number }
  | { type: "operator"; value: "+" | "-" | "*" | "/"; position: number }
  | { type: "percent" | "leftParen" | "rightParen" | "equals"; position: number };

export type TokenizeError = { code: "invalid-character" | "invalid-number"; position: number };
export type TokenizeResult = { ok: true; value: Token[] } | { ok: false; error: TokenizeError };

const KNOWN_UNITS = new Set<KnownUnitCode>([
  "mm", "cm", "m", "km", "g", "kg", "ml", "l", "sen", "RM", "s", "min", "h", "day", "mm2", "cm2", "m2", "km2",
]);

const isDigit = (character: string | undefined) => Boolean(character && character >= "0" && character <= "9");
const isLetter = (character: string | undefined) => Boolean(character && /[A-Za-z]/.test(character));

const isStandaloneMultiplicationX = (source: string, index: number) => {
  if (source[index].toLowerCase() !== "x") return false;
  const before = source.slice(0, index).trimEnd().at(-1);
  const after = source.slice(index + 1).trimStart()[0];
  return Boolean(before && after && !isLetter(source[index - 1]) && !isLetter(source[index + 1]));
};

const normalizeNumber = (raw: string) => {
  const [whole, decimal] = raw.split(".");
  if (!whole || (whole.includes(",") && !/^\d{1,3}(,\d{3})+$/.test(whole))) return undefined;
  if (decimal !== undefined && !/^\d+$/.test(decimal)) return undefined;
  return `${whole.replaceAll(",", "")}${decimal === undefined ? "" : `.${decimal}`}`;
};

/** Tokenizes an allow-listed primary-school maths expression without executing it. */
export function tokenize(source: string): TokenizeResult {
  const tokens: Token[] = [];

  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (isDigit(character)) {
      const position = index;
      let raw = "";
      while (isDigit(source[index]) || source[index] === "," || source[index] === ".") raw += source[index++];
      const normalized = normalizeNumber(raw);
      if (!normalized) return { ok: false, error: { code: "invalid-number", position } };
      if (source[index] === "/" && /^\d+$/.test(normalized) && isDigit(source[index + 1])) {
        index += 1;
        let denominator = "";
        while (isDigit(source[index])) denominator += source[index++];
        tokens.push({ type: "fraction", numerator: normalized, denominator, position });
      } else {
        tokens.push({ type: "number", value: normalized, position });
      }
      continue;
    }
    if (character.toLowerCase() === "x" && isStandaloneMultiplicationX(source, index)) {
      tokens.push({ type: "operator", value: "*", position: index++ });
      continue;
    }
    if (isLetter(character)) {
      const position = index;
      let word = "";
      while (isLetter(source[index]) || source[index] === "²" || source[index] === "2") {
        word += source[index++] === "²" ? "2" : source[index - 1];
      }
      const unit = KNOWN_UNITS.has(word as KnownUnitCode) ? (word as KnownUnitCode) : "unknown";
      tokens.push({ type: "unit", value: unit, position });
      continue;
    }
    const operator = character === "×" ? "*" : character === "÷" ? "/" : character;
    if (operator === "+" || operator === "-" || operator === "*" || operator === "/") {
      tokens.push({ type: "operator", value: operator, position: index++ });
      continue;
    }
    if (character === "(") tokens.push({ type: "leftParen", position: index++ });
    else if (character === ")") tokens.push({ type: "rightParen", position: index++ });
    else if (character === "=") tokens.push({ type: "equals", position: index++ });
    else if (character === "%") tokens.push({ type: "percent", position: index++ });
    else return { ok: false, error: { code: "invalid-character", position: index } };
  }
  return { ok: true, value: tokens };
}
