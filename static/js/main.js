/**
 * MSHome dashboard — vanilla JS
 * Upgraded with JWT Authentication & Role-Based Access Control
 */

const API_URL = '/devices';
let devices = [];
let activeRoom = 'All';
let activeControlDevice = null;

/** Cached DOM refs */
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
    panelStatusToggle: document.getElementById('panel-status-toggle'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessDisplay: document.getElementById('brightness-display'),
    acDial: document.getElementById('ac-dial'),
    acDialKnob: document.getElementById('ac-dial-knob'),
    acDialTicks: document.getElementById('ac-dial-ticks'),
    tempDisplay: document.querySelector('.temp-display'),
    unlockBtn: document.getElementById('unlock-btn'),
    toastContainer: document.getElementById('toast-container'),
    presetContainer: document.querySelector('.preset-container'),
};

const getIcon = type => ({ light: '💡', ac: '❄️', doorlock: '🔒' }[type] || '🔌');

const showToast = (msg, type = 'success') => {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = msg;
    el.toastContainer.appendChild(node);
    setTimeout(() => node.remove(), 3100);
};

const openModal = id => document.getElementById(id).classList.add('is-open');
const closeModalById = id => document.getElementById(id).classList.remove('is-open');

/* --- FETCH HELPERS WITH JWT TOKENS --- */
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('mshome_token')}`
});

const loadDeviceTypes = async () => {
    try {
        const res = await fetch(API_URL + '/types', { headers: { 'Authorization': `Bearer ${localStorage.getItem('mshome_token')}` } });
        if (!res.ok) throw new Error();
        const types = await res.json();
        el.deviceType.innerHTML = types.map(t => `<option value="${t.value}">${t.label}</option>`).join('');
    } catch {
        console.error("Could not load device types.");
    }
};

const loadDevices = async () => {
    try {
        const res = await fetch(API_URL, { headers: { 'Authorization': `Bearer ${localStorage.getItem('mshome_token')}` } });
        if (!res.ok) throw new Error();
        devices = await res.json();
        renderUI();
    } catch {
        showToast('Error connecting to server', 'error');
    }
};

const filteredDevices = () => activeRoom === 'All' ? devices : devices.filter(d => (d.room || 'Unassigned') === activeRoom);

const updateActiveBadges = () => {
    const onInFilter = filteredDevices().filter(d => d.status === 'on').length;
    const onTotal = devices.filter(d => d.status === 'on').length;
    if (el.activeCount) el.activeCount.textContent = onInFilter;
    if (el.activeCountDesktop) el.activeCountDesktop.textContent = onInFilter;
    if (el.statOn) el.statOn.textContent = onTotal;
};

/* --- ENFORCE PARENT/CHILD UI RULES --- */
const applyRolePermissions = () => {
    const role = localStorage.getItem('mshome_role');
    const addBtnDesktop = document.querySelector('.desktop-add-btn');
    const addBtnMobile = document.querySelector('.fab-btn');

    // Physically hide Add buttons if it's a child
    if (role === 'child') {
        if (addBtnDesktop) addBtnDesktop.style.display = 'none';
        if (addBtnMobile) addBtnMobile.style.display = 'none';
    } else {
        if (addBtnDesktop) addBtnDesktop.style.display = 'flex';
        if (addBtnMobile) addBtnMobile.style.display = 'flex';
    }
};

const renderUI = () => {
    const rooms = ['All', ...new Set(devices.map(d => d.room || 'Unassigned'))];
    if (!rooms.includes(activeRoom)) activeRoom = 'All';

    const filtered = filteredDevices();
    const numRooms = new Set(devices.map(d => d.room || 'Unassigned')).size;

    if (el.statTotal) el.statTotal.textContent = devices.length;
    if (el.statRooms) el.statRooms.textContent = numRooms;
    updateActiveBadges();

    el.roomNav.innerHTML = rooms.map(r => `<button class="room-pill${r === activeRoom ? ' active' : ''}" data-room="${r}">${r}</button>`).join('');

    if (!filtered.length) {
        el.deviceList.innerHTML = `<div class="empty-state device-grid__full"><div class="empty-icon">🏠</div><p>No devices found here.</p></div>`;
        return;
    }

    const isParent = localStorage.getItem('mshome_role') !== 'child';

    el.deviceList.innerHTML = filtered.map(d => {
        const on = d.status === 'on';
        return `
        <div class="device-card" data-id="${d.id}">
            ${isParent ? `
            <div class="device-card-menu">
                <button class="device-card-menu-btn" data-menu="${d.id}">⋮</button>
                <div id="device-menu-${d.id}" class="device-card-dropdown">
                    <button data-edit="${d.id}">Edit</button>
                    <button class="delete-text" data-delete="${d.id}">Delete</button>
                </div>
            </div>` : ''}
            <div class="device-info" data-open="${d.id}">
                <div class="device-icon">${getIcon(d.type)}</div>
                <strong>${d.name}</strong>
                <span class="room-label">📍 ${d.room || 'Unassigned'}</span>
            </div>
            <div class="device-actions">
                <button class="power-circle-btn ${on ? 'btn-on' : 'btn-off'}" data-toggle="${d.id}" data-status="${d.status}" aria-label="Toggle Power">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');
};

