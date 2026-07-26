create unique index students_group_normalized_identity_unique
  on students (group_code, lower(name), grade);
