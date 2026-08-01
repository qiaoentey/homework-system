import { useCallback, useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "google-identity-services";
const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client?hl=zh_CN";
const GENERIC_LOGIN_ERROR = "Google 登录失败，请重试";
const SCRIPT_LOAD_ERROR = "Google 登录暂时无法载入，请刷新重试";

export function LoginScreen({ googleClientId, onGoogleLogin }) {
  const googleButton = useRef(null);
  const loginInFlight = useRef(false);
  const mounted = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleCredential = useCallback(async (response) => {
    if (typeof response?.credential !== "string" || loginInFlight.current) return;

    loginInFlight.current = true;
    setPending(true);
    setError("");
    try {
      await onGoogleLogin(response.credential);
    } catch {
      if (mounted.current) setError(GENERIC_LOGIN_ERROR);
    } finally {
      loginInFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }, [onGoogleLogin]);

  useEffect(() => {
    let active = true;
    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    function showScriptError() {
      if (active) setError(SCRIPT_LOAD_ERROR);
    }

    function renderGoogleButton() {
      if (!active || !googleButton.current) return;
      const googleIdentity = window.google?.accounts?.id;
      if (!googleIdentity) {
        showScriptError();
        return;
      }

      googleButton.current.replaceChildren();
      googleIdentity.initialize({
        client_id: googleClientId,
        callback: handleCredential,
      });
      googleIdentity.renderButton(googleButton.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: 300,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      if (!script) {
        script = document.createElement("script");
        script.id = GOOGLE_SCRIPT_ID;
        script.src = GOOGLE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        document.head.append(script);
      }
      script.addEventListener("load", renderGoogleButton);
      script.addEventListener("error", showScriptError);
    }

    return () => {
      active = false;
      script?.removeEventListener("load", renderGoogleButton);
      script?.removeEventListener("error", showScriptError);
    };
  }, [googleClientId, handleCredential]);

  return (
    <section className="login-card">
      <div className="entrance__heading entrance__heading--compact">
        <span className="eyebrow">诚意教育</span>
        <h1>登录点名系统</h1>
        <p>请使用授权的 Google 帐号登录</p>
      </div>
      <div
        aria-label="Google 登录"
        className="google-login-button"
        ref={googleButton}
      />
      {pending ? <p className="login-pending" role="status">登录中…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
