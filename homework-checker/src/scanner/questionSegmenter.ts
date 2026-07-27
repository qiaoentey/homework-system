import type { OcrLine, QuestionRegion } from "./ocr.types";
import type { Rect } from "./imagePipeline";

// Primary-school worksheets commonly number items with a full stop, a closing
// parenthesis, or Chinese enumeration punctuation. OCR also occasionally turns
// `、` into `，`, so accept that conservative variant as a question boundary.
const QUESTION_NUMBER = /^\s*(\d{1,3})[.)、，,]\s*/;

type VisualRow = {
  lines: OcrLine[];
  box: Rect;
};

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
    const mergedRows: OcrLine[][] = [];
    for (const line of row.sort((left, right) => left.box.x - right.box.x)) {
      const mergedRow = mergedRows.at(-1);
      const previous = mergedRow?.at(-1);
      const gap = previous ? line.box.x - (previous.box.x + previous.box.width) : Infinity;
      // A large horizontal gutter is a column boundary, not a continuation of
      // the question on the left. Keep the columns as independent visual rows
      // so that their numbered questions cannot be merged accidentally.
      if (mergedRow && previous && gap < averageHeight * 4) {
        mergedRow.push(line);
      } else {
        mergedRows.push([line]);
      }
    }
    return mergedRows.map((mergedRow) => ({ lines: mergedRow, box: mergeBox(mergedRow) }));
  });
};

const makeQuestion = (index: number, lines: OcrLine[]): QuestionRegion => ({
  id: `question-${index + 1}`,
  lines,
  box: mergeBox(lines),
  confidence: Math.round(lines.reduce((total, line) => total + line.confidence, 0) / lines.length),
});

export function segmentQuestions(lines: OcrLine[]): QuestionRegion[] {
  const visibleLines = lines.filter((line) => line.text.trim() && line.box.width > 0 && line.box.height > 0);
  if (!visibleLines.length) return [];

  const averageHeight = median(visibleLines.map((line) => line.box.height));
  const rows = visualRows(visibleLines, averageHeight);
  const numbered = rows.some((row) => row.lines.some((line) => QUESTION_NUMBER.test(line.text)));
  const groups: OcrLine[][] = [];
  let current: OcrLine[] | undefined;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const startsNumberedQuestion = row.lines.some((line) => QUESTION_NUMBER.test(line.text));
    const previous = rows[index - 1];
    const verticalGap = previous ? row.box.y - (previous.box.y + previous.box.height) : 0;
    const startsUnnumberedQuestion = !numbered && index > 0 && verticalGap > averageHeight * 1.8;

    if (numbered) {
      if (startsNumberedQuestion) {
        current = [];
        groups.push(current);
      } else if (!current || verticalGap > averageHeight * 1.8) {
        // Keep worksheet headers, directions and footers out of numbered
        // questions. A nearby continuation line remains part of the question.
        current = undefined;
        continue;
      }
    } else if (!current || startsUnnumberedQuestion) {
      current = [];
      groups.push(current);
    }
    current?.push(...row.lines);
  }

  return groups.map((group, index) => makeQuestion(index, group));
}
