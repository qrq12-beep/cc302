// Global state
let tasks = [];
let currentFilter = {
    search: '',
    category: 'all',
    priority: 'all',
    status: 'all',
    sortBy: 'created'
};

// DOM Elements
const addTaskForm = document.getElementById('addTaskForm');
const editTaskForm = document.getElementById('editTaskForm');
const tasksList = document.getElementById('tasksList');
const modal = document.getElementById('editModal');
const closeModal = document.querySelector('.close');
const cancelEdit = document.getElementById('cancelEdit');
const clearCompletedBtn = document.getElementById('clearCompleted');

// Filter elements
const searchInput = document.getElementById('searchInput');
const filterCategory = document.getElementById('filterCategory');
const filterPriority = document.getElementById('filterPriority');
const filterStatus = document.getElementById('filterStatus');
const sortBy = document.getElementById('sortBy');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    addTaskForm.addEventListener('submit', handleAddTask);
    editTaskForm.addEventListener('submit', handleEditTask);
    closeModal.addEventListener('click', () => modal.style.display = 'none');
    cancelEdit.addEventListener('click', () => modal.style.display = 'none');
    clearCompletedBtn.addEventListener('click', handleClearCompleted);
    
    // Filter listeners
    searchInput.addEventListener('input', (e) => {
        currentFilter.search = e.target.value;
        renderTasks();
    });
    
    filterCategory.addEventListener('change', (e) => {
        currentFilter.category = e.target.value;
        renderTasks();
    });
    
    filterPriority.addEventListener('change', (e) => {
        currentFilter.priority = e.target.value;
        renderTasks();
    });
    
    filterStatus.addEventListener('change', (e) => {
        currentFilter.status = e.target.value;
        renderTasks();
    });
    
    sortBy.addEventListener('change', (e) => {
        currentFilter.sortBy = e.target.value;
        renderTasks();
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// API Functions
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        tasks = await response.json();
        renderTasks();
        updateStats();
    } catch (error) {
        console.error('Error loading tasks:', error);
    }
}

async function handleAddTask(e) {
    e.preventDefault();
    
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDescription').value,
        category: document.getElementById('taskCategory').value,
        priority: document.getElementById('taskPriority').value,
        due_date: document.getElementById('taskDueDate').value,
        tags: document.getElementById('taskTags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag)
    };
    
    try {
        const response = await fetch('/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const newTask = await response.json();
        tasks.push(newTask);
        renderTasks();
        updateStats();
        addTaskForm.reset();
        
        // Show success feedback
        showNotification('Task added successfully!', 'success');
    } catch (error) {
        console.error('Error adding task:', error);
        showNotification('Error adding task', 'error');
    }
}

async function toggleTask(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}/toggle`, {
            method: 'PUT'
        });
        
        const updatedTask = await response.json();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = updatedTask;
            renderTasks();
            updateStats();
        }
    } catch (error) {
        console.error('Error toggling task:', error);
    }
}

async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }
    
    try {
        await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        tasks = tasks.filter(t => t.id !== taskId);
        renderTasks();
        updateStats();
        showNotification('Task deleted successfully!', 'success');
    } catch (error) {
        console.error('Error deleting task:', error);
        showNotification('Error deleting task', 'error');
    }
}

function openEditModal(taskId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('editTaskId').value = task.id;
    document.getElementById('editTaskTitle').value = task.title;
    document.getElementById('editTaskDescription').value = task.description;
    document.getElementById('editTaskCategory').value = task.category;
    document.getElementById('editTaskPriority').value = task.priority;
    document.getElementById('editTaskDueDate').value = task.due_date;
    document.getElementById('editTaskTags').value = task.tags.join(', ');
    
    modal.style.display = 'block';
}

async function handleEditTask(e) {
    e.preventDefault();
    
    const taskId = parseInt(document.getElementById('editTaskId').value);
    const taskData = {
        title: document.getElementById('editTaskTitle').value,
        description: document.getElementById('editTaskDescription').value,
        category: document.getElementById('editTaskCategory').value,
        priority: document.getElementById('editTaskPriority').value,
        due_date: document.getElementById('editTaskDueDate').value,
        tags: document.getElementById('editTaskTags').value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag)
    };
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        const updatedTask = await response.json();
        const index = tasks.findIndex(t => t.id === taskId);
        if (index !== -1) {
            tasks[index] = updatedTask;
            renderTasks();
            updateStats();
        }
        
        modal.style.display = 'none';
        showNotification('Task updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating task:', error);
        showNotification('Error updating task', 'error');
    }
}

async function handleClearCompleted() {
    const completedTasks = tasks.filter(t => t.completed);
    
    if (completedTasks.length === 0) {
        showNotification('No completed tasks to clear', 'info');
        return;
    }
    
    if (!confirm(`Delete ${completedTasks.length} completed task(s)?`)) {
        return;
    }
    
    try {
        for (const task of completedTasks) {
            await fetch(`/api/tasks/${task.id}`, {
                method: 'DELETE'
            });
        }
        
        tasks = tasks.filter(t => !t.completed);
        renderTasks();
        updateStats();
        showNotification('Completed tasks cleared!', 'success');
    } catch (error) {
        console.error('Error clearing completed tasks:', error);
        showNotification('Error clearing tasks', 'error');
    }
}

// Rendering Functions
function renderTasks() {
    let filteredTasks = filterTasks();
    filteredTasks = sortTasks(filteredTasks);
    
    if (filteredTasks.length === 0) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <h3>No tasks found</h3>
                <p>Add a new task or adjust your filters</p>
            </div>
        `;
        return;
    }
    
    tasksList.innerHTML = filteredTasks.map(task => createTaskCard(task)).join('');
    
    // Attach event listeners
    filteredTasks.forEach(task => {
        const checkbox = document.querySelector(`#task-${task.id} .task-checkbox`);
        const editBtn = document.querySelector(`#task-${task.id} .btn-edit`);
        const deleteBtn = document.querySelector(`#task-${task.id} .btn-delete`);
        
        checkbox.addEventListener('change', () => toggleTask(task.id));
        editBtn.addEventListener('click', () => openEditModal(task.id));
        deleteBtn.addEventListener('click', () => deleteTask(task.id));
    });
}

