/* ══════════════════════════════════════════════
   TASKFLOW — script.js
   Tasks + Statistics with custom SVG charts
══════════════════════════════════════════════ */

// ─── Global State ───
let tasks = [];
let currentFilter = {
    search: '', category: 'all', priority: 'all', status: 'all', sortBy: 'created'
};

// ─── DOM Refs (set after DOMContentLoaded) ───
let tasksList, addTaskForm, editTaskForm, addFormWrap, editModal;

// ══════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    tasksList    = document.getElementById('tasksList');
    addTaskForm  = document.getElementById('addTaskForm');
    editTaskForm = document.getElementById('editTaskForm');
    addFormWrap  = document.getElementById('addFormWrap');
    editModal    = document.getElementById('editModal');

    bindUI();
    loadTasks();
});

// ══════════════════════════════════════════════
//  UI BINDINGS
// ══════════════════════════════════════════════
function bindUI() {
    // Tab nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Add form toggle
    document.getElementById('toggleAddForm').addEventListener('click', () => {
        addFormWrap.classList.toggle('open');
    });
    document.getElementById('cancelAdd').addEventListener('click', () => {
        addFormWrap.classList.remove('open');
        addTaskForm.reset();
    });

    // Form submissions
    addTaskForm.addEventListener('submit', handleAddTask);
    editTaskForm.addEventListener('submit', handleEditTask);

    // Modal close
    document.getElementById('closeModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    editModal.addEventListener('click', e => { if (e.target === editModal) closeEditModal(); });

    // Filters
    document.getElementById('searchInput').addEventListener('input', e => {
        currentFilter.search = e.target.value; renderTasks();
    });
    document.getElementById('filterCategory').addEventListener('change', e => {
        currentFilter.category = e.target.value; renderTasks();
    });
    document.getElementById('filterPriority').addEventListener('change', e => {
        currentFilter.priority = e.target.value; renderTasks();
    });
    document.getElementById('filterStatus').addEventListener('change', e => {
        currentFilter.status = e.target.value; renderTasks();
    });
    document.getElementById('sortBy').addEventListener('change', e => {
        currentFilter.sortBy = e.target.value; renderTasks();
    });

    // Clear done
    document.getElementById('clearCompleted').addEventListener('click', handleClearCompleted);
}

// ── Tab switching ──
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('tab-tasks').style.display = (tab === 'tasks') ? 'block' : 'none';
    document.getElementById('tab-stats').style.display = (tab === 'stats') ? 'block' : 'none';
    if (tab === 'stats') renderStats();
}

function closeEditModal() {
    editModal.classList.remove('open');
}

// ══════════════════════════════════════════════
//  API LAYER
// ══════════════════════════════════════════════
async function loadTasks() {
    try {
        const res = await fetch('/api/tasks');
        tasks = await res.json();
        renderTasks();
        updateSidebar();
    } catch (err) {
        console.error('loadTasks:', err);
        notify('Could not load tasks', 'error');
    }
}

async function handleAddTask(e) {
    e.preventDefault();
    const data = {
        title:       document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        category:    document.getElementById('taskCategory').value,
        priority:    document.getElementById('taskPriority').value,
        due_date:    document.getElementById('taskDueDate').value,
        tags:        document.getElementById('taskTags').value
                        .split(',').map(t => t.trim()).filter(Boolean)
    };
    try {
        const res  = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const task = await res.json();
        tasks.push(task);
        renderTasks();
        updateSidebar();
        addTaskForm.reset();
        addFormWrap.classList.remove('open');
        notify('Task added!', 'success');
    } catch (err) {
        console.error('handleAddTask:', err);
        notify('Error adding task', 'error');
    }
}

async function handleEditTask(e) {
    e.preventDefault();
    const taskId = parseInt(document.getElementById('editTaskId').value);
    const data = {
        title:       document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        category:    document.getElementById('editTaskCategory').value,
        priority:    document.getElementById('editTaskPriority').value,
        due_date:    document.getElementById('editTaskDueDate').value,
        tags:        document.getElementById('editTaskTags').value
                        .split(',').map(t => t.trim()).filter(Boolean)
    };
    try {
        const res     = await fetch('/api/tasks/' + taskId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const updated = await res.json();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) tasks[idx] = updated;
        renderTasks();
        updateSidebar();
        closeEditModal();
        notify('Task updated!', 'success');
    } catch (err) {
        console.error('handleEditTask:', err);
        notify('Error updating task', 'error');
    }
}

