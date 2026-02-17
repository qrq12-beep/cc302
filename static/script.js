/* ══════════════════════════════════════════════
   TASKFLOW — script.js
   Full implementation: tasks + subtasks + stats
══════════════════════════════════════════════ */

// ── Global state ──────────────────────────────
var tasks = [];
var subtaskCache = {};   // taskId -> [subtask, ...]
var drawerTaskId = null; // which task the drawer is showing
var currentFilter = { search: '', category: 'all', priority: 'all', status: 'all', sortBy: 'created' };

// ── DOM refs (populated in DOMContentLoaded) ──
var tasksList, addTaskForm, editTaskForm, addFormWrap, editModal;
var taskDrawer, drawerBackdrop;

// ═════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
    tasksList      = document.getElementById('tasksList');
    addTaskForm    = document.getElementById('addTaskForm');
    editTaskForm   = document.getElementById('editTaskForm');
    addFormWrap    = document.getElementById('addFormWrap');
    editModal      = document.getElementById('editModal');
    taskDrawer     = document.getElementById('taskDrawer');
    drawerBackdrop = document.getElementById('drawerBackdrop');

    bindUI();
    loadTasks();
});

// ═════════════════════════════════════════════
//  UI BINDINGS
// ═════════════════════════════════════════════
function bindUI() {
    // Tabs
    document.querySelectorAll('.nav-item').forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });

    // Add-form toggle
    document.getElementById('toggleAddForm').addEventListener('click', function() {
        addFormWrap.classList.toggle('open');
    });
    document.getElementById('cancelAdd').addEventListener('click', function() {
        addFormWrap.classList.remove('open');
        addTaskForm.reset();
    });

    // Form submissions
    addTaskForm.addEventListener('submit', handleAddTask);
    editTaskForm.addEventListener('submit', handleEditTask);

    // Edit modal close
    document.getElementById('closeModal').addEventListener('click', closeEditModal);
    document.getElementById('cancelEdit').addEventListener('click', closeEditModal);
    editModal.addEventListener('click', function(e) { if (e.target === editModal) closeEditModal(); });

    // Filters
    document.getElementById('searchInput').addEventListener('input', function(e) { currentFilter.search = e.target.value; renderTasks(); });
    document.getElementById('filterCategory').addEventListener('change', function(e) { currentFilter.category = e.target.value; renderTasks(); });
    document.getElementById('filterPriority').addEventListener('change', function(e) { currentFilter.priority = e.target.value; renderTasks(); });
    document.getElementById('filterStatus').addEventListener('change', function(e) { currentFilter.status = e.target.value; renderTasks(); });
    document.getElementById('sortBy').addEventListener('change', function(e) { currentFilter.sortBy = e.target.value; renderTasks(); });
    document.getElementById('clearCompleted').addEventListener('click', handleClearCompleted);

    // Drawer
    document.getElementById('closeDrawer').addEventListener('click', closeDrawer);
    drawerBackdrop.addEventListener('click', closeDrawer);
    document.getElementById('drawerEditBtn').addEventListener('click', function() {
        if (drawerTaskId !== null) { closeDrawer(); openEditModal(drawerTaskId); }
    });
    document.getElementById('drawerDeleteBtn').addEventListener('click', function() {
        if (drawerTaskId !== null) { closeDrawer(); deleteTask(drawerTaskId); }
    });

    // Subtask add
    document.getElementById('subtaskAddBtn').addEventListener('click', handleAddSubtask);
    document.getElementById('subtaskInput').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
    });
}

// ── Tab switching ──────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    document.getElementById('tab-tasks').style.display = (tab === 'tasks') ? 'block' : 'none';
    document.getElementById('tab-stats').style.display = (tab === 'stats') ? 'block' : 'none';
    if (tab === 'stats') renderStats();
}

function closeEditModal() { editModal.classList.remove('open'); }

