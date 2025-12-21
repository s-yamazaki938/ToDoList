// --- Configuration & State ---
const SB_URL = 'https://tpemermrrxgdxppzewpn.supabase.co';
const SB_KEY = 'sb_publishable_zr76EeMU58HUMoJJivdDoQ_Hflm3xX8';
const client = supabase.createClient(SB_URL, SB_KEY);

let userObj = null; 
let tasks = [];
let currentFilter = 'all';
let editingId = null;
let calDate = new Date();
let selectedDate = new Date().toISOString().split('T')[0];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Event Listeners
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('dark-mode-toggle').addEventListener('click', toggleDarkMode);
    document.getElementById('add-task-fab').addEventListener('click', () => openModal());
    document.getElementById('save-btn').addEventListener('click', saveTask);
    document.getElementById('cancel-btn').addEventListener('click', closeModal);
    document.getElementById('del-btn').addEventListener('click', deleteTask);
    document.getElementById('prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => changeMonth(1));

    // Filter Chips
    document.querySelectorAll('#filter-toolbar .chip').forEach(chip => {
        chip.addEventListener('click', (e) => setFilter(e.target.dataset.filter, e.target));
    });
});

// --- Auth Functions ---
async function handleLogin() {
    const uid = document.getElementById('login-id').value;
    const upw = document.getElementById('login-pw').value;
    
    const { data, error } = await client.from('users').select('*').eq('user_id', uid).eq('password', upw).single();
    
    if (error || !data) return alert("認証失敗");
    
    userObj = data;
    await client.from('users').update({ updated_at: new Date().toISOString() }).eq('id', userObj.id);
    
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('user-display').innerText = `Logged in: ${userObj.user_id}`;
    
    fetchTasks();
}

// --- Data Operations ---
async function fetchTasks() {
    setStatus("Syncing...");
    const { data, error } = await client.from('tasks')
        .select('*')
        .eq('creator_id', userObj.id)
        .order('is_completed', { ascending: true })
        .order('limit_date', { ascending: true });
    
    if (!error) tasks = data;
    renderTasks(); 
    updateStats();
    setStatus("Synced");
}

async function saveTask() {
    const title = document.getElementById('task-input').value.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const payload = {
        task_title: title, 
        limit_date: selectedDate,
        priority: document.getElementById('task-priority').value,
        category: document.getElementById('task-category').value,
        updated_at: now, 
        updater_id: userObj.id
    };

    if (editingId) {
        await client.from('tasks').update(payload).eq('id', editingId);
    } else {
        await client.from('tasks').insert([{ ...payload, is_completed: 0, creator_id: userObj.id, created_at: now }]);
    }
    
    closeModal(); 
    fetchTasks();
}

async function toggleTask(e, id, status) {
    e.stopPropagation();
    await client.from('tasks').update({ 
        is_completed: status === 1 ? 0 : 1, 
        updated_at: new Date().toISOString(), 
        updater_id: userObj.id 
    }).eq('id', id);
    fetchTasks();
}

async function deleteTask() {
    if (!confirm("Remove this task?")) return;
    await client.from('tasks').delete().eq('id', editingId);
    closeModal(); 
    fetchTasks();
}

// --- UI Rendering ---
function renderTasks() {
    const list = document.getElementById('task-list'); 
    list.innerHTML = '';
    const today = new Date().toISOString().split('T')[0];

    tasks.filter(t => currentFilter === 'all' || t.category === currentFilter).forEach(t => {
        const li = document.createElement('li');
        li.className = `task-card priority-${t.priority} ${t.is_completed === 1 ? 'completed' : ''}`;
        
        const isOverdue = t.is_completed === 0 && t.limit_date < today;
        
        li.innerHTML = `
            <div>
                <span class="task-toggle-area" style="font-size:17px; font-weight:bold; display:block; margin-bottom:8px;">${t.task_title}</span>
                <div style="font-size:12px; color:var(--accent-blue); display:flex; justify-content:space-between;">
                    <span style="${isOverdue ? 'color:var(--accent-red)' : ''}"><i class="far fa-clock"></i> ${t.limit_date}</span>
                    <span class="edit-trigger">${t.category.toUpperCase()} <i class="fas fa-edit"></i></span>
                </div>
            </div>
        `;

        // クリックイベントの委譲
        li.querySelector('.task-toggle-area').onclick = (e) => toggleTask(e, t.id, t.is_completed);
        li.querySelector('.edit-trigger').onclick = (e) => {
            e.stopPropagation();
            openModal(t.id);
        };

        list.appendChild(li);
    });
}

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stat-done').innerText = tasks.filter(t => t.is_completed === 1).length;
    document.getElementById('stat-overdue').innerText = tasks.filter(t => t.is_completed === 0 && t.limit_date < today).length;
    document.getElementById('stat-remain').innerText = tasks.filter(t => t.is_completed === 0).length;
}

function setFilter(cat, el) {
    currentFilter = cat;
    document.querySelectorAll('#filter-toolbar .neu-btn').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    renderTasks();
}

function toggleDarkMode() { document.body.classList.toggle('dark-mode'); }
function setStatus(s) { document.getElementById('sync-info').innerText = s; }

// --- Modal & Calendar Logic ---
function openModal(id = null) {
    editingId = id;
    if (id) {
        const t = tasks.find(x => x.id === id);
        document.getElementById('task-input').value = t.task_title;
        document.getElementById('task-priority').value = t.priority;
        document.getElementById('task-category').value = t.category;
        selectedDate = t.limit_date;
        document.getElementById('del-btn').style.display = 'block';
    } else {
        document.getElementById('task-input').value = '';
        selectedDate = new Date().toISOString().split('T')[0];
        document.getElementById('del-btn').style.display = 'none';
    }
    calDate = new Date(selectedDate); 
    renderCalendar();
    document.getElementById('modal').classList.add('active');
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

function changeMonth(m) { 
    calDate.setMonth(calDate.getMonth() + m); 
    renderCalendar(); 
}

function renderCalendar() {
    const grid = document.getElementById('cal-grid'); 
    grid.innerHTML = '';
    const y = calDate.getFullYear(), m = calDate.getMonth();
    
    document.getElementById('cal-label').innerText = `${y}年 ${m+1}月`;
    
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m+1, 0).getDate();
    
    for(let i=0; i<first; i++) grid.appendChild(document.createElement('div'));
    
    for(let i=1; i<=last; i++) {
        const day = document.createElement('div');
        const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        day.className = `cal-day ${selectedDate === dStr ? 'selected' : ''}`;
        day.innerText = i;
        day.onclick = () => { 
            selectedDate = dStr; 
            renderCalendar(); 
        };
        grid.appendChild(day);
    }
}