async function toggleTask(taskId) {
    try {
        const res     = await fetch('/api/tasks/' + taskId + '/toggle', { method: 'PUT' });
        const updated = await res.json();
        const idx = tasks.findIndex(t => t.id === taskId);
        if (idx !== -1) tasks[idx] = updated;
        renderTasks();
        updateSidebar();
    } catch (err) {
        console.error('toggleTask:', err);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
        await fetch('/api/tasks/' + taskId, { method: 'DELETE' });
        tasks = tasks.filter(t => t.id !== taskId);
        renderTasks();
        updateSidebar();
        notify('Task deleted', 'success');
    } catch (err) {
        console.error('deleteTask:', err);
        notify('Error deleting task', 'error');
    }
}

async function handleClearCompleted() {
    const done = tasks.filter(t => t.completed);
    if (!done.length) { notify('No completed tasks', 'info'); return; }
    if (!confirm('Delete ' + done.length + ' completed task(s)?')) return;
    try {
        await Promise.all(done.map(t => fetch('/api/tasks/' + t.id, { method: 'DELETE' })));
        tasks = tasks.filter(t => !t.completed);
        renderTasks();
        updateSidebar();
        notify('Cleared completed tasks!', 'success');
    } catch (err) {
        console.error('handleClearCompleted:', err);
        notify('Error clearing tasks', 'error');
    }
}

// ══════════════════════════════════════════════
//  RENDER — TASKS
// ══════════════════════════════════════════════
function renderTasks() {
    let list = applyFilters(tasks);
    list = applySorting(list);

    if (!list.length) {
        tasksList.innerHTML =
            '<div class="empty-state">' +
            '<div class="empty-icon">🔭</div>' +
            '<h3>No tasks found</h3>' +
            '<p>Add a new task or adjust your filters</p>' +
            '</div>';
        return;
    }

    tasksList.innerHTML = list.map(taskCard).join('');

    list.forEach(task => {
        const card = document.getElementById('tc-' + task.id);
        if (!card) return;
        card.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
        card.querySelector('.action-btn.edit').addEventListener('click', () => openEditModal(task.id));
        card.querySelector('.action-btn.delete').addEventListener('click', () => deleteTask(task.id));
    });
}

function taskCard(task) {
    const due    = getDueStatus(task.due_date);
    const priCls = 'priority-' + task.priority.toLowerCase();
    const tagList = (task.tags || []);
    const tags   = tagList.length
        ? '<div class="task-tags">' + tagList.map(t => '<span class="tag">#' + esc(t) + '</span>').join('') + '</div>'
        : '';

    return '<div class="task-card ' + priCls + (task.completed ? ' completed' : '') + '" id="tc-' + task.id + '">' +
        '<div class="task-inner">' +
        '<div class="task-check' + (task.completed ? ' checked' : '') + '"></div>' +
        '<div class="task-body">' +
        '<div class="task-title">' + esc(task.title) + '</div>' +
        (task.description ? '<div class="task-desc">' + esc(task.description) + '</div>' : '') +
        '<div class="task-meta">' +
        '<span class="badge badge-category">' + esc(task.category) + '</span>' +
        '<span class="badge badge-' + task.priority.toLowerCase() + '">' + task.priority + '</span>' +
        (due.text ? '<span class="badge ' + due.cls + '">' + due.text + '</span>' : '') +
        '</div>' +
        tags +
        '</div>' +
        '<div class="task-actions">' +
        '<button class="action-btn edit">Edit</button>' +
        '<button class="action-btn delete">Delete</button>' +
        '</div>' +
        '</div>' +
        '</div>';
}

function openEditModal(taskId) {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    document.getElementById('editTaskId').value          = t.id;
    document.getElementById('editTaskTitle').value       = t.title;
    document.getElementById('editTaskDescription').value = t.description || '';
    document.getElementById('editTaskCategory').value    = t.category;
    document.getElementById('editTaskPriority').value    = t.priority;
    document.getElementById('editTaskDueDate').value     = t.due_date || '';
    document.getElementById('editTaskTags').value        = (t.tags || []).join(', ');
    editModal.classList.add('open');
}

