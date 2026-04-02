/* ═══════════════════════════════════════════════════
   MSHome — main.js
   Refactored for speed:
   • Optimistic toggle (no full reload on ON/OFF)
   • Modal open/close via CSS class (no display toggling)
   • All event listeners registered once in setupListeners()
   • DOM cache for frequently accessed elements
═══════════════════════════════════════════════════ */

const API_URL = '/devices';
let devices = [];
let activeRoom = 'All';
let activeControlDevice = null;

/* DOM Cache ───*/
const el = {
    deviceList: document.getElementById('deviceList'),
    roomNav: document.getElementById('room-nav'),
    activeCount: document.getElementById('active-count'),
    activeCountDesktop: document.getElementById('active-count-desktop'),
    statTotal: document.getElementById('stat-total'),
    statOn: document.getElementById('stat-on'),
    statRooms: document.getElementById('stat-rooms'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    deleteModal: document.getElementById('deleteModal'),
    addModal: document.getElementById('addModal'),
    deleteIdField: document.getElementById('deleteIdField'),
    editingId: document.getElementById('editing-device-id'),
    deviceName: document.getElementById('device-name'),
    deviceRoom: document.getElementById('device-room'),
    deviceType: document.getElementById('device-type'),
    modalTitle: document.getElementById('modal-title'),
    controlPanel: document.getElementById('deviceControlPanel'),
    controlName: document.getElementById('control-device-name'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessDisplay: document.getElementById('brightness-display'),
    tempDisplay: document.querySelector('.temp-display'),
    unlockBtn: document.getElementById('unlock-btn'),
    toastContainer: document.getElementById('toast-container'),
};

/* Helpers ─────*/
const getIcon = type => ({ light: '💡', ac: '❄️', doorlock: '🔒' }[type] || '🔌');


/* Toast ───────*/
const showToast = (msg, type = 'success') => {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3100);
};

/* Modal helpers (CSS class, not display toggle) */
const openModal = id => document.getElementById(id).classList.add('is-open');
const closeModal_ = id => document.getElementById(id).classList.remove('is-open');

/* Fetch & full render */
const loadDevices = async () => {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error();
        devices = await res.json();
        renderUI();
    } catch {
        showToast('Error connecting to server', 'error');
    }
};

/* Render (pure DOM update, no fetch) */
const renderUI = () => {
    const rooms = ['All', ...new Set(devices.map(d => d.room || 'Unassigned'))];
    if (!rooms.includes(activeRoom)) {
        activeRoom = 'All';
    }
    const filtered = activeRoom === 'All'
        ? devices
        : devices.filter(d => (d.room || 'Unassigned') === activeRoom);

    const onCount = filtered.filter(d => d.status === 'on').length;
    const allOn = devices.filter(d => d.status === 'on').length;
    const numRooms = new Set(devices.map(d => d.room || 'Unassigned')).size;

    /* Badges */
    if (el.activeCount) el.activeCount.textContent = onCount;
    if (el.activeCountDesktop) el.activeCountDesktop.textContent = onCount;
    if (el.statTotal) el.statTotal.textContent = devices.length;
    if (el.statOn) el.statOn.textContent = allOn;
    if (el.statRooms) el.statRooms.textContent = numRooms;

    /* Room pills */
    el.roomNav.innerHTML = rooms.map(r =>
        `<button class="room-pill${r === activeRoom ? ' active' : ''}"
                 data-room="${r}">${r}</button>`
    ).join('');

    /* Device grid */
    if (!filtered.length) {
        el.deviceList.innerHTML = `
            <div class="empty-state" style="grid-column:1/-1">
                <div class="empty-icon">🏠</div>
                <p>No devices found here.</p>
            </div>`;
        return;
    }

    el.deviceList.innerHTML = filtered.map(d => {
        const on = d.status === 'on';
        return `
        <div class="device-card" data-id="${d.id}">
            <div class="device-card-menu">
                <button class="device-card-menu-btn" data-menu="${d.id}">⋮</button>
                <div id="device-menu-${d.id}" class="device-card-dropdown">
                    <button data-edit="${d.id}">Edit</button>
                    <button class="delete-text" data-delete="${d.id}">Delete</button>
                </div>
            </div>
            <div class="device-info" data-open="${d.id}">
                <div class="device-icon">${getIcon(d.type)}</div>
                <strong>${d.name}</strong>
                <span class="room-label">📍 ${d.room || 'Unassigned'}</span>
            </div>
            <div class="device-actions">
                <button class="toggle-btn ${on ? 'btn-on' : 'btn-off'}"
                        data-toggle="${d.id}"
                        data-status="${d.status}">
                    ${on ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>`;
    }).join('');
};

