import Decimal from "decimal.js";
import Fraction from "fraction.js";
import { tokenize, type Token, type UnitCode } from "./tokenize";

export type NumericValue = {
  kind: "rational";
  value: Fraction;
  display: "decimal" | "fraction";
  decimalPlaces?: number;
};

export type ExprNode =
  | { type: "value"; value: NumericValue; unit?: UnitCode }
  | { type: "variable"; name: "x" }
  | { type: "unary"; operator: "+" | "-"; operand: ExprNode }
  | { type: "binary"; operator: "+" | "-" | "*" | "/"; left: ExprNode; right: ExprNode };

export type ArithmeticEquation = {
  kind: "arithmetic";
  expression: ExprNode;
  studentAnswer: NumericValue;
  unit?: UnitCode;
};

export type LinearEquation = {
  kind: "linear";
  left: ExprNode;
  right: ExprNode;
  variable: "x";
  studentAnswer: NumericValue;
};

export type ParsedEquation = ArithmeticEquation | LinearEquation;
export type ParseError = {
  code: "invalid-character" | "invalid-number" | "unexpected-token" | "missing-equals" | "trailing-token" | "too-complex";
  position: number;
};
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

class ParseFailure extends Error {
  constructor(readonly error: ParseError) {
    super(error.code);
  }
}

const numberValue = (source: string): NumericValue => {
  const decimalPlaces = source.includes(".") ? source.length - source.indexOf(".") - 1 : 0;
  return {
    kind: "rational",
    value: new Fraction(source),
    display: "decimal",
    decimalPlaces,
  };
};

const negated = (value: NumericValue): NumericValue => ({ ...value, value: value.value.neg() });

class EquationParser {
  private index = 0;

  constructor(private readonly tokens: Token[]) {}

  parse(): ParsedEquation {
    const left = this.expression();
    if (this.current()?.type !== "equals") this.fail("missing-equals");
    this.index += 1;
    const right = this.expression();

    if (this.current()?.type === "separator") {
      this.index += 1;
      const variable = this.current();
      if (variable?.type !== "variable") this.fail("unexpected-token");
      this.index += 1;
      if (this.current()?.type !== "equals") this.fail("missing-equals");
      this.index += 1;
      const answer = this.signedValue();
      if (answer.unit) this.fail("unexpected-token");
      if (this.current()) this.fail("trailing-token");
      if (!containsVariable(left) && !containsVariable(right)) this.fail("unexpected-token");
      return {
        kind: "linear",
        left,
        right,
        variable: variable.value,
        studentAnswer: answer.value,
      };
    }

    if (this.current()) this.fail("trailing-token");
    if (containsVariable(left) || containsVariable(right)) this.fail("unexpected-token");
    const answer = answerFrom(right, (code) => this.fail(code));
    return {
      kind: "arithmetic",
      expression: left,
      studentAnswer: answer.value,
      unit: answer.unit,
    };
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
    if (token?.type === "variable") {
      this.index += 1;
      return { type: "variable", name: token.value };
    }
    return { type: "value", ...this.value() };
  }

  private value(): { value: NumericValue; unit?: UnitCode } {
    let unit = this.consumeUnit();
    const token = this.current();
    if (!token || (token.type !== "number" && token.type !== "fraction")) this.fail("unexpected-token");
    this.index += 1;
    let value: NumericValue = token.type === "fraction"
      ? {
          kind: "rational",
          value: new Fraction(`${token.numerator}/${token.denominator}`),
          display: "fraction",
        }
      : numberValue(token.value);
    if (this.current()?.type === "percent") {
      this.index += 1;
      value = {
        kind: "rational",
        value: value.value.div(100),
        display: "decimal",
        decimalPlaces: value.decimalPlaces,
      };
    }
    const suffix = this.consumeUnit();
    if (unit && suffix && unit !== suffix) this.fail("unexpected-token");
    unit ??= suffix;
    return { value, unit };
  }

  private signedValue(): { value: NumericValue; unit?: UnitCode } {
    const operator = this.current();
    if (operator?.type !== "operator" || (operator.value !== "+" && operator.value !== "-")) return this.value();
    this.index += 1;
    const answer = this.value();
    return operator.value === "+" ? answer : { ...answer, value: negated(answer.value) };
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

const containsVariable = (node: ExprNode): boolean => {
  if (node.type === "variable") return true;
  if (node.type === "value") return false;
  if (node.type === "unary") return containsVariable(node.operand);
  return containsVariable(node.left) || containsVariable(node.right);
};

const answerFrom = (
  node: ExprNode,
  fail: (code: ParseError["code"]) => never,
): { value: NumericValue; unit?: UnitCode } => {
  if (node.type === "value") return { value: node.value, unit: node.unit };
  if (node.type === "unary" && node.operand.type === "value") {
    return {
      value: node.operator === "-" ? negated(node.operand.value) : node.operand.value,
      unit: node.operand.unit,
    };
  }
  return fail("unexpected-token");
};

export const toDecimal = (value: NumericValue) =>
  new Decimal(value.value.s.toString())
    .times(value.value.n.toString())
    .dividedBy(value.value.d.toString());

/** Parses only the documented arithmetic and bounded one-variable grammar. */
export function parseEquation(text: string): Result<ParsedEquation, ParseError> {
  if (text.length > 160) return { ok: false, error: { code: "too-complex", position: 160 } };
  const tokenized = tokenize(text);
  if (!tokenized.ok) return tokenized;
  if (tokenized.value.length > 64) return { ok: false, error: { code: "too-complex", position: 0 } };
  try {
    return { ok: true, value: new EquationParser(tokenized.value).parse() };
  } catch (error) {
    if (error instanceof ParseFailure) return { ok: false, error: error.error };
    return { ok: false, error: { code: "unexpected-token", position: 0 } };
  }
}
