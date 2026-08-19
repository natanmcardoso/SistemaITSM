import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";
import { DEMO_PASSWORD, LOGIN_ACCOUNTS } from "../devData";
import { homeRouteForRole } from "../auth/routing";
import { IconTicket } from "../components/icons";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-8">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-9 shadow-[0_1px_2px_rgba(16,24,40,.04),0_8px_24px_rgba(16,24,40,.08)]"
      >
        <div className="mb-7 flex items-center gap-2.5">
          <div className="flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-[10px] bg-primary">
            <IconTicket width={20} height={20} strokeWidth={1.9} className="text-white" />
          </div>
          <div className="text-[19px] font-extrabold tracking-tight text-slate-900">Sistema ITSM</div>
        </div>

        <div className="mb-1.5 text-[13px] font-bold tracking-wide text-slate-400 uppercase">Entrar como</div>

        <label className="mb-1.5 block text-[13px] font-bold text-slate-600" htmlFor="account">
          Conta
        </label>
        <select
          id="account"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-5 w-full rounded-[10px] border-[1.5px] border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-primary focus:outline-none"
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
          <optgroup label="Gestores">
            {LOGIN_ACCOUNTS.filter((a) => a.role === "manager").map((account) => (
              <option key={account.email} value={account.email}>
                {account.name}
              </option>
            ))}
          </optgroup>
        </select>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[10px] bg-primary py-3 text-sm font-bold text-white shadow-[0_1px_2px_rgba(29,79,216,.16)] transition hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div className="mt-5 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Senha das contas de demonstração preenchida automaticamente
        </div>
      </form>
    </div>
  );
}