const setToggleButton = (btn, status) => {
    const on = status === 'on';
    btn.classList.toggle('btn-on', on);
    btn.classList.toggle('btn-off', !on);
    btn.dataset.status = status;
};

const toggleDevice = async (id, currentStatus) => {
    const newStatus = currentStatus === 'on' ? 'off' : 'on';
    const dev = devices.find(d => d.id === id);
    if (dev) dev.status = newStatus;

    const btn = document.querySelector(`#deviceList [data-toggle="${id}"]`);
    if (btn) setToggleButton(btn, newStatus);
    updateActiveBadges();
    if (activeControlDevice?.id === id && el.controlPanel.classList.contains('active')) setPanelStatusToggleUI(newStatus);

    try {
        const res = await fetch(`${API_URL}/${id}/status`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error();
    } catch {
        if (dev) dev.status = currentStatus;
        if (btn) setToggleButton(btn, currentStatus);
        updateActiveBadges();
        if (activeControlDevice?.id === id && el.controlPanel.classList.contains('active')) setPanelStatusToggleUI(currentStatus);
        showToast('Could not update device', 'error');
    }
};

const saveDevice = async () => {
    const id = el.editingId.value.trim();
    const name = el.deviceName.value.trim();
    const room = el.deviceRoom.value.trim();
    const type = el.deviceType.value;

    // Grab the child access checkbox!
    const childAccessEl = document.getElementById('device-child-access');
    const childAccess = childAccessEl ? childAccessEl.checked : false;

    if (!name || !room) return showToast('Please enter both fields', 'error');

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, room, type, childAccess }), // Send childAccess to backend
        });
        if (!res.ok) throw new Error();
        closeAddModal();
        await loadDevices();
        showToast(`Device ${id ? 'updated' : 'added'} successfully!`, 'success');
    } catch {
        showToast('Error saving device', 'error');
    }
};

const confirmDelete = async () => {
    const btn = document.querySelector('#deleteModal .danger-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
        const res = await fetch(`${API_URL}/${el.deleteIdField.value}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('mshome_token')}` }
        });
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

const openDeleteModal = id => {
    el.deleteIdField.value = id;
    openModal('deleteModal');
};

const closeModal = () => closeModalById('deleteModal');

const openAddModal = () => {
    el.modalTitle.textContent = 'Add New Device';
    el.editingId.value = '';
    el.deviceName.value = '';
    el.deviceRoom.value = '';
    el.deviceType.value = 'light';

    // Reset Checkbox
    const childAccessEl = document.getElementById('device-child-access');
    if (childAccessEl) childAccessEl.checked = false;

    openModal('addModal');
    setTimeout(() => el.deviceName.focus(), 80);
};

