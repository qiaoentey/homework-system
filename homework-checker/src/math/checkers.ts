import Fraction from "fraction.js";
import type { ExprNode, NumericValue, ParsedEquation } from "./parser";
import { toDecimal } from "./parser";
import type { KnownUnitCode, UnitCode } from "./tokenize";

export type CheckResult = {
  status: "correct" | "incorrect" | "uncertain";
  expected?: string;
  reason: string;
  confidence: number;
};

type Dimension = "length" | "mass" | "volume" | "money" | "time" | "area";
type UnitDefinition = { dimension: Dimension; scale: Fraction };
type Quantity = { value: NumericValue; unit?: UnitCode };

const units: Record<KnownUnitCode, UnitDefinition> = {
  mm: { dimension: "length", scale: new Fraction("0.001") }, cm: { dimension: "length", scale: new Fraction("0.01") }, m: { dimension: "length", scale: new Fraction(1) }, km: { dimension: "length", scale: new Fraction(1000) },
  g: { dimension: "mass", scale: new Fraction(1) }, kg: { dimension: "mass", scale: new Fraction(1000) },
  ml: { dimension: "volume", scale: new Fraction(1) }, l: { dimension: "volume", scale: new Fraction(1000) },
  sen: { dimension: "money", scale: new Fraction("0.01") }, RM: { dimension: "money", scale: new Fraction(1) },
  s: { dimension: "time", scale: new Fraction(1) }, min: { dimension: "time", scale: new Fraction(60) }, h: { dimension: "time", scale: new Fraction(3600) }, day: { dimension: "time", scale: new Fraction(86400) },
  mm2: { dimension: "area", scale: new Fraction("0.000001") }, cm2: { dimension: "area", scale: new Fraction("0.0001") }, m2: { dimension: "area", scale: new Fraction(1) }, km2: { dimension: "area", scale: new Fraction(1_000_000) },
};

class CannotDetermine extends Error {
  constructor(readonly reason: string) { super(reason); }
}

const definition = (unit?: UnitCode) => {
  if (unit === "unknown") throw new CannotDetermine("The unit is not in the approved unit list.");
  return unit ? units[unit] : undefined;
};

const valueOperation = (left: NumericValue, operator: "+" | "-" | "*" | "/", right: NumericValue): NumericValue => {
  if (left.kind === "fraction" && right.kind === "fraction") {
    if (operator === "+") return { kind: "fraction", value: left.value.add(right.value) };
    if (operator === "-") return { kind: "fraction", value: left.value.sub(right.value) };
    if (operator === "*") return { kind: "fraction", value: left.value.mul(right.value) };
    if (right.value.equals(0)) throw new CannotDetermine("Division by zero cannot be checked.");
    return { kind: "fraction", value: left.value.div(right.value) };
  }
  const first = toDecimal(left);
  const second = toDecimal(right);
  if (operator === "+") return { kind: "decimal", value: first.plus(second) };
  if (operator === "-") return { kind: "decimal", value: first.minus(second) };
  if (operator === "*") return { kind: "decimal", value: first.times(second) };
  if (second.isZero()) throw new CannotDetermine("Division by zero cannot be checked.");
  return { kind: "decimal", value: first.dividedBy(second) };
};

const toFraction = (value: NumericValue) => value.kind === "fraction" ? value.value : new Fraction(value.value.toFixed());

const convertToBase = (quantity: Quantity) => {
  const unit = definition(quantity.unit);
  return unit ? toFraction(quantity.value).mul(unit.scale) : toFraction(quantity.value);
};

const dimensionOf = (quantity: Quantity) => definition(quantity.unit)?.dimension;

const resultingProductUnit = (left?: UnitCode, right?: UnitCode): UnitCode | undefined => {
  const leftDefinition = definition(left);
  const rightDefinition = definition(right);
  if (!leftDefinition) return right;
  if (!rightDefinition) return left;
  if (leftDefinition.dimension === "length" && rightDefinition.dimension === "length") {
    const side = left ?? right;
    if (side === "mm" || side === "cm" || side === "m" || side === "km") return `${side}2` as KnownUnitCode;
  }
  throw new CannotDetermine("This unit multiplication is outside the deterministic checker.");
};

