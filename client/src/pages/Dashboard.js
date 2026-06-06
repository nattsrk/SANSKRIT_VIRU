import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
export default function Dashboard() {
  const { user, API } = useAuth();
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);

  useEffect(() => {
    API.get('/classes').then(res => setClasses(res.data)).catch(() => {});
    API.get('/assignments').then(res => setAssignments(res.data)).catch(() => {});
  }, [API]);

  const isTeacher = user.role === 'teacher';

  return (
    <div className="dashboard">
      <div className="container">
        <div className={`greeting ${isTeacher ? 'greeting-teacher' : 'greeting-student'}`}>
          <div>
            <h2>Namaste, {user.name}!</h2>
            <p>{isTeacher ? 'Manage your Sanskrit classes' : 'Continue your Sanskrit journey'}</p>
          </div>
          <div className="greeting-sanskrit">
            विद्या सेतु
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-number">{classes.length}</div>
            <div className="stat-label">{isTeacher ? 'Classes Teaching' : 'Enrolled Classes'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{assignments.length}</div>
            <div className="stat-label">Assignments</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {isTeacher
                ? assignments.reduce((sum, a) => sum + (a.submission_count || 0), 0)
                : assignments.filter(a => a.submitted_at).length
              }
            </div>
            <div className="stat-label">{isTeacher ? 'Submissions' : 'Completed'}</div>
          </div>
        </div>

        <section className="section">
          <div className="section-header">
            <h3>My Classes</h3>
            {isTeacher && <Link to="/classes" className="section-link">+ New Class</Link>}
          </div>
          <div className="class-list">
            {classes.map(cls => (
              <Link to={`/classes/${cls.id}`} key={cls.id} className="class-card">
                <div className={`class-accent ${isTeacher ? 'accent-teacher' : 'accent-student'}`} />
                <div className="class-info">
                  <h4>{cls.title}</h4>
                  <p className="class-desc">{cls.description}</p>
                  <div className="class-meta">
                    <span>{cls.schedule || 'No schedule set'}</span>
                    {isTeacher && <span>{cls.student_count} students</span>}
                    {!isTeacher && cls.teacher_name && <span>{cls.teacher_name}</span>}
                  </div>
                </div>
              </Link>
            ))}
            {classes.length === 0 && (
              <p className="empty">No classes yet. {isTeacher ? 'Create your first class!' : 'Enroll in a class to get started.'}</p>
            )}
          </div>
        </section>

        <section className="section">
          <div className="section-header">
            <h3>Upcoming Assignments</h3>
          </div>
          <div className="assignment-list">
            {assignments.slice(0, 5).map(a => (
              <div key={a.id} className="assignment-card">
                <div className="assignment-info">
                  <h4>{a.title}</h4>
                  <p>{a.class_title}</p>
                </div>
                <div className="assignment-meta">
                  {a.due_date && <span className="due-date">Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                  {a.submitted_at && <span className="submitted-badge">Submitted</span>}
                  {a.marks != null && <span className="marks-badge">{a.marks}/{a.max_marks}</span>}
                </div>
              </div>
            ))}
            {assignments.length === 0 && <p className="empty">No assignments yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
