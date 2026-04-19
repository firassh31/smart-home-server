/**
 * MSHome dashboard — vanilla JS
 * - Device list: fetch once, renderUI() updates DOM
 * - Card toggle: optimistic PUT /status, no full grid re-render
 * - Control panel: drafts (light / AC / lock) until Save Settings
 * - Modals: visibility via .is-open (CSS), not display toggles
 */

const API_URL = '/devices';
let devices = [];
let activeRoom = 'All';
let activeControlDevice = null;

/** Cached DOM refs (queried once at parse time) */
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

/* Fetch dynamic select options from the server */
const loadDeviceTypes = async () => {
    try {
        // Fetch from the new backend route
        const res = await fetch(API_URL + '/types');
        if (!res.ok) throw new Error();

        const types = await res.json();

        // Map the JSON data into HTML <option> elements
        el.deviceType.innerHTML = types.map(t =>
            `<option value="${t.value}">${t.label}</option>`
        ).join('');

    } catch {
        console.error("Could not load device types from server.");
    }
};
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

/** Devices in current room filter (for “Active” badge on mobile header) */
const filteredDevices = () =>
    activeRoom === 'All'
        ? devices
        : devices.filter(d => (d.room || 'Unassigned') === activeRoom);

/** Refresh header badges and stats without touching the grid */
const updateActiveBadges = () => {
    const onInFilter = filteredDevices().filter(d => d.status === 'on').length;
    const onTotal = devices.filter(d => d.status === 'on').length;
    if (el.activeCount) el.activeCount.textContent = onInFilter;
    if (el.activeCountDesktop) el.activeCountDesktop.textContent = onInFilter;
    if (el.statOn) el.statOn.textContent = onTotal;
};

