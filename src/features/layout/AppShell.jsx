export function AppShell({ children, onLogout }) {
  return (
    <main className="app-shell">
      <div className="app-shell__content">
        <header className="brand-header">
          <div className="brand" aria-label="诚意教育">
            <strong className="brand__name">诚意教育</strong>
            <span className="brand__tagline">您身边学习专家</span>
          </div>
          {onLogout ? (
            <button className="text-button" type="button" onClick={onLogout}>
              退出登录
            </button>
          ) : null}
        </header>
        {children}
      </div>
    </main>
  );
}
