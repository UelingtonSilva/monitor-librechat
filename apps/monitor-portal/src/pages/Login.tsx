import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api.js";

export function Login({ onLogin }: { onLogin: (user: string) => void }) {
  const { t } = useTranslation();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      const r = await api.login(user, password);
      onLogin(r.user);
    } catch (err) {
      setErr(err instanceof Error ? err.message : t("common:login.failed"));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col gap-1">
          <span className="eyebrow">{t("common:login.eyebrow")}</span>
          <h1 className="text-xl font-semibold tracking-tight">Monitor</h1>
          <p className="text-sm text-muted-foreground">{t("common:login.subtitle")}</p>
        </div>

        <form
          onSubmit={submit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
        >
          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("common:login.user")}</span>
            <input
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="eyebrow">{t("common:login.password")}</span>
            <input
              type="password"
              className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-accent px-3 py-2 text-sm font-medium text-accent-foreground disabled:opacity-60"
          >
            {submitting ? t("common:login.signingIn") : t("common:login.signIn")}
          </button>
        </form>

        <p className="mt-4 text-xs text-muted-foreground">{t("common:login.restrictedNotice")}</p>
      </div>
    </div>
  );
}