function applyFilters(list) {
    return list.filter(t => {
        if (currentFilter.search) {
            var q = currentFilter.search.toLowerCase();
            var tags = (t.tags || []).map(g => g.toLowerCase());
            if (!(t.title.toLowerCase().includes(q) ||
                  (t.description || '').toLowerCase().includes(q) ||
                  tags.some(g => g.includes(q)))) return false;
        }
        if (currentFilter.category !== 'all' && t.category !== currentFilter.category) return false;
        if (currentFilter.priority !== 'all' && t.priority !== currentFilter.priority) return false;
        if (currentFilter.status === 'pending'   &&  t.completed) return false;
        if (currentFilter.status === 'completed' && !t.completed) return false;
        return true;
    });
}

function applySorting(list) {
    var s = list.slice();
    var order = { High: 0, Medium: 1, Low: 2 };
    if (currentFilter.sortBy === 'created') {
        s.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (currentFilter.sortBy === 'dueDate') {
        s.sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });
    } else if (currentFilter.sortBy === 'priority') {
        s.sort((a, b) => order[a.priority] - order[b.priority]);
    } else if (currentFilter.sortBy === 'title') {
        s.sort((a, b) => a.title.localeCompare(b.title));
    }
    return s;
}

// ══════════════════════════════════════════════
//  SIDEBAR
// ══════════════════════════════════════════════
function updateSidebar() {
    var total     = tasks.length;
    var completed = tasks.filter(t => t.completed).length;
    var pending   = total - completed;
    var pct       = total ? Math.round((completed / total) * 100) : 0;

    setText('sb-total',   total);
    setText('sb-pending', pending);
    setText('sb-done',    completed);
    setText('ring-pct',   pct + '%');

    var circ = 2 * Math.PI * 22;
    var fill = (pct / 100) * circ;
    var ringEl = document.getElementById('ring-fill');
    if (ringEl) ringEl.setAttribute('stroke-dasharray', fill + ' ' + circ);
}

// ══════════════════════════════════════════════
//  STATISTICS
// ══════════════════════════════════════════════
function renderStats() {
    var total     = tasks.length;
    var completed = tasks.filter(t => t.completed).length;
    var pending   = total - completed;
    var today     = new Date(); today.setHours(0, 0, 0, 0);
    var overdue   = tasks.filter(t => !t.completed && t.due_date && new Date(t.due_date) < today).length;
    var rate      = total ? Math.round((completed / total) * 100) : 0;

    setText('kpi-total',   total);
    setText('kpi-done',    completed);
    setText('kpi-pending', pending);
    setText('kpi-overdue', overdue);
    setText('kpi-rate',    rate + '%');

    renderDonut(completed, pending, total);
    renderPriorityChart();
    renderCategoryChart();
    renderTimeline();
    renderTagCloud();
}

function renderDonut(completed, pending, total) {
    var circ  = 2 * Math.PI * 48;
    var cArc  = total ? (completed / total) * circ : 0;
    var pArc  = total ? (pending   / total) * circ : 0;
    var doneEl    = document.getElementById('donut-done');
    var pendingEl = document.getElementById('donut-pending');
    if (doneEl) {
        doneEl.setAttribute('stroke-dasharray',  cArc + ' ' + circ);
        doneEl.setAttribute('stroke-dashoffset', '0');
    }
    if (pendingEl) {
        pendingEl.setAttribute('stroke-dasharray',  pArc + ' ' + circ);
        pendingEl.setAttribute('stroke-dashoffset', '-' + cArc);
    }
    setText('donut-pct', (total ? Math.round((completed / total) * 100) : 0) + '%');
}

function renderPriorityChart() {
    var counts = { High: 0, Medium: 0, Low: 0 };
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    var max    = Math.max(counts.High, counts.Medium, counts.Low, 1);
    var colors = { High: 'var(--red)', Medium: 'var(--amber)', Low: 'var(--green)' };
    var el     = document.getElementById('priorityChart');
    if (!el) return;
    el.innerHTML = Object.keys(counts).map(label =>
        '<div class="bar-row">' +
        '<span class="bar-label">' + label + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' +
        Math.round((counts[label] / max) * 100) + '%;background:' + colors[label] + '"></div></div>' +
        '<span class="bar-count">' + counts[label] + '</span>' +
        '</div>'
    ).join('');
}

