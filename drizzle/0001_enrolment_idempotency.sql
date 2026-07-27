DROP INDEX IF EXISTS students_group_normalized_identity_unique;
--> statement-breakpoint
ALTER TABLE students ADD COLUMN enrolment_key TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX students_enrolment_key_unique
  ON students (enrolment_key);