const renderUI = () => {
    const rooms = ['All', ...new Set(devices.map(d => d.room || 'Unassigned'))];
    if (!rooms.includes(activeRoom)) activeRoom = 'All';

    const filtered = filteredDevices();
    const numRooms = new Set(devices.map(d => d.room || 'Unassigned')).size;

    if (el.statTotal) el.statTotal.textContent = devices.length;
    if (el.statRooms) el.statRooms.textContent = numRooms;
    updateActiveBadges();

    el.roomNav.innerHTML = rooms
        .map(
            r =>
                `<button class="room-pill${r === activeRoom ? ' active' : ''}" data-room="${r}">${r}</button>`
        )
        .join('');

    if (!filtered.length) {
        el.deviceList.innerHTML = `
            <div class="empty-state device-grid__full">
                <div class="empty-icon">🏠</div>
                <p>No devices found here.</p>
            </div>`;
        return;
    }

    el.deviceList.innerHTML = filtered
        .map(d => {
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
                        data-toggle="${d.id}" data-status="${d.status}">
                    ${on ? 'ON' : 'OFF'}
                </button>
            </div>
        </div>`;
        })
        .join('');
};

const setToggleButton = (btn, status) => {
    const on = status === 'on';
    btn.classList.toggle('btn-on', on);
    btn.classList.toggle('btn-off', !on);
    btn.textContent = on ? 'ON' : 'OFF';
    btn.dataset.status = status;
};

const toggleDevice = async (id, currentStatus) => {
    const newStatus = currentStatus === 'on' ? 'off' : 'on';
    const dev = devices.find(d => d.id === id);
    if (dev) dev.status = newStatus;

    const btn = document.querySelector(`#deviceList [data-toggle="${id}"]`);
    if (btn) setToggleButton(btn, newStatus);
    updateActiveBadges();
    if (activeControlDevice?.id === id && el.controlPanel.classList.contains('active')) {
        setPanelStatusToggleUI(newStatus);
    }

    try {
        const res = await fetch(`${API_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (!res.ok) throw new Error();
    } catch {
        if (dev) dev.status = currentStatus;
        if (btn) setToggleButton(btn, currentStatus);
        updateActiveBadges();
        if (activeControlDevice?.id === id && el.controlPanel.classList.contains('active')) {
            setPanelStatusToggleUI(currentStatus);
        }
        showToast('Could not update device', 'error');
    }
};

const saveDevice = async () => {
    const id = el.editingId.value.trim();
    const name = el.deviceName.value.trim();
    const room = el.deviceRoom.value.trim();
    const type = el.deviceType.value;
    if (!name || !room) return showToast('Please enter both fields', 'error');

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, room, type }),
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
        const res = await fetch(`${API_URL}/${el.deleteIdField.value}`, { method: 'DELETE' });
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

/* ——— Light panel ——— */
const updateSliderFill = slider => {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${pct}%`);
};

/* ——— AC dial (16–30°C, top semicircle; draft only until save) ——— */
const AC_MIN_TEMP = 16;
const AC_MAX_TEMP = 30;
const AC_MIN_ANGLE = -180;
const AC_MAX_ANGLE = 0;
const AC_DIAL_RADIUS = 90;
const AC_TRACK_RADIUS = AC_DIAL_RADIUS - 1.5;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const tempToAngle = temp => {
    const t = clamp(temp, AC_MIN_TEMP, AC_MAX_TEMP);
    const ratio = (t - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
    return AC_MIN_ANGLE + ratio * (AC_MAX_ANGLE - AC_MIN_ANGLE);
};

const angleToTemp = angle => {
    const a = clamp(angle, AC_MIN_ANGLE, AC_MAX_ANGLE);
    const ratio = (a - AC_MIN_ANGLE) / (AC_MAX_ANGLE - AC_MIN_ANGLE);
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
        const x = AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.cos(rad);
        const y = AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.sin(rad);
        tick.style.left = `${x}px`;
        tick.style.top = `${y}px`;
        const cool = ratio <= 0.5;
        tick.classList.toggle('tick-cool', cool);
        tick.classList.toggle('tick-warm', !cool);
        const blend = cool ? clamp(ratio / 0.5, 0, 1) : clamp((ratio - 0.5) / 0.5, 0, 1);
        tick.style.setProperty('--tick-blend', String(blend));
    });
};

const setACDialUI = temp => {
    const safe = setACTemperatureDraft(temp);
    const rad = (tempToAngle(safe) * Math.PI) / 180;
    const x = AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.cos(rad);
    const y = AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.sin(rad);
    el.tempDisplay.textContent = String(safe);
    if (el.acDialKnob) {
        el.acDialKnob.style.left = `${x}px`;
        el.acDialKnob.style.top = `${y}px`;
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
        const locked = d.state?.is_locked !== false;
        setUnlockButtonUI(locked);
    }

    document.querySelectorAll('.device-panel').forEach(p => p.classList.add('hidden'));
    const panel = document.getElementById(`panel-${d.type}`) || document.getElementById('panel-unknown');
    panel.classList.remove('hidden');
    el.controlPanel.classList.add('active');
};

const closeDeviceControl = () => {
    el.controlPanel.classList.remove('active');
    activeControlDevice = null;
};

const updateDeviceStatus = async newStatus => {
    if (!activeControlDevice) return;
    const id = activeControlDevice.id;
    const res = await fetch(`${API_URL}/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('status update failed');
    await res.json(); // API returns { message, status } — no device id; patch local model
    const i = devices.findIndex(d => d.id === id);
    if (i !== -1) devices[i].status = newStatus;
};

const updateDeviceState = async stateUpdates => {
    if (!activeControlDevice) return;
    const res = await fetch(`${API_URL}/${activeControlDevice.id}/state`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    else if (t === 'ac') {
        stateUpdates.temperature =
            activeControlDevice.state?.temperature ?? parseInt(el.tempDisplay.textContent, 10);
    } else if (t === 'doorlock') {
        stateUpdates.is_locked = activeControlDevice.state?.is_locked !== false;
    }

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
    if (roomBtn) {
        activeRoom = roomBtn.dataset.room;
        renderUI();
        return;
    }

    const menuBtn = t.closest('[data-menu]');
    if (menuBtn) {
        e.stopPropagation();
        const id = menuBtn.dataset.menu;
        const dd = document.getElementById(`device-menu-${id}`);
        const card = menuBtn.closest('.device-card');
        const wasOpen = dd.classList.contains('show');
        closeAllDropdowns();
        if (!wasOpen) {
            dd.classList.add('show');
            if (card) card.classList.add('menu-open');
        }
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

const getPointer = evt => {
    if (evt.touches?.length) return evt.touches[0];
    if (evt.changedTouches?.length) return evt.changedTouches[0];
    return evt;
};

const updateACDialFromPointer = evt => {
    if (!activeControlDevice || activeControlDevice.type !== 'ac') return;
    const p = getPointer(evt);
    const rect = el.acDial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let deg = (Math.atan2(p.clientY - cy, p.clientX - cx) * 180) / Math.PI;
    if (deg > 0) deg = deg > 90 ? -180 : 0;
    setACDialUI(angleToTemp(deg));
};

const setupACDialGestures = () => {
    if (!el.acDial) return;
    buildACTicks();
    let dragging = false;

    const start = evt => {
        if (!activeControlDevice || activeControlDevice.type !== 'ac') return;
        dragging = true;
        el.acDial.classList.add('dragging');
        updateACDialFromPointer(evt);
        if (evt.cancelable) evt.preventDefault();
    };

    const move = evt => {
        if (!dragging) return;
        updateACDialFromPointer(evt);
        if (evt.cancelable) evt.preventDefault();
    };

    const end = () => {
        if (!dragging) return;
        dragging = false;
        el.acDial.classList.remove('dragging');
    };

    el.acDial.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
    el.acDial.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end);
};

const setupListeners = () => {
    document.addEventListener('click', onDocumentClick);

    el.brightnessSlider.addEventListener('input', e => {
        el.brightnessDisplay.textContent = e.target.value;
        updateSliderFill(e.target);
    });

    el.presetContainer?.addEventListener('click', e => {
        const btn = e.target.closest('.preset-btn');
        if (!btn) return;
        const val = btn.getAttribute('data-val');
        if (val == null) return;
        el.brightnessSlider.value = val;
        el.brightnessDisplay.textContent = val;
        updateSliderFill(el.brightnessSlider);
    });

    setupACDialGestures();

    // Power in panel is draft-only: do not mutate devices[] / card until Save Settings.
    el.panelStatusToggle.addEventListener('click', () => {
        const cur = el.panelStatusToggle.dataset.status || 'off';
        setPanelStatusToggleUI(cur === 'on' ? 'off' : 'on');
    });

    el.unlockBtn.addEventListener('click', e => {
        if (!activeControlDevice) return;
        const locked = activeControlDevice.state?.is_locked !== false;
        const nextLocked = !locked;
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
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') saveDevice();
        })
    );
};

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

window.addEventListener('DOMContentLoaded', () => {
    setupListeners();
    loadDevices();
    loadDeviceTypes();
});
