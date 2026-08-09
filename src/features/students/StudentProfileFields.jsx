import {
  PICKUP_METHOD_OPTIONS,
  STAY_TIME_OPTIONS,
  STUDENT_GRADE_OPTIONS,
  schoolClassesFor,
  schoolOptionsFor,
  vanDriverOptionsFor,
} from "../../domain/profileOptions.js";

const STAY_FIELDS = [
  ["lateStayMonday", "星期一"],
  ["lateStayTuesday", "星期二"],
  ["lateStayWednesday", "星期三"],
  ["lateStayThursday", "星期四"],
  ["lateStayFriday", "星期五"],
];

const DINNER_FIELDS = [
  ["dinnerMonday", "星期一晚餐"],
  ["dinnerTuesday", "星期二晚餐"],
  ["dinnerWednesday", "星期三晚餐"],
  ["dinnerThursday", "星期四晚餐"],
  ["dinnerFriday", "星期五晚餐"],
];

const HOMEWORK_DAY_FIELDS = [
  ["homeworkMonday", "星期一"],
  ["homeworkTuesday", "星期二"],
  ["homeworkWednesday", "星期三"],
  ["homeworkThursday", "星期四"],
  ["homeworkFriday", "星期五"],
];

function ExistingOption({ value, choices }) {
  if (!value || choices.includes(value)) return null;
  return <option value={value}>{value}（现有资料）</option>;
}

