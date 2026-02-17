from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime
import json, os, hashlib, secrets

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', secrets.token_hex(32))

USERS_FILE = 'users.json'

# ── helpers ────────────────────────────────────

def hash_pw(password):
    return hashlib.sha256(password.encode()).hexdigest()

def data_file(kind, username):
    safe = ''.join(c for c in username if c.isalnum() or c in '-_')
    return f'data_{safe}_{kind}.json'

# ── user store ─────────────────────────────────

def load_users():
    if os.path.exists(USERS_FILE):
        with open(USERS_FILE) as f:
            return json.load(f)
    return {}

def save_users(users):
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=2)

# ── per-user task / subtask store ─────────────

def load_tasks(username):
    path = data_file('tasks', username)
    return json.load(open(path)) if os.path.exists(path) else []

def save_tasks(username, tasks):
    with open(data_file('tasks', username), 'w') as f:
        json.dump(tasks, f, indent=2)

def load_subtasks(username):
    path = data_file('subtasks', username)
    return json.load(open(path)) if os.path.exists(path) else []

def save_subtasks(username, subtasks):
    with open(data_file('subtasks', username), 'w') as f:
        json.dump(subtasks, f, indent=2)

def next_id(items):
    return max((x['id'] for x in items), default=0) + 1

# ── auth guard ─────────────────────────────────

def current_user():
    return session.get('username')

def require_login():
    if not current_user():
        return jsonify({'error': 'Not logged in'}), 401
    return None

# ══════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════

@app.route('/')
def index():
    if not current_user():
        return redirect(url_for('login_page'))
    return render_template('index.html', username=current_user())

@app.route('/login')
def login_page():
    if current_user():
        return redirect(url_for('index'))
    return render_template('login.html')

@app.route('/api/register', methods=['POST'])
def register():
    data     = request.json or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 4:
        return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if not username.replace('_','').replace('-','').isalnum():
        return jsonify({'error': 'Username: letters, numbers, - _ only'}), 400
    users = load_users()
    if username in users:
        return jsonify({'error': 'Username already taken'}), 409
    users[username] = {'password': hash_pw(password), 'created_at': datetime.now().isoformat()}
    save_users(users)
    session['username'] = username
    return jsonify({'ok': True, 'username': username}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data     = request.json or {}
    username = data.get('username', '').strip().lower()
    password = data.get('password', '')
    users    = load_users()
    if username not in users or users[username]['password'] != hash_pw(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    session['username'] = username
    return jsonify({'ok': True, 'username': username})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/me', methods=['GET'])
def me():
    u = current_user()
    if not u:
        return jsonify({'error': 'Not logged in'}), 401
    return jsonify({'username': u})

# ══════════════════════════════════════════════
#  TASK ROUTES
# ══════════════════════════════════════════════

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    err = require_login()
    if err: return err
    return jsonify(load_tasks(current_user()))

@app.route('/api/tasks', methods=['POST'])
def add_task():
    err = require_login()
    if err: return err
    u     = current_user()
    data  = request.json
    tasks = load_tasks(u)
    new_task = {
        'id':          next_id(tasks),
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
    save_tasks(u, tasks)
    return jsonify(new_task), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    err = require_login()
    if err: return err
    u     = current_user()
    data  = request.json
    tasks = load_tasks(u)
    for task in tasks:
        if task['id'] == task_id:
            task.update({k: data.get(k, task[k]) for k in
                         ['title','description','category','priority','due_date','completed','tags']})
            save_tasks(u, tasks)
            return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    err = require_login()
    if err: return err
    u        = current_user()
    tasks    = [t for t in load_tasks(u) if t['id'] != task_id]
    subtasks = [s for s in load_subtasks(u) if s['task_id'] != task_id]
    save_tasks(u, tasks)
    save_subtasks(u, subtasks)
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/toggle', methods=['PUT'])
def toggle_task(task_id):
    err = require_login()
    if err: return err
    u     = current_user()
    tasks = load_tasks(u)
    for task in tasks:
        if task['id'] == task_id:
            task['completed'] = not task['completed']
            save_tasks(u, tasks)
            return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

# ══════════════════════════════════════════════
#  SUBTASK ROUTES
# ══════════════════════════════════════════════

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['GET'])
def get_subtasks(task_id):
    err = require_login()
    if err: return err
    subs = sorted([s for s in load_subtasks(current_user()) if s['task_id'] == task_id],
                  key=lambda s: s.get('order', 0))
    return jsonify(subs)

@app.route('/api/tasks/<int:task_id>/subtasks', methods=['POST'])
def add_subtask(task_id):
    err = require_login()
    if err: return err
    u        = current_user()
    data     = request.json
    subtasks = load_subtasks(u)
    task_subs = [s for s in subtasks if s['task_id'] == task_id]
    new_sub  = {
        'id':      next_id(subtasks),
        'task_id': task_id,
        'title':   data.get('title', '').strip(),
        'is_done': False,
        'order':   len(task_subs),
    }
    subtasks.append(new_sub)
    save_subtasks(u, subtasks)
    return jsonify(new_sub), 201

@app.route('/api/subtasks/<int:sub_id>', methods=['PUT'])
def update_subtask(sub_id):
    err = require_login()
    if err: return err
    u        = current_user()
    data     = request.json
    subtasks = load_subtasks(u)
    for sub in subtasks:
        if sub['id'] == sub_id:
            for key in ['title', 'is_done', 'order']:
                if key in data: sub[key] = data[key]
            save_subtasks(u, subtasks)
            return jsonify(sub)
    return jsonify({'error': 'Subtask not found'}), 404

@app.route('/api/subtasks/<int:sub_id>', methods=['DELETE'])
def delete_subtask(sub_id):
    err = require_login()
    if err: return err
    u        = current_user()
    subtasks = [s for s in load_subtasks(u) if s['id'] != sub_id]
    save_subtasks(u, subtasks)
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/subtasks/reorder', methods=['PUT'])
def reorder_subtasks(task_id):
    err = require_login()
    if err: return err
    u         = current_user()
    new_order = request.json.get('order', [])
    subtasks  = load_subtasks(u)
    id_to_pos = {sid: idx for idx, sid in enumerate(new_order)}
    for sub in subtasks:
        if sub['task_id'] == task_id and sub['id'] in id_to_pos:
            sub['order'] = id_to_pos[sub['id']]
    save_subtasks(u, subtasks)
    result = sorted([s for s in subtasks if s['task_id'] == task_id],
                    key=lambda s: s.get('order', 0))
    return jsonify(result)

# ══════════════════════════════════════════════
#  STATS
# ══════════════════════════════════════════════

@app.route('/api/stats', methods=['GET'])
def get_stats():
    err = require_login()
    if err: return err
    tasks     = load_tasks(current_user())
    total     = len(tasks)
    completed = sum(1 for t in tasks if t['completed'])
    pending   = total - completed
    priority_counts = {
        p: sum(1 for t in tasks if t['priority'] == p and not t['completed'])
        for p in ['High', 'Medium', 'Low']
    }
    return jsonify({'total': total, 'completed': completed,
                    'pending': pending, 'priority_counts': priority_counts})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)