function renderCategoryChart() {
    var cats = {};
    tasks.forEach(t => { cats[t.category] = (cats[t.category] || 0) + 1; });
    var sorted  = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8);
    var max     = sorted.length ? sorted[0][1] : 1;
    var palette = ['var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--amber)', 'var(--red)'];
    var el      = document.getElementById('categoryChart');
    if (!el) return;
    if (!sorted.length) { el.innerHTML = '<p style="padding:20px;color:var(--text-3);font-size:0.85rem">No tasks yet</p>'; return; }
    el.innerHTML = sorted.map(([label, count], i) =>
        '<div class="bar-row">' +
        '<span class="bar-label" style="font-size:0.72rem">' + esc(label) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' +
        Math.round((count / max) * 100) + '%;background:' + palette[i % palette.length] + '"></div></div>' +
        '<span class="bar-count">' + count + '</span>' +
        '</div>'
    ).join('');
}

function renderTimeline() {
    var el = document.getElementById('timelineChart');
    if (!el) return;
    if (!tasks.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:0.85rem">No tasks to display</p>'; return; }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var buckets = {};
    for (var i = 5; i >= 0; i--) {
        var d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        buckets[key] = { label: d.toLocaleString('default', { month: 'short' }), done: 0, pending: 0, overdue: 0 };
    }

    tasks.forEach(t => {
        if (!t.created_at) return;
        var d   = new Date(t.created_at);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!buckets[key]) return;
        var b = buckets[key];
        if (t.completed) { b.done++; }
        else if (t.due_date && new Date(t.due_date) < today) { b.overdue++; }
        else { b.pending++; }
    });

    var vals = Object.values(buckets);
    var maxV = Math.max.apply(null, vals.map(b => b.done + b.pending + b.overdue).concat([1]));
    var px   = n => Math.round((n / maxV) * 72);

    el.innerHTML = vals.map(b => {
        var total = b.done + b.pending + b.overdue;
        return '<div class="tl-col">' +
            '<div class="tl-bar-wrap">' +
            (b.done    ? '<div class="tl-seg done"    style="height:' + px(b.done)    + 'px"></div>' : '') +
            (b.pending ? '<div class="tl-seg pending" style="height:' + px(b.pending) + 'px"></div>' : '') +
            (b.overdue ? '<div class="tl-seg overdue" style="height:' + px(b.overdue) + 'px"></div>' : '') +
            (!total    ? '<div class="tl-seg" style="height:3px;background:var(--surface2)"></div>' : '') +
            '</div>' +
            '<span class="tl-label">' + b.label + '</span>' +
            '</div>';
    }).join('');
}

function renderTagCloud() {
    var freq = {};
    tasks.forEach(t => (t.tags || []).forEach(tag => { freq[tag] = (freq[tag] || 0) + 1; }));
    var sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20);
    var el     = document.getElementById('tagCloud');
    if (!el) return;
    if (!sorted.length) { el.innerHTML = '<p class="empty-hint">No tags yet</p>'; return; }
    var max = sorted[0][1];
    el.innerHTML = sorted.map(function(entry) {
        var tag = entry[0], count = entry[1];
        var size = (0.75 + (count / max) * 0.45).toFixed(2);
        return '<span class="tag-cloud-item" style="font-size:' + size + 'rem">#' + esc(tag) +
               ' <small style="opacity:0.5">' + count + '</small></span>';
    }).join('');
}

// ══════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════
function getDueStatus(due_date) {
    if (!due_date) return { text: '', cls: '' };
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var due   = new Date(due_date); due.setHours(0, 0, 0, 0);
    var diff  = Math.ceil((due - today) / 86400000);
    if (diff < 0)   return { text: 'Overdue ' + Math.abs(diff) + 'd', cls: 'badge-overdue' };
    if (diff === 0) return { text: 'Due Today',                         cls: 'badge-soon'    };
    if (diff === 1) return { text: 'Due Tomorrow',                      cls: 'badge-soon'    };
    if (diff <= 3)  return { text: 'Due in ' + diff + 'd',            cls: 'badge-soon'    };
    return              { text: 'Due ' + due_date,                      cls: 'badge-date'    };
}

function esc(str) {
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}

function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
}

function notify(msg, type) {
    type = type || 'info';
    var n = document.createElement('div');
    n.className = 'notif ' + type;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function() {
        n.style.animation = 'notifOut 0.3s forwards';
        setTimeout(function() { if (n.parentNode) n.remove(); }, 320);
    }, 2800);
}