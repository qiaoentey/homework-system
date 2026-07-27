import type { OcrLine, QuestionRegion } from "./ocr.types";
import type { Rect } from "./imagePipeline";

// Primary-school worksheets commonly number items with a full stop, a closing
// parenthesis, or Chinese enumeration punctuation. OCR also occasionally turns
// `、` into `，`, so accept that conservative variant as a question boundary.
const QUESTION_NUMBER = /^\s*(\d{1,3})(?:[)、]\s*|[.，,]\s+)/;

type VisualRow = {
  lines: OcrLine[];
  box: Rect;
  columnAssociationConfidence: number;
};

type QuestionGroup = {
  rows: VisualRow[];
  boundaryConfidence: number;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

const columnBoundaryConfidence = (gapRatio: number) =>
  clamp(0.62 + Math.abs(gapRatio - 4) * 0.16, 0.5, 0.95);

const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

const mergeBox = (lines: OcrLine[]): Rect => {
  const left = Math.min(...lines.map((line) => line.box.x));
  const top = Math.min(...lines.map((line) => line.box.y));
  const right = Math.max(...lines.map((line) => line.box.x + line.box.width));
  const bottom = Math.max(...lines.map((line) => line.box.y + line.box.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const visualRows = (lines: OcrLine[], averageHeight: number): VisualRow[] => {
  const rowThreshold = Math.max(1, averageHeight * 0.6);
  const rows: OcrLine[][] = [];

  for (const line of [...lines].sort((left, right) => left.box.y - right.box.y || left.box.x - right.box.x)) {
    const row = rows.at(-1);
    if (row && Math.abs(line.box.y - row[0].box.y) <= rowThreshold) row.push(line);
    else rows.push([line]);
  }

  return rows.flatMap((row) => {
    const mergedRows: Array<Omit<VisualRow, "box">> = [];
    for (const line of row.sort((left, right) => left.box.x - right.box.x)) {
      const mergedRow = mergedRows.at(-1);
      const previous = mergedRow?.lines.at(-1);
      const gap = previous ? line.box.x - (previous.box.x + previous.box.width) : Infinity;
      // A large horizontal gutter is a column boundary, not a continuation of
      // the question on the left. Keep the columns as independent visual rows
      // so that their numbered questions cannot be merged accidentally.
      if (mergedRow && previous && gap < averageHeight * 4) {
        mergedRow.lines.push(line);
        if (Number.isFinite(gap)) {
          mergedRow.columnAssociationConfidence = Math.min(
            mergedRow.columnAssociationConfidence,
            columnBoundaryConfidence(gap / averageHeight),
          );
        }
      } else {
        const nextRow = { lines: [line], columnAssociationConfidence: 1 };
        if (mergedRow && Number.isFinite(gap)) {
          const gapRatio = gap / averageHeight;
          // Four line-heights is the split threshold. A gutter only just over
          // that threshold is weak column evidence; a substantially wider
          // gutter is a reliable column boundary.
          const confidence = columnBoundaryConfidence(gapRatio);
          mergedRow.columnAssociationConfidence = Math.min(
            mergedRow.columnAssociationConfidence,
            confidence,
          );
          nextRow.columnAssociationConfidence = confidence;
        }
        mergedRows.push(nextRow);
      }
    }
    return mergedRows.map((mergedRow) => ({
      ...mergedRow,
      box: mergeBox(mergedRow.lines),
    }));
  });
};

const CRITICAL_TEXT = /[0-9+\-*/×÷=.%xX]/;

const overlapProportion = (left: Rect, right: Rect) => {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea ? (width * height) / smallerArea : 0;
};

const geometryConfidenceFor = (group: QuestionGroup, averageHeight: number) => {
  const lines = group.rows.flatMap((row) => row.lines);
  let maximumOverlap = 0;
  for (let leftIndex = 0; leftIndex < lines.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < lines.length; rightIndex += 1) {
      maximumOverlap = Math.max(
        maximumOverlap,
        overlapProportion(lines[leftIndex].box, lines[rightIndex].box),
      );
    }
  }

  const overlapConfidence = clamp(0.96 - maximumOverlap * 0.6, 0.36, 0.96);
  const continuationConfidence = group.rows.slice(1).reduce((confidence, row, index) => {
    const previous = group.rows[index];
    const gapRatio = (
      row.box.y - (previous.box.y + previous.box.height)
    ) / averageHeight;
    // Nearby rows strongly support a continuation. As an internal gap
    // approaches the 1.8-height question split threshold, grouping is
    // increasingly ambiguous even if it remains on the continuation side.
    const evidence = clamp(0.95 - Math.max(0, gapRatio - 0.6) * 0.25, 0.6, 0.95);
    return Math.min(confidence, evidence);
  }, 0.96);
  const columnAssociationConfidence = Math.min(
    ...group.rows.map((row) => row.columnAssociationConfidence),
  );

  return Math.min(overlapConfidence, continuationConfidence, columnAssociationConfidence);
};

const makeQuestion = (index: number, group: QuestionGroup): QuestionRegion => {
  const lines = group.rows.flatMap((row) => row.lines);
  const criticalLines = lines.filter((line) => CRITICAL_TEXT.test(line.text));
  return {
    id: `question-${index + 1}`,
    lines,
    box: mergeBox(lines),
    confidence: Math.round(lines.reduce((total, line) => total + line.confidence, 0) / lines.length),
    criticalConfidence: criticalLines.length
      ? Math.min(...criticalLines.map((line) => line.criticalConfidence))
      : 0,
    locationConfidence: group.boundaryConfidence,
  };
};

export function segmentQuestions(lines: OcrLine[]): QuestionRegion[] {
  const visibleLines = lines.filter((line) => line.text.trim() && line.box.width > 0 && line.box.height > 0);
  if (!visibleLines.length) return [];

  const averageHeight = median(visibleLines.map((line) => line.box.height));
  const rows = visualRows(visibleLines, averageHeight);
  const numbered = rows.some((row) => row.lines.some((line) => QUESTION_NUMBER.test(line.text)));
  const groups: QuestionGroup[] = [];
  let current: QuestionGroup | undefined;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const startsNumberedQuestion = row.lines.some((line) => QUESTION_NUMBER.test(line.text));
    const previous = rows[index - 1];
    const verticalGap = previous ? row.box.y - (previous.box.y + previous.box.height) : 0;
    const startsUnnumberedQuestion = !numbered && index > 0 && verticalGap > averageHeight * 1.8;

    if (numbered) {
      if (startsNumberedQuestion) {
        current = { rows: [], boundaryConfidence: 0.94 };
        groups.push(current);
      } else if (!current || verticalGap > averageHeight * 1.8) {
        // Keep worksheet headers, directions and footers out of numbered
        // questions. A nearby continuation line remains part of the question.
        current = undefined;
        continue;
      }
    } else if (!current || startsUnnumberedQuestion) {
      const gapRatio = averageHeight ? verticalGap / averageHeight : 0;
      const boundaryConfidence = startsUnnumberedQuestion
        ? clamp(0.72 + Math.max(0, gapRatio - 1.8) * 0.25, 0.55, 0.95)
        : 0.9;
      if (current && startsUnnumberedQuestion) {
        current.boundaryConfidence = Math.min(current.boundaryConfidence, boundaryConfidence);
      }
      current = {
        rows: [],
        boundaryConfidence,
      };
      groups.push(current);
    }
    current?.rows.push(row);
  }

  const groupBoxes = groups.map((group) => mergeBox(group.rows.flatMap((row) => row.lines)));
  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
      const overlap = overlapProportion(groupBoxes[leftIndex], groupBoxes[rightIndex]);
      if (!overlap) continue;

      const separationConfidence = clamp(0.96 - overlap * 0.6, 0.36, 0.96);
      groups[leftIndex].boundaryConfidence = Math.min(
        groups[leftIndex].boundaryConfidence,
        separationConfidence,
      );
      groups[rightIndex].boundaryConfidence = Math.min(
        groups[rightIndex].boundaryConfidence,
        separationConfidence,
      );
    }
  }

  return groups.map((group, index) => {
    group.boundaryConfidence = Math.min(
      group.boundaryConfidence,
      geometryConfidenceFor(group, averageHeight),
    );
    return makeQuestion(index, group);
  });
}
