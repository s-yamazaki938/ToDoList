const SB_URL = 'https://tpemermrrxgdxppzewpn.supabase.co';
const SB_KEY = 'sb_publishable_zr76EeMU58HUMoJJivdDoQ_Hflm3xX8';
const client = supabase.createClient(SB_URL, SB_KEY);

let userObj = { id: 1, user_id: 'user' }, tasks = [], templates = [], currentFilter = 'all';
let currentScreen = 'screen-tasks', currentTemplateId = null, editingId = null;
let currentMode = 'task', selectedDate = new Date().toISOString().split('T')[0], calDate = new Date();

document.addEventListener('DOMContentLoaded', () => {
    // ログイン処理をスキップし、直接アプリを初期化
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    document.getElementById('user-display').innerText = `User: ${userObj.user_id}`;
    
    document.getElementById('dark-mode-toggle').onclick = () => document.body.classList.toggle('dark-mode');
    document.getElementById('nav-tasks').onclick = () => switchScreen('screen-tasks');
    document.getElementById('nav-templates').onclick = () => switchScreen('screen-templates');
    document.getElementById('back-to-templates').onclick = () => switchScreen('screen-templates');
    document.getElementById('save-btn').onclick = handleSave;
    document.getElementById('cancel-btn').onclick = closeModal;
    document.getElementById('del-btn').onclick = handleDelete;
    document.getElementById('prev-month').onclick = () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); };
    document.getElementById('next-month').onclick = () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); };
    document.getElementById('fab-add').onclick = () => {
        if (currentScreen === 'screen-tasks') openTaskModal();
        else if (currentScreen === 'screen-templates') addNewTemplate();
        else if (currentScreen === 'screen-template-detail') openTemplateItemModal();
    };
    document.querySelectorAll('#filter-toolbar .chip').forEach(c => c.onclick = (e) => {
        currentFilter = e.target.dataset.filter;
        document.querySelectorAll('#filter-toolbar .chip').forEach(x => x.classList.remove('selected'));
        e.target.classList.add('selected'); renderTasks();
    });
    document.getElementById('use-template-select').onchange = (e) => {
        document.getElementById('editor-fields').style.display = e.target.value ? 'none' : 'block';
    };
    
    // 初期画面を表示
    switchScreen('screen-tasks');
});



function switchScreen(id) {
    currentScreen = id;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.getElementById('nav-tasks').classList.toggle('active', id === 'screen-tasks');
    document.getElementById('nav-templates').classList.toggle('active', id.includes('template'));
    if (id === 'screen-tasks') fetchTasks();
    if (id === 'screen-templates') fetchTemplates();
}

async function fetchTasks() {
    const { data } = await client.from('tasks').select('*').eq('creator_id', userObj.id).order('limit_date', { ascending: true });
    tasks = data || []; renderTasks(); updateStats();
}

function renderTasks() {
    const list = document.getElementById('task-list'); list.innerHTML = '';
    tasks.filter(t => currentFilter === 'all' || t.category === currentFilter).forEach(t => {
        const div = document.createElement('div');
        div.className = `task-card priority-${t.priority} ${t.is_completed ? 'completed' : ''}`;
        div.innerHTML = `<div style="flex:1" onclick="toggleTask(${t.id}, ${t.is_completed})"><strong>${t.task_title}</strong><br><small>${t.limit_date} • ${t.priority}</small></div>
                         <button class="neu-btn" onclick="openTaskModal(${t.id})" style="width:30px;height:30px;"><i class="fas fa-pen"></i></button>`;
        list.appendChild(div);
    });
}

async function toggleTask(id, stat) { await client.from('tasks').update({ is_completed: stat ? 0 : 1 }).eq('id', id); fetchTasks(); }

async function fetchTemplates() {
    const { data } = await client.from('task_templates').select('*').eq('creator_id', userObj.id);
    templates = data || [];
    document.getElementById('template-list').innerHTML = templates.map(t => `<div class="template-card" onclick="viewTemplate(${t.id},'${t.template_name}')"><strong>${t.template_name}</strong></div>`).join('');
}

