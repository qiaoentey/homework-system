export function AppShell({ children, onLogout }) {
  return (
    <main className="app-shell">
      <div className="app-shell__content">
        <header className="brand-header">
          <img
            className="brand-logo"
            src="/assets/brand-logo.png"
            alt="诚意教育，您身边学习专家"
            width="105"
            height="34"
          />
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
