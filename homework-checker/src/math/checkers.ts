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
type Affine = { coefficient: Fraction; constant: Fraction; display: NumericValue["display"] };

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

const numeric = (
  value: Fraction,
  display: NumericValue["display"] = "decimal",
): NumericValue => ({ kind: "rational", value, display });

const definition = (unit?: UnitCode) => {
  if (unit === "unknown") throw new CannotDetermine("The unit is not in the approved unit list.");
  return unit ? units[unit] : undefined;
};

const operationDisplay = (left: NumericValue, right: NumericValue) =>
  left.display === "fraction" || right.display === "fraction" ? "fraction" : "decimal";

const valueOperation = (left: NumericValue, operator: "+" | "-" | "*" | "/", right: NumericValue): NumericValue => {
  if (operator === "+") return numeric(left.value.add(right.value), operationDisplay(left, right));
  if (operator === "-") return numeric(left.value.sub(right.value), operationDisplay(left, right));
  if (operator === "*") return numeric(left.value.mul(right.value), operationDisplay(left, right));
  if (right.value.equals(0)) throw new CannotDetermine("Division by zero cannot be checked.");
  return numeric(left.value.div(right.value), operationDisplay(left, right));
};

const convertToBase = (quantity: Quantity) => {
  const unit = definition(quantity.unit);
  return unit ? quantity.value.value.mul(unit.scale) : quantity.value.value;
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
  if (node.type === "variable") throw new CannotDetermine("A variable requires the bounded equation checker.");
  if (node.type === "value") return { value: node.value, unit: node.unit };
  if (node.type === "unary") {
    const operand = evaluate(node.operand);
    return {
      ...operand,
      value: node.operator === "+" ? operand.value : numeric(operand.value.value.neg(), operand.value.display),
    };
  }
  const left = evaluate(node.left);
  const right = evaluate(node.right);
  if (node.operator === "+" || node.operator === "-") {
    const leftDimension = dimensionOf(left);
    const rightDimension = dimensionOf(right);
    if (leftDimension !== rightDimension) throw new CannotDetermine("Units must have the same dimension before adding or subtracting.");
    if (!leftDimension) return { value: valueOperation(left.value, node.operator, right.value) };
    return {
      value: numeric(
        node.operator === "+" ? convertToBase(left).add(convertToBase(right)) : convertToBase(left).sub(convertToBase(right)),
        operationDisplay(left.value, right.value),
      ),
      unit: baseUnitFor(leftDimension),
    };
  }
  if (node.operator === "/" && dimensionOf(right)) throw new CannotDetermine("Unit division is outside the deterministic checker.");
  if (node.operator === "/" && dimensionOf(left)) {
    if (right.value.value.equals(0)) throw new CannotDetermine("Division by zero cannot be checked.");
    return {
      value: numeric(left.value.value.div(right.value.value), operationDisplay(left.value, right.value)),
      unit: left.unit,
    };
  }
  if (node.operator === "*" && (dimensionOf(left) || dimensionOf(right))) {
    const unit = resultingProductUnit(left.unit, right.unit);
    const scale = definition(unit)?.scale ?? new Fraction(1);
    return {
      value: numeric(
        convertToBase(left).mul(convertToBase(right)).div(scale),
        operationDisplay(left.value, right.value),
      ),
      unit,
    };
  }
  return { value: valueOperation(left.value, node.operator, right.value), unit: left.unit };
};

const baseUnits: Record<Dimension, UnitCode> = { length: "m", mass: "g", volume: "ml", money: "RM", time: "s", area: "m2" };
const baseUnitFor = (dimension: Dimension): UnitCode => baseUnits[dimension];

const hasFiniteDecimal = (value: Fraction) => {
  let denominator = value.d;
  while (denominator % 2n === 0n) denominator /= 2n;
  while (denominator % 5n === 0n) denominator /= 5n;
  return denominator === 1n;
};

const roundToSen = (value: Fraction) => {
  const signedNumerator = value.s * value.n;
  const sign = signedNumerator < 0n ? -1n : 1n;
  const magnitude = signedNumerator < 0n ? -signedNumerator : signedNumerator;
  const scaled = magnitude * 100n;
  let rounded = scaled / value.d;
  if ((scaled % value.d) * 2n >= value.d) rounded += 1n;
  return new Fraction(`${sign * rounded}/100`);
};

const format = (value: NumericValue, unit?: UnitCode) => {
  const fractionText = value.value.toFraction();
  let number: string;
  if (unit === "RM") {
    number = toDecimal(value).toFixed(2);
  } else if (value.display === "fraction" || !hasFiniteDecimal(value.value)) {
    number = fractionText;
  } else {
    number = toDecimal(value).toString();
  }
  if (!unit) return number;
  if (unit === "RM") return `RM ${number}`;
  return `${number} ${unit.replace("2", "²")}`;
};

