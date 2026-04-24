const PAGE_SIZE = 10;

const state = {
  sessions: [],
  currentSessionId: null,
  currentPage: 1,
  totalPages: 1,
  total: 0,
  order: 'asc',
};

// ── DOM refs ────────────────────────────────────────
const $sessionSelect    = document.getElementById('session-select');
const $sessionInfo      = document.getElementById('session-info');
const $sessionDesc      = document.getElementById('session-description');
const $messagesCount    = document.getElementById('messages-count');
const $messagesContainer = document.getElementById('messages-container');
const $pageInfo         = document.getElementById('page-info');
const $pagination       = document.getElementById('pagination');
const $btnFirst         = document.getElementById('btn-first');
const $btnPrev          = document.getElementById('btn-prev');
const $btnNext          = document.getElementById('btn-next');
const $btnLast          = document.getElementById('btn-last');
const $btnOrder         = document.getElementById('btn-order');

// ── Helpers ─────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTimestamp(iso) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-CA');
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date} ${time}`;
  } catch {
    return iso;
  }
}

async function apiFetch(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Render ──────────────────────────────────────────
function renderSessions(sessions) {
  $sessionSelect.innerHTML = sessions
    .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');
}

function renderMessages(messages) {
  if (!messages.length) {
    $messagesContainer.innerHTML = '<div class="empty">No thoughts yet in this session.</div>';
    return;
  }

  const baseIndex = (state.currentPage - 1) * PAGE_SIZE;

  $messagesContainer.innerHTML = messages.map((msg, i) => {
    const num = state.order === 'asc'
      ? baseIndex + i + 1
      : state.total - baseIndex - i;

    return `
      <article class="thought">
        <div class="thought-header">
          <span class="thought-number">#${num}</span>
          <span class="thought-time">${escapeHtml(formatTimestamp(msg.timestamp))}</span>
        </div>
        <div class="thought-body">${escapeHtml(msg.text)}</div>
      </article>`;
  }).join('');
}

function updateUI() {
  $messagesCount.textContent =
    `${state.total} thought${state.total !== 1 ? 's' : ''}`;

  $btnOrder.textContent =
    state.order === 'asc' ? '⇅ Newest first' : '⇅ Oldest first';

  $pageInfo.textContent =
    `Page ${state.currentPage} of ${Math.max(1, state.totalPages)}`;

  $btnFirst.disabled = state.currentPage <= 1;
  $btnPrev.disabled  = state.currentPage <= 1;
  $btnNext.disabled  = state.currentPage >= state.totalPages;
  $btnLast.disabled  = state.currentPage >= state.totalPages;

  if (state.totalPages <= 1) {
    $pagination.classList.add('hidden');
  } else {
    $pagination.classList.remove('hidden');
  }
}

// ── Data loading ─────────────────────────────────────
async function fetchAndRender() {
  $messagesContainer.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const data = await apiFetch(
      `/api/sessions/${state.currentSessionId}/messages` +
      `?page=${state.currentPage}&order=${state.order}&limit=${PAGE_SIZE}`
    );
    state.totalPages = data.totalPages || 1;
    state.total      = data.total || 0;
    renderMessages(data.messages || []);
    updateUI();
  } catch {
    $messagesContainer.innerHTML =
      '<div class="error">Failed to load messages. Please try again.</div>';
  }
}

async function selectSession(sessionId) {
  state.currentSessionId = sessionId;
  state.order = 'asc';

  const session = state.sessions.find(s => String(s.id) === String(sessionId));
  if (session?.description) {
    $sessionDesc.textContent = session.description;
    $sessionInfo.classList.remove('hidden');
  } else {
    $sessionInfo.classList.add('hidden');
  }

  $messagesContainer.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const data = await apiFetch(
      `/api/sessions/${sessionId}/messages?page=1&order=asc&limit=${PAGE_SIZE}`
    );
    state.totalPages      = data.totalPages || 1;
    state.total           = data.total || 0;
    state.currentPage     = 1;
    renderMessages(data.messages || []);
    updateUI();
  } catch {
    $messagesContainer.innerHTML =
      '<div class="error">Failed to load session.</div>';
  }
}

// ── Event listeners ──────────────────────────────────
$sessionSelect.addEventListener('change', () => {
  selectSession($sessionSelect.value);
});

$btnFirst.addEventListener('click', () => {
  state.currentPage = 1;
  fetchAndRender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$btnPrev.addEventListener('click', () => {
  if (state.currentPage > 1) {
    state.currentPage--;
    fetchAndRender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$btnNext.addEventListener('click', () => {
  if (state.currentPage < state.totalPages) {
    state.currentPage++;
    fetchAndRender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$btnLast.addEventListener('click', () => {
  state.currentPage = state.totalPages;
  fetchAndRender();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$btnOrder.addEventListener('click', () => {
  // Mirror the page position so the user stays in the same part of the session
  const mirrored = state.totalPages - state.currentPage + 1;
  state.order = state.order === 'asc' ? 'desc' : 'asc';
  state.currentPage = Math.max(1, Math.min(mirrored, state.totalPages));
  fetchAndRender();
});

// ── Init ─────────────────────────────────────────────
(async () => {
  try {
    const data = await apiFetch('/api/sessions');
    state.sessions = data.sessions || [];

    if (!state.sessions.length) {
      $messagesContainer.innerHTML =
        '<div class="empty">No sessions yet — the agent has not started thinking.</div>';
      $sessionSelect.innerHTML = '<option>No sessions available</option>';
      return;
    }

    renderSessions(state.sessions);
    await selectSession(state.sessions[0].id);
  } catch {
    $messagesContainer.innerHTML =
      '<div class="error">Could not connect to the server.</div>';
  }
})();