/* Optimistic toggle (instant UI, background save) */
const toggleDevice = async (id, currentStatus) => {
    const newStatus = currentStatus === 'on' ? 'off' : 'on';

    /* Update local state immediately */
    const dev = devices.find(d => d.id === id);
    if (dev) dev.status = newStatus;

    /* Update just the button in the DOM — no full re-render */
    const btn = document.querySelector(`[data-toggle="${id}"]`);
    if (btn) {
        btn.classList.toggle('btn-on', newStatus === 'on');
        btn.classList.toggle('btn-off', newStatus === 'off');
        btn.textContent = newStatus === 'on' ? 'ON' : 'OFF';
        btn.dataset.status = newStatus;
    }

    /* Update badge counts */
    const onCount = (activeRoom === 'All' ? devices : devices.filter(d => (d.room || 'Unassigned') === activeRoom))
        .filter(d => d.status === 'on').length;
    if (el.activeCount) el.activeCount.textContent = onCount;
    if (el.activeCountDesktop) el.activeCountDesktop.textContent = onCount;
    if (el.statOn) el.statOn.textContent = devices.filter(d => d.status === 'on').length;

    /* Background API call */
    try {
        const res = await fetch(API_URL + '/' + id + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (!res.ok) throw new Error();
    } catch {
        /* Rollback on failure */
        if (dev) dev.status = currentStatus;
        if (btn) {
            btn.classList.toggle('btn-on', currentStatus === 'on');
            btn.classList.toggle('btn-off', currentStatus === 'off');
            btn.textContent = currentStatus === 'on' ? 'ON' : 'OFF';
            btn.dataset.status = currentStatus;
        }
        showToast('Could not update device', 'error');
    }
};

/* Save Device (Add / Edit) */
const saveDevice = async () => {
    const id = el.editingId.value.trim();
    const name = el.deviceName.value.trim();
    const room = el.deviceRoom.value.trim();
    const type = el.deviceType.value;

    if (!name || !room) return showToast('Please enter both fields', 'error');

    const method = id ? 'PUT' : 'POST';
    const url = id ? API_URL + '/' + id : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, room, type })
        });
        if (!res.ok) throw new Error();
        closeAddModal();
        await loadDevices();
        showToast(`Device ${id ? 'updated' : 'added'} successfully!`, 'success');
    } catch {
        showToast('Error saving device', 'error');
    }
};

