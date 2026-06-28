/**
 * MSHome dashboard.
 * Keeps API calls, role rules, rendering, and device control behavior in one
 * vanilla JavaScript file for the static Express-served frontend.
 */

const API_URL = '/devices';
let devices = [];
let activeRoom = 'All';
let activeControlDevice = null;

// Cached DOM references used across render and event handlers.
const el = {
    deviceList: document.getElementById('deviceList'),
    roomNav: document.getElementById('room-nav'),
    activeCountDesktop: document.getElementById('active-count-desktop'),
    statTotal: document.getElementById('stat-total'),
    statOn: document.getElementById('stat-on'),
    statRooms: document.getElementById('stat-rooms'),
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

const DEVICE_ICONS = {
    light: 'Light',
    ac: 'AC',
    doorlock: 'Lock'
};

// Escapes dynamic data before it is written through innerHTML.
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[char]));

const getIcon = type => DEVICE_ICONS[type] || 'Device';

// Shows short-lived feedback for API and interaction results.
const showToast = (msg, type = 'success') => {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = msg;
    el.toastContainer.appendChild(node);
    setTimeout(() => node.remove(), 3100);
};

const openModal = id => document.getElementById(id).classList.add('is-open');
const closeModalById = id => document.getElementById(id).classList.remove('is-open');

