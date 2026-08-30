import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n/config.js";
import App from "./App.js";
import "./index.css";

// The design system drives dark mode through a class on the root element rather than a bare
// CSS media query. Apply the OS preference once at boot and follow it live.
const mq = matchMedia("(prefers-color-scheme: dark)");
const applyTheme = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
applyTheme(mq.matches);
mq.addEventListener("change", (e) => applyTheme(e.matches));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