/* Delete Device */
const confirmDelete = async () => {
    const btn = document.querySelector('#deleteModal .danger-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    try {
        const res = await fetch(API_URL + '/' + el.deleteIdField.value, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        closeModal();
        await loadDevices();
        showToast('Device deleted!', 'info');
    } catch {
        showToast('Error deleting device', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Delete';
    }
};

/* Modal open/close ────────*/
const openDeleteModal = id => {
    el.deleteIdField.value = id;
    openModal('deleteModal');
};

const closeModal = () => closeModal_('deleteModal');

const openAddModal = () => {
    el.modalTitle.textContent = 'Add New Device';
    el.editingId.value = '';
    el.deviceName.value = '';
    el.deviceRoom.value = '';
    el.deviceType.value = 'light';
    openModal('addModal');
    /* Focus first input after transition */
    setTimeout(() => el.deviceName.focus(), 80);
};

const closeAddModal = () => closeModal_('addModal');

const editDevice = id => {
    const d = devices.find(d => d.id === id);
    if (!d) return;
    el.modalTitle.textContent = 'Edit Device';
    el.editingId.value = d.id;
    el.deviceName.value = d.name;
    el.deviceRoom.value = d.room || '';
    el.deviceType.value = d.type;
    closeAllDropdowns();
    openModal('addModal');
    setTimeout(() => el.deviceName.focus(), 80);
};

/*  Sidebar */
const toggleSidebar = () => {
    el.sidebar.classList.toggle('show');
    el.sidebarOverlay.classList.toggle('show');
};

/*  Dropdowns  */
const closeAllDropdowns = () =>
    document.querySelectorAll('.device-card-dropdown.show')
        .forEach(m => m.classList.remove('show'));

/*  Device Control Panel  */
const updateSliderFill = slider => {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', pct + '%');
};

const openDeviceControl = id => {
    const d = devices.find(d => d.id === id);
    if (!d) return;
    // UI/UX UPGRADE: Block opening if device is OFF (except doorlocks)
    if (d.type !== 'doorlock' && d.status === 'off') {
        showToast('Please turn the device ON to access its settings', 'info');
        return; // This stops the rest of the function from running!
    }
    activeControlDevice = d;

    el.controlName.textContent = d.name;

    if (d.type === 'light') {
        el.brightnessSlider.value = d.state?.brightness || 10;
        el.brightnessDisplay.textContent = el.brightnessSlider.value;
        updateSliderFill(el.brightnessSlider);
    } else if (d.type === 'ac') {
        el.tempDisplay.textContent = (d.state?.temperature || 22) + '°C';
    } else if (d.type === 'doorlock') {
        const isLocked = d.state?.is_locked == false; // Default to locked if state is missing
        el.unlockBtn.textContent = isLocked ? 'Unlock Door' : 'Lock Door';
        if (isLocked) {
            el.unlockBtn.classList.remove('danger-btn');
            el.unlockBtn.classList.add('btn-on'); // Safe = Green
        } else {
            el.unlockBtn.classList.remove('btn-on');
            el.unlockBtn.classList.add('danger-btn'); // Unlocked = Red/Danger
        }
    }

    document.querySelectorAll('.device-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`panel-${d.type}`) || document.getElementById('panel-unknown');
    panel.classList.remove('hidden');
    // Hide the Save button footer if it's a doorlock, show it for everything else
    const panelFooter = document.querySelector('.panel-footer');
    if (d.type === 'doorlock') {
        panelFooter.classList.add('hidden');
    } else {
        panelFooter.classList.remove('hidden');
    }

    el.controlPanel.classList.add('active');

};

const closeDeviceControl = () => {
    el.controlPanel.classList.remove('active');
    activeControlDevice = null;
};
// Separate functions for status vs state updates since status is optimistic toggle but state is debounced and can have multiple fields
const updateDeviceStatus = async newStatus => {
    if (!activeControlDevice) return;
    try {
        const res = await fetch(API_URL + '/' + activeControlDevice.id + '/status', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            const updated = await res.json();
            const i = devices.findIndex(d => d.id === updated.id);
            if (i !== -1) devices[i] = updated;
        }
    } catch {
        showToast('Network error', 'error');
    }
};

/* State update (debounced for sliders/temp) ───*/
const updateDeviceState = async stateUpdates => {
    if (!activeControlDevice) return;
    try {
        console.log('Updating device state with:', stateUpdates);
        const res = await fetch(API_URL + '/' + activeControlDevice.id + '/state', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stateUpdates)
        });
        if (res.ok) {
            const updated = await res.json();
            const i = devices.findIndex(d => d.id === updated.id);
            if (i !== -1) devices[i] = updated;
        }
    } catch {
        showToast('Network error', 'error');
    }
};


const savePanelSettings = () => {
    if (!activeControlDevice) return;

    if (activeControlDevice.type === 'light') {
        updateDeviceState({ brightness: parseInt(el.brightnessSlider.value) });
        showToast('Brightness saved!', 'success');
        closeDeviceControl();
    } else if (activeControlDevice.type === 'ac') {
        updateDeviceState({ temperature: parseInt(el.tempDisplay.textContent) });
        showToast('Temperature saved!', 'success');
        closeDeviceControl();
    }
};


/* 
   SINGLE DELEGATED EVENT LISTENER SETUP
   All clicks handled via event delegation on
   document — no inline onclick needed (except
   modal buttons which stay inline for simplicity).
*/
const setupListeners = () => {

    /* Global click delegation */
    document.addEventListener('click', e => {
        const t = e.target;
        /* 
    Room filter click 
    */
        const roomBtn = t.closest('[data-room]');
        if (roomBtn) {
            activeRoom = roomBtn.dataset.room; // Update the active room state
            renderUI();                        // Re-render the grid and active state
            return;
        }
        /* Three-dot menu toggle */
        const menuBtn = t.closest('[data-menu]');
        if (menuBtn) {
            e.stopPropagation();
            const id = menuBtn.dataset.menu;
            const dd = document.getElementById(`device-menu-${id}`);
            const was = dd.classList.contains('show');
            closeAllDropdowns();
            if (!was) dd.classList.add('show');
            return;
        }

        /* Edit button inside dropdown */
        const editBtn = t.closest('[data-edit]');
        if (editBtn) { editDevice(editBtn.dataset.edit); return; }

        /* Delete button inside dropdown */
        const delBtn = t.closest('[data-delete]');
        if (delBtn) { openDeleteModal(delBtn.dataset.delete); return; }

        /* Toggle button */
        const toggleBtn = t.closest('[data-toggle]');
        if (toggleBtn) {
            e.stopPropagation();
            toggleDevice(toggleBtn.dataset.toggle, toggleBtn.dataset.status);
            return;
        }

        /* Device card open (not on a button/dropdown) */
        const openArea = t.closest('[data-open]');
        if (openArea && !t.closest('button') && !t.closest('.device-card-dropdown')) {
            openDeviceControl(openArea.dataset.open);
            return;
        }

        /* Close dropdowns on outside click */
        if (!t.closest('.device-card-menu')) closeAllDropdowns();
    });

    /*  Brightness slider */
    el.brightnessSlider.addEventListener('input', e => {
        el.brightnessDisplay.textContent = e.target.value;
        updateSliderFill(e.target);
    });

    /*  AC temp buttons  */
    document.getElementById('temp-minus').addEventListener('click', () => adjustTemp(-1));
    document.getElementById('temp-plus').addEventListener('click', () => adjustTemp(+1));

    /* Door lock */
    document.getElementById('unlock-btn').addEventListener('click', e => {
        if (!activeControlDevice) return;

        // Use optional chaining (?.) just in case the state folder is completely empty
        const isCurrentlyLocked = activeControlDevice.state?.is_locked !== false;
        const newLockedState = !isCurrentlyLocked;
        const newStatus = newLockedState ? 'on' : 'off';

        // Update local state
        if (!activeControlDevice.state) activeControlDevice.state = {};
        activeControlDevice.state.is_locked = newLockedState;
        activeControlDevice.status = newStatus;

        // Update panel button UI
        const btn = e.target;
        btn.textContent = newLockedState ? 'Unlock Door' : 'Lock Door';
        if (newLockedState) {
            btn.classList.remove('danger-btn');
            btn.classList.add('btn-on'); // Green
        } else {
            btn.classList.remove('btn-on');
            btn.classList.add('danger-btn'); // Red
        }

        // Updates dashboard card toggle UI
        const cardToggleBtn = document.querySelector(`[data-toggle="${activeControlDevice.id}"]`);
        if (cardToggleBtn) {
            cardToggleBtn.classList.toggle('btn-on', newLockedState);
            cardToggleBtn.classList.toggle('btn-off', !newLockedState);
            cardToggleBtn.textContent = newLockedState ? 'ON' : 'OFF';
            cardToggleBtn.dataset.status = newStatus;
        }

        // ✅ Sends BOTH updates to the database cleanly!
        updateDeviceState({ is_locked: newLockedState });
        updateDeviceStatus(newStatus);

        showToast(newLockedState ? 'Door Locked 🔒' : 'Door Unlocked 🔓', 'info');
    });

    /*  Keyboard: Escape closes modals/panel */
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (el.addModal.classList.contains('is-open')) closeAddModal();
        if (el.deleteModal.classList.contains('is-open')) closeModal();
        if (el.controlPanel.classList.contains('active')) closeDeviceControl();
    });

    /* Keyboard: Enter submits add modal */
    [el.deviceName, el.deviceRoom].forEach(inp =>
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveDevice(); })
    );
};

const adjustTemp = delta => {
    if (!activeControlDevice) return;
    let temp = parseInt(el.tempDisplay.textContent) + delta;
    temp = Math.max(16, Math.min(30, temp));
    el.tempDisplay.textContent = temp + '°C';
};

/*  Expose globals used by inline onclick attributes */
window.saveDevice = saveDevice;
window.confirmDelete = confirmDelete;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.closeModal = closeModal;
window.toggleSidebar = toggleSidebar;
window.closeDeviceControl = closeDeviceControl;
window.savePanelSettings = savePanelSettings;
window.profile = () => { };
window.settings = () => { };
window.logout = () => { };

/* Init */
window.addEventListener('DOMContentLoaded', () => {
    setupListeners();
    loadDevices();
});