// JWT headers are shared by every protected device request.
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('mshome_token')}`
});

// Loads the server-owned device type list into the add/edit form.
const loadDeviceTypes = async () => {
    try {
        const res = await fetch(`${API_URL}/types`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error();
        const types = await res.json();
        el.deviceType.innerHTML = types.map(t => `<option value="${escapeHTML(t.value)}">${escapeHTML(t.label)}</option>`).join('');
    } catch {
        console.error("Could not load device types.");
    }
};

// Fetches devices for the current user and sends expired sessions back to auth.
const loadDevices = async () => {
    try {
        const res = await fetch(API_URL, { headers: getAuthHeaders() });

        if (res.status === 401 || res.status === 403) {
            window.logout();
            return;
        }

        if (!res.ok) throw new Error();
        devices = await res.json();
        renderUI();
    } catch {
        if (el.deviceList) {
            el.deviceList.innerHTML = '<div class="empty-state device-grid__full"><div class="empty-icon">!</div><p>Failed to load devices.</p></div>';
        }
    }
};

const filteredDevices = () => activeRoom === 'All'
    ? devices
    : devices.filter(d => (d.room || 'Unassigned') === activeRoom);

// Keeps dashboard counters aligned with the selected room and full inventory.
const updateActiveBadges = () => {
    const onInFilter = filteredDevices().filter(d => d.status === 'on').length;
    const onTotal = devices.filter(d => d.status === 'on').length;
    if (el.activeCountDesktop) el.activeCountDesktop.textContent = onInFilter;
    if (el.statOn) el.statOn.textContent = onTotal;
};

// Applies parent/child display rules; the API still enforces permissions.
const applyRolePermissions = () => {
    const role = localStorage.getItem('mshome_role');
    const code = localStorage.getItem('mshome_code');
    const addBtn = document.querySelector('.desktop-add-btn');
    const codeDisplay = document.getElementById('desktop-family-code');
    const codeVal = document.getElementById('desktop-code-val');
    const isChild = role === 'child';

    if (addBtn) addBtn.classList.toggle('hidden', isChild);
    if (codeDisplay) codeDisplay.classList.add('hidden');

    if (!isChild && code && code !== 'undefined' && code !== 'null') {
        if (codeVal) codeVal.textContent = code;
        if (codeDisplay) codeDisplay.classList.remove('hidden');
    }
};

// Renders room filters, summary stats, and the current device cards.
const renderUI = () => {
    const rooms = ['All', ...new Set(devices.map(d => d.room || 'Unassigned'))];
    if (!rooms.includes(activeRoom)) activeRoom = 'All';

    const filtered = filteredDevices();
    const numRooms = new Set(devices.map(d => d.room || 'Unassigned')).size;
    const isParent = localStorage.getItem('mshome_role') !== 'child';

    if (el.statTotal) el.statTotal.textContent = devices.length;
    if (el.statRooms) el.statRooms.textContent = numRooms;
    updateActiveBadges();

    el.roomNav.innerHTML = rooms
        .map(room => `<button class="room-pill${room === activeRoom ? ' active' : ''}" data-room="${escapeHTML(room)}">${escapeHTML(room)}</button>`)
        .join('');

    if (!filtered.length) {
        el.deviceList.innerHTML = '<div class="empty-state device-grid__full"><div class="empty-icon">--</div><p>No devices found here.</p></div>';
        return;
    }

    el.deviceList.innerHTML = filtered.map(device => {
        const on = device.status === 'on';
        const id = escapeHTML(device.id);
        const name = escapeHTML(device.name);
        const room = escapeHTML(device.room || 'Unassigned');
        const type = escapeHTML(device.type);

        return `
        <div class="device-card" data-id="${id}">
            ${isParent ? `
            <div class="device-card-menu">
                <button class="device-card-menu-btn" data-menu="${id}" aria-label="Open device actions">...</button>
                <div id="device-menu-${id}" class="device-card-dropdown">
                    <button data-edit="${id}">Edit</button>
                    <button class="delete-text" data-delete="${id}">Delete</button>
                </div>
            </div>` : ''}
            <div class="device-info" data-open="${id}">
                <div class="device-icon">${getIcon(type)}</div>
                <strong>${name}</strong>
                <span class="room-label">${room}</span>
            </div>
            <div class="device-actions">
                <button class="power-circle-btn ${on ? 'btn-on' : 'btn-off'}" data-toggle="${id}" data-status="${device.status}" aria-label="Toggle power">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                        <line x1="12" y1="2" x2="12" y2="12"></line>
                    </svg>
                </button>
            </div>
        </div>`;
    }).join('');
};

// Keeps button styles and data attributes synchronized after status changes.
const setToggleButton = (btn, status) => {
    const on = status === 'on';
    btn.classList.toggle('btn-on', on);
    btn.classList.toggle('btn-off', !on);
    btn.dataset.status = status;
};

// Optimistically toggles a device, then rolls back the UI if the API fails.
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

// Creates or updates a device through the shared add/edit modal.
const saveDevice = async () => {
    const id = el.editingId.value.trim();
    const name = el.deviceName.value.trim();
    const room = el.deviceRoom.value.trim();
    const type = el.deviceType.value;
    const childAccessEl = document.getElementById('device-child-access');
    const childAccess = childAccessEl ? childAccessEl.checked : false;

    if (!name || !room) return showToast('Please enter both fields', 'error');

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL}/${id}` : API_URL;

    try {
        const res = await fetch(url, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify({ name, room, type, childAccess }),
        });
        if (!res.ok) throw new Error();
        closeAddModal();
        await loadDevices();
        showToast(`Device ${id ? 'updated' : 'added'} successfully!`, 'success');
    } catch {
        showToast('Error saving device', 'error');
    }
};

