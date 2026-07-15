const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try { msg = (await res.json()).error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  listStudents: () => request('/auth/students'),
  createStudent: (data) => request('/auth/students', { method: 'POST', body: JSON.stringify(data) }),
  resetStudentPassword: (id, password) => request(`/auth/students/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  deleteStudent: (id) => request(`/auth/students/${id}`, { method: 'DELETE' }),

  // tests
  listTests: (type) => request('/tests' + (type ? `?type=${type}` : '')),
  testMeta: (id) => request(`/tests/${id}/meta`),
  uploadTest: (formData) => request('/tests', { method: 'POST', body: formData }),
  createWritingTest: (formData) => request('/tests/writing', { method: 'POST', body: formData }),
  deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),
  listMocks: () => request('/tests/mocks'),
  createMock: (title) => request('/tests/mocks', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteMock: (id) => request(`/tests/mocks/${id}`, { method: 'DELETE' }),

  // attempts
  submitAttempt: (data) => request('/attempts', { method: 'POST', body: JSON.stringify(data) }),
  myAttempts: (type) => request('/attempts/mine' + (type ? `?type=${type}` : '')),
  latestResults: () => request('/attempts/latest'),
  progress: () => request('/attempts/progress'),
  getAttempt: (id) => request(`/attempts/${id}`),
  allResults: () => request('/attempts'),
  pendingQueue: () => request('/attempts/queue/pending'),
  gradeAttempt: (id, band_final, feedback) => request(`/attempts/${id}/grade`, { method: 'PUT', body: JSON.stringify({ band_final, feedback }) }),
  postSpeakingScore: (student_id, band_final, mock_id) => request('/attempts/speaking', { method: 'POST', body: JSON.stringify({ student_id, band_final, mock_id }) }),

  // messages
  inbox: () => request('/messages/inbox'),
  unreadCount: () => request('/messages/unread-count'),
  markRead: (id) => request(`/messages/${id}/read`, { method: 'PUT' }),
  sendMessage: (to_user_id, body) => request('/messages', { method: 'POST', body: JSON.stringify({ to_user_id, body }) }),

  // motivation
  latestMotivation: () => request('/motivation/latest'),
  postMotivation: (message) => request('/motivation', { method: 'POST', body: JSON.stringify({ message }) })
};
