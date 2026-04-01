import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Login.css';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [college, setCollege] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await register(name, email, password, role, college);
      } else {
        await login(email, password);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="login-logo">VidyaSetu</h1>
          <p className="login-tagline">VIRTUAL SANSKRIT CLASSROOM</p>
          <p className="login-college">Bridging Tradition with Technology</p>
        </div>

        <div className="role-toggle">
          <button
            className={`role-btn ${role === 'student' ? 'active-student' : ''}`}
            onClick={() => setRole('student')}
          >
            Student
          </button>
          <button
            className={`role-btn ${role === 'teacher' ? 'active-teacher' : ''}`}
            onClick={() => setRole('teacher')}
          >
            Teacher
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegister && (
            <>
              <label className="form-label">Full Name</label>
              <input className="form-input" type="text" value={name} onChange={e => setName(e.target.value)} required />
              <label className="form-label">College / Institution</label>
              <input className="form-input" type="text" value={college} onChange={e => setCollege(e.target.value)} />
            </>
          )}
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label className="form-label">Password</label>
          <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" className={`login-btn ${role === 'teacher' ? 'btn-teacher' : 'btn-student'}`}>
            {isRegister ? 'Create Account' : 'Sign In'}
          </button>

          <p className="toggle-text">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <span className="toggle-link" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
              {isRegister ? 'Sign In' : 'Register'}
            </span>
          </p>

          {!isRegister && (
            <div className="demo-creds">
              <p><strong>Demo Accounts:</strong></p>
              <p>Teacher: guru@vidyasetu.com / teacher123</p>
              <p>Student: priya@vidyasetu.com / student123</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