function createTaskCard(task) {
    const dueStatus = getDueStatus(task.due_date);
    
    return `
        <div class="task-card ${task.completed ? 'completed' : ''}" id="task-${task.id}">
            <div class="task-header">
                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                <div class="task-content">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                    <div class="task-meta">
                        <span class="badge category">${task.category}</span>
                        <span class="badge priority-${task.priority.toLowerCase()}">${task.priority} Priority</span>
                        ${task.due_date ? `<span class="badge ${dueStatus.class}">${dueStatus.text}</span>` : ''}
                    </div>
                    ${task.tags.length > 0 ? `
                        <div class="task-tags">
                            ${task.tags.map(tag => `<span class="tag">#${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="task-actions">
                        <button class="btn-icon btn-edit">Edit</button>
                        <button class="btn-icon btn-delete">Delete</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function filterTasks() {
    return tasks.filter(task => {
        // Search filter
        if (currentFilter.search) {
            const searchLower = currentFilter.search.toLowerCase();
            const matchesSearch = 
                task.title.toLowerCase().includes(searchLower) ||
                task.description.toLowerCase().includes(searchLower) ||
                task.tags.some(tag => tag.toLowerCase().includes(searchLower));
            
            if (!matchesSearch) return false;
        }
        
        // Category filter
        if (currentFilter.category !== 'all' && task.category !== currentFilter.category) {
            return false;
        }
        
        // Priority filter
        if (currentFilter.priority !== 'all' && task.priority !== currentFilter.priority) {
            return false;
        }
        
        // Status filter
        if (currentFilter.status === 'pending' && task.completed) {
            return false;
        }
        if (currentFilter.status === 'completed' && !task.completed) {
            return false;
        }
        
        return true;
    });
}

function sortTasks(tasksToSort) {
    const sorted = [...tasksToSort];
    
    switch (currentFilter.sortBy) {
        case 'created':
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'dueDate':
            sorted.sort((a, b) => {
                if (!a.due_date) return 1;
                if (!b.due_date) return -1;
                return new Date(a.due_date) - new Date(b.due_date);
            });
            break;
        case 'priority':
            const priorityOrder = { 'High': 0, 'Medium': 1, 'Low': 2 };
            sorted.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
            break;
        case 'title':
            sorted.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }
    
    return sorted;
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('pendingTasks').textContent = pending;
}

// Utility Functions
function getDueStatus(dueDate) {
    if (!dueDate) {
        return { text: '', class: '' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
        return { text: `Overdue by ${Math.abs(diffDays)} day(s)`, class: 'overdue' };
    } else if (diffDays === 0) {
        return { text: 'Due Today', class: 'due-soon' };
    } else if (diffDays === 1) {
        return { text: 'Due Tomorrow', class: 'due-soon' };
    } else if (diffDays <= 3) {
        return { text: `Due in ${diffDays} days`, class: 'due-soon' };
    } else {
        return { text: `Due ${dueDate}`, class: 'due-date' };
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);