const closeAddModal = () => closeModalById('addModal');

const editDevice = id => {
    const d = devices.find(x => x.id === id);
    if (!d) return;
    el.modalTitle.textContent = 'Edit Device';
    el.editingId.value = d.id;
    el.deviceName.value = d.name;
    el.deviceRoom.value = d.room || '';
    el.deviceType.value = d.type;

    // Load existing Checkbox status
    const childAccessEl = document.getElementById('device-child-access');
    if (childAccessEl) childAccessEl.checked = d.childAccess || false;

    closeAllDropdowns();
    openModal('addModal');
    setTimeout(() => el.deviceName.focus(), 80);
};

const toggleSidebar = () => {
    el.sidebar.classList.toggle('show');
    el.sidebarOverlay.classList.toggle('show');
};

const closeAllDropdowns = () => {
    document.querySelectorAll('.device-card-dropdown.show').forEach(m => {
        m.classList.remove('show');
        const card = m.closest('.device-card');
        if (card) card.classList.remove('menu-open');
    });
};

/* ——— Light & AC Panel Logic ——— */
const updateSliderFill = slider => {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${pct}%`);
};

const AC_MIN_TEMP = 16, AC_MAX_TEMP = 30, AC_MIN_ANGLE = -180, AC_MAX_ANGLE = 0, AC_DIAL_RADIUS = 90, AC_TRACK_RADIUS = 88.5;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const tempToAngle = temp => {
    const ratio = (clamp(temp, AC_MIN_TEMP, AC_MAX_TEMP) - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
    return AC_MIN_ANGLE + ratio * (AC_MAX_ANGLE - AC_MIN_ANGLE);
};

const angleToTemp = angle => {
    const ratio = (clamp(angle, AC_MIN_ANGLE, AC_MAX_ANGLE) - AC_MIN_ANGLE) / (AC_MAX_ANGLE - AC_MIN_ANGLE);
    return Math.round(AC_MIN_TEMP + ratio * (AC_MAX_TEMP - AC_MIN_TEMP));
};

const setACTemperatureDraft = temp => {
    const next = clamp(parseInt(temp, 10), AC_MIN_TEMP, AC_MAX_TEMP);
    if (activeControlDevice) {
        if (!activeControlDevice.state) activeControlDevice.state = {};
        activeControlDevice.state.temperature = next;
    }
    return next;
};

const buildACTicks = () => {
    if (!el.acDialTicks || el.acDialTicks.childElementCount) return;
    for (let t = AC_MIN_TEMP; t <= AC_MAX_TEMP; t++) {
        const span = document.createElement('span');
        span.className = 'ac-dial-tick';
        span.dataset.temp = String(t);
        el.acDialTicks.appendChild(span);
    }
};

const updateACTicks = () => {
    if (!el.acDialTicks) return;
    el.acDialTicks.querySelectorAll('.ac-dial-tick').forEach(tick => {
        const tickTemp = +tick.dataset.temp;
        const ratio = (tickTemp - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
        const rad = (tempToAngle(tickTemp) * Math.PI) / 180;
        tick.style.left = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.cos(rad)}px`;
        tick.style.top = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.sin(rad)}px`;
        const cool = ratio <= 0.5;
        tick.classList.toggle('tick-cool', cool);
        tick.classList.toggle('tick-warm', !cool);
        tick.style.setProperty('--tick-blend', String(cool ? clamp(ratio / 0.5, 0, 1) : clamp((ratio - 0.5) / 0.5, 0, 1)));
    });
};

const setACDialUI = temp => {
    const safe = setACTemperatureDraft(temp);
    const rad = (tempToAngle(safe) * Math.PI) / 180;
    el.tempDisplay.textContent = String(safe);
    if (el.acDialKnob) {
        el.acDialKnob.style.left = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.cos(rad)}px`;
        el.acDialKnob.style.top = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.sin(rad)}px`;
    }
    updateACTicks();
};

const setPanelStatusToggleUI = status => {
    const on = status === 'on';
    el.panelStatusToggle.classList.toggle('btn-on', on);
    el.panelStatusToggle.classList.toggle('btn-off', !on);
    el.panelStatusToggle.textContent = on ? 'ON' : 'OFF';
    el.panelStatusToggle.dataset.status = on ? 'on' : 'off';
};

const setUnlockButtonUI = (locked, btn = el.unlockBtn) => {
    btn.textContent = locked ? 'Unlock Door' : 'Lock Door';
    btn.classList.toggle('danger-btn', !locked);
    btn.classList.toggle('btn-on', locked);
};

const openDeviceControl = id => {
    const d = devices.find(x => x.id === id);
    if (!d) return;
    activeControlDevice = d;
    el.controlName.textContent = d.name;
    setPanelStatusToggleUI(d.status || 'off');

    if (d.type === 'light') {
        el.brightnessSlider.value = d.state?.brightness || 10;
        el.brightnessDisplay.textContent = el.brightnessSlider.value;
        updateSliderFill(el.brightnessSlider);
    } else if (d.type === 'ac') {
        setACDialUI(d.state?.temperature ?? 22);
    } else if (d.type === 'doorlock') {
        setUnlockButtonUI(d.state?.is_locked !== false);
    }

    document.querySelectorAll('.device-panel').forEach(p => p.classList.add('hidden'));
    (document.getElementById(`panel-${d.type}`) || document.getElementById('panel-unknown')).classList.remove('hidden');
    el.controlPanel.classList.add('active');
};

const closeDeviceControl = () => {
    el.controlPanel.classList.remove('active');
    activeControlDevice = null;
};

const updateDeviceStatus = async newStatus => {
    if (!activeControlDevice) return;
    const res = await fetch(`${API_URL}/${activeControlDevice.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('status update failed');
    const i = devices.findIndex(d => d.id === activeControlDevice.id);
    if (i !== -1) devices[i].status = newStatus;
};

