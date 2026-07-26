import Decimal from "decimal.js";
import Fraction from "fraction.js";
import { tokenize, type Token, type UnitCode } from "./tokenize";

export type NumericValue =
  | { kind: "decimal"; value: Decimal }
  | { kind: "fraction"; value: Fraction };

export type ExprNode =
  | { type: "value"; value: NumericValue; unit?: UnitCode }
  | { type: "unary"; operator: "+" | "-"; operand: ExprNode }
  | { type: "binary"; operator: "+" | "-" | "*" | "/"; left: ExprNode; right: ExprNode };

export type ParsedEquation = { expression: ExprNode; studentAnswer: NumericValue; unit?: UnitCode };
export type ParseError = {
  code: "invalid-character" | "invalid-number" | "unexpected-token" | "missing-equals" | "trailing-token";
  position: number;
};
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

class ParseFailure extends Error {
  constructor(readonly error: ParseError) {
    super(error.code);
  }
}

class EquationParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ParsedEquation {
    const expression = this.expression();
    if (this.current()?.type !== "equals") this.fail("missing-equals");
    this.index += 1;
    const answer = this.value();
    if (this.current()) this.fail("trailing-token");
    return { expression, studentAnswer: answer.value, unit: answer.unit };
  }

  private expression(): ExprNode {
    let node = this.term();
    while (this.current()?.type === "operator" && (this.current() as Extract<Token, { type: "operator" }>).value.match(/[+-]/)) {
      const operator = (this.current() as Extract<Token, { type: "operator" }>).value as "+" | "-";
      this.index += 1;
      node = { type: "binary", operator, left: node, right: this.term() };
    }
    return node;
  }

  private term(): ExprNode {
    let node = this.factor();
    while (this.current()?.type === "operator" && (this.current() as Extract<Token, { type: "operator" }>).value.match(/[*/]/)) {
      const operator = (this.current() as Extract<Token, { type: "operator" }>).value as "*" | "/";
      this.index += 1;
      node = { type: "binary", operator, left: node, right: this.factor() };
    }
    return node;
  }

  private factor(): ExprNode {
    const token = this.current();
    if (token?.type === "operator" && (token.value === "+" || token.value === "-")) {
      this.index += 1;
      return { type: "unary", operator: token.value, operand: this.factor() };
    }
    if (token?.type === "leftParen") {
      this.index += 1;
      const node = this.expression();
      if (this.current()?.type !== "rightParen") this.fail("unexpected-token");
      this.index += 1;
      return node;
    }
    return { type: "value", ...this.value() };
  }

  private value(): { value: NumericValue; unit?: UnitCode } {
    let unit = this.consumeUnit();
    const token = this.current();
    if (!token || (token.type !== "number" && token.type !== "fraction")) this.fail("unexpected-token");
    this.index += 1;
    let value: NumericValue = token.type === "fraction"
      ? { kind: "fraction", value: new Fraction(`${token.numerator}/${token.denominator}`) }
      : { kind: "decimal", value: new Decimal(token.value) };
    if (this.current()?.type === "percent") {
      this.index += 1;
      value = { kind: "decimal", value: toDecimal(value).dividedBy(100) };
    }
    const suffix = this.consumeUnit();
    if (unit && suffix && unit !== suffix) this.fail("unexpected-token");
    unit ??= suffix;
    return { value, unit };
  }

  private consumeUnit() {
    const token = this.current();
    if (token?.type !== "unit") return undefined;
    this.index += 1;
    return token.value;
  }

  private current() {
    return this.tokens[this.index];
  }

  private fail(code: ParseError["code"]): never {
    throw new ParseFailure({ code, position: this.current()?.position ?? this.tokens.at(-1)?.position ?? 0 });
  }
}

export const toDecimal = (value: NumericValue) => value.kind === "decimal"
  ? value.value
  : new Decimal(value.value.s.toString()).times(value.value.n.toString()).dividedBy(value.value.d.toString());

/** Parses only the documented equation grammar; it never evaluates source text. */
export function parseEquation(text: string): Result<ParsedEquation, ParseError> {
  const tokenized = tokenize(text);
  if (!tokenized.ok) return tokenized;
  try {
    return { ok: true, value: new EquationParser(tokenized.value).parse() };
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, error: error.error };
    return { ok: false, error: { code: "unexpected-token", position: 0 } };
  }
}
