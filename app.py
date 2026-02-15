from flask import Flask, render_template, request, jsonify, redirect, url_for
from datetime import datetime
import json
import os

app = Flask(__name__)

# File to store tasks
TASKS_FILE = 'tasks.json'

def load_tasks():
    """Load tasks from JSON file"""
    if os.path.exists(TASKS_FILE):
        with open(TASKS_FILE, 'r') as f:
            return json.load(f)
    return []

def save_tasks(tasks):
    """Save tasks to JSON file"""
    with open(TASKS_FILE, 'w') as f:
        json.dump(tasks, f, indent=2)

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks"""
    tasks = load_tasks()
    return jsonify(tasks)

@app.route('/api/tasks', methods=['POST'])
def add_task():
    """Add a new task"""
    data = request.json
    tasks = load_tasks()
    
    new_task = {
        'id': max([task['id'] for task in tasks], default=0) + 1,
        'title': data.get('title', ''),
        'description': data.get('description', ''),
        'category': data.get('category', 'General'),
        'priority': data.get('priority', 'Medium'),
        'due_date': data.get('due_date', ''),
        'completed': False,
        'created_at': datetime.now().isoformat(),
        'tags': data.get('tags', [])
    }
    
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    """Update an existing task"""
    data = request.json
    tasks = load_tasks()
    
    for task in tasks:
        if task['id'] == task_id:
            task.update({
                'title': data.get('title', task['title']),
                'description': data.get('description', task['description']),
                'category': data.get('category', task['category']),
                'priority': data.get('priority', task['priority']),
                'due_date': data.get('due_date', task['due_date']),
                'completed': data.get('completed', task['completed']),
                'tags': data.get('tags', task['tags'])
            })
            save_tasks(tasks)
            return jsonify(task)
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task"""
    tasks = load_tasks()
    tasks = [task for task in tasks if task['id'] != task_id]
    save_tasks(tasks)
    return jsonify({'success': True})

@app.route('/api/tasks/<int:task_id>/toggle', methods=['PUT'])
def toggle_task(task_id):
    """Toggle task completion status"""
    tasks = load_tasks()
    
    for task in tasks:
        if task['id'] == task_id:
            task['completed'] = not task['completed']
            save_tasks(tasks)
            return jsonify(task)
    
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get task statistics"""
    tasks = load_tasks()
    total = len(tasks)
    completed = sum(1 for task in tasks if task['completed'])
    pending = total - completed
    
    priority_counts = {
        'High': sum(1 for task in tasks if task['priority'] == 'High' and not task['completed']),
        'Medium': sum(1 for task in tasks if task['priority'] == 'Medium' and not task['completed']),
        'Low': sum(1 for task in tasks if task['priority'] == 'Low' and not task['completed'])
    }
    
    return jsonify({
        'total': total,
        'completed': completed,
        'pending': pending,
        'priority_counts': priority_counts
    })

# ✅ FIXED FOR DOCKER
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