const evaluate = (node: ExprNode): Quantity => {
  if (node.type === "value") return { value: node.value, unit: node.unit };
  if (node.type === "unary") {
    const operand = evaluate(node.operand);
    const sign = node.operator === "+" ? 1 : -1;
    return { ...operand, value: operand.value.kind === "fraction"
      ? { kind: "fraction", value: sign === 1 ? operand.value.value : operand.value.value.neg() }
      : { kind: "decimal", value: operand.value.value.times(sign) } };
  }
  const left = evaluate(node.left);
  const right = evaluate(node.right);
  if (node.operator === "+" || node.operator === "-") {
    const leftDimension = dimensionOf(left);
    const rightDimension = dimensionOf(right);
    if (leftDimension !== rightDimension) throw new CannotDetermine("Units must have the same dimension before adding or subtracting.");
    if (!leftDimension) return { value: valueOperation(left.value, node.operator, right.value) };
    return {
      value: { kind: "fraction", value: node.operator === "+" ? convertToBase(left).add(convertToBase(right)) : convertToBase(left).sub(convertToBase(right)) },
      unit: baseUnitFor(leftDimension),
    };
  }
  if (node.operator === "/" && dimensionOf(right)) throw new CannotDetermine("Unit division is outside the deterministic checker.");
  if (node.operator === "/" && dimensionOf(left)) {
    const divisor = toFraction(right.value);
    if (divisor.equals(0)) throw new CannotDetermine("Division by zero cannot be checked.");
    return { value: { kind: "fraction", value: toFraction(left.value).div(divisor) }, unit: left.unit };
  }
  if (node.operator === "*" && (dimensionOf(left) || dimensionOf(right))) {
    const unit = resultingProductUnit(left.unit, right.unit);
    const scale = definition(unit)?.scale ?? new Fraction(1);
    return { value: { kind: "fraction", value: convertToBase(left).mul(convertToBase(right)).div(scale) }, unit };
  }
  return { value: valueOperation(left.value, node.operator, right.value), unit: left.unit };
};

const baseUnits: Record<Dimension, UnitCode> = { length: "m", mass: "g", volume: "ml", money: "RM", time: "s", area: "m2" };
const baseUnitFor = (dimension: Dimension): UnitCode => baseUnits[dimension];

const format = (value: NumericValue, unit?: UnitCode) => {
  if (value.kind === "fraction" && !unit) return value.value.toFraction();
  const decimal = toDecimal(value);
  const number = unit === "RM" ? decimal.toFixed(2) : decimal.toString();
  if (!unit) return number;
  if (unit === "RM") return `RM ${number}`;
  return `${number} ${unit.replace("2", "²")}`;
};

/** Compares the parsed arithmetic with the student's answer using exact decimal/fraction arithmetic. */
export function checkEquation(parsed: ParsedEquation): CheckResult {
  try {
    const expected = evaluate(parsed.expression);
    const expectedDefinition = definition(expected.unit);
    const answerDefinition = definition(parsed.unit);
    if (expectedDefinition?.dimension !== answerDefinition?.dimension) {
      throw new CannotDetermine("The answer unit does not match the expression unit.");
    }
    const expectedBase = convertToBase(expected);
    const actualBase = convertToBase({ value: parsed.studentAnswer, unit: parsed.unit });
    const displayValue = answerDefinition
      ? { kind: "fraction" as const, value: expectedBase.div(answerDefinition.scale) }
      : expected.value;
    const expectedText = format(displayValue, parsed.unit);
    return expectedBase.equals(actualBase)
      ? { status: "correct", expected: expectedText, reason: "The answer matches the exact calculation.", confidence: 1 }
      : { status: "incorrect", expected: expectedText, reason: "The answer does not match the exact calculation.", confidence: 1 };
  } catch (error) {
    const reason = error instanceof CannotDetermine ? error.reason : "The equation could not be checked deterministically.";
    return { status: "uncertain", reason, confidence: 0 };
  }
}