const updateDeviceState = async stateUpdates => {
    if (!activeControlDevice) return;
    const res = await fetch(`${API_URL}/${activeControlDevice.id}/state`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(stateUpdates),
    });
    if (!res.ok) throw new Error('state update failed');
    const updated = await res.json();
    const i = devices.findIndex(d => d.id === updated.id);
    if (i !== -1) devices[i] = updated;
};

const savePanelSettings = async () => {
    if (!activeControlDevice) return;
    const statusToSave = el.panelStatusToggle.dataset.status || 'off';
    const stateUpdates = {};
    const t = activeControlDevice.type;

    if (t === 'light') stateUpdates.brightness = parseInt(el.brightnessSlider.value, 10);
    else if (t === 'ac') stateUpdates.temperature = activeControlDevice.state?.temperature ?? parseInt(el.tempDisplay.textContent, 10);
    else if (t === 'doorlock') stateUpdates.is_locked = activeControlDevice.state?.is_locked !== false;

    if (!activeControlDevice.state) activeControlDevice.state = {};

    try {
        if (Object.keys(stateUpdates).length) await updateDeviceState(stateUpdates);
        await updateDeviceStatus(statusToSave);
        activeControlDevice.status = statusToSave;
        Object.assign(activeControlDevice.state, stateUpdates);
        renderUI();
        showToast('Settings saved!', 'success');
        closeDeviceControl();
    } catch {
        showToast('Could not save settings', 'error');
    }
};

