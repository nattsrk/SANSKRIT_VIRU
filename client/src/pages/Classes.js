import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Classes.css';

export default function Classes() {
  const { user, API } = useAuth();
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState('');

  const isTeacher = user.role === 'teacher';

  useEffect(() => {
    API.get('/classes').then(res => setClasses(res.data)).catch(() => {});
  }, [API]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const { data } = await API.post('/classes', { title, description, schedule });
    setClasses([...classes, { ...data, student_count: 0 }]);
    setShowForm(false);
    setTitle('');
    setDescription('');
    setSchedule('');
  };

  return (
    <div className="classes-page container">
      <div className="page-header">
        <h2>My Classes</h2>
        {isTeacher && (
          <button className="create-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Class'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="create-form" onSubmit={handleCreate}>
          <input className="form-input" placeholder="Class Title" value={title} onChange={e => setTitle(e.target.value)} required />
          <input className="form-input" placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="form-input" placeholder="Schedule (e.g., Mon, Wed 10AM)" value={schedule} onChange={e => setSchedule(e.target.value)} />
          <button type="submit" className="submit-btn">Create Class</button>
        </form>
      )}

      <div className="classes-grid">
        {classes.map(cls => (
          <Link to={`/classes/${cls.id}`} key={cls.id} className="class-tile">
            <div className={`tile-header ${isTeacher ? 'tile-teacher' : 'tile-student'}`}>
              <h3>{cls.title}</h3>
              <span className="tile-subject">{cls.subject || 'Sanskrit'}</span>
            </div>
            <div className="tile-body">
              <p>{cls.description || 'No description'}</p>
              <div className="tile-footer">
                <span>{cls.schedule || 'No schedule'}</span>
                {isTeacher && <span>{cls.student_count} students</span>}
                {!isTeacher && cls.teacher_name && <span>{cls.teacher_name}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {classes.length === 0 && (
        <p className="empty">No classes found.</p>
      )}
    </div>
  );
}