async function addNewTemplate() {
    const name = prompt("Template Name?"); if (!name) return;
    await client.from('task_templates').insert([{ template_name: name, creator_id: userObj.id }]); fetchTemplates();
}

async function viewTemplate(id, name) {
    currentTemplateId = id; document.getElementById('current-template-name').innerText = name;
    switchScreen('screen-template-detail'); fetchTemplateItems();
}

async function fetchTemplateItems() {
    const { data } = await client.from('template_items').select('*').eq('template_id', currentTemplateId);
    document.getElementById('template-item-list').innerHTML = data.map(i => `<div class="task-card"><strong>${i.title}</strong></div>`).join('');
}

function openTaskModal(id = null) {
    editingId = id; currentMode = 'task';
    const modal = document.getElementById('modal');
    document.getElementById('template-selector-area').style.display = id ? 'none' : 'block';
    document.getElementById('use-template-select').innerHTML = '<option value="">-- Manual --</option>' + templates.map(t => `<option value="${t.id}">${t.template_name}</option>`).join('');
    if (id) {
        const t = tasks.find(x => x.id === id);
        document.getElementById('main-input').value = t.task_title; selectedDate = t.limit_date;
        document.getElementById('del-btn').style.display = 'block';
    } else {
        document.getElementById('main-input').value = ''; selectedDate = new Date().toISOString().split('T')[0];
        document.getElementById('del-btn').style.display = 'none';
    }
    calDate = new Date(selectedDate); renderCalendar(); modal.classList.add('active');
}

function openTemplateItemModal() {
    editingId = null; currentMode = 'template-item';
    document.getElementById('template-selector-area').style.display = 'none';
    document.getElementById('calendar-container').style.display = 'none';
    document.getElementById('main-input').value = '';
    document.getElementById('modal').classList.add('active');
}

async function handleSave() {
    const title = document.getElementById('main-input').value, tid = document.getElementById('use-template-select').value;
    if (currentMode === 'task') {
        if (tid) {
            const { data } = await client.from('template_items').select('*').eq('template_id', tid);
            await client.from('tasks').insert(data.map(i => ({ task_title: i.title, priority: i.priority, category: i.category, limit_date: selectedDate, creator_id: userObj.id, is_completed: 0 })));
        } else {
            const p = { task_title: title, priority: document.getElementById('main-priority').value, category: document.getElementById('main-category').value, limit_date: selectedDate, creator_id: userObj.id };
            if (editingId) await client.from('tasks').update(p).eq('id', editingId);
            else await client.from('tasks').insert([{ ...p, is_completed: 0 }]);
        }
        fetchTasks();
    } else {
        await client.from('template_items').insert([{ title, template_id: currentTemplateId, priority: 'medium', category: 'none' }]);
        fetchTemplateItems();
    }
    closeModal();
}

async function handleDelete() { if (editingId) { await client.from('tasks').delete().eq('id', editingId); fetchTasks(); closeModal(); } }
function closeModal() { document.getElementById('modal').classList.remove('active'); }
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stat-done').innerText = tasks.filter(t => t.is_completed).length;
    document.getElementById('stat-overdue').innerText = tasks.filter(t => !t.is_completed && t.limit_date < today).length;
    document.getElementById('stat-remain').innerText = tasks.filter(t => !t.is_completed).length;
}
function renderCalendar() {
    const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
    const y = calDate.getFullYear(), m = calDate.getMonth();
    document.getElementById('cal-label').innerText = `${y}年 ${m+1}月`;
    const first = new Date(y, m, 1).getDay(), last = new Date(y, m+1, 0).getDate();
    for(let i=0; i<first; i++) grid.appendChild(document.createElement('div'));
    for(let i=1; i<=last; i++) {
        const d = document.createElement('div'); const dStr = `${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        d.className = `cal-day ${selectedDate === dStr ? 'selected' : ''}`; d.innerText = i;
        d.onclick = () => { selectedDate = dStr; renderCalendar(); }; grid.appendChild(d);
    }
}
