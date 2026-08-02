INSERT INTO teacher_groups (code, branch_code, label)
VALUES ('YUAN NING STP', 'STP', 'YUAN NING')
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint

UPDATE students
SET group_code = 'YUAN NING STP',
    name = CASE source_ref
      WHEN 'stp-ps-001' THEN 'Abby Lee'
      WHEN 'stp-ps-003' THEN '陈羽捷'
      WHEN 'stp-ps-004' THEN '蔡卓亨'
      WHEN 'stp-ps-005' THEN '叶泋妤'
      WHEN 'stp-ps-006' THEN '萧欣甯'
      WHEN 'stp-ps-007' THEN '萧皓恒'
      WHEN 'stp-ps-008' THEN '丁文淇'
      WHEN 'stp-ps-010' THEN '卢奕衡'
      WHEN 'stp-ps-011' THEN '李媛霏'
      WHEN 'stp-ps-012' THEN '邓威乐'
      WHEN 'stp-ps-013' THEN '陈凯泽'
      WHEN 'stp-ps-014' THEN '林佑峻'
      WHEN 'stp-ps-016' THEN 'Jayden'
      WHEN 'stp-ps-017' THEN '蔡颜馡'
      WHEN 'stp-ps-018' THEN '范旻宏'
      WHEN 'stp-ps-020' THEN '刘思源'
      WHEN 'stp-ps-021' THEN '陈美芯'
      WHEN 'stp-ps-022' THEN '黄靖芯'
      WHEN 'stp-ps-023' THEN '刘柏亨'
      WHEN 'stp-ps-026' THEN '叶思羽'
      WHEN 'stp-ps-027' THEN '刘恩甯'
      WHEN 'stp-ps-028' THEN 'Ava'
      WHEN 'stp-ps-030' THEN '陈祈文'
      WHEN 'stp-ps-031' THEN 'Eason Chan'
      WHEN 'stp-ps-032' THEN '林宥承'
      WHEN 'stp-ps-033' THEN '和凯乐'
      WHEN 'stp-ps-035' THEN '陈嘉谦'
      WHEN 'stp-ps-036' THEN '马佳瑜'
      WHEN 'stp-ps-038' THEN '张皓翔'
      WHEN 'stp-ps-039' THEN '邓茹予'
      WHEN 'stp-ps-040' THEN '刘俊盛'
      WHEN 'stp-ps-042' THEN '陈凯'
      WHEN 'stp-ps-043' THEN '伍悦帧'
      WHEN 'stp-ps-044' THEN 'Afzan'
      WHEN 'stp-ps-045' THEN '曾于哲'
      WHEN 'stp-ps-115' THEN '陈佳莹'
      WHEN 'stp-ps-117' THEN '陈彦州'
      WHEN 'stp-ps-119' THEN '陈杰'
      ELSE name
    END,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE branch_code = 'STP'
  AND group_code = 'PS STP'
  AND source_ref IN (
    'stp-ps-001', 'stp-ps-003', 'stp-ps-004', 'stp-ps-005',
    'stp-ps-006', 'stp-ps-007', 'stp-ps-008', 'stp-ps-010',
    'stp-ps-011', 'stp-ps-012', 'stp-ps-013', 'stp-ps-014',
    'stp-ps-016', 'stp-ps-017', 'stp-ps-018', 'stp-ps-020',
    'stp-ps-021', 'stp-ps-022', 'stp-ps-023', 'stp-ps-026',
    'stp-ps-027', 'stp-ps-028', 'stp-ps-030', 'stp-ps-031',
    'stp-ps-032', 'stp-ps-033', 'stp-ps-035', 'stp-ps-036',
    'stp-ps-038', 'stp-ps-039', 'stp-ps-040', 'stp-ps-042',
    'stp-ps-043', 'stp-ps-044', 'stp-ps-045', 'stp-ps-115',
    'stp-ps-117', 'stp-ps-119'
  );
--> statement-breakpoint

INSERT INTO students
  (id, name, grade, branch_code, group_code, status, profile, source_ref)
VALUES
  ('dc100001-0000-4000-8000-000000000001', 'Macy', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-001'),
  ('dc100002-0000-4000-8000-000000000002', '杨景立', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-002'),
  ('dc100003-0000-4000-8000-000000000003', 'Julian', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-003'),
  ('dc100004-0000-4000-8000-000000000004', 'Owen', 'Y5', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-004'),
  ('dc100005-0000-4000-8000-000000000005', '陈梓煒', 'K1+K2', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-005')
ON CONFLICT (id) DO NOTHING;
