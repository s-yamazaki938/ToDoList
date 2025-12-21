const SB_URL = 'https://tpemermrrxgdxppzewpn.supabase.co';
const SB_KEY = 'sb_publishable_zr76EeMU58HUMoJJivdDoQ_Hflm3xX8';
const client = supabase.createClient(SB_URL, SB_KEY);

// State
let userObj = null;
let tasks = [];
let templates = [];
let currentScreen = 'screen-tasks';
let currentTemplateId = null;
let editingId = null; // タスクIDまたはテンプレートアイテムID
let currentMode = 'task'; // 'task' or 'template-item'
let selectedDate = new Date().toISOString().split('T')[0];
let calDate = new Date();
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    initEvents();
});

function initEvents() {
    document.getElementById('login-btn').onclick = handleLogin;
    document.getElementById('dark-mode-toggle').onclick = () => document.body.classList.toggle('dark-mode');
    
    // ナビゲーション
    document.getElementById('nav-tasks').onclick = () => switchScreen('screen-tasks');
    document.getElementById('nav-templates').onclick = () => switchScreen('screen-templates');
    document.getElementById('back-to-templates').onclick = () => switchScreen('screen-templates');

    // モーダル操作
    document.getElementById('cancel-btn').onclick = closeModal;
    document.getElementById('save-btn').onclick = handleSave;
    document.getElementById('del-btn').onclick = handleDelete;
    document.getElementById('prev-month').onclick = () => changeMonth(-1);
    document.getElementById('next-month').onclick = () => changeMonth(1);

    // FAB
    document.getElementById('fab-add').onclick = () => {
        if (currentScreen === 'screen-tasks') openTaskModal();
        else if (currentScreen === 'screen-templates') addNewTemplate();
        else if (currentScreen === 'screen-template-detail') openTemplateItemModal();
    };

    // フィルタ
    document.querySelectorAll('#filter-toolbar .chip').forEach(chip => {
        chip.onclick = (e) => {
            currentFilter = e.target.dataset.filter;
            document.querySelectorAll('#filter-toolbar .chip').forEach(c => c.classList.remove('selected'));
            e.target.classList.add('selected');
            renderTasks();
        };
    });

    // テンプレート選択時の表示切り替え
    document.getElementById('use-template-select').onchange = (e) => {
        const isBulk = e.target.value !== "";
        document.getElementById('editor-fields').style.display = isBulk ? 'none' : 'block';
    };
}

// --- Auth ---
async function handleLogin() {
    const uid = document.getElementById('login-id').value;
    const upw = document.getElementById('login-pw').value;
    const { data, error } = await client.from('users').select('*').eq('user_id', uid).eq('password', upw).single();
    if (error || !data) return alert("Login Failed");
    userObj = data;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('user-display').innerText = `User: ${userObj.user_id}`;
    switchScreen('screen-tasks');
}

// --- Navigation ---
function switchScreen(screenId) {
    currentScreen = screenId;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    document.getElementById('nav-tasks').classList.toggle('active', screenId === 'screen-tasks');
    document.getElementById('nav-templates').classList.toggle('active', screenId.includes('template'));

    if (screenId === 'screen-tasks') fetchTasks();
    if (screenId === 'screen-templates') fetchTemplates();
}

// --- Task Logic ---
async function fetchTasks() {
    setStatus("Syncing...");
    const { data } = await client.from('tasks').select('*').eq('creator_id', userObj.id).order('limit_date', { ascending: true });
    tasks = data || [];
    renderTasks();
    updateStats();
    setStatus("Done");
}

function renderTasks() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    const filtered = tasks.filter(t => currentFilter === 'all' || t.category === currentFilter);
    
    filtered.forEach(t => {
        const li = document.createElement('div');
        li.className = `task-card priority-${t.priority} ${t.is_completed ? 'completed' : ''}`;
        li.innerHTML = `
            <div style="flex:1" onclick="toggleTaskStatus(${t.id}, ${t.is_completed})">
                <strong style="font-size:16px;">${t.task_title}</strong>
                <div style="font-size:11px; margin-top:5px; color:var(--accent-blue)">
                    <i class="far fa-calendar"></i> ${t.limit_date} | ${t.category}
                </div>
            </div>
            <button class="neu-btn" onclick="openTaskModal(${t.id})" style="width:35px; height:35px;"><i class="fas fa-pen"></i></button>
        `;
        list.appendChild(li);
    });
}

async function toggleTaskStatus(id, currentStatus) {
    await client.from('tasks').update({ is_completed: currentStatus ? 0 : 1 }).eq('id', id);
    fetchTasks();
}

// --- Template Logic ---
async function fetchTemplates() {
    const { data } = await client.from('task_templates').select('*').eq('creator_id', userObj.id);
    templates = data || [];
    const list = document.getElementById('template-list');
    list.innerHTML = templates.map(t => `
        <div class="template-card" onclick="viewTemplateDetail(${t.id}, '${t.template_name}')">
            <strong>${t.template_name}</strong>
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="neu-btn" onclick="event.stopPropagation(); editTemplateName(${t.id}, '${t.template_name}')" style="padding:8px 12px; font-size:11px;">Rename</button>
                <button class="neu-btn" onclick="event.stopPropagation(); deleteTemplate(${t.id})" style="padding:8px 12px; font-size:11px; color:var(--accent-red)">Delete</button>
            </div>
        </div>
    `).join('');
}

async function addNewTemplate() {
    const name = prompt("Enter Template Name:");
    if (!name) return;
    const { data, error } = await client.from('task_templates').insert([{ template_name: name, creator_id: userObj.id }]).select().single();
    if (!error) viewTemplateDetail(data.id, data.template_name);
}

