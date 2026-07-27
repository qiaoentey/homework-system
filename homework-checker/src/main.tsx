import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { PwaUpdatePrompt } from "./pwa/PwaUpdatePrompt";
import "./styles/tokens.css";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <PwaUpdatePrompt />
  </StrictMode>,
);
