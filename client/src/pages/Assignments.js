import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Assignments.css';

export default function Assignments() {
  const { user, API } = useAuth();
  const [assignments, setAssignments] = useState([]);

  const isTeacher = user.role === 'teacher';

  useEffect(() => {
    API.get('/assignments').then(res => setAssignments(res.data)).catch(() => {});
  }, [API]);

  return (
    <div className="assignments-page container">
      <div className="page-header">
        <h2>Assignments</h2>
      </div>

      <div className="assignments-list">
        {assignments.map(a => (
          <div key={a.id} className="assign-card">
            <div className="assign-left">
              <div className={`assign-status ${a.submitted_at ? 'done' : 'pending'}`}>
                {a.submitted_at ? '✓' : '○'}
              </div>
              <div>
                <h4>{a.title}</h4>
                <p className="assign-class">{a.class_title}</p>
                {a.description && <p className="assign-desc">{a.description}</p>}
              </div>
            </div>
            <div className="assign-right">
              {a.due_date && (
                <div className="assign-due">
                  Due {new Date(a.due_date).toLocaleDateString()}
                </div>
              )}
              <div className="assign-marks">
                {isTeacher
                  ? `${a.submission_count || 0} submissions`
                  : a.marks != null
                    ? `${a.marks}/${a.max_marks}`
                    : `/${a.max_marks}`
                }
              </div>
              {!isTeacher && !a.submitted_at && (
                <button className="submit-assignment-btn" onClick={async () => {
                  await API.post(`/assignments/${a.id}/submit`, { content: 'Submitted via web' });
                  const res = await API.get('/assignments');
                  setAssignments(res.data);
                }}>Submit</button>
              )}
            </div>
          </div>
        ))}
        {assignments.length === 0 && <p className="empty">No assignments found.</p>}
      </div>
    </div>
  );
}