// ═════════════════════════════════════════════
//  DRAWER
// ═════════════════════════════════════════════
function openDrawer(taskId) {
    var task = tasks.find(function(t) { return t.id === taskId; });
    if (!task) return;
    drawerTaskId = taskId;

    // Header
    var priBadge = document.getElementById('drawerPriBadge');
    priBadge.textContent = task.priority;
    priBadge.className = 'badge badge-' + task.priority.toLowerCase();
    document.getElementById('drawerTitle').textContent = task.title;

    // Meta badges
    var due = getDueStatus(task.due_date);
    var metaHtml = '<span class="badge badge-category">' + esc(task.category) + '</span>';
    if (due.text) metaHtml += '<span class="badge ' + due.cls + '">' + due.text + '</span>';
    if (task.tags && task.tags.length) {
        task.tags.forEach(function(tag) { metaHtml += '<span class="tag">#' + esc(tag) + '</span>'; });
    }
    document.getElementById('drawerMeta').innerHTML = metaHtml;

    // Description
    var descEl = document.getElementById('drawerDesc');
    descEl.textContent = task.description || '';
    descEl.style.display = task.description ? 'block' : 'none';

    // Open panel
    taskDrawer.classList.add('open');
    drawerBackdrop.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Load subtasks
    loadSubtasks(taskId);
}

function closeDrawer() {
    taskDrawer.classList.remove('open');
    drawerBackdrop.classList.remove('open');
    document.body.style.overflow = '';
    drawerTaskId = null;
}

// ═════════════════════════════════════════════
//  TASK API
// ═════════════════════════════════════════════
function loadTasks() {
    fetch('/api/tasks')
        .then(function(r) { return r.json(); })
        .then(function(data) {
            tasks = data;
            // pre-fetch subtask counts so progress pills render immediately
            var fetches = tasks.map(function(t) {
                return fetch('/api/tasks/' + t.id + '/subtasks')
                    .then(function(r) { return r.json(); })
                    .then(function(subs) { subtaskCache[t.id] = subs; });
            });
            Promise.all(fetches).then(function() {
                renderTasks();
                updateSidebar();
            });
        })
        .catch(function(err) { console.error('loadTasks:', err); notify('Could not load tasks', 'error'); });
}

function handleAddTask(e) {
    e.preventDefault();
    var data = {
        title:       document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        category:    document.getElementById('taskCategory').value,
        priority:    document.getElementById('taskPriority').value,
        due_date:    document.getElementById('taskDueDate').value,
        tags:        document.getElementById('taskTags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
    };
    fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function(r) { return r.json(); })
        .then(function(task) {
            tasks.push(task);
            subtaskCache[task.id] = [];
            renderTasks();
            updateSidebar();
            addTaskForm.reset();
            addFormWrap.classList.remove('open');
            notify('Task added!', 'success');
        })
        .catch(function(err) { console.error(err); notify('Error adding task', 'error'); });
}

function handleEditTask(e) {
    e.preventDefault();
    var taskId = parseInt(document.getElementById('editTaskId').value);
    var data = {
        title:       document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        category:    document.getElementById('editTaskCategory').value,
        priority:    document.getElementById('editTaskPriority').value,
        due_date:    document.getElementById('editTaskDueDate').value,
        tags:        document.getElementById('editTaskTags').value.split(',').map(function(t) { return t.trim(); }).filter(Boolean)
    };
    fetch('/api/tasks/' + taskId, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function(r) { return r.json(); })
        .then(function(updated) {
            var idx = tasks.findIndex(function(t) { return t.id === taskId; });
            if (idx !== -1) tasks[idx] = updated;
            renderTasks();
            updateSidebar();
            closeEditModal();
            notify('Task updated!', 'success');
        })
        .catch(function(err) { console.error(err); notify('Error updating task', 'error'); });
}

function toggleTask(taskId) {
    fetch('/api/tasks/' + taskId + '/toggle', { method: 'PUT' })
        .then(function(r) { return r.json(); })
        .then(function(updated) {
            var idx = tasks.findIndex(function(t) { return t.id === taskId; });
            if (idx !== -1) tasks[idx] = updated;
            renderTasks();
            updateSidebar();
        })
        .catch(function(err) { console.error(err); });
}

function deleteTask(taskId) {
    if (!confirm('Delete this task and all its subtasks?')) return;
    fetch('/api/tasks/' + taskId, { method: 'DELETE' })
        .then(function() {
            tasks = tasks.filter(function(t) { return t.id !== taskId; });
            delete subtaskCache[taskId];
            renderTasks();
            updateSidebar();
            notify('Task deleted', 'success');
        })
        .catch(function(err) { console.error(err); notify('Error deleting task', 'error'); });
}

