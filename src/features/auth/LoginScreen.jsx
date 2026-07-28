import { useEffect, useRef, useState } from "react";

const GENERIC_LOGIN_ERROR = "密码错误，请重试";

export function LoginScreen({ onPasswordLogin }) {
  const loginInFlight = useRef(false);
  const mounted = useRef(false);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function submitPassword(event) {
    event.preventDefault();
    if (!password || loginInFlight.current) return;

    loginInFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onPasswordLogin(password);
    } catch {
      if (mounted.current) {
        setPassword("");
        setError(GENERIC_LOGIN_ERROR);
      }
    } finally {
      loginInFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return (
    <section className="login-card">
      <div className="entrance__heading entrance__heading--compact">
        <span className="eyebrow">诚意教育</span>
        <h1>登录点名系统</h1>
        <p>请输入系统密码</p>
      </div>
      <form className="access-form" onSubmit={submitPassword}>
        <label htmlFor="access-password">系统密码</label>
        <input
          id="access-password"
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={pending}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={pending || !password}>
          {pending ? "登录中…" : "登录"}
        </button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
