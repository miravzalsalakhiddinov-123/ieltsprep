import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import StudentLayout from './components/StudentLayout';
import AdminLayout from './components/AdminLayout';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Practice from './pages/Practice';
import LessonsHub from './pages/LessonsHub';
import Lessons from './pages/Lessons';
import LessonView from './pages/LessonView';
import MockCenter from './pages/MockCenter';
import MockResults from './pages/MockResults';
import TestRunner from './pages/TestRunner';

import AdminStudents from './pages/admin/AdminStudents';
import AdminTests from './pages/admin/AdminTests';
import AdminLessons from './pages/admin/AdminLessons';
import AdminMocks from './pages/admin/AdminMocks';
import AdminResults from './pages/admin/AdminResults';
import AdminGrading from './pages/admin/AdminGrading';
import AdminMessages from './pages/admin/AdminMessages';
import AdminMotivation from './pages/admin/AdminMotivation';

// 'full' (default, single combined deploy) | 'admin' | 'student' — set via the
// VITE_APP_MODE build-time env var when deploying admin and student panels as
// two separate Vercel projects/links. See DEPLOY.md.
const MODE = import.meta.env.VITE_APP_MODE || 'full';
const SHOW_STUDENT = MODE !== 'admin';
const SHOW_ADMIN = MODE !== 'student';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Fullscreen test-taking routes — no sidebar layout */}
      {SHOW_STUDENT && <Route path="/practice/:type/:testId" element={
        <ProtectedRoute role="student"><TestRunner /></ProtectedRoute>
      } />}
      {SHOW_STUDENT && <Route path="/practice/:type/:testId/review/:attemptId" element={
        <ProtectedRoute role="student"><TestRunner reviewMode /></ProtectedRoute>
      } />}

      {/* Student area */}
      {SHOW_STUDENT && (
        <Route path="/" element={<ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="practice" element={<Practice />} />
          <Route path="lessons" element={<LessonsHub />} />
          <Route path="lessons/view/:id" element={<LessonView />} />
          <Route path="lessons/:section" element={<Lessons />} />
          <Route path="mock" element={<MockCenter />} />
          <Route path="mock/results/:mockId" element={<MockResults />} />
        </Route>
      )}

      {/* Admin area */}
      {SHOW_ADMIN && (
        <Route path="/admin" element={<ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/admin/students" replace />} />
          <Route path="students" element={<AdminStudents />} />
          <Route path="tests" element={<AdminTests />} />
          <Route path="lessons" element={<AdminLessons />} />
          <Route path="mocks" element={<AdminMocks />} />
          <Route path="results" element={<AdminResults />} />
          <Route path="grading" element={<AdminGrading />} />
          <Route path="messages" element={<AdminMessages />} />
          <Route path="motivation" element={<AdminMotivation />} />
        </Route>
      )}

      <Route path="*" element={<Navigate to={MODE === 'admin' ? '/admin' : '/'} replace />} />
    </Routes>
  );
}