function handleClearCompleted() {
    var done = tasks.filter(function(t) { return t.completed; });
    if (!done.length) { notify('No completed tasks', 'info'); return; }
    if (!confirm('Delete ' + done.length + ' completed task(s)?')) return;
    Promise.all(done.map(function(t) { return fetch('/api/tasks/' + t.id, { method: 'DELETE' }); }))
        .then(function() {
            done.forEach(function(t) { delete subtaskCache[t.id]; });
            tasks = tasks.filter(function(t) { return !t.completed; });
            renderTasks();
            updateSidebar();
            notify('Cleared!', 'success');
        })
        .catch(function() { notify('Error clearing tasks', 'error'); });
}

function openEditModal(taskId) {
    var t = tasks.find(function(x) { return x.id === taskId; });
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

// ═════════════════════════════════════════════
//  SUBTASK API
// ═════════════════════════════════════════════
function loadSubtasks(taskId) {
    fetch('/api/tasks/' + taskId + '/subtasks')
        .then(function(r) { return r.json(); })
        .then(function(subs) {
            subtaskCache[taskId] = subs;
            renderSubtasks(taskId);
            // refresh pill on the task card
            refreshProgressPill(taskId);
        })
        .catch(function(err) { console.error('loadSubtasks:', err); });
}

function handleAddSubtask() {
    var input = document.getElementById('subtaskInput');
    var title = input.value.trim();
    if (!title || drawerTaskId === null) return;
    fetch('/api/tasks/' + drawerTaskId + '/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title })
    })
        .then(function(r) { return r.json(); })
        .then(function(sub) {
            subtaskCache[drawerTaskId] = subtaskCache[drawerTaskId] || [];
            subtaskCache[drawerTaskId].push(sub);
            input.value = '';
            renderSubtasks(drawerTaskId);
            refreshProgressPill(drawerTaskId);
        })
        .catch(function(err) { console.error(err); notify('Error adding subtask', 'error'); });
}

function toggleSubtask(subId) {
    var taskId = drawerTaskId;
    var subs   = subtaskCache[taskId] || [];
    var sub    = subs.find(function(s) { return s.id === subId; });
    if (!sub) return;
    fetch('/api/subtasks/' + subId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: !sub.is_done })
    })
        .then(function(r) { return r.json(); })
        .then(function(updated) {
            var idx = subs.findIndex(function(s) { return s.id === subId; });
            if (idx !== -1) subs[idx] = updated;
            renderSubtasks(taskId);
            refreshProgressPill(taskId);
        })
        .catch(function(err) { console.error(err); });
}

function deleteSubtask(subId) {
    var taskId = drawerTaskId;
    fetch('/api/subtasks/' + subId, { method: 'DELETE' })
        .then(function() {
            subtaskCache[taskId] = (subtaskCache[taskId] || []).filter(function(s) { return s.id !== subId; });
            renderSubtasks(taskId);
            refreshProgressPill(taskId);
        })
        .catch(function(err) { console.error(err); });
}

function renameSubtask(subId, newTitle) {
    fetch('/api/subtasks/' + subId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
    }).catch(function(err) { console.error(err); });
}

function reorderSubtasks(taskId, orderedIds) {
    fetch('/api/tasks/' + taskId + '/subtasks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderedIds })
    })
        .then(function(r) { return r.json(); })
        .then(function(subs) { subtaskCache[taskId] = subs; })
        .catch(function(err) { console.error(err); });
}

// ═════════════════════════════════════════════
//  RENDER — TASKS
// ═════════════════════════════════════════════
function renderTasks() {
    var list = applySorting(applyFilters(tasks));
    if (!list.length) {
        tasksList.innerHTML = '<div class="empty-state"><div class="empty-icon">🔭</div><h3>No tasks found</h3><p>Add a new task or adjust your filters</p></div>';
        return;
    }
    tasksList.innerHTML = list.map(taskCard).join('');
    list.forEach(function(task) {
        var card = document.getElementById('tc-' + task.id);
        if (!card) return;
        // clicking the body opens drawer
        card.querySelector('.task-body').addEventListener('click', function() { openDrawer(task.id); });
        // checkbox toggles task completion
        card.querySelector('.task-check').addEventListener('click', function(e) { e.stopPropagation(); toggleTask(task.id); });
        card.querySelector('.action-btn.edit').addEventListener('click', function(e) { e.stopPropagation(); openEditModal(task.id); });
        card.querySelector('.action-btn.delete').addEventListener('click', function(e) { e.stopPropagation(); deleteTask(task.id); });
    });
}

