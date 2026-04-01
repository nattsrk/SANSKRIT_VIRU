import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  const isTeacher = user.role === 'teacher';

  return (
    <nav className={`navbar ${isTeacher ? 'navbar-teacher' : 'navbar-student'}`}>
      <div className="nav-inner">
        <Link to="/dashboard" className="nav-brand">
          <span className="brand-name">VidyaSetu</span>
          <span className="brand-tag">Virtual Sanskrit Classroom</span>
        </Link>
        <div className="nav-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/classes">Classes</Link>
          <Link to="/assignments">Assignments</Link>
        </div>
        <div className="nav-user">
          <span className="user-badge">{isTeacher ? 'Teacher' : 'Student'}</span>
          <span className="user-name">{user.name}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </div>
    </nav>
  );
}