export function StudentProfileFields({
  branchCode,
  grade,
  values,
  disabled,
  onGradeChange,
  onChange,
  fieldTestId,
}) {
  const schoolOptions = schoolOptionsFor(branchCode);
  const schoolClasses = schoolClassesFor(branchCode, values.school, grade);
  const vanDriverOptions = vanDriverOptionsFor(branchCode);
  const stayValues = STAY_TIME_OPTIONS.map(([value]) => value);

  function changeSchool(nextSchool) {
    onChange("school", nextSchool);
    onChange("schoolClass", "");
  }

  function changeDinnerRequired(nextValue) {
    onChange("dinnerRequired", nextValue);

    for (const [field] of DINNER_FIELDS) {
      if (nextValue === "需要") {
        if (!values[field]) onChange(field, "不需要");
      } else {
        onChange(field, "");
      }
    }
  }

  function changeCareProgram(nextValue) {
    onChange("careProgram", nextValue);
    if (nextValue === "功课班") return;

    onChange("homeworkArrivalTime", "");
    onChange("homeworkDepartureTime", "");
    for (const [field] of HOMEWORK_DAY_FIELDS) onChange(field, "");
  }

  return (
    <div className="student-profile-fields">
      <div className="student-profile-fields__grid">
        {onGradeChange ? (
          <label data-testid={fieldTestId}>
            <span>年级</span>
            <select
              aria-label="年级"
              required
              disabled={disabled}
              value={grade}
              onChange={(event) => onGradeChange(event.target.value)}
            >
              <option value="">请选择年级</option>
              {STUDENT_GRADE_OPTIONS.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
              <ExistingOption value={grade} choices={STUDENT_GRADE_OPTIONS} />
            </select>
          </label>
        ) : null}
        <label data-testid={fieldTestId}>
          <span>学校</span>
          <select
            aria-label="学校"
            disabled={disabled}
            value={values.school}
            onChange={(event) => changeSchool(event.target.value)}
          >
            <option value="">请选择学校</option>
            {schoolOptions.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
            <ExistingOption value={values.school} choices={schoolOptions} />
          </select>
        </label>

        <label data-testid={fieldTestId}>
          <span>学校班级</span>
          <select
            aria-label="学校班级"
            disabled={disabled || !values.school}
            value={values.schoolClass}
            onChange={(event) => onChange("schoolClass", event.target.value)}
          >
            <option value="">请选择学校班级</option>
            {schoolClasses.map((schoolClass) => (
              <option key={schoolClass} value={schoolClass}>{schoolClass}</option>
            ))}
            <ExistingOption value={values.schoolClass} choices={schoolClasses} />
          </select>
        </label>

        <label data-testid={fieldTestId}>
          <span>平常回家时间</span>
          <input
            aria-label="平常回家时间"
            type="time"
            disabled={disabled}
            value={values.usualPickupTime}
            onChange={(event) => onChange("usualPickupTime", event.target.value)}
          />
        </label>

        <label data-testid={fieldTestId}>
          <span>回家载送</span>
          <select
            aria-label="回家载送"
            disabled={disabled}
            value={values.pickupMethod}
            onChange={(event) => onChange("pickupMethod", event.target.value)}
          >
            <option value="" hidden>请选择载送方式</option>
            {PICKUP_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
            <ExistingOption value={values.pickupMethod} choices={PICKUP_METHOD_OPTIONS} />
          </select>
        </label>

        {values.pickupMethod === "Van" ? (
          <>
            <label data-testid={fieldTestId}>
              <span>Van 司机</span>
              <select
                aria-label="Van 司机"
                disabled={disabled}
                value={values.vanDriver}
                onChange={(event) => onChange("vanDriver", event.target.value)}
              >
                <option value="">请选择司机</option>
                {vanDriverOptions.map((driver) => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
                <ExistingOption value={values.vanDriver} choices={vanDriverOptions} />
              </select>
            </label>
            <label data-testid={fieldTestId}>
              <span>Van 回程时间</span>
              <input
                aria-label="Van 回程时间"
                type="time"
                disabled={disabled}
                value={values.vanHomeTime}
                onChange={(event) => onChange("vanHomeTime", event.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="student-profile-fields__program">
        <label data-testid={fieldTestId}>
          <span>学生类型</span>
          <select
            aria-label="学生类型"
            disabled={disabled}
            value={values.careProgram}
            onChange={(event) => changeCareProgram(event.target.value)}
          >
            <option value="">请选择</option>
            <option value="Full Daycare">Full Daycare</option>
            <option value="功课班">功课班</option>
          </select>
        </label>

        {values.careProgram === "功课班" ? (
          <div className="student-profile-fields__homework">
            <div className="student-profile-fields__homework-times">
              <label data-testid={fieldTestId}>
                <span>来校时间</span>
                <input
                  aria-label="来校时间"
                  type="time"
                  disabled={disabled}
                  value={values.homeworkArrivalTime}
                  onChange={(event) => onChange("homeworkArrivalTime", event.target.value)}
                />
              </label>
              <label data-testid={fieldTestId}>
                <span>回家时间</span>
                <input
                  aria-label="回家时间"
                  type="time"
                  disabled={disabled}
                  value={values.homeworkDepartureTime}
                  onChange={(event) => onChange("homeworkDepartureTime", event.target.value)}
                />
              </label>
            </div>
            <div className="student-profile-fields__homework-days">
              <h3>星期几有来</h3>
              <div>
                {HOMEWORK_DAY_FIELDS.map(([field, label]) => (
                  <label data-testid={fieldTestId} key={field}>
                    <input
                      aria-label={label}
                      type="checkbox"
                      disabled={disabled}
                      checked={values[field] === "有来"}
                      onChange={(event) => onChange(field, event.target.checked ? "有来" : "")}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="student-profile-fields__dinner">
        <label data-testid={fieldTestId}>
          <span>是否需要晚餐</span>
          <select
            aria-label="是否需要晚餐"
            disabled={disabled}
            value={values.dinnerRequired}
            onChange={(event) => changeDinnerRequired(event.target.value)}
          >
            <option value="">请选择</option>
            <option value="不需要">不需要</option>
            <option value="需要">需要</option>
          </select>
        </label>

        {values.dinnerRequired === "需要" ? (
          <div className="student-profile-fields__dinner-days">
            {DINNER_FIELDS.map(([field, label]) => (
              <label data-testid={fieldTestId} key={field}>
                <span>{label}</span>
                <select
                  aria-label={label}
                  disabled={disabled}
                  value={values[field]}
                  onChange={(event) => onChange(field, event.target.value)}
                >
                  <option value="不需要">不需要</option>
                  <option value="需要">需要</option>
                </select>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div className="student-profile-fields__stay">
        <h3>特别留校放学时间</h3>
        <div className="student-profile-fields__stay-grid">
          {STAY_FIELDS.map(([field, label]) => (
            <label data-testid={fieldTestId} key={field}>
              <span>{label}</span>
              <select
                aria-label={label}
                disabled={disabled}
                value={values[field]}
                onChange={(event) => onChange(field, event.target.value)}
              >
                {STAY_TIME_OPTIONS.map(([value, text]) => (
                  <option key={value || "none"} value={value}>{text}</option>
                ))}
                <ExistingOption value={values[field]} choices={stayValues} />
              </select>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
