"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export const TEST_SESSION_KEY = "liquidity_radar_test_session_v1";

const TEST_ACCOUNTS_KEY = "liquidity_radar_test_accounts_v1";
const DUMMY_EMAIL = "demo@liquidityradar.test";
const DUMMY_PASSWORD = "RadarDemo!2026";
const MAX_LOCAL_ACCOUNTS = 25;

export type TestSession = {
  name: string;
  email: string;
  role: "Demo administrator" | "Registered tester";
  signedInAt: string;
};

type StoredTestAccount = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordIssue(value: string) {
  if (value.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/.test(value)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(value)) return "Add an uppercase letter.";
  if (!/\d/.test(value)) return "Add a number.";
  return "";
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hashPassword(password: string, salt: string) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function readAccounts(): StoredTestAccount[] {
  try {
    const stored = window.localStorage.getItem(TEST_ACCOUNTS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredTestAccount[]) : [];
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredTestAccount[]) {
  window.localStorage.setItem(TEST_ACCOUNTS_KEY, JSON.stringify(accounts));
}

function newSession(
  name: string,
  email: string,
  role: TestSession["role"],
): TestSession {
  return {
    name,
    email,
    role,
    signedInAt: new Date().toISOString(),
  };
}

export function saveTestSession(session: TestSession) {
  window.localStorage.setItem(TEST_SESSION_KEY, JSON.stringify(session));
}

export function readTestSession(): TestSession | null {
  try {
    const stored = window.localStorage.getItem(TEST_SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<TestSession>;
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      (parsed.role !== "Demo administrator" &&
        parsed.role !== "Registered tester") ||
      typeof parsed.signedInAt !== "string"
    ) {
      return null;
    }
    return parsed as TestSession;
  } catch {
    return null;
  }
}

export function clearTestSession() {
  window.localStorage.removeItem(TEST_SESSION_KEY);
}

export function TestAuth({
  onAuthenticated,
}: {
  onAuthenticated: (session: TestSession) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginEmail, setLoginEmail] = useState(DUMMY_EMAIL);
  const [loginPassword, setLoginPassword] = useState(DUMMY_PASSWORD);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const email = normalizeEmail(loginEmail);
      if (email === DUMMY_EMAIL && loginPassword === DUMMY_PASSWORD) {
        const session = newSession(
          "Liquidity Radar Demo",
          DUMMY_EMAIL,
          "Demo administrator",
        );
        saveTestSession(session);
        onAuthenticated(session);
        return;
      }

      const account = readAccounts().find(
        (candidate) => candidate.email === email,
      );
      if (!account) {
        setError("No test account was found on this browser.");
        return;
      }
      const candidateHash = await hashPassword(loginPassword, account.salt);
      if (candidateHash !== account.passwordHash) {
        setError("The test email or password is incorrect.");
        return;
      }

      const session = newSession(
        account.name,
        account.email,
        "Registered tester",
      );
      saveTestSession(session);
      onAuthenticated(session);
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const email = normalizeEmail(String(form.get("email") ?? ""));
      const password = String(form.get("password") ?? "");
      const confirmation = String(form.get("confirmation") ?? "");

      if (name.length < 2 || name.length > 60) {
        setError("Enter a display name between 2 and 60 characters.");
        return;
      }
      if (!isEmail(email)) {
        setError("Enter a valid test email address.");
        return;
      }
      if (email === DUMMY_EMAIL) {
        setError("That address is reserved for the shared dummy account.");
        return;
      }
      const issue = passwordIssue(password);
      if (issue) {
        setError(issue);
        return;
      }
      if (password !== confirmation) {
        setError("The passwords do not match.");
        return;
      }

      const accounts = readAccounts();
      if (accounts.some((account) => account.email === email)) {
        setError("A test account with that email already exists here.");
        return;
      }
      if (accounts.length >= MAX_LOCAL_ACCOUNTS) {
        setError("This browser has reached its test-account limit.");
        return;
      }

      const salt = randomSalt();
      const account: StoredTestAccount = {
        id: crypto.randomUUID(),
        name,
        email,
        passwordHash: await hashPassword(password, salt),
        salt,
        createdAt: new Date().toISOString(),
      };
      saveAccounts([...accounts, account]);

      const session = newSession(name, email, "Registered tester");
      saveTestSession(session);
      setNotice("Test account created on this browser.");
      onAuthenticated(session);
    } finally {
      setBusy(false);
    }
  }

  function openMode(nextMode: "login" | "register") {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  return (
    <main className="test-auth-shell">
      <section className="test-auth-intro">
        <Link
          className="real-brand auth-brand"
          href="/"
          aria-label="Liquidity Radar"
        >
          <span className="radar-mark" aria-hidden="true">
            <i />
          </span>
          <span>
            <strong>Liquidity Radar</strong>
            <small>Official public-record explorer</small>
          </span>
        </Link>
        <div>
          <p className="eyebrow teal">Protected test workspace</p>
          <h1>Explore real public records with a test account.</h1>
          <p>
            The data is attributable to SEC, IRS, Census, and BEA sources. The
            account system on this test link is browser-local and does not send
            credentials to a server.
          </p>
        </div>
        <ul>
          <li>
            <i />
            Real government records only
          </li>
          <li>
            <i />
            No personal liquidity estimates
          </li>
          <li>
            <i />
            No server-side credential collection
          </li>
        </ul>
      </section>

      <section className="test-auth-card" aria-labelledby="test-auth-title">
        <div
          className="test-auth-tabs"
          role="tablist"
          aria-label="Account access"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => openMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => openMode("register")}
          >
            Create test account
          </button>
        </div>

        {mode === "login" ? (
          <form
            key="login-form"
            className="test-auth-form"
            onSubmit={submitLogin}
          >
            <div>
              <p className="eyebrow">Test access</p>
              <h2 id="test-auth-title">Sign in to Liquidity Radar</h2>
              <p>
                Use the shared dummy account or an account registered on this
                browser.
              </p>
            </div>
            <label>
              <span>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                required
              />
            </label>
            <label className="test-show-password">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              <span>Show password</span>
            </label>
            {error && <p className="test-auth-error">{error}</p>}
            {notice && <p className="test-auth-notice">{notice}</p>}
            <button
              className="button primary wide"
              type="submit"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in to test dashboard"}
            </button>
            <div className="dummy-account-card">
              <span>Shared dummy account</span>
              <code>{DUMMY_EMAIL}</code>
              <code>{DUMMY_PASSWORD}</code>
              <small>
                Public test credentials. Do not reuse a real password.
              </small>
            </div>
          </form>
        ) : (
          <form
            key="registration-form"
            className="test-auth-form"
            onSubmit={submitRegistration}
          >
            <div>
              <p className="eyebrow">Browser-local registration</p>
              <h2 id="test-auth-title">Create a test account</h2>
              <p>
                Registration is stored only in this browser. Use test
                information, not a personal or work password.
              </p>
            </div>
            <label>
              <span>Display name</span>
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={60}
                placeholder="Demo User"
                required
              />
            </label>
            <label>
              <span>Test email</span>
              <input
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.test"
                required
              />
            </label>
            <label>
              <span>Password</span>
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={10}
                required
              />
              <small>10+ characters with upper, lower, and a number.</small>
            </label>
            <label>
              <span>Confirm password</span>
              <input
                name="confirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={10}
                required
              />
            </label>
            <label className="test-show-password">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(event) => setShowPassword(event.target.checked)}
              />
              <span>Show passwords</span>
            </label>
            <label className="test-local-acknowledgement">
              <input type="checkbox" required />
              <span>
                I understand this is a device-local test account with no
                password reset or cross-device access.
              </span>
            </label>
            {error && <p className="test-auth-error">{error}</p>}
            {notice && <p className="test-auth-notice">{notice}</p>}
            <button
              className="button primary wide"
              type="submit"
              disabled={busy}
            >
              {busy ? "Creating account…" : "Create account and continue"}
            </button>
          </form>
        )}

        <p className="test-auth-footnote">
          Production accounts will require managed identity, server-verified
          sessions, email verification, recovery, and abuse controls.
        </p>
      </section>
    </main>
  );
}
