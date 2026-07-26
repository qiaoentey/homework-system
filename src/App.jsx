import { useCallback, useEffect, useReducer, useState } from "react";
import { sessionApi } from "./api/client.js";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { BranchGateway } from "./features/branches/BranchGateway.jsx";
import { GroupChooser } from "./features/groups/GroupChooser.jsx";
import { AppShell } from "./features/layout/AppShell.jsx";
import { flowReducer, initialFlowState } from "./state/flowReducer.js";

export function App() {
  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  const [catalog, setCatalog] = useState(null);
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState("");

  const openEntrance = useCallback(async () => {
    const nextCatalog = await sessionApi.catalog();
    setCatalog(nextCatalog);
    setLoadError("");
    dispatch({ type: "LOGIN" });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        await sessionApi.current();
        if (!cancelled) await openEntrance();
      } catch (error) {
        if (!cancelled && error.status !== 401) setLoadError("系统暂时无法载入，请重试");
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [openEntrance]);

  const loginWithEmergency = useCallback(async (password) => {
    await sessionApi.emergencyLogin(password);
    await openEntrance();
  }, [openEntrance]);

  const loginWithGoogle = useCallback(async (credential) => {
    await sessionApi.googleLogin(credential);
    await openEntrance();
  }, [openEntrance]);

  async function logout() {
    try {
      await sessionApi.logout();
    } finally {
      setCatalog(null);
      dispatch({ type: "LOGOUT" });
    }
  }

  if (booting) {
    return (
      <AppShell>
        <div className="loading-state" role="status">正在载入…</div>
      </AppShell>
    );
  }

  if (flow.screen === "login") {
    return (
      <AppShell>
        {loadError ? (
          <div className="load-error" role="alert">
            <p>{loadError}</p>
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              重新载入
            </button>
          </div>
        ) : (
          <LoginScreen
            onEmergencyLogin={loginWithEmergency}
            onGoogleLogin={loginWithGoogle}
          />
        )}
      </AppShell>
    );
  }

  const branches = catalog?.branches ?? [];
  const selectedBranch = branches.find((branch) => branch.code === flow.branchCode);
  if (flow.screen === "branch") {
    return (
      <AppShell>
        <BranchGateway
          branches={branches}
          onSelect={(branchCode) => dispatch({ type: "SELECT_BRANCH", branchCode })}
        />
      </AppShell>
    );
  }

  if (flow.screen === "group" && selectedBranch) {
    return (
      <AppShell onLogout={logout}>
        <GroupChooser
          branch={selectedBranch}
          onBack={() => dispatch({ type: "BACK_TO_BRANCHES" })}
          onSelect={(groupCode) => dispatch({ type: "SELECT_GROUP", groupCode })}
        />
      </AppShell>
    );
  }

  if (flow.screen === "roster" && selectedBranch) {
    return (
      <AppShell onLogout={logout}>
        <section className="roster-placeholder">
          <nav className="roster-placeholder__actions" aria-label="名单返回">
            <button type="button" className="back-button" onClick={() => dispatch({ type: "BACK_TO_GROUPS" })}>
              <span aria-hidden="true">←</span>
              返回老师
            </button>
            <button type="button" className="back-button" onClick={() => dispatch({ type: "BACK_TO_BRANCHES" })}>
              返回分院
            </button>
          </nav>
          <span className="eyebrow">{selectedBranch.label} 分院</span>
          <h1>{flow.groupCode}</h1>
        </section>
      </AppShell>
    );
  }

  return null;
}
