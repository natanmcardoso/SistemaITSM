import type { ReactElement } from "react";
import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { homeRouteForRole } from "./auth/routing";
import { AdminPage } from "./pages/AdminPage";
import { AgendaPage } from "./pages/AgendaPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ConfigPage } from "./pages/ConfigPage";
import { HomePage } from "./pages/HomePage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ReportsPage } from "./pages/ReportsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { MonitoringPage } from "./pages/MonitoringPage";
import { LoginPage } from "./pages/LoginPage";
import { MeusAtendimentosPage } from "./pages/MeusAtendimentosPage";
import { MeusChamadosPage } from "./pages/MeusChamadosPage";
import { NewTicketPage } from "./pages/NewTicketPage";
import { QueuePage } from "./pages/QueuePage";
import { TechnicianDashboardPage } from "./pages/TechnicianDashboardPage";
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
        path="/inicio"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/perfil"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/preferencias"
        element={
          <RequireAuth>
            <PreferencesPage />
          </RequireAuth>
        }
      />
      <Route
        path="/agenda"
        element={
          <RequireAuth>
            <AgendaPage />
          </RequireAuth>
        }
      />
      <Route
        path="/relatorios"
        element={
          <RequireAuth>
            <ReportsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/automacoes"
        element={
          <RequireAuth>
            <AutomationsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/monitoramento"
        element={
          <RequireAuth>
            <MonitoringPage />
          </RequireAuth>
        }
      />
      <Route
        path="/meu-dashboard"
        element={
          <RequireAuth>
            <TechnicianDashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/fila"
        element={
          <RequireAuth>
            <QueuePage />
          </RequireAuth>
        }
      />
      <Route
        path="/meus-atendimentos"
        element={
          <RequireAuth>
            <MeusAtendimentosPage />
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
        path="/catalogo"
        element={
          <RequireAuth>
            <CatalogPage />
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
      <Route
        path="/configuracoes"
        element={
          <RequireAuth>
            <ConfigPage />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminPage />
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