function taskCard(task) {
    var due    = getDueStatus(task.due_date);
    var priCls = 'priority-' + task.priority.toLowerCase();
    var tags   = (task.tags || []);
    var tagsHtml = tags.length ? '<div class="task-tags">' + tags.map(function(t) { return '<span class="tag">#' + esc(t) + '</span>'; }).join('') + '</div>' : '';

    // subtask progress pill
    var subs    = subtaskCache[task.id] || [];
    var subTotal = subs.length;
    var subDone  = subs.filter(function(s) { return s.is_done; }).length;
    var pillHtml = '';
    if (subTotal > 0) {
        var pct = Math.round((subDone / subTotal) * 100);
        pillHtml = '<span class="task-progress-pill">' +
            '<span class="pip-done">' + subDone + '</span> / ' + subTotal +
            '<span class="pill-mini-bar"><span class="pill-mini-bar-fill" style="width:' + pct + '%"></span></span>' +
            '</span>';
    }

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
        pillHtml +
        '</div>' +
        tagsHtml +
        '</div>' +
        '<div class="task-actions">' +
        '<button class="action-btn edit">Edit</button>' +
        '<button class="action-btn delete">Delete</button>' +
        '</div>' +
        '</div>' +
        '</div>';
}

// Refresh just the progress pill on an existing card without full re-render
function refreshProgressPill(taskId) {
    var card = document.getElementById('tc-' + taskId);
    if (!card) return;
    var subs     = subtaskCache[taskId] || [];
    var subTotal = subs.length;
    var subDone  = subs.filter(function(s) { return s.is_done; }).length;
    // update or remove the pill
    var existing = card.querySelector('.task-progress-pill');
    if (subTotal === 0) { if (existing) existing.remove(); return; }
    var pct = Math.round((subDone / subTotal) * 100);
    var pillHtml = '<span class="task-progress-pill">' +
        '<span class="pip-done">' + subDone + '</span> / ' + subTotal +
        '<span class="pill-mini-bar"><span class="pill-mini-bar-fill" style="width:' + pct + '%"></span></span>' +
        '</span>';
    if (existing) { existing.outerHTML = pillHtml; }
    else {
        var meta = card.querySelector('.task-meta');
        if (meta) meta.insertAdjacentHTML('beforeend', pillHtml);
    }
}

// ═════════════════════════════════════════════
//  RENDER — SUBTASKS (drawer)
// ═════════════════════════════════════════════
function renderSubtasks(taskId) {
    var subs     = subtaskCache[taskId] || [];
    var total    = subs.length;
    var done     = subs.filter(function(s) { return s.is_done; }).length;
    var pct      = total ? Math.round((done / total) * 100) : 0;

    // progress header
    var progEl = document.getElementById('subtaskProgress');
    progEl.textContent = done + ' / ' + total;
    progEl.className   = 'subtask-progress' + (total && done === total ? ' all-done' : '');

    // bar
    document.getElementById('subtaskBarFill').style.width = pct + '%';

    // list
    var listEl = document.getElementById('subtaskList');
    if (!total) { listEl.innerHTML = '<li style="color:var(--text-3);font-size:0.83rem;padding:4px 0">No subtasks yet</li>'; return; }

    listEl.innerHTML = subs.map(function(sub) {
        return '<li class="subtask-item' + (sub.is_done ? ' done' : '') + '" data-id="' + sub.id + '" draggable="true">' +
            '<span class="drag-handle" title="Drag to reorder">⣿</span>' +
            '<div class="subtask-check' + (sub.is_done ? ' checked' : '') + '" data-id="' + sub.id + '"></div>' +
            '<span class="subtask-title" contenteditable="true" data-id="' + sub.id + '">' + esc(sub.title) + '</span>' +
            '<button class="subtask-del" data-id="' + sub.id + '" title="Delete">✕</button>' +
            '</li>';
    }).join('');

    // bind events
    listEl.querySelectorAll('.subtask-check').forEach(function(el) {
        el.addEventListener('click', function() { toggleSubtask(parseInt(el.dataset.id)); });
    });
    listEl.querySelectorAll('.subtask-del').forEach(function(el) {
        el.addEventListener('click', function() { deleteSubtask(parseInt(el.dataset.id)); });
    });
    listEl.querySelectorAll('.subtask-title').forEach(function(el) {
        el.addEventListener('blur', function() {
            var newTitle = el.textContent.trim();
            if (newTitle) renameSubtask(parseInt(el.dataset.id), newTitle);
        });
        el.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
    });

    bindDragReorder(listEl, taskId);
}

