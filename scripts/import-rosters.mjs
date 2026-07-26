import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPool } from "../server/db/pool.js";

const APPROVED_COUNTS = {
  "MK HAPPY": 82,
  "MK QIAO EN": 40,
  "MK WEN XUAN": 18,
  "WS HUILING": 46,
  "WS JIA WEN": 61,
  "WS MIXIN": 42,
  "巧恩 STP": 90,
  "PS STP": 121,
  "SY STP": 50,
};

function rosterFile(filename, groupCode) {
  return {
    groupCode,
    expectedCount: APPROVED_COUNTS[groupCode],
    filePath: fileURLToPath(new URL(`../data/rosters/${filename}`, import.meta.url)),
  };
}

export const ROSTER_FILES = [
  rosterFile("mk-happy.csv", "MK HAPPY"),
  rosterFile("mk-qiao-en.csv", "MK QIAO EN"),
  rosterFile("mk-wen-xuan.csv", "MK WEN XUAN"),
  rosterFile("ws-huiling.csv", "WS HUILING"),
  rosterFile("ws-jia-wen.csv", "WS JIA WEN"),
  rosterFile("ws-mixin.csv", "WS MIXIN"),
  rosterFile("stp-qiao-en.csv", "巧恩 STP"),
  rosterFile("stp-ps.csv", "PS STP"),
  rosterFile("stp-sy.csv", "SY STP"),
];

function normalizeWhitespace(value) {
  return value.replace(/\s+/gu, " ").trim();
}

function parseCsvRecords(text) {
  const records = [];
  let field = "";
  let record = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n") {
      record.push(field.replace(/\r$/u, ""));
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  if (field.length > 0 || record.length > 0) {
    record.push(field.replace(/\r$/u, ""));
    records.push(record);
  }
  return records;
}

export function parseRosterCsv(text, groupCode) {
  const records = parseCsvRecords(text.replace(/^\uFEFF/u, ""));
  const [header, ...data] = records;
  if (!header || header.join(",") !== "source_ref,name,grade") {
    throw new Error(`${groupCode}: expected header source_ref,name,grade`);
  }

  const sourceRefs = new Set();
  return data.map((cells, index) => {
    if (cells.length !== 3) throw new Error(`${groupCode}: row ${index + 2} must contain three cells`);
    const [sourceRef, name, grade] = cells.map(normalizeWhitespace);
    if (!sourceRef || !name || !grade) {
      throw new Error(`${groupCode}: row ${index + 2} has a required blank cell`);
    }
    if (sourceRefs.has(sourceRef)) {
      throw new Error(`${groupCode}: duplicate source_ref ${sourceRef}`);
    }
    sourceRefs.add(sourceRef);
    return { sourceRef, name, grade, groupCode };
  });
}

async function readRoster(file) {
  return parseRosterCsv(await readFile(file.filePath, "utf8"), file.groupCode);
}

export async function importRosters(pool, rosterFiles = ROSTER_FILES) {
  let inserted = 0;
  let updated = 0;
  const counts = {};
  const rows = [];

  for (const file of rosterFiles) {
    const client = await pool.connect();
    try {
      await client.query("begin");
      const students = await readRoster(file);
      if (students.length !== file.expectedCount) {
        throw new Error(`${file.groupCode}: expected ${file.expectedCount} rows, received ${students.length}`);
      }

      const group = await client.query(
        "select branch_code from teacher_groups where code = $1",
        [file.groupCode],
      );
      if (group.rows.length !== 1) throw new Error(`${file.groupCode}: unknown teacher group`);
      const branchCode = group.rows[0].branch_code;

      for (const student of students) {
        const existing = await client.query(
          "select 1 from students where group_code = $1 and source_ref = $2",
          [student.groupCode, student.sourceRef],
        );
        await client.query(
          `insert into students (name, grade, branch_code, group_code, source_ref)
           values ($1, $2, $3, $4, $5)
           on conflict (group_code, source_ref)
           do update set name = excluded.name, grade = excluded.grade, updated_at = now()`,
          [student.name, student.grade, branchCode, student.groupCode, student.sourceRef],
        );
        if (existing.rows.length) updated += 1;
        else inserted += 1;
      }

      await client.query("commit");
      counts[file.groupCode] = students.length;
      rows.push(...students);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  return { inserted, updated, counts, rows };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to import rosters");
  const pool = createPool(process.env.DATABASE_URL);
  try {
    console.log(JSON.stringify(await importRosters(pool, ROSTER_FILES)));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
