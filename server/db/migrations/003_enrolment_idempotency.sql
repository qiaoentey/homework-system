drop index if exists students_group_normalized_identity_unique;

alter table students
  add column enrolment_key uuid;

alter table students
  add constraint students_enrolment_key_unique unique (enrolment_key);
