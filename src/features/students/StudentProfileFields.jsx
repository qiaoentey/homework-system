import {
  PICKUP_METHOD_OPTIONS,
  SCHOOL_OPTIONS,
  STAY_TIME_OPTIONS,
  VAN_DRIVER_OPTIONS,
  schoolClassesFor,
} from "../../domain/profileOptions.js";

const STAY_FIELDS = [
  ["lateStayMonday", "星期一"],
  ["lateStayTuesday", "星期二"],
  ["lateStayWednesday", "星期三"],
  ["lateStayThursday", "星期四"],
  ["lateStayFriday", "星期五"],
];

function ExistingOption({ value, choices }) {
  if (!value || choices.includes(value)) return null;
  return <option value={value}>{value}（现有资料）</option>;
}

export function StudentProfileFields({
  grade,
  values,
  disabled,
  onChange,
  fieldTestId,
}) {
  const schoolClasses = schoolClassesFor(values.school, grade);
  const stayValues = STAY_TIME_OPTIONS.map(([value]) => value);

  function changeSchool(nextSchool) {
    onChange("school", nextSchool);
    onChange("schoolClass", "");
  }

  return (
    <div className="student-profile-fields">
      <div className="student-profile-fields__grid">
        <label data-testid={fieldTestId}>
          <span>学校</span>
          <select
            aria-label="学校"
            disabled={disabled}
            value={values.school}
            onChange={(event) => changeSchool(event.target.value)}
          >
            <option value="">请选择学校</option>
            {SCHOOL_OPTIONS.map((school) => (
              <option key={school} value={school}>{school}</option>
            ))}
            <ExistingOption value={values.school} choices={SCHOOL_OPTIONS} />
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
                {VAN_DRIVER_OPTIONS.map((driver) => (
                  <option key={driver} value={driver}>{driver}</option>
                ))}
                <ExistingOption value={values.vanDriver} choices={VAN_DRIVER_OPTIONS} />
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
