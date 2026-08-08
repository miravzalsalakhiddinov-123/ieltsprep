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
  register: (name, username, password, email) => request('/auth/register', { method: 'POST', body: JSON.stringify({ name, username, password, email }) }),
  verifyEmail: (token) => request(`/auth/verify?token=${encodeURIComponent(token)}`),
  resendVerification: (username) => request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ username }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  listStudents: () => request('/auth/students'),
  createStudent: (data) => request('/auth/students', { method: 'POST', body: JSON.stringify(data) }),
  resetStudentPassword: (id, password) => request(`/auth/students/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  deleteStudent: (id) => request(`/auth/students/${id}`, { method: 'DELETE' }),

  // tests
  listTests: (type) => request('/tests' + (type ? `?type=${type}` : '')),
  testsWithProgress: (type) => request('/tests/with-progress' + (type ? `?type=${type}` : '')),
  testMeta: (id) => request(`/tests/${id}/meta`),
  uploadTest: (formData) => request('/tests', { method: 'POST', body: formData }),
  replaceTestFile: (id, formData) => request(`/tests/${id}/file`, { method: 'PATCH', body: formData }),
  createWritingTest: (formData) => request('/tests/writing', { method: 'POST', body: formData }),
  deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),
  setTestMock: (id, mockId) => request(`/tests/${id}/mock`, { method: 'PATCH', body: JSON.stringify({ mock_id: mockId }) }),
  setTestPart: (id, partScope, partNumber) => request(`/tests/${id}/part`, { method: 'PATCH', body: JSON.stringify({ part_scope: partScope, part_number: partNumber }) }),
  listMocks: () => request('/tests/mocks'),
  createMock: (title) => request('/tests/mocks', { method: 'POST', body: JSON.stringify({ title }) }),
  deleteMock: (id) => request(`/tests/mocks/${id}`, { method: 'DELETE' }),

  // attempts
  submitAttempt: (data) => request('/attempts', { method: 'POST', body: JSON.stringify(data) }),
  myAttempts: (type) => request('/attempts/mine' + (type ? `?type=${type}` : '')),
  weakAreas: (type) => request(`/attempts/weak-areas?type=${type}`),
  backfillQtypes: () => request('/attempts/backfill-qtypes', { method: 'POST' }),
  latestResults: () => request('/attempts/latest'),
  progress: () => request('/attempts/progress'),
  getAttempt: (id) => request(`/attempts/${id}`),
  allResults: () => request('/attempts'),
  pendingQueue: () => request('/attempts/queue/pending'),
  gradeAttempt: (id, band_final, feedback) => request(`/attempts/${id}/grade`, { method: 'PUT', body: JSON.stringify({ band_final, feedback }) }),
  resetAttempt: (id) => request(`/attempts/${id}`, { method: 'DELETE' }),
  postSpeakingScore: (student_id, band_final, mock_id) => request('/attempts/speaking', { method: 'POST', body: JSON.stringify({ student_id, band_final, mock_id }) }),

  // leaderboard
  leaderboard: () => request('/attempts/leaderboard'),

  // lessons (speaking/writing samples)
  listLessons: (params = {}) => {
    const { skill, kind } = typeof params === 'string' ? { skill: params } : params;
    const qs = new URLSearchParams();
    if (skill) qs.set('skill', skill);
    if (kind) qs.set('kind', kind);
    const q = qs.toString();
    return request('/lessons' + (q ? `?${q}` : ''));
  },
  getLesson: (id) => request(`/lessons/${id}`),
  createLesson: (formData) => request('/lessons', { method: 'POST', body: formData }),
  updateLesson: (id, formData) => request(`/lessons/${id}`, { method: 'PUT', body: formData }),
  deleteLesson: (id) => request(`/lessons/${id}`, { method: 'DELETE' }),

  // vocabulary trainer
  listVocabCategories: () => request('/vocab/categories'),
  createVocabCategory: (name, description) => request('/vocab/categories', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updateVocabCategory: (id, name, description) => request(`/vocab/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name, description }) }),
  deleteVocabCategory: (id) => request(`/vocab/categories/${id}`, { method: 'DELETE' }),
  listVocabSets: (categoryId) => request(`/vocab/categories/${categoryId}/sets`),
  getVocabSet: (id) => request(`/vocab/sets/${id}`),
  createVocabSet: (category_id, name) => request('/vocab/sets', { method: 'POST', body: JSON.stringify({ category_id, name }) }),
  updateVocabSet: (id, data) => request(`/vocab/sets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVocabSet: (id) => request(`/vocab/sets/${id}`, { method: 'DELETE' }),
  addVocabWord: (setId, english, russian, uzbek) => request(`/vocab/sets/${setId}/words`, { method: 'POST', body: JSON.stringify({ english, russian, uzbek }) }),
  bulkAddVocabWords: (setId, text) => request(`/vocab/sets/${setId}/words/bulk`, { method: 'POST', body: JSON.stringify({ text }) }),
  updateVocabWord: (id, english, russian, uzbek) => request(`/vocab/words/${id}`, { method: 'PUT', body: JSON.stringify({ english, russian, uzbek }) }),
  deleteVocabWord: (id) => request(`/vocab/words/${id}`, { method: 'DELETE' }),

  // messages
  inbox: () => request('/messages/inbox'),
  unreadCount: () => request('/messages/unread-count'),
  markRead: (id) => request(`/messages/${id}/read`, { method: 'PUT' }),
  sendMessage: (to_user_id, body) => request('/messages', { method: 'POST', body: JSON.stringify({ to_user_id, body }) }),

  // motivation
  latestMotivation: () => request('/motivation/latest'),
  postMotivation: (message) => request('/motivation', { method: 'POST', body: JSON.stringify({ message }) }),

  // blog (mini-blog, admin-authored)
  listBlogPosts: (limit) => request('/blog' + (limit ? `?limit=${limit}` : '')),
  getBlogPost: (id) => request(`/blog/${id}`),
  createBlogPost: (title, body) => request('/blog', { method: 'POST', body: JSON.stringify({ title, body }) }),
  updateBlogPost: (id, title, body) => request(`/blog/${id}`, { method: 'PUT', body: JSON.stringify({ title, body }) }),
  deleteBlogPost: (id) => request(`/blog/${id}`, { method: 'DELETE' })
};
