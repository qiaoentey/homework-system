import { useEffect, useRef, useState } from "react";

const GENERIC_LOGIN_ERROR = "登录失败，请重试";

export function LoginScreen({ onEmergencyLogin, onGoogleLogin }) {
  const googleButton = useRef(null);
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

  useEffect(() => {
    let cancelled = false;

    function mountGoogleButton() {
      if (
        cancelled ||
        !googleButton.current ||
        !window.google?.accounts?.id
      ) {
        return false;
      }

      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
        callback: async ({ credential }) => {
          if (!credential || loginInFlight.current) return;
          loginInFlight.current = true;
          setPending(true);
          setError("");
          try {
            await onGoogleLogin(credential);
          } catch {
            if (mounted.current) setError(GENERIC_LOGIN_ERROR);
          } finally {
            loginInFlight.current = false;
            if (mounted.current) setPending(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButton.current, {
        shape: "pill",
        size: "large",
        text: "signin_with",
        width: 320,
      });
      return true;
    }

    if (mountGoogleButton()) return () => {
      cancelled = true;
    };

    const scriptId = "google-identity-services";
    let script = document.getElementById(scriptId);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
    script.addEventListener("load", mountGoogleButton);

    return () => {
      cancelled = true;
      script.removeEventListener("load", mountGoogleButton);
    };
  }, [onGoogleLogin]);

  async function submitEmergency(event) {
    event.preventDefault();
    if (!password || loginInFlight.current) return;

    loginInFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onEmergencyLogin(password);
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
        <p>请选择 Google 或紧急密码登录</p>
      </div>
      <div className="google-login" ref={googleButton} aria-label="Google 登录" />
      <div className="divider"><span>或</span></div>
      <form className="emergency-form" onSubmit={submitEmergency}>
        <label htmlFor="emergency-password">紧急密码</label>
        <input
          id="emergency-password"
          type="password"
          autoComplete="current-password"
          value={password}
          disabled={pending}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={pending || !password}>
          {pending ? "登录中…" : "紧急登录"}
        </button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
