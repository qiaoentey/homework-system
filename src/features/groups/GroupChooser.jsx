export function GroupChooser({ branch, onBack, onSelect }) {
  return (
    <section className="entrance">
      <button className="back-button" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span>
        返回分院
      </button>
      <div className="entrance__heading entrance__heading--compact">
        <span className="eyebrow">{branch.label} 分院</span>
        <h1>请选择老师</h1>
        <p>只显示该老师的学生名单</p>
      </div>
      <div className="choice-stack" role="group" aria-label={`${branch.label} 老师选择`}>
        {branch.groups.map((group) => (
          <button
            className="choice-button"
            key={group.code}
            type="button"
            onClick={() => onSelect(group.code)}
          >
            {group.label}
          </button>
        ))}
      </div>
    </section>
  );
}
