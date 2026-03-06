import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';

// Lazy-loaded pages — each gets its own chunk
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Clients = lazy(() => import('@/pages/Clients'));
const ClientForm = lazy(() => import('@/pages/ClientForm'));
const ClientDetail = lazy(() => import('@/pages/ClientDetail'));
const Contracts = lazy(() => import('@/pages/Contracts'));
const ContractForm = lazy(() => import('@/pages/ContractForm'));
const ContractDetail = lazy(() => import('@/pages/ContractDetail'));
const FollowUps = lazy(() => import('@/pages/FollowUps'));
const Settings = lazy(() => import('@/pages/Settings'));
const Prospecting = lazy(() => import('@/pages/Prospecting'));
const EmailPage = lazy(() => import('@/pages/Email'));
const Tasks = lazy(() => import('@/pages/Tasks'));
const Kanban = lazy(() => import('@/pages/Kanban'));
const Financial = lazy(() => import('@/pages/Financial'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const PageSpeed = lazy(() => import('@/pages/PageSpeed'));
const ActivityLogPage = lazy(() => import('@/pages/ActivityLog'));
const EmailTemplates = lazy(() => import('@/pages/EmailTemplates'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const InvoiceForm = lazy(() => import('@/pages/InvoiceForm'));
const InvoiceDetail = lazy(() => import('@/pages/InvoiceDetail'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-3 border-chevla-600 border-t-transparent rounded-full" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0F13]">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm text-gray-400">Carregando...</p>
      </div>
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute><Layout /></PrivateRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/new" element={<ClientForm />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="clients/:id/edit" element={<ClientForm />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="contracts/new" element={<ContractForm />} />
          <Route path="contracts/:id" element={<ContractDetail />} />
          <Route path="follow-ups" element={<FollowUps />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="financial" element={<Financial />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/new" element={<InvoiceForm />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="invoices/:id/edit" element={<InvoiceForm />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="prospecting" element={<Prospecting />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="pagespeed" element={<PageSpeed />} />
          <Route path="activity-log" element={<ActivityLogPage />} />
          <Route path="email-templates" element={<EmailTemplates />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}