async function editTemplateName(id, oldName) {
    const name = prompt("Update Template Name:", oldName);
    if (!name) return;
    await client.from('task_templates').update({ template_name: name }).eq('id', id);
    fetchTemplates();
}

async function deleteTemplate(id) {
    const { data } = await client.from('template_items').select('id').eq('template_id', id);
    if (data.length > 0) {
        if (!confirm(`This template has ${data.length} items. Delete anyway?`)) return;
    }
    await client.from('task_templates').delete().eq('id', id);
    fetchTemplates();
}

async function viewTemplateDetail(id, name) {
    currentTemplateId = id;
    document.getElementById('current-template-name').innerText = name;
    switchScreen('screen-template-detail');
    renderTemplateItems();
}

async function renderTemplateItems() {
    const { data } = await client.from('template_items').select('*').eq('template_id', currentTemplateId);
    const list = document.getElementById('template-item-list');
    list.innerHTML = data.map(item => `
        <div class="task-card priority-${item.priority}">
            <strong>${item.title}</strong>
            <div style="font-size:11px; opacity:0.6;">Category: ${item.category}</div>
            <div style="margin-top:10px; display:flex; gap:10px;">
                <button class="neu-btn" onclick="openTemplateItemModal(${item.id})" style="padding:8px 12px; font-size:11px;">Edit Item</button>
                <button class="neu-btn" onclick="deleteTemplateItem(${item.id})" style="padding:8px 12px; font-size:11px; color:var(--accent-red)">Remove</button>
            </div>
        </div>
    `).join('');
}

async function deleteTemplateItem(id) {
    await client.from('template_items').delete().eq('id', id);
    renderTemplateItems();
}

// --- Modal Handling ---
function openTaskModal(id = null) {
    editingId = id;
    currentMode = 'task';
    document.getElementById('modal-title').innerText = id ? "Edit Task" : "Add Task";
    document.getElementById('template-selector-area').style.display = id ? 'none' : 'block';
    document.getElementById('calendar-container').style.display = 'block';
    document.getElementById('editor-fields').style.display = 'block';
    document.getElementById('del-btn').style.display = id ? 'block' : 'none';
    
    // テンプレート選択肢の更新
    const select = document.getElementById('use-template-select');
    select.innerHTML = '<option value="">-- Manual Create --</option>' + 
        templates.map(t => `<option value="${t.id}">${t.template_name}</option>`).join('');
    select.value = "";

    if (id) {
        const t = tasks.find(x => x.id === id);
        document.getElementById('main-input').value = t.task_title;
        document.getElementById('main-priority').value = t.priority;
        document.getElementById('main-category').value = t.category;
        selectedDate = t.limit_date;
    } else {
        document.getElementById('main-input').value = '';
        selectedDate = new Date().toISOString().split('T')[0];
    }
    calDate = new Date(selectedDate);
    renderCalendar();
    document.getElementById('modal').classList.add('active');
}

function openTemplateItemModal(id = null) {
    editingId = id;
    currentMode = 'template-item';
    document.getElementById('modal-title').innerText = "Template Item";
    document.getElementById('template-selector-area').style.display = 'none';
    document.getElementById('calendar-container').style.display = 'none';
    document.getElementById('editor-fields').style.display = 'block';
    document.getElementById('del-btn').style.display = 'none';

    if (id) {
        // 本来は再取得が必要だが簡易化のため省略
    } else {
        document.getElementById('main-input').value = '';
    }
    document.getElementById('modal').classList.add('active');
}

async function handleSave() {
    const title = document.getElementById('main-input').value;
    const pri = document.getElementById('main-priority').value;
    const cat = document.getElementById('main-category').value;
    const templateId = document.getElementById('use-template-select').value;

    if (currentMode === 'task') {
        if (templateId) {
            // テンプレートから一括登録
            const { data: items } = await client.from('template_items').select('*').eq('template_id', templateId);
            const bulkTasks = items.map(it => ({
                task_title: it.title, priority: it.priority, category: it.category,
                limit_date: selectedDate, creator_id: userObj.id, is_completed: 0
            }));
            await client.from('tasks').insert(bulkTasks);
        } else {
            // 単体登録・更新
            const payload = { task_title: title, priority: pri, category: cat, limit_date: selectedDate, creator_id: userObj.id };
            if (editingId) await client.from('tasks').update(payload).eq('id', editingId);
            else await client.from('tasks').insert([{ ...payload, is_completed: 0 }]);
        }
        fetchTasks();
    } else {
        // テンプレートアイテム保存
        const payload = { title, priority: pri, category: cat, template_id: currentTemplateId };
        if (editingId) await client.from('template_items').update(payload).eq('id', editingId);
        else await client.from('template_items').insert([payload]);
        renderTemplateItems();
    }
    closeModal();
}

async function handleDelete() {
    if (currentMode === 'task' && editingId) {
        await client.from('tasks').delete().eq('id', editingId);
        fetchTasks();
        closeModal();
    }
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

// --- Utils ---
function setStatus(s) { document.getElementById('sync-info').innerText = s; }

function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('stat-done').innerText = tasks.filter(t => t.is_completed).length;
    document.getElementById('stat-overdue').innerText = tasks.filter(t => !t.is_completed && t.limit_date < today).length;
    document.getElementById('stat-remain').innerText = tasks.filter(t => !t.is_completed).length;
}

function changeMonth(m) { calDate.setMonth(calDate.getMonth() + m); renderCalendar(); }

function renderCalendar() {
    const grid = document.getElementById('cal-grid'); grid.innerHTML = '';
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
        day.onclick = () => { selectedDate = dStr; renderCalendar(); };
        grid.appendChild(day);
    }
}