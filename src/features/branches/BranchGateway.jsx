export function BranchGateway({ branches, onSelect }) {
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
            key={branch.code}
            type="button"
            onClick={() => onSelect(branch.code)}
          >
            {branch.label}
          </button>
        ))}
      </div>
    </section>
  );
}
