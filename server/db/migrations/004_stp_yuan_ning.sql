insert into teacher_groups (code, branch_code, label)
values ('YUAN NING STP', 'STP', 'YUAN NING')
on conflict (code) do nothing;

update students
set group_code = 'YUAN NING STP',
    name = case source_ref
      when 'stp-ps-001' then 'Abby Lee'
      when 'stp-ps-003' then '陈羽捷'
      when 'stp-ps-004' then '蔡卓亨'
      when 'stp-ps-005' then '叶泋妤'
      when 'stp-ps-006' then '萧欣甯'
      when 'stp-ps-007' then '萧皓恒'
      when 'stp-ps-008' then '丁文淇'
      when 'stp-ps-010' then '卢奕衡'
      when 'stp-ps-011' then '李媛霏'
      when 'stp-ps-012' then '邓威乐'
      when 'stp-ps-013' then '陈凯泽'
      when 'stp-ps-014' then '林佑峻'
      when 'stp-ps-016' then 'Jayden'
      when 'stp-ps-017' then '蔡颜馡'
      when 'stp-ps-018' then '范旻宏'
      when 'stp-ps-020' then '刘思源'
      when 'stp-ps-021' then '陈美芯'
      when 'stp-ps-022' then '黄靖芯'
      when 'stp-ps-023' then '刘柏亨'
      when 'stp-ps-026' then '叶思羽'
      when 'stp-ps-027' then '刘恩甯'
      when 'stp-ps-028' then 'Ava'
      when 'stp-ps-030' then '陈祈文'
      when 'stp-ps-031' then 'Eason Chan'
      when 'stp-ps-032' then '林宥承'
      when 'stp-ps-033' then '和凯乐'
      when 'stp-ps-035' then '陈嘉谦'
      when 'stp-ps-036' then '马佳瑜'
      when 'stp-ps-038' then '张皓翔'
      when 'stp-ps-039' then '邓茹予'
      when 'stp-ps-040' then '刘俊盛'
      when 'stp-ps-042' then '陈凯'
      when 'stp-ps-043' then '伍悦帧'
      when 'stp-ps-044' then 'Afzan'
      when 'stp-ps-045' then '曾于哲'
      when 'stp-ps-115' then '陈佳莹'
      when 'stp-ps-117' then '陈彦州'
      when 'stp-ps-119' then '陈杰'
      else name
    end,
    updated_at = now()
where branch_code = 'STP'
  and group_code = 'PS STP'
  and source_ref in (
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

insert into students
  (id, name, grade, branch_code, group_code, status, profile, source_ref)
values
  ('dc100001-0000-4000-8000-000000000001', 'Macy', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-001'),
  ('dc100002-0000-4000-8000-000000000002', '杨景立', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-002'),
  ('dc100003-0000-4000-8000-000000000003', 'Julian', 'Y1', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-003'),
  ('dc100004-0000-4000-8000-000000000004', 'Owen', 'Y5', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-004'),
  ('dc100005-0000-4000-8000-000000000005', '陈梓煒', 'K1+K2', 'STP', 'YUAN NING STP', 'active', '{"school":"","schoolClass":"","usualPickupTime":"","pickupMethod":"","lateStayMonday":"","lateStayTuesday":"","lateStayWednesday":"","lateStayThursday":"","lateStayFriday":""}', 'stp-yuan-ning-005')
on conflict (id) do nothing;
