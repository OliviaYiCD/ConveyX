import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_ENTITY_ID } from "../api/client";
import { setSession } from "../lib/session";
import { Alert, Button, Card } from "../components/ui";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // POC: accept any credentials and attach demo entity for invoiced orders
    await new Promise((r) => setTimeout(r, 400));

    if (!email.trim()) {
      setError("Enter your work email.");
      setLoading(false);
      return;
    }

    setSession({
      mode: "account",
      email: email.trim(),
      name: email.split("@")[0].replace(/\./g, " "),
      entityId: DEMO_ENTITY_ID,
    });
    navigate("/orders");
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <span className="pill-label">Account access</span>
          <h1>Sign in to ConveyX</h1>
          <p className="lead">
            For conveyancers and firms with an account — order on invoice, manage orders, and
            access bulk pricing.
          </p>
        </div>

        {error && <Alert type="error" message={error} />}

        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com.au"
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="auth-footer">
          Need a one-off search?{" "}
          <Link to="/" className="text-link">
            Pay per check as a guest
          </Link>
        </p>
      </Card>
    </div>
  );
}
