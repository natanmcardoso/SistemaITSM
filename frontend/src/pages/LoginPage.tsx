import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DEMO_PASSWORD, TECHNICIANS } from "../devData";

export function LoginPage() {
  const [email, setEmail] = useState(TECHNICIANS[0].email);
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
      navigate("/fila");
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
        <p className="mt-1 text-sm text-slate-500">Entrar como técnico</p>

        <label className="mt-6 block text-sm font-medium text-slate-700" htmlFor="technician">
          Técnico
        </label>
        <select
          id="technician"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          {TECHNICIANS.map((tech) => (
            <option key={tech.email} value={tech.email}>
              {tech.name}
            </option>
          ))}
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