const uncertain = (reason: string): CheckResult => ({
  status: "uncertain",
  expected: undefined,
  reason,
  confidence: 0,
});

const compareExact = (
  expected: NumericValue,
  actual: NumericValue,
  expectedText: string,
): CheckResult => {
  if (expected.value.equals(actual.value)) {
    return { status: "correct", expected: expectedText, reason: "The answer matches the exact calculation.", confidence: 1 };
  }
  if (!hasFiniteDecimal(expected.value) && actual.display === "decimal") {
    return uncertain("The exact result repeats and no rounding precision was stated, so the decimal answer needs teacher review.");
  }
  return { status: "incorrect", expected: expectedText, reason: "The answer does not match the exact calculation.", confidence: 1 };
};

const affine = (node: ExprNode): Affine => {
  if (node.type === "variable") return { coefficient: new Fraction(1), constant: new Fraction(0), display: "decimal" };
  if (node.type === "value") {
    if (node.unit) throw new CannotDetermine("Units are outside the bounded one-variable equation grammar.");
    return { coefficient: new Fraction(0), constant: node.value.value, display: node.value.display };
  }
  if (node.type === "unary") {
    const value = affine(node.operand);
    return node.operator === "+" ? value : {
      coefficient: value.coefficient.neg(),
      constant: value.constant.neg(),
      display: value.display,
    };
  }
  const left = affine(node.left);
  const right = affine(node.right);
  const display = left.display === "fraction" || right.display === "fraction" ? "fraction" : "decimal";
  if (node.operator === "+") {
    return { coefficient: left.coefficient.add(right.coefficient), constant: left.constant.add(right.constant), display };
  }
  if (node.operator === "-") {
    return { coefficient: left.coefficient.sub(right.coefficient), constant: left.constant.sub(right.constant), display };
  }
  const leftHasVariable = !left.coefficient.equals(0);
  const rightHasVariable = !right.coefficient.equals(0);
  if (node.operator === "*") {
    if (leftHasVariable && rightHasVariable) throw new CannotDetermine("Non-linear equations need teacher review.");
    if (leftHasVariable) {
      return { coefficient: left.coefficient.mul(right.constant), constant: left.constant.mul(right.constant), display };
    }
    if (rightHasVariable) {
      return { coefficient: right.coefficient.mul(left.constant), constant: right.constant.mul(left.constant), display };
    }
    return { coefficient: new Fraction(0), constant: left.constant.mul(right.constant), display };
  }
  if (rightHasVariable || right.constant.equals(0)) {
    throw new CannotDetermine("Division by a variable or zero is outside the bounded equation grammar.");
  }
  return {
    coefficient: left.coefficient.div(right.constant),
    constant: left.constant.div(right.constant),
    display,
  };
};

const checkLinearEquation = (parsed: Extract<ParsedEquation, { kind: "linear" }>): CheckResult => {
  const left = affine(parsed.left);
  const right = affine(parsed.right);
  const coefficient = left.coefficient.sub(right.coefficient);
  if (coefficient.equals(0)) throw new CannotDetermine("The equation does not have one unique solution.");
  const solution = right.constant.sub(left.constant).div(coefficient);
  const expected = numeric(solution, left.display === "fraction" || right.display === "fraction" ? "fraction" : "decimal");
  return compareExact(expected, parsed.studentAnswer, format(expected));
};

const checkArithmeticEquation = (parsed: Extract<ParsedEquation, { kind: "arithmetic" }>): CheckResult => {
  const expected = evaluate(parsed.expression);
  const expectedDefinition = definition(expected.unit);
  const answerDefinition = definition(parsed.unit);
  if (expectedDefinition?.dimension !== answerDefinition?.dimension) {
    throw new CannotDetermine("The answer unit does not match the expression unit.");
  }

  let expectedBase = convertToBase(expected);
  let actualBase = convertToBase({ value: parsed.studentAnswer, unit: parsed.unit });
  const isMoney = expectedDefinition?.dimension === "money";
  if (isMoney) {
    expectedBase = roundToSen(expectedBase);
    actualBase = roundToSen(actualBase);
  }
  const displayValue = numeric(
    answerDefinition ? expectedBase.div(answerDefinition.scale) : expectedBase,
    expected.value.display,
  );
  const expectedText = format(displayValue, parsed.unit);
  return compareExact(
    numeric(expectedBase, expected.value.display),
    numeric(actualBase, parsed.studentAnswer.display),
    expectedText,
  );
};

/** Checks allow-listed arithmetic and bounded one-variable equations without executing source text. */
export function checkEquation(parsed: ParsedEquation): CheckResult {
  try {
    return parsed.kind === "linear" ? checkLinearEquation(parsed) : checkArithmeticEquation(parsed);
  } catch (error) {
    return uncertain(error instanceof CannotDetermine
      ? error.reason
      : "The equation could not be checked deterministically.");
  }
}