// ── Drag-to-reorder ───────────────────────────
function bindDragReorder(listEl, taskId) {
    var dragSrc = null;

    listEl.querySelectorAll('.subtask-item').forEach(function(item) {
        item.addEventListener('dragstart', function(e) {
            dragSrc = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragend', function() {
            item.classList.remove('dragging');
            listEl.querySelectorAll('.subtask-item').forEach(function(i) { i.classList.remove('drag-over'); });
            // collect new order
            var orderedIds = [];
            listEl.querySelectorAll('.subtask-item').forEach(function(i) { orderedIds.push(parseInt(i.dataset.id)); });
            reorderSubtasks(taskId, orderedIds);
        });
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (item !== dragSrc) {
                listEl.querySelectorAll('.subtask-item').forEach(function(i) { i.classList.remove('drag-over'); });
                item.classList.add('drag-over');
                // insert dragged item before or after target
                var rect   = item.getBoundingClientRect();
                var midY   = rect.top + rect.height / 2;
                if (e.clientY < midY) { listEl.insertBefore(dragSrc, item); }
                else { listEl.insertBefore(dragSrc, item.nextSibling); }
            }
        });
        item.addEventListener('dragleave', function() { item.classList.remove('drag-over'); });
        item.addEventListener('drop', function(e) { e.preventDefault(); });
    });
}

