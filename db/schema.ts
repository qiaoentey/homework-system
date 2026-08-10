import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const branches = sqliteTable("branches", {
  code: text("code").primaryKey(),
  label: text("label").notNull(),
});

export const teacherGroups = sqliteTable("teacher_groups", {
  code: text("code").primaryKey(),
  branchCode: text("branch_code").notNull().references(() => branches.code),
  label: text("label").notNull(),
}, (table) => [
  uniqueIndex("teacher_groups_code_branch_unique").on(table.code, table.branchCode),
]);

export const students = sqliteTable("students", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  branchCode: text("branch_code").notNull(),
  groupCode: text("group_code").notNull(),
  status: text("status", { enum: ["active", "stopped"] }).notNull().default("active"),
  profile: text("profile").notNull().default("{}"),
  sourceRef: text("source_ref"),
  enrolmentKey: text("enrolment_key"),
  createdAt: text("created_at").notNull().default(
    sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ),
  updatedAt: text("updated_at").notNull().default(
    sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ),
}, (table) => [
  foreignKey({
    columns: [table.groupCode, table.branchCode],
    foreignColumns: [teacherGroups.code, teacherGroups.branchCode],
  }).name("students_group_branch_fk"),
  check("students_status_check", sql`${table.status} in ('active', 'stopped')`),
  uniqueIndex("students_group_source_ref_unique").on(table.groupCode, table.sourceRef),
  uniqueIndex("students_enrolment_key_unique").on(table.enrolmentKey),
  index("students_branch_group_status_name_idx").on(
    table.branchCode,
    table.groupCode,
    table.status,
    table.name,
  ),
]);

export const attendanceEvents = sqliteTable("attendance_events", {
  studentId: text("student_id").notNull().references(() => students.id),
  attendanceDate: text("attendance_date").notNull(),
  eventCode: text("event_code").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull(),
  absenceReason: text("absence_reason"),
  updatedBy: text("updated_by").notNull(),
  updatedAt: text("updated_at").notNull().default(
    sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ),
}, (table) => [
  primaryKey({ columns: [table.studentId, table.attendanceDate, table.eventCode] }),
  check("attendance_events_active_check", sql`${table.isActive} in (0, 1)`),
  index("attendance_events_attendance_date_idx").on(table.attendanceDate),
]);

export const studentMessages = sqliteTable("student_messages", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  messageDate: text("message_date").notNull(),
  body: text("body").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: text("created_at").notNull().default(
    sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ),
}, (table) => [
  index("student_messages_student_date_idx").on(table.studentId, table.messageDate),
]);

export const studentActivity = sqliteTable("student_activity", {
  id: text("id").primaryKey(),
  studentId: text("student_id").notNull().references(() => students.id),
  action: text("action", {
    enum: ["enrol", "stop", "restore", "profile_update"],
  }).notNull(),
  actor: text("actor").notNull(),
  details: text("details").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(
    sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  ),
}, (table) => [
  check(
    "student_activity_action_check",
    sql`${table.action} in ('enrol', 'stop', 'restore', 'profile_update')`,
  ),
  index("student_activity_student_idx").on(table.studentId),
]);

export const accessLoginAttempts = sqliteTable("access_login_attempts", {
  addressHash: text("address_hash").primaryKey(),
  failures: integer("failures").notNull(),
  windowStartedAt: integer("window_started_at").notNull(),
  lockedUntil: integer("locked_until").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
}, (table) => [
  index("access_login_attempts_updated_at_idx").on(table.updatedAt),
]);
