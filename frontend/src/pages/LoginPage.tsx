import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DEMO_PASSWORD, LOGIN_ACCOUNTS } from "../devData";
import { homeRouteForRole } from "../auth/routing";

export function LoginPage() {
  const [email, setEmail] = useState(LOGIN_ACCOUNTS[0].email);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { access_token, user } = await login(email, DEMO_PASSWORD);
      signIn({ token: access_token, user });
      navigate(homeRouteForRole(user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Sistema ITSM</h1>
        <p className="mt-1 text-sm text-slate-500">Entrar como</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="account">
          Conta
        </label>
        <select
          id="account"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <optgroup label="Técnicos">
            {LOGIN_ACCOUNTS.filter((a) => a.role === "technician").map((account) => (
              <option key={account.email} value={account.email}>
                {account.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Usuários finais">
            {LOGIN_ACCOUNTS.filter((a) => a.role === "end_user").map((account) => (
              <option key={account.email} value={account.email}>
                {account.name}
              </option>
            ))}
          </optgroup>
        </select>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
