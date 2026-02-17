from flask import Flask, render_template, request, jsonify
from datetime import datetime
import json
import os

app = Flask(__name__)

TASKS_FILE    = 'tasks.json'
SUBTASKS_FILE = 'subtasks.json'

# ── persistence ────────────────────────────────

def load_tasks():
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_tasks(tasks):
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f, indent=2)

def load_subtasks():
    if os.path.exists(SUBTASKS_FILE):
        with open(SUBTASKS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_subtasks(subtasks):
    with open(SUBTASKS_FILE, 'w') as f:
        json.dump(subtasks, f, indent=2)

def next_subtask_id(subtasks):
    return max((s['id'] for s in subtasks), default=0) + 1

# ── pages ──────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')

# ── task routes ────────────────────────────────

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    return jsonify(load_tasks())

@app.route('/api/tasks', methods=['POST'])
def add_task():
    data  = request.json
    tasks = load_tasks()
    new_task = {
        'id':          max((t['id'] for t in tasks), default=0) + 1,
        'title':       data.get('title', ''),
        'description': data.get('description', ''),
        'category':    data.get('category', 'General'),
        'priority':    data.get('priority', 'Medium'),
        'due_date':    data.get('due_date', ''),
        'completed':   False,
        'created_at':  datetime.now().isoformat(),
        'tags':        data.get('tags', []),
    }
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    data  = request.json
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            task.update({
                'title':       data.get('title',       task['title']),
                'description': data.get('description', task['description']),
                'category':    data.get('category',    task['category']),
                'priority':    data.get('priority',    task['priority']),
                'due_date':    data.get('due_date',    task['due_date']),
                'completed':   data.get('completed',   task['completed']),
                'tags':        data.get('tags',        task['tags']),
            })
            save_tasks(tasks)
            return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [t for t in tasks if t['id'] != task_id]
    save_tasks(tasks)
    # cascade-delete subtasks
    subtasks = [s for s in load_subtasks() if s['task_id'] != task_id]
    save_subtasks(subtasks)
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/toggle', methods=['PUT'])
def toggle_task(task_id):
    tasks = load_tasks()
    for task in tasks:
        if task['id'] == task_id:
            task['completed'] = not task['completed']
            save_tasks(tasks)
            return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

# ── subtask routes ─────────────────────────────

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['GET'])
def get_subtasks(task_id):
    subs = [s for s in load_subtasks() if s['task_id'] == task_id]
    subs.sort(key=lambda s: s.get('order', 0))
    return jsonify(subs)

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
def add_subtask(task_id):
    data     = request.json
    subtasks = load_subtasks()
    task_subs = [s for s in subtasks if s['task_id'] == task_id]
    new_sub  = {
        'id':      next_subtask_id(subtasks),
        'task_id': task_id,
        'title':   data.get('title', '').strip(),
        'is_done': False,
        'order':   len(task_subs),
    }
    subtasks.append(new_sub)
    save_subtasks(subtasks)
    return jsonify(new_sub), 201

@app.route('/api/subtasks/<int:sub_id>', methods=['PUT'])
def update_subtask(sub_id):
    data     = request.json
    subtasks = load_subtasks()
    for sub in subtasks:
        if sub['id'] == sub_id:
            if 'title'   in data: sub['title']   = data['title']
            if 'is_done' in data: sub['is_done']  = data['is_done']
            if 'order'   in data: sub['order']    = data['order']
            save_subtasks(subtasks)
            return jsonify(sub)
    return jsonify({'error': 'Subtask not found'}), 404

@app.route('/api/subtasks/<int:sub_id>', methods=['DELETE'])
def delete_subtask(sub_id):
    subtasks = load_subtasks()
    subtasks = [s for s in subtasks if s['id'] != sub_id]
    save_subtasks(subtasks)
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/subtasks/reorder', methods=['PUT'])
def reorder_subtasks(task_id):
    """Body: { "order": [id, id, id, ...] } """
    data     = request.json
    new_order = data.get('order', [])
    subtasks = load_subtasks()
    id_to_pos = {sid: idx for idx, sid in enumerate(new_order)}
    for sub in subtasks:
        if sub['task_id'] == task_id and sub['id'] in id_to_pos:
            sub['order'] = id_to_pos[sub['id']]
    save_subtasks(subtasks)
    result = sorted([s for s in subtasks if s['task_id'] == task_id],
                    key=lambda s: s.get('order', 0))
    return jsonify(result)

# ── stats ──────────────────────────────────────

@app.route('/api/stats', methods=['GET'])
def get_stats():
    tasks = load_tasks()
    total     = len(tasks)
    completed = sum(1 for t in tasks if t['completed'])
    pending   = total - completed
    priority_counts = {
        'High':   sum(1 for t in tasks if t['priority'] == 'High'   and not t['completed']),
        'Medium': sum(1 for t in tasks if t['priority'] == 'Medium' and not t['completed']),
        'Low':    sum(1 for t in tasks if t['priority'] == 'Low'    and not t['completed']),
    }
    return jsonify({'total': total, 'completed': completed,
                    'pending': pending, 'priority_counts': priority_counts})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)