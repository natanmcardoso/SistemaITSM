import type { ReactElement } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { homeRouteForRole } from "./auth/routing";
import { DashboardPage } from "./pages/DashboardPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { LoginPage } from "./pages/LoginPage";
import { MeusChamadosPage } from "./pages/MeusChamadosPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { QueuePage } from "./pages/QueuePage";
import { TicketDetailPage } from "./pages/TicketDetailPage";

function RequireAuth({ children }: { children: ReactElement }) {
  const { auth } = useAuth();
  return auth ? children : <Navigate to="/login" replace />;
}

function DefaultRoute() {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  return <Navigate to={homeRouteForRole(auth.user.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/fila"
        element={
          <RequireAuth>
            <QueuePage />
          </RequireAuth>
        }
      />
      <Route
        path="/novo-chamado"
        element={
          <RequireAuth>
            <NewTicketPage />
          </RequireAuth>
        }
      />
      <Route
        path="/tickets/:ticketId"
        element={
          <RequireAuth>
            <TicketDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/meus-chamados"
        element={
          <RequireAuth>
            <MeusChamadosPage />
          </RequireAuth>
        }
      />
      <Route
        path="/base-conhecimento"
        element={
          <RequireAuth>
            <KnowledgeBasePage />
          </RequireAuth>
        }
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<DefaultRoute />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
