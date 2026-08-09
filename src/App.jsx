import { useCallback, useEffect, useReducer, useState } from "react";
import { sessionApi } from "./api/client.js";
import { LoginScreen } from "./features/auth/LoginScreen.jsx";
import { BranchGateway } from "./features/branches/BranchGateway.jsx";
import { DashboardScreen } from "./features/dashboard/DashboardScreen.jsx";
import { GroupChooser } from "./features/groups/GroupChooser.jsx";
import { AppShell } from "./features/layout/AppShell.jsx";
import { RosterScreen } from "./features/roster/RosterScreen.jsx";
import { flowReducer, initialFlowState } from "./state/flowReducer.js";

export function App() {
  const [flow, dispatch] = useReducer(flowReducer, initialFlowState);
  const [catalog, setCatalog] = useState(null);
  const [googleClientId, setGoogleClientId] = useState("");
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
        if (cancelled) return;
        if (error.status === 401) {
          try {
            const config = await sessionApi.googleConfig();
            if (typeof config?.googleClientId !== "string" || !config.googleClientId) {
              throw new Error("Google client ID is unavailable");
            }
            if (!cancelled) setGoogleClientId(config.googleClientId);
          } catch {
            if (!cancelled) setLoadError("系统暂时无法载入，请重试");
          }
        } else {
          setLoadError("系统暂时无法载入，请重试");
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
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
            googleClientId={googleClientId}
            onGoogleLogin={loginWithGoogle}
          />
        )}
      </AppShell>
    );
  }

  const branches = catalog?.branches ?? [];
  const canViewDashboard = catalog?.permissions?.canViewDashboard === true;
  const selectedBranch = branches.find((branch) => branch.code === flow.branchCode);
  if (flow.screen === "branch") {
    return (
      <AppShell>
        <BranchGateway
          branches={branches}
          onDashboard={canViewDashboard
            ? () => dispatch({ type: "OPEN_DASHBOARD" })
            : undefined}
          onSelect={(branchCode) => dispatch({ type: "SELECT_BRANCH", branchCode })}
        />
      </AppShell>
    );
  }

  if (flow.screen === "dashboard") {
    const openedFromRoster = Boolean(flow.branchCode && flow.groupCode);
    return (
      <AppShell onLogout={logout}>
        <DashboardScreen
          backLabel={openedFromRoster ? "返回班级" : "返回分院"}
          initialGroupCode={openedFromRoster ? flow.groupCode : null}
          onBack={() => dispatch({ type: "BACK_FROM_DASHBOARD" })}
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
        <RosterScreen
          branchCode={flow.branchCode}
          groupCode={flow.groupCode}
          groups={selectedBranch.groups}
          onBackGroups={() => dispatch({ type: "BACK_TO_GROUPS" })}
          onBackBranches={() => dispatch({ type: "BACK_TO_BRANCHES" })}
          onDashboard={canViewDashboard
            ? () => dispatch({ type: "OPEN_DASHBOARD" })
            : undefined}
        />
      </AppShell>
    );
  }

  return null;
}