const onDocumentClick = e => {
    const t = e.target;
    const roomBtn = t.closest('[data-room]');
    if (roomBtn) { activeRoom = roomBtn.dataset.room; renderUI(); return; }

    const menuBtn = t.closest('[data-menu]');
    if (menuBtn) {
        e.stopPropagation();
        const dd = document.getElementById(`device-menu-${menuBtn.dataset.menu}`);
        const card = menuBtn.closest('.device-card');
        const wasOpen = dd.classList.contains('show');
        closeAllDropdowns();
        if (!wasOpen) { dd.classList.add('show'); if (card) card.classList.add('menu-open'); }
        return;
    }

    const editBtn = t.closest('[data-edit]');
    if (editBtn) return editDevice(editBtn.dataset.edit);

    const delBtn = t.closest('[data-delete]');
    if (delBtn) return openDeleteModal(delBtn.dataset.delete);

    const toggleBtn = t.closest('#deviceList [data-toggle]');
    if (toggleBtn) {
        e.stopPropagation();
        return toggleDevice(toggleBtn.dataset.toggle, toggleBtn.dataset.status);
    }

    const openArea = t.closest('[data-open]');
    if (openArea && !t.closest('button') && !t.closest('.device-card-dropdown')) {
        return openDeviceControl(openArea.dataset.open);
    }

    if (!t.closest('.device-card-menu')) closeAllDropdowns();
};