// ═════════════════════════════════════════════
//  FILTERS & SORTING
// ═════════════════════════════════════════════
function applyFilters(list) {
    return list.filter(function(t) {
        if (currentFilter.search) {
            var q    = currentFilter.search.toLowerCase();
            var tags = (t.tags || []).map(function(g) { return g.toLowerCase(); });
            if (!(t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q) || tags.some(function(g) { return g.includes(q); }))) return false;
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
        s.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    } else if (currentFilter.sortBy === 'dueDate') {
        s.sort(function(a, b) { if (!a.due_date) return 1; if (!b.due_date) return -1; return new Date(a.due_date) - new Date(b.due_date); });
    } else if (currentFilter.sortBy === 'priority') {
        s.sort(function(a, b) { return order[a.priority] - order[b.priority]; });
    } else if (currentFilter.sortBy === 'title') {
        s.sort(function(a, b) { return a.title.localeCompare(b.title); });
    }
    return s;
}

// ═════════════════════════════════════════════
//  SIDEBAR
// ═════════════════════════════════════════════
function updateSidebar() {
    var total     = tasks.length;
    var completed = tasks.filter(function(t) { return t.completed; }).length;
    var pending   = total - completed;
    var pct       = total ? Math.round((completed / total) * 100) : 0;
    setText('sb-total',   total);
    setText('sb-pending', pending);
    setText('sb-done',    completed);
    setText('ring-pct',   pct + '%');
    var circ   = 2 * Math.PI * 22;
    var fill   = (pct / 100) * circ;
    var ringEl = document.getElementById('ring-fill');
    if (ringEl) ringEl.setAttribute('stroke-dasharray', fill + ' ' + circ);
}

// ═════════════════════════════════════════════
//  STATISTICS
// ═════════════════════════════════════════════
function renderStats() {
    var total     = tasks.length;
    var completed = tasks.filter(function(t) { return t.completed; }).length;
    var pending   = total - completed;
    var today     = new Date(); today.setHours(0, 0, 0, 0);
    var overdue   = tasks.filter(function(t) { return !t.completed && t.due_date && new Date(t.due_date) < today; }).length;
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
    var dEl   = document.getElementById('donut-done');
    var pEl   = document.getElementById('donut-pending');
    if (dEl) { dEl.setAttribute('stroke-dasharray', cArc + ' ' + circ); dEl.setAttribute('stroke-dashoffset', '0'); }
    if (pEl) { pEl.setAttribute('stroke-dasharray', pArc + ' ' + circ); pEl.setAttribute('stroke-dashoffset', '-' + cArc); }
    setText('donut-pct', (total ? Math.round((completed / total) * 100) : 0) + '%');
}

function renderPriorityChart() {
    var counts = { High: 0, Medium: 0, Low: 0 };
    tasks.forEach(function(t) { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    var max    = Math.max(counts.High, counts.Medium, counts.Low, 1);
    var colors = { High: 'var(--red)', Medium: 'var(--amber)', Low: 'var(--green)' };
    var el     = document.getElementById('priorityChart');
    if (!el) return;
    el.innerHTML = Object.keys(counts).map(function(label) {
        return '<div class="bar-row"><span class="bar-label">' + label + '</span>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((counts[label] / max) * 100) + '%;background:' + colors[label] + '"></div></div>' +
            '<span class="bar-count">' + counts[label] + '</span></div>';
    }).join('');
}

function renderCategoryChart() {
    var cats   = {};
    tasks.forEach(function(t) { cats[t.category] = (cats[t.category] || 0) + 1; });
    var sorted  = Object.entries(cats).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8);
    var max     = sorted.length ? sorted[0][1] : 1;
    var palette = ['var(--accent)', 'var(--blue)', 'var(--purple)', 'var(--green)', 'var(--amber)', 'var(--red)'];
    var el      = document.getElementById('categoryChart');
    if (!el) return;
    if (!sorted.length) { el.innerHTML = '<p style="padding:20px;color:var(--text-3);font-size:0.85rem">No tasks yet</p>'; return; }
    el.innerHTML = sorted.map(function(entry, i) {
        return '<div class="bar-row"><span class="bar-label" style="font-size:0.72rem">' + esc(entry[0]) + '</span>' +
            '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((entry[1] / max) * 100) + '%;background:' + palette[i % palette.length] + '"></div></div>' +
            '<span class="bar-count">' + entry[1] + '</span></div>';
    }).join('');
}

function renderTimeline() {
    var el = document.getElementById('timelineChart');
    if (!el) return;
    if (!tasks.length) { el.innerHTML = '<p style="color:var(--text-3);font-size:0.85rem">No tasks to display</p>'; return; }
    var today   = new Date(); today.setHours(0, 0, 0, 0);
    var buckets = {};
    for (var i = 5; i >= 0; i--) {
        var d   = new Date(today.getFullYear(), today.getMonth() - i, 1);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        buckets[key] = { label: d.toLocaleString('default', { month: 'short' }), done: 0, pending: 0, overdue: 0 };
    }
    tasks.forEach(function(t) {
        if (!t.created_at) return;
        var d   = new Date(t.created_at);
        var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!buckets[key]) return;
        var b = buckets[key];
        if (t.completed) { b.done++; } else if (t.due_date && new Date(t.due_date) < today) { b.overdue++; } else { b.pending++; }
    });
    var vals = Object.values(buckets);
    var maxV = Math.max.apply(null, vals.map(function(b) { return b.done + b.pending + b.overdue; }).concat([1]));
    var px   = function(n) { return Math.round((n / maxV) * 72); };
    el.innerHTML = vals.map(function(b) {
        var tot = b.done + b.pending + b.overdue;
        return '<div class="tl-col"><div class="tl-bar-wrap">' +
            (b.done    ? '<div class="tl-seg done"    style="height:' + px(b.done)    + 'px"></div>' : '') +
            (b.pending ? '<div class="tl-seg pending" style="height:' + px(b.pending) + 'px"></div>' : '') +
            (b.overdue ? '<div class="tl-seg overdue" style="height:' + px(b.overdue) + 'px"></div>' : '') +
            (!tot ? '<div class="tl-seg" style="height:3px;background:var(--surface2)"></div>' : '') +
            '</div><span class="tl-label">' + b.label + '</span></div>';
    }).join('');
}

function renderTagCloud() {
    var freq = {};
    tasks.forEach(function(t) { (t.tags || []).forEach(function(tag) { freq[tag] = (freq[tag] || 0) + 1; }); });
    var sorted = Object.entries(freq).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 20);
    var el     = document.getElementById('tagCloud');
    if (!el) return;
    if (!sorted.length) { el.innerHTML = '<p class="empty-hint">No tags yet</p>'; return; }
    var max = sorted[0][1];
    el.innerHTML = sorted.map(function(entry) {
        var size = (0.75 + (entry[1] / max) * 0.45).toFixed(2);
        return '<span class="tag-cloud-item" style="font-size:' + size + 'rem">#' + esc(entry[0]) + ' <small style="opacity:0.5">' + entry[1] + '</small></span>';
    }).join('');
}

// ═════════════════════════════════════════════
//  UTILITIES
// ═════════════════════════════════════════════
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
    n.className   = 'notif ' + type;
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(function() {
        n.style.animation = 'notifOut 0.3s forwards';
        setTimeout(function() { if (n.parentNode) n.remove(); }, 320);
    }, 2800);
}