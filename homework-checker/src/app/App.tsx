import { useCallback, useEffect, useState } from "react";
import { AnswerLibrary } from "../answer-library/AnswerLibrary";
import { MathScanner } from "../scanner/MathScanner";
import { isAppRoute, type AppRoute } from "./routes";

const currentRoute = (): AppRoute => (isAppRoute(window.location.pathname) ? window.location.pathname : "/");

export function App() {
  const [route, setRoute] = useState<AppRoute>(currentRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(currentRoute());
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  const navigate = useCallback((nextRoute: AppRoute) => {
    window.history.pushState({}, "", nextRoute);
    setRoute(nextRoute);
  }, []);

  if (route === "/answers") return <AnswerLibrary onBack={() => navigate("/")} />;

  if (route === "/scan") {
    return (
      <main className="page-shell">
        <a className="text-button" href="/" onClick={(event) => { event.preventDefault(); navigate("/"); }} aria-label="返回首页">← 返回首页</a>
        <MathScanner />
      </main>
    );
  }

  return (
    <main className="home page-shell">
      <section className="hero" aria-labelledby="home-title">
        <p className="eyebrow">安亲班老师工具</p>
        <h1 id="home-title">功课检查更轻松</h1>
        <p>快速找到活动本答案，或准备拍照检查数学作业。</p>
      </section>
      <nav className="home-actions" aria-label="主要功能">
        <a className="primary-action" href="/answers" onClick={(event) => { event.preventDefault(); navigate("/answers"); }} aria-label="快速查答案">
          <span aria-hidden="true">📚</span>
          <span>快速查答案</span>
          <small>按年级和科目找答案 PDF、影片</small>
        </a>
        <a className="secondary-action" href="/scan" onClick={(event) => { event.preventDefault(); navigate("/scan"); }} aria-label="拍照检查数学">
          <span aria-hidden="true">📷</span>
          <span>拍照检查数学</span>
          <small>在本机浏览器检查作业</small>
        </a>
      </nav>
    </main>
  );
}
