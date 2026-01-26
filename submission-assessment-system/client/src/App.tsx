import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import theme from './theme';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import StudentDashboard from './pages/student/Dashboard';
import StudentUpload from './pages/student/Upload';
import StudentAssessment from './pages/student/Assessment';
import StudentResults from './pages/student/Results';
import AdminDashboard from './pages/admin/Dashboard';
import AdminQuestionBank from './pages/admin/QuestionBank';
import AdminSubmissions from './pages/admin/Submissions';
import AdminExports from './pages/admin/Exports';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/upload"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentUpload />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/assessment/:submissionId"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/results/:submissionId"
            element={
              <ProtectedRoute requiredRole="student">
                <StudentResults />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/questions"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminQuestionBank />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/submissions"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSubmissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/exports"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminExports />
              </ProtectedRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
