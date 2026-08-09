export function BranchGateway({ branches, onSelect, onDashboard }) {
  return (
    <section className="entrance entrance--branch">
      <div className="entrance__heading">
        <h1>请选择分院</h1>
        <p>进入后只显示该分院名单</p>
      </div>
      <div className="choice-stack" role="group" aria-label="分院选择">
        {branches.map((branch) => (
          <button
            className="choice-button"
            data-variant={branch.code === "STP" ? "primary" : "default"}
            key={branch.code}
            type="button"
            onClick={() => onSelect(branch.code)}
          >
            {branch.label}
          </button>
        ))}
      </div>
      {onDashboard ? (
        <button aria-label="Dashboard" className="dashboard-entry" type="button" onClick={onDashboard}>
          <span>Dashboard</span>
          <small>查看全部班级当天点名状态</small>
        </button>
      ) : null}
    </section>
  );
}