const setupACDialGestures = () => {
    if (!el.acDial) return;
    buildACTicks();
    let dragging = false;
    const getPointer = evt => evt.touches?.length ? evt.touches[0] : (evt.changedTouches?.length ? evt.changedTouches[0] : evt);

    const updateACDialFromPointer = evt => {
        if (!activeControlDevice || activeControlDevice.type !== 'ac') return;
        const p = getPointer(evt);
        const rect = el.acDial.getBoundingClientRect();
        let deg = (Math.atan2(p.clientY - (rect.top + rect.height / 2), p.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
        if (deg > 0) deg = deg > 90 ? -180 : 0;
        setACDialUI(angleToTemp(deg));
    };

    const start = evt => {
        if (!activeControlDevice || activeControlDevice.type !== 'ac') return;
        dragging = true; el.acDial.classList.add('dragging'); updateACDialFromPointer(evt);
        if (evt.cancelable) evt.preventDefault();
    };
    const move = evt => { if (dragging) { updateACDialFromPointer(evt); if (evt.cancelable) evt.preventDefault(); } };
    const end = () => { if (dragging) { dragging = false; el.acDial.classList.remove('dragging'); } };

    el.acDial.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    el.acDial.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
};

const setupListeners = () => {
    /* --- AUTHENTICATION LOGIC --- */
    const authForm = document.getElementById('auth-form');
    const authMessage = document.getElementById('auth-message');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');

    const nameGroup = document.getElementById('auth-name-group');
    const roleGroup = document.getElementById('auth-role-group');
    const emailGroup = document.getElementById('auth-email-group');
    const parentGroup = document.getElementById('auth-parent-group'); // NEW
    const roleSelect = document.getElementById('auth-role'); // NEW

    let isLoginMode = true;

    if (authForm) {
        // Show/Hide Parent input based on dropdown selection
        roleSelect.addEventListener('change', (e) => {
            if (e.target.value === 'child' && !isLoginMode) {
                parentGroup.classList.remove('hidden');
            } else {
                parentGroup.classList.add('hidden');
            }
        });

        authToggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            isLoginMode = !isLoginMode;

            if (isLoginMode) {
                if (roleGroup) roleGroup.classList.add('hidden');
                if (emailGroup) emailGroup.classList.add('hidden');
                if (parentGroup) parentGroup.classList.add('hidden');
                authSubmitBtn.textContent = 'Sign In';
                authToggleText.textContent = "Don't have an account?";
                authToggleLink.textContent = 'Register here';
                document.querySelector('.auth-box h3').textContent = 'Create Account / Login';
            } else {
                if (roleGroup) roleGroup.classList.remove('hidden');
                if (emailGroup) emailGroup.classList.remove('hidden');
                if (roleSelect.value === 'child') parentGroup.classList.remove('hidden');
                authSubmitBtn.textContent = 'Create Account';
                authToggleText.textContent = "Already have an account?";
                authToggleLink.textContent = 'Log in here';
                document.querySelector('.auth-box h3').textContent = 'Create Account';
            }
            authMessage.textContent = '';
        });

        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('auth-name').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            const role = roleSelect.value;
            const parentName = document.getElementById('auth-parent').value.trim();

            authMessage.className = 'auth-msg-text error';

            if (!name || !password) return authMessage.textContent = "Error: Fill all fields.";
            if (!isLoginMode && role === 'child' && !parentName) {
                return authMessage.textContent = "Error: Child accounts must enter their Parent's Username.";
            }

            let payload;
            if (isLoginMode) {
                payload = { name, password };
            } else {
                const email = document.getElementById('auth-email').value.trim();
                if (!email) return authMessage.textContent = "Error: Email is required to register.";
                if (password.length < 6) return authMessage.textContent = "Error: Password must be at least 6 characters.";
                payload = { name, email, password, role, parentName }; // Send Parent Name!
            }

            const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

            try {
                authSubmitBtn.textContent = 'Processing...';
                authSubmitBtn.disabled = true;

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Authentication failed');

                localStorage.setItem('mshome_token', data.token);
                localStorage.setItem('mshome_role', data.role);

                authMessage.className = 'auth-msg-text success';
                authMessage.textContent = data.message;

                setTimeout(() => {
                    document.getElementById('auth-page').classList.add('hidden');
                    applyRolePermissions();
                    loadDeviceTypes();
                    loadDevices();
                }, 1000);

            } catch (error) {
                authMessage.textContent = "Error: " + error.message;
            } finally {
                authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
                authSubmitBtn.disabled = false;
            }
        });
    }
    document.addEventListener('click', onDocumentClick);

    el.brightnessSlider.addEventListener('input', e => {
        el.brightnessDisplay.textContent = e.target.value;
        updateSliderFill(e.target);
    });

    el.presetContainer?.addEventListener('click', e => {
        const btn = e.target.closest('.preset-btn');
        if (!btn || btn.getAttribute('data-val') == null) return;
        el.brightnessSlider.value = btn.getAttribute('data-val');
        el.brightnessDisplay.textContent = el.brightnessSlider.value;
        updateSliderFill(el.brightnessSlider);
    });

    setupACDialGestures();

    el.panelStatusToggle.addEventListener('click', () => {
        setPanelStatusToggleUI(el.panelStatusToggle.dataset.status === 'on' ? 'off' : 'on');
    });

    el.unlockBtn.addEventListener('click', e => {
        if (!activeControlDevice) return;
        const nextLocked = activeControlDevice.state?.is_locked === false;
        if (!activeControlDevice.state) activeControlDevice.state = {};
        activeControlDevice.state.is_locked = nextLocked;
        setPanelStatusToggleUI(nextLocked ? 'on' : 'off');
        setUnlockButtonUI(nextLocked, e.currentTarget);
        showToast(nextLocked ? 'Door locked (pending save)' : 'Door unlocked (pending save)', 'info');
    });

    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (el.addModal.classList.contains('is-open')) closeAddModal();
        if (el.deleteModal.classList.contains('is-open')) closeModal();
        if (el.controlPanel.classList.contains('active')) closeDeviceControl();
    });

    [el.deviceName, el.deviceRoom].forEach(inp =>
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') saveDevice(); })
    );
};

// Map functions to window for HTML onClick compatibility
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
window.logout = () => {
    // TRUE LOGOUT: Erases memory and reloads the page to lock it!
    localStorage.removeItem('mshome_token');
    localStorage.removeItem('mshome_role');
    window.location.reload();
};

window.addEventListener('DOMContentLoaded', () => {
    setupListeners();

    // Check if user is logged in
    const token = localStorage.getItem('mshome_token');
    const authPage = document.getElementById('auth-page');

    if (token) {
        // Logged in: Hide auth screen and load devices!
        if (authPage) authPage.classList.add('hidden');
        applyRolePermissions();
        loadDevices();
        loadDeviceTypes();
    } else {
        // Not logged in: Ensure auth screen is visible
        if (authPage) authPage.classList.remove('hidden');
    }
});