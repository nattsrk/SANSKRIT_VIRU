import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './ClassDetail.css';

export default function ClassDetail() {
  const { id } = useParams();
  const { user, API } = useAuth();
  const [cls, setCls] = useState(null);
  const [tab, setTab] = useState('lessons');

  const isTeacher = user.role === 'teacher';

  useEffect(() => {
    API.get(`/classes/${id}`).then(res => setCls(res.data)).catch(() => {});
  }, [API, id]);

  if (!cls) return <div className="loading">Loading...</div>;

  return (
    <div className="class-detail container">
      <div className={`detail-header ${isTeacher ? 'header-teacher' : 'header-student'}`}>
        <div>
          <h2>{cls.title}</h2>
          <p>{cls.description}</p>
          <div className="detail-meta">
            <span>Teacher: {cls.teacher_name}</span>
            <span>Schedule: {cls.schedule || 'Not set'}</span>
            <span>{cls.students?.length || 0} students</span>
          </div>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`tab ${tab === 'lessons' ? 'active' : ''}`} onClick={() => setTab('lessons')}>Lessons</button>
        <button className={`tab ${tab === 'assignments' ? 'active' : ''}`} onClick={() => setTab('assignments')}>Assignments</button>
        {isTeacher && <button className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Students</button>}
      </div>

      <div className="detail-content">
        {tab === 'lessons' && (
          <div className="lesson-list">
            {cls.lessons?.map((lesson, i) => (
              <div key={lesson.id} className="lesson-card">
                <div className="lesson-num">{i + 1}</div>
                <div className="lesson-info">
                  <h4>{lesson.title}</h4>
                  {lesson.content && <p>{lesson.content}</p>}
                  {lesson.shloka && (
                    <div className="shloka-box">
                      <p className="shloka-text">{lesson.shloka}</p>
                      {lesson.shloka_meaning && <p className="shloka-meaning">{lesson.shloka_meaning}</p>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {(!cls.lessons || cls.lessons.length === 0) && <p className="empty">No lessons yet.</p>}
          </div>
        )}

        {tab === 'assignments' && (
          <div className="assignment-list-detail">
            {cls.assignments?.map(a => (
              <div key={a.id} className="assignment-detail-card">
                <h4>{a.title}</h4>
                <p>{a.description}</p>
                <div className="assignment-detail-meta">
                  {a.due_date && <span>Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                  <span>Max marks: {a.max_marks}</span>
                </div>
              </div>
            ))}
            {(!cls.assignments || cls.assignments.length === 0) && <p className="empty">No assignments yet.</p>}
          </div>
        )}

        {tab === 'students' && isTeacher && (
          <div className="student-list">
            {cls.students?.map(s => (
              <div key={s.id} className="student-card">
                <div className="student-avatar">{s.name[0]}</div>
                <div>
                  <h4>{s.name}</h4>
                  <p>{s.email}</p>
                </div>
              </div>
            ))}
            {(!cls.students || cls.students.length === 0) && <p className="empty">No students enrolled.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
