import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ContextEngineProvider } from './context/ContextEngineContext';
import PublicLayout from './components/layout/publicLayout';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lightweight pages kept eager for first paint on marketing paths
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';

// Sprint 9 — route-level code splitting for heavy tool / admin pages
const HowItWorks = lazy(() => import('./pages/HowItWorks'));
const About = lazy(() => import('./pages/About'));
const Community = lazy(() => import('./pages/Community'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const OpportunityVerification = lazy(() => import('./pages/OpportunityVerification'));
const ResumeBuilderReview = lazy(() => import('./pages/ResumeBuilderReview'));
const InterviewPreparation = lazy(() => import('./pages/InterviewPreparation'));
const HistoryPage = lazy(() => import('./pages/History'));
const Profile = lazy(() => import('./pages/Profile'));

const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminUserDetail = lazy(() => import('./pages/admin/UserDetail'));
const AdminReports = lazy(() => import('./pages/admin/Reports'));
const AdminVerifications = lazy(() => import('./pages/admin/Verifications'));
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AdminCareerSessions = lazy(() => import('./pages/admin/CareerSessions'));
const AdminOpportunities = lazy(() => import('./pages/admin/Opportunities'));
const AdminOpportunityDetail = lazy(() => import('./pages/admin/OpportunityDetail'));
const AdminInterviews = lazy(() => import('./pages/admin/Interviews'));
const AdminInterviewDetail = lazy(() => import('./pages/admin/InterviewDetail'));
const AdminResumes = lazy(() => import('./pages/admin/Resumes'));
const AdminResumeDetail = lazy(() => import('./pages/admin/ResumeDetail'));
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'));
const AdminFeatureFlags = lazy(() => import('./pages/admin/FeatureFlags'));
const AdminAnnouncements = lazy(() => import('./pages/admin/Announcements'));

/** Accessible route fallback matching existing spinner / design tokens */
function RouteFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="spinner-lg" aria-hidden="true" />
      <span className="sr-only">Loading page…</span>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner-lg" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/**
 * Frontend-only gate. Real security is auth → admin middleware on /api/admin.
 * Users without role=admin (including legacy tokens / demoted admins after /me)
 * are redirected away from the Admin UI.
 */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner-lg" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;
  return children;
}

function AppContent() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path='/' element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/community" element={<Community />} />

          <Route path="/opportunity" element={<OpportunityVerification />} />
          <Route path="/resume-builder-review" element={<ResumeBuilderReview />} />
          <Route path="/interview" element={<InterviewPreparation />} />
        </Route>

        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard" element={<Navigate to="/profile" replace />} />

        {/* Sprint 6 — Admin Portal */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserDetail />} />
          <Route path="career-sessions" element={<AdminCareerSessions />} />
          <Route path="opportunities" element={<AdminOpportunities />} />
          <Route path="opportunities/:id" element={<AdminOpportunityDetail />} />
          <Route path="interviews" element={<AdminInterviews />} />
          <Route path="interviews/:id" element={<AdminInterviewDetail />} />
          <Route path="resumes" element={<AdminResumes />} />
          <Route path="resumes/:id" element={<AdminResumeDetail />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="verifications" element={<AdminVerifications />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="feature-flags" element={<AdminFeatureFlags />} />
          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <ContextEngineProvider>
            <AppContent />
          </ContextEngineProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}
