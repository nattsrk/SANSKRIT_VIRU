import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import ClassDetail from './pages/ClassDetail';
import Assignments from './pages/Assignments';
import TestSocket from './pages/TestSocket';
import VideoRoom from './pages/VideoRoom';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <>
      <Navbar />
      <Routes>

        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/classes" element={<ProtectedRoute><Classes /></ProtectedRoute>} />
        <Route path="/classes/:id" element={<ProtectedRoute><ClassDetail /></ProtectedRoute>} />
        <Route path="/assignments" element={<ProtectedRoute><Assignments /></ProtectedRoute>} />

        
        <Route path="/test-socket" element={<ProtectedRoute><TestSocket /></ProtectedRoute>} />
        <Route path="/room/:roomId" element={<ProtectedRoute><VideoRoom /></ProtectedRoute>} />
        <Route path="/test-video" element={<h1>VIDEO ROOM WORKS</h1>} />

        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />

      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}