// Confirms and performs a parent-only delete request.
const confirmDelete = async () => {
    const btn = document.querySelector('#deleteModal .danger-btn');
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Deleting...';

    try {
        const res = await fetch(`${API_URL}/${el.deleteIdField.value}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
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

// Resets the device modal into create mode.
const openAddModal = async () => {
    await loadDeviceTypes();
    el.modalTitle.textContent = 'Add New Device';
    el.editingId.value = '';
    el.deviceName.value = '';
    el.deviceRoom.value = '';
    el.deviceType.value = 'light';

    const childAccessEl = document.getElementById('device-child-access');
    if (childAccessEl) childAccessEl.checked = false;

    openModal('addModal');
    setTimeout(() => el.deviceName.focus(), 80);
};

const closeAddModal = () => closeModalById('addModal');

// Loads the selected device into the same modal used for creation.
const editDevice = async (id) => {
    const device = devices.find(x => x.id === id);
    if (!device) return;

    await loadDeviceTypes();
    el.modalTitle.textContent = 'Edit Device';
    el.editingId.value = device.id;
    el.deviceName.value = device.name;
    el.deviceRoom.value = device.room || '';
    el.deviceType.value = device.type;

    const childAccessEl = document.getElementById('device-child-access');
    if (childAccessEl) childAccessEl.checked = device.childAccess || false;

    closeAllDropdowns();
    openModal('addModal');
    setTimeout(() => el.deviceName.focus(), 80);
};

// Closes any open per-card action menus.
const closeAllDropdowns = () => {
    document.querySelectorAll('.device-card-dropdown.show').forEach(menu => {
        menu.classList.remove('show');
        const card = menu.closest('.device-card');
        if (card) card.classList.remove('menu-open');
    });
};

// Range input fill is drawn with a CSS custom property.
const updateSliderFill = slider => {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.setProperty('--value', `${pct}%`);
};

const AC_MIN_TEMP = 16;
const AC_MAX_TEMP = 30;
const AC_MIN_ANGLE = -180;
const AC_MAX_ANGLE = 0;
const AC_DIAL_RADIUS = 90;
const AC_TRACK_RADIUS = 88.5;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const tempToAngle = temp => {
    const ratio = (clamp(temp, AC_MIN_TEMP, AC_MAX_TEMP) - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
    return AC_MIN_ANGLE + ratio * (AC_MAX_ANGLE - AC_MIN_ANGLE);
};

const angleToTemp = angle => {
    const ratio = (clamp(angle, AC_MIN_ANGLE, AC_MAX_ANGLE) - AC_MIN_ANGLE) / (AC_MAX_ANGLE - AC_MIN_ANGLE);
    return Math.round(AC_MIN_TEMP + ratio * (AC_MAX_TEMP - AC_MIN_TEMP));
};

// Stores panel edits locally until the user clicks Save Settings.
const setACTemperatureDraft = temp => {
    const next = clamp(parseInt(temp, 10), AC_MIN_TEMP, AC_MAX_TEMP);
    if (activeControlDevice) {
        if (!activeControlDevice.state) activeControlDevice.state = {};
        activeControlDevice.state.temperature = next;
    }
    return next;
};

// Builds the AC dial tick marks once, then repositions them on updates.
const buildACTicks = () => {
    if (!el.acDialTicks || el.acDialTicks.childElementCount) return;

    for (let temp = AC_MIN_TEMP; temp <= AC_MAX_TEMP; temp++) {
        const span = document.createElement('span');
        span.className = 'ac-dial-tick';
        span.dataset.temp = String(temp);
        el.acDialTicks.appendChild(span);
    }
};

const updateACTicks = () => {
    if (!el.acDialTicks) return;

    el.acDialTicks.querySelectorAll('.ac-dial-tick').forEach(tick => {
        const tickTemp = Number(tick.dataset.temp);
        const ratio = (tickTemp - AC_MIN_TEMP) / (AC_MAX_TEMP - AC_MIN_TEMP);
        const rad = (tempToAngle(tickTemp) * Math.PI) / 180;
        const cool = ratio <= 0.5;

        tick.style.left = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.cos(rad)}px`;
        tick.style.top = `${AC_DIAL_RADIUS + AC_TRACK_RADIUS * Math.sin(rad)}px`;
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

// Opens the advanced control panel and selects controls for the device type.
const openDeviceControl = id => {
    const device = devices.find(x => x.id === id);
    if (!device) return;

    activeControlDevice = device;
    el.controlName.textContent = device.name;
    setPanelStatusToggleUI(device.status || 'off');

    if (device.type === 'light') {
        el.brightnessSlider.value = device.state?.brightness || 10;
        el.brightnessDisplay.textContent = el.brightnessSlider.value;
        updateSliderFill(el.brightnessSlider);
    } else if (device.type === 'ac') {
        setACDialUI(device.state?.temperature ?? 22);
    } else if (device.type === 'doorlock') {
        setUnlockButtonUI(device.state?.is_locked !== false);
    }

    document.querySelectorAll('.device-panel').forEach(panel => panel.classList.add('hidden'));
    (document.getElementById(`panel-${device.type}`) || document.getElementById('panel-unknown')).classList.remove('hidden');
    el.controlPanel.classList.add('active');
};

const closeDeviceControl = () => {
    el.controlPanel.classList.remove('active');
    activeControlDevice = null;
};

// Persists the panel's status toggle.
const updateDeviceStatus = async newStatus => {
    if (!activeControlDevice) return;

    const res = await fetch(`${API_URL}/${activeControlDevice.id}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('status update failed');

    const index = devices.findIndex(d => d.id === activeControlDevice.id);
    if (index !== -1) devices[index].status = newStatus;
};

// Persists nested state fields changed in the control panel.
const updateDeviceState = async stateUpdates => {
    if (!activeControlDevice) return;

    const res = await fetch(`${API_URL}/${activeControlDevice.id}/state`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(stateUpdates),
    });
    if (!res.ok) throw new Error('state update failed');

    const updated = await res.json();
    const index = devices.findIndex(d => d.id === updated.id);
    if (index !== -1) devices[index] = updated;
};

// Saves both status and state edits from the control panel.
const savePanelSettings = async () => {
    if (!activeControlDevice) return;

    const statusToSave = el.panelStatusToggle.dataset.status || 'off';
    const stateUpdates = {};
    const type = activeControlDevice.type;

    if (type === 'light') stateUpdates.brightness = parseInt(el.brightnessSlider.value, 10);
    else if (type === 'ac') stateUpdates.temperature = activeControlDevice.state?.temperature ?? parseInt(el.tempDisplay.textContent, 10);
    else if (type === 'doorlock') stateUpdates.is_locked = activeControlDevice.state?.is_locked !== false;

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

// Central click delegation for generated dashboard controls.
const onDocumentClick = event => {
    const target = event.target;
    const roomBtn = target.closest('[data-room]');
    if (roomBtn) {
        activeRoom = roomBtn.dataset.room;
        renderUI();
        return;
    }

    const menuBtn = target.closest('[data-menu]');
    if (menuBtn) {
        event.stopPropagation();
        const dropdown = document.getElementById(`device-menu-${menuBtn.dataset.menu}`);
        const card = menuBtn.closest('.device-card');
        const wasOpen = dropdown.classList.contains('show');
        closeAllDropdowns();
        if (!wasOpen) {
            dropdown.classList.add('show');
            if (card) card.classList.add('menu-open');
        }
        return;
    }

    const editBtn = target.closest('[data-edit]');
    if (editBtn) return editDevice(editBtn.dataset.edit);

    const deleteBtn = target.closest('[data-delete]');
    if (deleteBtn) return openDeleteModal(deleteBtn.dataset.delete);

    const toggleBtn = target.closest('#deviceList [data-toggle]');
    if (toggleBtn) {
        event.stopPropagation();
        return toggleDevice(toggleBtn.dataset.toggle, toggleBtn.dataset.status);
    }

    const openArea = target.closest('[data-open]');
    if (openArea && !target.closest('button') && !target.closest('.device-card-dropdown')) {
        return openDeviceControl(openArea.dataset.open);
    }

    if (!target.closest('.device-card-menu')) closeAllDropdowns();
};

// Enables drag control for the AC temperature dial.
const setupACDialGestures = () => {
    if (!el.acDial) return;
    buildACTicks();
    let dragging = false;

    const updateACDialFromPointer = event => {
        if (!activeControlDevice || activeControlDevice.type !== 'ac') return;

        const rect = el.acDial.getBoundingClientRect();
        let deg = (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180) / Math.PI;
        if (deg > 0) deg = deg > 90 ? -180 : 0;
        setACDialUI(angleToTemp(deg));
    };

    const start = event => {
        if (!activeControlDevice || activeControlDevice.type !== 'ac') return;
        dragging = true;
        el.acDial.classList.add('dragging');
        updateACDialFromPointer(event);
        event.preventDefault();
    };
    const move = event => {
        if (!dragging) return;
        updateACDialFromPointer(event);
        event.preventDefault();
    };
    const end = () => {
        if (!dragging) return;
        dragging = false;
        el.acDial.classList.remove('dragging');
    };

    el.acDial.addEventListener('mousedown', start);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
};

// Wires static DOM events once after the document is ready.
const setupListeners = () => {
    const authForm = document.getElementById('auth-form');
    const authMessage = document.getElementById('auth-message');
    const authToggleLink = document.getElementById('auth-toggle-link');
    const authToggleText = document.getElementById('auth-toggle-text');
    const authSubmitBtn = document.getElementById('auth-submit-btn');
    const roleGroup = document.getElementById('auth-role-group');
    const emailGroup = document.getElementById('auth-email-group');
    const parentGroup = document.getElementById('auth-parent-group');
    const roleSelect = document.getElementById('auth-role');
    let isLoginMode = true;

    if (authForm) {
        roleSelect.addEventListener('change', event => {
            parentGroup.classList.toggle('hidden', event.target.value !== 'child' || isLoginMode);
        });

        authToggleLink.addEventListener('click', event => {
            event.preventDefault();
            isLoginMode = !isLoginMode;
            roleGroup.classList.toggle('hidden', isLoginMode);
            emailGroup.classList.toggle('hidden', isLoginMode);
            parentGroup.classList.toggle('hidden', isLoginMode || roleSelect.value !== 'child');
            authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
            authToggleText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
            authToggleLink.textContent = isLoginMode ? 'Register here' : 'Log in here';
            document.querySelector('.auth-box h3').textContent = isLoginMode ? 'Create Account / Login' : 'Create Account';
            authMessage.textContent = '';
        });

        authForm.addEventListener('submit', async event => {
            event.preventDefault();

            const name = document.getElementById('auth-name').value.trim();
            const password = document.getElementById('auth-password').value.trim();
            const role = roleSelect.value;
            const codeInput = document.getElementById('auth-family-code');
            const familyCode = codeInput ? codeInput.value.trim().toUpperCase() : '';

            authMessage.className = 'auth-msg-text error';
            if (!name || !password) return authMessage.textContent = "Error: Fill all fields.";
            if (!isLoginMode && role === 'child' && !familyCode) {
                return authMessage.textContent = "Error: Child accounts must enter the 6-digit Family Code.";
            }

            let payload;
            if (isLoginMode) {
                payload = { name, password };
            } else {
                const email = document.getElementById('auth-email').value.trim();
                if (!email) return authMessage.textContent = "Error: Email is required to register.";
                if (password.length < 6) return authMessage.textContent = "Error: Password must be at least 6 characters.";
                payload = { name, email, password, role, familyCode };
            }

            try {
                authSubmitBtn.textContent = 'Processing...';
                authSubmitBtn.disabled = true;

                const response = await fetch(isLoginMode ? '/auth/login' : '/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Authentication failed');

                localStorage.setItem('mshome_token', data.token);
                localStorage.setItem('mshome_role', data.role);
                localStorage.setItem('mshome_code', data.familyCode || '');
                authMessage.className = 'auth-msg-text success';
                authMessage.textContent = data.message;

                setTimeout(() => {
                    document.getElementById('auth-page').classList.add('hidden');
                    applyRolePermissions();
                    loadDeviceTypes();
                    loadDevices();
                    fetchWeather();
                }, 1000);
            } catch (error) {
                authMessage.textContent = `Error: ${error.message}`;
            } finally {
                authSubmitBtn.textContent = isLoginMode ? 'Sign In' : 'Create Account';
                authSubmitBtn.disabled = false;
            }
        });
    }

    document.addEventListener('click', onDocumentClick);

    el.brightnessSlider.addEventListener('input', event => {
        el.brightnessDisplay.textContent = event.target.value;
        updateSliderFill(event.target);
    });

    el.presetContainer?.addEventListener('click', event => {
        const btn = event.target.closest('.preset-btn');
        if (!btn || btn.getAttribute('data-val') == null) return;
        el.brightnessSlider.value = btn.getAttribute('data-val');
        el.brightnessDisplay.textContent = el.brightnessSlider.value;
        updateSliderFill(el.brightnessSlider);
    });

    setupACDialGestures();

    el.panelStatusToggle.addEventListener('click', () => {
        setPanelStatusToggleUI(el.panelStatusToggle.dataset.status === 'on' ? 'off' : 'on');
    });

    el.unlockBtn.addEventListener('click', event => {
        if (!activeControlDevice) return;
        const nextLocked = activeControlDevice.state?.is_locked === false;
        if (!activeControlDevice.state) activeControlDevice.state = {};
        activeControlDevice.state.is_locked = nextLocked;
        setPanelStatusToggleUI(nextLocked ? 'on' : 'off');
        setUnlockButtonUI(nextLocked, event.currentTarget);
        showToast(nextLocked ? 'Door locked (pending save)' : 'Door unlocked (pending save)', 'info');
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (el.addModal.classList.contains('is-open')) closeAddModal();
        if (el.deleteModal.classList.contains('is-open')) closeModal();
        if (el.controlPanel.classList.contains('active')) closeDeviceControl();
    });

    [el.deviceName, el.deviceRoom].forEach(input =>
        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') saveDevice();
        })
    );
};

// Weather data is fetched through the server proxy so the API key stays private.
const fetchWeather = async () => {
    const iconEl = document.getElementById('weather-icon');
    const tempEl = document.getElementById('weather-temp');
    const descEl = document.getElementById('weather-desc');
    const widgetEl = document.getElementById('weather-widget');

    if (!iconEl || !tempEl || !descEl) return;

    const getWeatherData = async (queryUrl) => {
        try {
            const response = await fetch(queryUrl);
            if (!response.ok) throw new Error('Weather endpoint failed');
            const data = await response.json();
            const temp = Math.round(data.main.temp);
            const desc = data.weather?.[0]?.description || 'Unknown';
            const iconCode = data.weather?.[0]?.icon || '';
            const locationName = data.name || 'your area';
            const labelMap = {
                '01d': 'Clear',
                '01n': 'Clear',
                '02d': 'Clouds',
                '02n': 'Clouds',
                '03d': 'Clouds',
                '03n': 'Clouds',
                '04d': 'Clouds',
                '04n': 'Clouds',
                '09d': 'Rain',
                '09n': 'Rain',
                '10d': 'Rain',
                '10n': 'Rain',
                '11d': 'Storm',
                '11n': 'Storm',
                '13d': 'Snow',
                '13n': 'Snow',
                '50d': 'Fog',
                '50n': 'Fog'
            };

            tempEl.textContent = `${temp}\u00B0C`;
            descEl.textContent = desc;
            iconEl.textContent = labelMap[iconCode] || 'Weather';
            if (widgetEl) widgetEl.title = `Current Weather in ${locationName}`;
        } catch (error) {
            console.error("External API Error:", error);
            tempEl.textContent = '--\u00B0C';
            descEl.textContent = 'Offline';
            iconEl.textContent = 'Offline';
        }
    };

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            position => getWeatherData(`/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`),
            () => getWeatherData('/api/weather?city=Haifa'),
            { timeout: 10000 }
        );
    } else {
        getWeatherData('/api/weather?city=Haifa');
    }
};

// Inline HTML handlers are kept mapped here for the static template.
window.saveDevice = saveDevice;
window.confirmDelete = confirmDelete;
window.openAddModal = openAddModal;
window.closeAddModal = closeAddModal;
window.closeModal = closeModal;
window.closeDeviceControl = closeDeviceControl;
window.savePanelSettings = savePanelSettings;
window.copyFamilyCode = async () => {
    const code = localStorage.getItem('mshome_code');
    if (!code) return;

    try {
        await navigator.clipboard.writeText(code);
        showToast('Invite code copied to clipboard!', 'success');
    } catch {
        showToast('Failed to copy code.', 'error');
    }
};
window.logout = () => {
    localStorage.clear();
    window.location.reload();
};

window.addEventListener('DOMContentLoaded', () => {
    setupListeners();

    const token = localStorage.getItem('mshome_token');
    const authPage = document.getElementById('auth-page');

    if (token && token !== 'undefined' && token !== 'null') {
        if (authPage) authPage.classList.add('hidden');
        applyRolePermissions();
        loadDevices();
        loadDeviceTypes();
        fetchWeather();
    } else {
        localStorage.clear();
        if (authPage) authPage.classList.remove('hidden');
    }
});
