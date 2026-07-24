// GRS Smart Energy Monitoring System - Main Application Logic
import db from './db.js';
import { renderDashboardCharts } from './charts.js';

// Global App State
let state = {
    currentRole: null,   // 'technician', 'supervisor', 'manager'
    currentUser: null,   // user object
    activeTab: 'dashboard',
    
    // Technician workflow state
    selectedLocationId: null,
    selectedMeterId: null,
    capturedPhoto: null,
    ocrReading: null,
    
    // Manager editor state
    editingUser: null
};

// UI Selectors
const DOM = {
    // Role selection screen
    roleSelectionScreen: document.getElementById('roleSelectionScreen'),
    loginPanel: document.getElementById('loginPanel'),
    loginTitle: document.getElementById('loginTitle'),
    loginForm: document.getElementById('loginForm'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('loginError'),
    
    // Main layouts
    appHeader: document.getElementById('appHeader'),
    mainAppArea: document.getElementById('mainAppArea'),
    techDashboard: document.getElementById('techDashboard'),
    supervisorDashboard: document.getElementById('supervisorDashboard'),
    managerDashboard: document.getElementById('managerDashboard'),
    
    // Header controls
    headerUserRole: document.getElementById('headerUserRole'),
    headerUserName: document.getElementById('headerUserName'),
    logoutBtn: document.getElementById('logoutBtn')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    showRoleSelection();
});

// Event Listeners Configuration
function setupEventListeners() {
    // Role selector buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = btn.dataset.role;
            showLoginForm(role);
        });
    });

    // Login Form Submit
    DOM.loginForm.addEventListener('submit', handleLogin);
    
    // Cancel login button
    document.getElementById('cancelLoginBtn').addEventListener('click', showRoleSelection);

    // Logout
    DOM.logoutBtn.addEventListener('click', handleLogout);
}

// Show the role choice cards
function showRoleSelection() {
    state.currentRole = null;
    state.currentUser = null;
    
    DOM.roleSelectionScreen.classList.remove('d-none');
    DOM.loginPanel.style.display = 'none';
    DOM.appHeader.classList.add('d-none');
    DOM.mainAppArea.classList.add('d-none');
    
    DOM.usernameInput.value = '';
    DOM.passwordInput.value = '';
    DOM.loginError.classList.add('d-none');
}

// Show login form for a specific role
function showLoginForm(role) {
    state.currentRole = role;
    DOM.loginPanel.style.display = 'block';
    DOM.loginTitle.textContent = `${role.charAt(0).toUpperCase() + role.slice(1)} Login`;
    DOM.loginError.classList.add('d-none');
    
    // Autofill credentials for easy testing
    if (db.isCloudMode()) {
        if (role === 'admin') {
            DOM.usernameInput.value = 'admin@grsenergy.com';
            DOM.passwordInput.value = 'admin123';
        } else if (role === 'manager') {
            DOM.usernameInput.value = 'manager@grsenergy.com';
            DOM.passwordInput.value = 'manager123';
        } else if (role === 'supervisor') {
            DOM.usernameInput.value = 'supervisor@grsenergy.com';
            DOM.passwordInput.value = 'supervisor123';
        } else if (role === 'technician') {
            DOM.usernameInput.value = 'tech@grsenergy.com';
            DOM.passwordInput.value = 'tech123';
        }
    } else {
        if (role === 'manager') {
            DOM.usernameInput.value = 'manager';
            DOM.passwordInput.value = '123';
        } else if (role === 'supervisor') {
            DOM.usernameInput.value = 'supervisor';
            DOM.passwordInput.value = '123';
        } else if (role === 'technician') {
            DOM.usernameInput.value = 'tech_suhas';
            DOM.passwordInput.value = '123';
        } else {
            DOM.usernameInput.value = '';
            DOM.passwordInput.value = '';
        }
    }
    
    DOM.passwordInput.focus();
}

// Authenticate and Login
async function handleLogin(e) {
    e.preventDefault();
    const username = DOM.usernameInput.value.trim();
    const password = DOM.passwordInput.value;
    
    if (db.isCloudMode()) {
        try {
            const { user, profile } = await db.supabase.signIn(username, password);
            const userRole = (profile.role || 'TECHNICIAN').toLowerCase();
            
            // Allow ADMIN to access any role dashboard for easy testing
            if (userRole === state.currentRole || userRole === 'admin') {
                state.currentUser = {
                    id: profile.id,
                    username: profile.email,
                    name: profile.full_name || profile.email,
                    role: userRole,
                    email: profile.email
                };
                loginSuccess();
            } else {
                DOM.loginError.textContent = `Access denied. Account role is '${userRole.toUpperCase()}', but logging in as '${state.currentRole.toUpperCase()}'.`;
                DOM.loginError.classList.remove('d-none');
            }
        }
        catch (err) {
            console.error("Supabase Login Error:", err);
            DOM.loginError.textContent = err.message || 'Invalid email or password.';
            DOM.loginError.classList.remove('d-none');
        }
    } else {
        const users = db.getUsers();
        const user = users.find(u => (u.username === username || u.email === username) && u.password === password);
        
        if (user) {
            state.currentUser = user;
            loginSuccess();
        } else {
            DOM.loginError.textContent = 'Invalid username or password.';
            DOM.loginError.classList.remove('d-none');
        }
    }
}

// Redirect to proper dashboard based on role
function loginSuccess() {
    DOM.roleSelectionScreen.classList.add('d-none');
    DOM.appHeader.classList.remove('d-none');
    DOM.mainAppArea.classList.remove('d-none');
    
    // Set Header Info
    DOM.headerUserRole.className = `user-badge ${state.currentRole}`;
    DOM.headerUserRole.innerHTML = `<span class="indicator"></span>${state.currentRole.toUpperCase()}`;
    DOM.headerUserName.textContent = state.currentUser.name;
    
    // Hide all dashboards first
    DOM.techDashboard.classList.add('d-none');
    DOM.supervisorDashboard.classList.add('d-none');
    DOM.managerDashboard.classList.add('d-none');
    
    if (state.currentRole === 'technician') {
        DOM.techDashboard.classList.remove('d-none');
        initTechnicianDashboard();
    } else if (state.currentRole === 'supervisor') {
        DOM.supervisorDashboard.classList.remove('d-none');
        initSupervisorDashboard();
        setupRealtimeSync();
    } else if (state.currentRole === 'manager' || state.currentRole === 'admin') {
        DOM.managerDashboard.classList.remove('d-none');
        initManagerDashboard();
        setupRealtimeSync();
    }
}

// Setup Real-time Listener for Supabase Cloud Updates
function setupRealtimeSync() {
    if (db.isCloudMode() && db.supabase) {
        db.supabase.subscribeToReadings((payload) => {
            console.log("⚡ Auto-refreshing dashboard view on cloud change:", payload);
            if (state.currentRole === 'supervisor') {
                loadSupervisorReadings();
            } else if (state.currentRole === 'manager' || state.currentRole === 'admin') {
                loadManagerSubmissions();
            }
        });
    }
}

// Logout
function handleLogout() {
    showRoleSelection();
}

// ==========================================
// TECHNICIAN MODULE
// ==========================================
async function initTechnicianDashboard() {
    // Reset Technician State
    state.selectedLocationId = null;
    state.selectedMeterId = null;
    state.capturedPhoto = null;
    state.ocrReading = null;
    
    // Render location select box
    const locationSelect = document.getElementById('techLocationSelect');
    locationSelect.innerHTML = '<option value="">-- Select Location --</option>';
    
    let allLocations = [];
    if (db.isCloudMode()) {
        try {
            allLocations = await db.supabase.getLocations();
        } catch (err) {
            console.error("Error loading cloud locations:", err);
            allLocations = db.getLocations();
        }
    } else {
        allLocations = db.getLocations();
    }
    
    state.cachedLocations = allLocations;
    
    const assignedLocations = allLocations.filter(l => {
        if (!state.currentUser.assignedLocations || state.currentUser.assignedLocations.length === 0) return true;
        return state.currentUser.assignedLocations.includes(l.id);
    });
    
    assignedLocations.forEach(loc => {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.name;
        locationSelect.appendChild(opt);
    });
    
    // Hide following steps
    document.getElementById('techMeterStep').classList.add('d-none');
    document.getElementById('techPhotoStep').classList.add('d-none');
    document.getElementById('techOcrStep').classList.add('d-none');
    
    // Listener
    locationSelect.onchange = (e) => {
        state.selectedLocationId = e.target.value;
        if (state.selectedLocationId) {
            loadTechnicianMeters(state.selectedLocationId);
        } else {
            document.getElementById('techMeterStep').classList.add('d-none');
            document.getElementById('techPhotoStep').classList.add('d-none');
            document.getElementById('techOcrStep').classList.add('d-none');
        }
    };
}

async function loadTechnicianMeters(locationId) {
    const meterStep = document.getElementById('techMeterStep');
    const meterSelect = document.getElementById('techMeterSelect');
    meterSelect.innerHTML = '<option value="">-- Select Energy Meter --</option>';
    
    let allMeters = [];
    if (db.isCloudMode()) {
        try {
            allMeters = await db.supabase.getEnergyMeters();
        } catch (err) {
            console.error("Error loading cloud meters:", err);
            allMeters = db.getEnergyMeters();
        }
    } else {
        allMeters = db.getEnergyMeters();
    }
    
    state.cachedMeters = allMeters;
    
    const locationMeters = allMeters.filter(m => {
        const mLocId = m.locationId || m.location_id;
        return mLocId === locationId;
    });
    
    locationMeters.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.meter_name || m.name;
        meterSelect.appendChild(opt);
    });
    
    meterStep.classList.remove('d-none');
    document.getElementById('techPhotoStep').classList.add('d-none');
    document.getElementById('techOcrStep').classList.add('d-none');
    
    meterSelect.onchange = (e) => {
        state.selectedMeterId = e.target.value;
        if (state.selectedMeterId) {
            showPhotoStep();
        } else {
            document.getElementById('techPhotoStep').classList.add('d-none');
            document.getElementById('techOcrStep').classList.add('d-none');
        }
    };
}

function showPhotoStep() {
    const photoStep = document.getElementById('techPhotoStep');
    photoStep.classList.remove('d-none');
    document.getElementById('techOcrStep').classList.add('d-none');
    
    const preview = document.getElementById('techPhotoPreview');
    const uploadInput = document.getElementById('techPhotoUpload');
    const captureBtn = document.getElementById('techCaptureBtn');
    const uploadPlaceholder = document.getElementById('techUploadPlaceholder');
    
    preview.style.display = 'none';
    uploadPlaceholder.style.display = 'block';
    
    // Capture from mobile camera or simulated capture
    captureBtn.onclick = () => {
        // Simulated Camera capture with high premium design feedback
        // We will open a camera UI overlay
        showSimulatedCamera((capturedBase64) => {
            state.capturedPhoto = capturedBase64;
            preview.src = capturedBase64;
            preview.style.display = 'block';
            uploadPlaceholder.style.display = 'none';
            runAiOcrSimulation();
        });
    };
    
    // Upload from gallery alternative
    uploadInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.capturedPhoto = event.target.result;
                preview.src = event.target.result;
                preview.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
                runAiOcrSimulation();
            };
            reader.readAsDataURL(file);
        }
    };
}

function showSimulatedCamera(onCapture) {
    // Show a premium overlay of custom camera capture
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Mobile Camera Capture</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body text-center" style="position: relative;">
                <div style="background:#000; width:100%; height:320px; border-radius:12px; position:relative; overflow:hidden;" id="camViewport">
                    <video id="webcamVideo" width="100%" height="100%" autoplay playsinline style="object-fit: cover;"></video>
                    <!-- Simulated camera frames and guides -->
                    <div style="position:absolute; top:20px; left:20px; border-top:3px solid var(--primary); border-left:3px solid var(--primary); width:30px; height:30px;"></div>
                    <div style="position:absolute; top:20px; right:20px; border-top:3px solid var(--primary); border-right:3px solid var(--primary); width:30px; height:30px;"></div>
                    <div style="position:absolute; bottom:20px; left:20px; border-bottom:3px solid var(--primary); border-left:3px solid var(--primary); width:30px; height:30px;"></div>
                    <div style="position:absolute; bottom:20px; right:20px; border-bottom:3px solid var(--primary); border-right:3px solid var(--primary); width:30px; height:30px;"></div>
                    
                    <div class="scanner-laser" style="display:block;"></div>
                    
                    <div id="camFallbackMsg" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:var(--text-secondary); width:80%;">
                        <i class="fas fa-camera" style="font-size:3rem; margin-bottom:1rem; color:var(--primary);"></i>
                        <p>Camera Permitted. Tap Capture below to read the meter.</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="camCancel">Cancel</button>
                <button class="btn btn-primary" id="camSnap"><i class="fas fa-circle"></i> Capture</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.modal-close');
    const cancelBtn = modal.querySelector('#camCancel');
    const snapBtn = modal.querySelector('#camSnap');
    const video = modal.querySelector('#webcamVideo');
    let mediaStream = null;

    // Try accessing actual camera (will fallback if not available)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            mediaStream = stream;
            video.srcObject = stream;
            modal.querySelector('#camFallbackMsg').style.display = 'none';
        })
        .catch(err => {
            console.log("Real camera not accessible, using mock camera stream:", err);
            video.style.display = 'none';
        });

    const cleanup = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
        }
        modal.remove();
    };

    closeBtn.onclick = cleanup;
    cancelBtn.onclick = cleanup;

    snapBtn.onclick = () => {
        let base64Img = '';
        if (mediaStream) {
            // Draw real video frame to canvas
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            base64Img = canvas.toDataURL('image/jpeg');
        } else {
            // Generate a realistic mock meter reading image as SVG base64
            const rVal = (Math.random() * 5000 + 10000).toFixed(1);
            const selectedMeter = (db.isCloudMode() && state.cachedMeters) ? 
                state.cachedMeters.find(m => m.id === state.selectedMeterId) : 
                db.getEnergyMeters().find(m => m.id === state.selectedMeterId);
            const mName = selectedMeter ? (selectedMeter.meter_name || selectedMeter.name) : 'Meter';
            base64Img = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%230f172a"/><stop offset="100%" style="stop-color:%231e293b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2338bdf8" font-family="monospace" font-size="28">${rVal} kWh</text><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="12">METER: ${mName}</text></svg>`;
        }
        
        onCapture(base64Img);
        cleanup();
    };
}

async function runAiOcrSimulation() {
    const ocrStep = document.getElementById('techOcrStep');
    ocrStep.classList.remove('d-none');
    
    const ocrLoading = document.getElementById('techOcrLoading');
    const ocrResultBox = document.getElementById('techOcrResultBox');
    const readingInput = document.getElementById('techReadingInput');
    const verifySubmitBtn = document.getElementById('techSubmitBtn');
    
    ocrLoading.classList.remove('d-none');
    ocrResultBox.style.display = 'none';
    verifySubmitBtn.disabled = true;

    let allReadings = [];
    let allMeters = [];
    if (db.isCloudMode()) {
        try {
            allReadings = await db.supabase.getMeterReadings();
            allMeters = await db.supabase.getEnergyMeters();
        } catch (err) {
            allReadings = db.getMeterReadings();
            allMeters = db.getEnergyMeters();
        }
    } else {
        allReadings = db.getMeterReadings();
        allMeters = db.getEnergyMeters();
    }
    
    // Simulate OCR delay (1.5 seconds)
    setTimeout(() => {
        ocrLoading.classList.add('d-none');
        ocrResultBox.style.display = 'block';
        verifySubmitBtn.disabled = false;
        
        // Generate a simulated reading based on history of this meter
        const selectedMeter = allMeters.find(m => m.id === state.selectedMeterId);
        const mName = selectedMeter ? (selectedMeter.meter_name || selectedMeter.name) : 'Meter';
        
        // Find previous reading for this meter
        const prevReadings = allReadings.filter(r => r.energyMeter === mName && r.status === 'Approved');
        let baseReading = 10000; // default starting point
        if (prevReadings.length > 0) {
            // Get highest reading
            baseReading = Math.max(...prevReadings.map(r => parseFloat(r.meterReading) || 0));
        }
        
        // Increment reading realistically (e.g. 50 to 200 units)
        const increment = parseFloat((Math.random() * 150 + 50).toFixed(1));
        const detectedVal = (baseReading + increment).toFixed(1);
        
        state.ocrReading = detectedVal;
        document.getElementById('techOcrVal').textContent = `${detectedVal} kWh`;
        readingInput.value = detectedVal;
    }, 1500);
    
    // Setup verification click handler
    verifySubmitBtn.onclick = async () => {
        const finalReading = parseFloat(readingInput.value);
        if (isNaN(finalReading) || finalReading <= 0) {
            alert("Please enter a valid meter reading.");
            return;
        }
        
        verifySubmitBtn.disabled = true;
        verifySubmitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading to Cloud...';
        
        const locObj = (db.isCloudMode() && state.cachedLocations) ? 
            state.cachedLocations.find(l => l.id === state.selectedLocationId) : 
            db.getLocations().find(l => l.id === state.selectedLocationId);
            
        const meterObj = (db.isCloudMode() && state.cachedMeters) ? 
            state.cachedMeters.find(m => m.id === state.selectedMeterId) : 
            db.getEnergyMeters().find(m => m.id === state.selectedMeterId);
        
        const locName = locObj ? (locObj.name || locObj.meter_name) : 'Location';
        const meterName = meterObj ? (meterObj.meter_name || meterObj.name) : 'Meter';
        
        const now = new Date();
        const newReading = {
            technicianName: state.currentUser.name,
            locationId: state.selectedLocationId,
            meterId: state.selectedMeterId,
            location: locName,
            energyMeter: meterName,
            meterReading: finalReading,
            photo: state.capturedPhoto,
            date: now.toISOString().split('T')[0],
            time: now.toTimeString().split(' ')[0],
            status: 'Pending Supervisor Approval',
            remarks: ''
        };
        
        try {
            await db.saveMeterReading(newReading);
            alert("Reading & Meter Photo Submitted Successfully to Supabase Cloud!");
        } catch (err) {
            console.error("Error submitting reading:", err);
            alert("Reading Submitted Locally.");
        }
        
        initTechnicianDashboard();
    };
}


// ==========================================
// SUPERVISOR MODULE
// ==========================================
let supervisorActiveFilter = 'Pending'; // 'Pending', 'Approved', 'Rejected', 'All'
let supervisorActiveReportTab = 'dashboard';

function initSupervisorDashboard() {
    setupSupervisorNavigation();
    loadSupervisorDashboardView();
}

function setupSupervisorNavigation() {
    const navItems = document.querySelectorAll('#supervisorDashboard .sidebar-item');
    navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const targetView = item.dataset.view;
            supervisorActiveReportTab = targetView;
            
            if (targetView === 'dashboard') {
                document.getElementById('superMainDashboardView').classList.remove('d-none');
                document.getElementById('superReportsView').classList.add('d-none');
                loadSupervisorDashboardView();
            } else {
                document.getElementById('superMainDashboardView').classList.add('d-none');
                document.getElementById('superReportsView').classList.remove('d-none');
                loadSupervisorReportView(targetView);
            }
        };
    });
}

async function loadSupervisorDashboardView() {
    const listBody = document.getElementById('superReadingsList');
    listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--primary);"><i class="fas fa-spinner fa-spin"></i> Syncing cloud readings...</td></tr>';
    
    let readings = [];
    if (db.isCloudMode()) {
        try {
            readings = await db.supabase.getMeterReadings();
        } catch (err) {
            console.error("Error fetching cloud readings:", err);
            readings = db.getMeterReadings();
        }
    } else {
        readings = db.getMeterReadings();
    }
    
    state.cachedReadings = readings;
    
    const pendingCount = readings.filter(r => r.status === 'Pending Supervisor Approval').length;
    const approvedCount = readings.filter(r => r.status === 'Approved').length;
    const rejectedCount = readings.filter(r => r.status === 'Rejected').length;
    
    document.getElementById('superPendingCount').textContent = pendingCount;
    document.getElementById('superApprovedCount').textContent = approvedCount;
    document.getElementById('superRejectedCount').textContent = rejectedCount;
    
    // Setup filter badge click listeners
    const badges = document.querySelectorAll('.summary-card.clickable');
    badges.forEach(b => {
        b.onclick = () => {
            const filter = b.dataset.filter;
            supervisorActiveFilter = filter;
            renderFilteredSupervisorReadings();
        };
    });
    
    renderFilteredSupervisorReadings();
}
    
    renderFilteredSupervisorReadings();
}

function renderFilteredSupervisorReadings() {
    const listBody = document.getElementById('superReadingsList');
    listBody.innerHTML = '';
    
    let readings = db.getMeterReadings();
    
    if (supervisorActiveFilter === 'Pending') {
        readings = readings.filter(r => r.status === 'Pending Supervisor Approval');
    } else if (supervisorActiveFilter === 'Approved') {
        readings = readings.filter(r => r.status === 'Approved');
    } else if (supervisorActiveFilter === 'Rejected') {
        readings = readings.filter(r => r.status === 'Rejected');
    }
    
    if (readings.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:var(--text-muted); padding:2rem;">No readings found for status: ${supervisorActiveFilter}</td></tr>`;
        return;
    }
    
    readings.forEach(r => {
        const tr = document.createElement('tr');
        
        let statusBadge = '';
        if (r.status === 'Pending Supervisor Approval') {
            statusBadge = '<span class="badge badge-pending">Pending</span>';
        } else if (r.status === 'Approved') {
            statusBadge = '<span class="badge badge-approved">Approved</span>';
        } else {
            statusBadge = '<span class="badge badge-rejected">Rejected</span>';
        }
        
        tr.innerHTML = `
            <td>
                <div><strong>${r.technicianName}</strong></div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${r.date} ${r.time}</div>
            </td>
            <td>${r.location}</td>
            <td>${r.energyMeter}</td>
            <td>
                <div style="width:60px; height:40px; border-radius:6px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer;" class="img-preview-cell">
                    <img src="${db.getImageData(r.photo)}" style="width:100%; height:100%; object-fit:cover;" />
                </div>
            </td>
            <td><strong>${r.meterReading} kWh</strong></td>
            <td>${statusBadge}</td>
            <td class="text-right">
                <button class="btn btn-secondary btn-icon action-review-btn" title="Review Reading"><i class="fas fa-clipboard-check"></i> Review</button>
            </td>
        `;
        
        // Add image zoom click handler
        tr.querySelector('.img-preview-cell').onclick = () => {
            showImageZoomModal(r.photo, `${r.location} - ${r.energyMeter}`);
        };
        
        // Add review click handler
        tr.querySelector('.action-review-btn').onclick = () => {
            showReviewModal(r);
        };
        
        listBody.appendChild(tr);
    });
}

function showImageZoomModal(photoData, title) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 650px;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body text-center">
                <img src="${db.getImageData(photoData)}" style="max-width:100%; max-height:450px; border-radius:8px; border:1px solid var(--border-color); object-fit:contain;" />
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close').onclick = () => modal.remove();
}

function showReviewModal(reading) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Review Meter Reading</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div style="display:flex; gap:1.5rem; margin-bottom:1.5rem;">
                    <div style="flex:1;">
                        <div style="margin-bottom:0.75rem;"><span style="color:var(--text-secondary); font-size:0.8rem;">Technician:</span> <div><strong>${reading.technicianName}</strong></div></div>
                        <div style="margin-bottom:0.75rem;"><span style="color:var(--text-secondary); font-size:0.8rem;">Location:</span> <div>${reading.location}</div></div>
                        <div style="margin-bottom:0.75rem;"><span style="color:var(--text-secondary); font-size:0.8rem;">Energy Meter:</span> <div>${reading.energyMeter}</div></div>
                        <div style="margin-bottom:0.75rem;"><span style="color:var(--text-secondary); font-size:0.8rem;">Date & Time:</span> <div>${reading.date} ${reading.time}</div></div>
                    </div>
                    <div style="width:200px; text-align:center;">
                        <span style="color:var(--text-secondary); font-size:0.8rem; display:block; margin-bottom:0.25rem;">Meter Photo:</span>
                        <div style="width:100%; height:130px; border-radius:8px; overflow:hidden; border:1px solid var(--border-color); cursor:zoom-in;" id="modalZoomImg">
                            <img src="${db.getImageData(reading.photo)}" style="width:100%; height:100%; object-fit:cover;" />
                        </div>
                        <span style="font-size:0.7rem; color:var(--text-muted); margin-top:0.25rem; display:block;">Click to zoom</span>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>Verify / Edit Reading (kWh)</label>
                    <input type="number" id="reviewReadingInput" class="form-control" value="${reading.meterReading}" step="0.1" />
                </div>
                
                <div class="form-group">
                    <label>Remarks</label>
                    <textarea id="reviewRemarks" class="form-control" rows="3" placeholder="Add remarks or reasons for approval/rejection...">${reading.remarks || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
                <span style="color:var(--text-secondary);">Current Status: <strong>${reading.status}</strong></span>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-secondary" id="reviewCancel">Cancel</button>
                    <button class="btn btn-danger" id="reviewReject"><i class="fas fa-times"></i> Reject</button>
                    <button class="btn btn-success" id="reviewApprove"><i class="fas fa-check"></i> Approve & Save</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Zoom image in review modal
    modal.querySelector('#modalZoomImg').onclick = () => {
        showImageZoomModal(reading.photo, `${reading.location} - ${reading.energyMeter}`);
    };
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('#reviewCancel').onclick = () => modal.remove();
    
    const inputReading = modal.querySelector('#reviewReadingInput');
    const inputRemarks = modal.querySelector('#reviewRemarks');
    
    // Approve Action
    modal.querySelector('#reviewApprove').onclick = () => {
        const val = parseFloat(inputReading.value);
        if (isNaN(val) || val <= 0) {
            alert("Please enter a valid reading.");
            return;
        }
        db.updateMeterReading(reading.id, {
            meterReading: val,
            remarks: inputRemarks.value.trim(),
            status: 'Approved'
        });
        modal.remove();
        loadSupervisorDashboardView();
    };
    
    // Reject Action
    modal.querySelector('#reviewReject').onclick = () => {
        db.updateMeterReading(reading.id, {
            remarks: inputRemarks.value.trim(),
            status: 'Rejected'
        });
        modal.remove();
        loadSupervisorDashboardView();
// Supervisor Dashboard Reports Controller
async function loadSupervisorReportView(reportKey) {
    const reportTitle = document.getElementById('superReportTitle');
    const reportContainer = document.getElementById('superReportContainer');
    
    reportContainer.innerHTML = '<div class="text-center" style="padding:3rem; color:var(--primary);"><i class="fas fa-spinner fa-spin"></i> Loading report data...</div>';
    
    let readings = [];
    if (db.isCloudMode()) {
        try {
            readings = await db.supabase.getMeterReadings();
        } catch (err) {
            console.error("Error loading cloud report readings:", err);
            readings = db.getMeterReadings();
        }
    } else {
        readings = db.getMeterReadings();
    }
    
    const approvedReadings = readings.filter(r => r.status === 'Approved');
    const pendingReadings = readings.filter(r => r.status === 'Pending Supervisor Approval');
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Helper to filter dates in a week range
    const getWeekBoundaries = (weeksOffset) => {
        const current = new Date();
        const day = current.getDay();
        const diff = current.getDate() - day + (day === 0 ? -6 : 1) - (weeksOffset * 7); // Monday of week
        const monday = new Date(current.setDate(diff));
        monday.setHours(0,0,0,0);
        
        const sunday = new Date(monday);
        sunday.setDate(sunday.getDate() + 6);
        sunday.setHours(23,59,59,999);
        
        return { start: monday, end: sunday };
    };

    let title = '';
    let html = '';
    
    switch(reportKey) {
        case 'today':
            title = "Today's Readings";
            const todayList = readings.filter(r => r.date === todayStr);
            html = buildReadingsTableHtml(todayList);
            break;
            
        case 'yesterday':
            title = "Yesterday Comparison";
            const yestList = approvedReadings.filter(r => r.date === yesterdayStr);
            const todApproved = approvedReadings.filter(r => r.date === todayStr);
            
            const yestTotal = yestList.reduce((acc, r) => acc + (parseFloat(r.meterReading) || 0), 0);
            const todTotal = todApproved.reduce((acc, r) => acc + (parseFloat(r.meterReading) || 0), 0);
            const diffPercent = yestTotal > 0 ? (((todTotal - yestTotal) / yestTotal) * 100).toFixed(1) : 0;
            
            html = `
                <div class="summary-grid" style="margin-bottom:2rem;">
                    <div class="summary-card blue">
                        <div class="summary-info">
                            <h4>Yesterday Approved Sum</h4>
                            <div class="value">${yestTotal.toLocaleString()} kWh</div>
                        </div>
                        <div class="summary-icon"><i class="fas fa-history"></i></div>
                    </div>
                    <div class="summary-card emerald">
                        <div class="summary-info">
                            <h4>Today Approved Sum</h4>
                            <div class="value">${todTotal.toLocaleString()} kWh</div>
                        </div>
                        <div class="summary-icon"><i class="fas fa-calendar-day"></i></div>
                    </div>
                    <div class="summary-card ${diffPercent >= 0 ? 'rose' : 'emerald'}">
                        <div class="summary-info">
                            <h4>Consumption Change</h4>
                            <div class="value">${diffPercent >= 0 ? '+' : ''}${diffPercent}%</div>
                        </div>
                        <div class="summary-icon"><i class="fas ${diffPercent >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                    </div>
                </div>
                <h3>Yesterday's Record List</h3>
                ${buildReadingsTableHtml(yestList)}
            `;
            break;
            
        case 'currweek':
            title = "Current Week Readings";
            const currWeek = getWeekBoundaries(0);
            const currWeekList = readings.filter(r => {
                const d = new Date(r.date);
                return d >= currWeek.start && d <= currWeek.end;
            });
            html = buildReadingsTableHtml(currWeekList);
            break;
            
        case 'prevweek':
            title = "Previous Week Readings";
            const prevWeek = getWeekBoundaries(1);
            const prevWeekList = readings.filter(r => {
                const d = new Date(r.date);
                return d >= prevWeek.start && d <= prevWeek.end;
            });
            html = buildReadingsTableHtml(prevWeekList);
            break;
            
        case 'weekcompare':
            title = "Weekly Comparison Report";
            const wCurr = getWeekBoundaries(0);
            const wPrev = getWeekBoundaries(1);
            
            const currWeekApproved = approvedReadings.filter(r => {
                const d = new Date(r.date);
                return d >= wCurr.start && d <= wCurr.end;
            });
            const prevWeekApproved = approvedReadings.filter(r => {
                const d = new Date(r.date);
                return d >= wPrev.start && d <= wPrev.end;
            });
            
            const currWTotal = currWeekApproved.reduce((acc, r) => acc + (parseFloat(r.meterReading) || 0), 0);
            const prevWTotal = prevWeekApproved.reduce((acc, r) => acc + (parseFloat(r.meterReading) || 0), 0);
            const wDiff = prevWTotal > 0 ? (((currWTotal - prevWTotal) / prevWTotal) * 100).toFixed(1) : 0;
            
            html = `
                <div class="summary-grid" style="margin-bottom:2rem;">
                    <div class="summary-card blue">
                        <div class="summary-info">
                            <h4>Previous Week Approved</h4>
                            <div class="value">${prevWTotal.toLocaleString()} kWh</div>
                        </div>
                        <div class="summary-icon"><i class="fas fa-calendar-alt"></i></div>
                    </div>
                    <div class="summary-card emerald">
                        <div class="summary-info">
                            <h4>Current Week Approved</h4>
                            <div class="value">${currWTotal.toLocaleString()} kWh</div>
                        </div>
                        <div class="summary-icon"><i class="fas fa-calendar-check"></i></div>
                    </div>
                    <div class="summary-card ${wDiff >= 0 ? 'rose' : 'emerald'}">
                        <div class="summary-info">
                            <h4>Week-on-Week Change</h4>
                            <div class="value">${wDiff >= 0 ? '+' : ''}${wDiff}%</div>
                        </div>
                        <div class="summary-icon"><i class="fas ${wDiff >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
                    </div>
                </div>
            `;
            break;
            
        case 'pending':
            title = "Pending Readings";
            html = buildReadingsTableHtml(pendingReadings);
            break;
            
        case 'approved':
            title = "Approved Readings";
            html = buildReadingsTableHtml(approvedReadings);
            break;
            
        case 'techwise':
            title = "Technician-wise Reports";
            const techMap = {};
            readings.forEach(r => {
                if(!techMap[r.technicianName]) techMap[r.technicianName] = { total: 0, count: 0, pending: 0 };
                techMap[r.technicianName].count++;
                techMap[r.technicianName].total += (parseFloat(r.meterReading) || 0);
                if(r.status === 'Pending Supervisor Approval') techMap[r.technicianName].pending++;
            });
            
            let techRows = '';
            Object.keys(techMap).forEach(name => {
                const data = techMap[name];
                techRows += `
                    <tr>
                        <td><strong>${name}</strong></td>
                        <td>${data.count}</td>
                        <td>${data.pending}</td>
                        <td><strong>${data.total.toLocaleString()} kWh</strong></td>
                    </tr>
                `;
            });
            
            html = `
                <div class="table-card">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Technician Name</th>
                                    <th>Total Submissions</th>
                                    <th>Pending Review</th>
                                    <th>Total Logged Reading</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${techRows || '<tr><td colspan="4" class="text-center">No technician records found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;
            
        case 'locwise':
            title = "Location-wise Reports";
            const locMap = {};
            readings.forEach(r => {
                if(!locMap[r.location]) locMap[r.location] = { total: 0, count: 0 };
                locMap[r.location].count++;
                locMap[r.location].total += (parseFloat(r.meterReading) || 0);
            });
            
            let locRows = '';
            Object.keys(locMap).forEach(loc => {
                const data = locMap[loc];
                locRows += `
                    <tr>
                        <td><strong>${loc}</strong></td>
                        <td>${data.count}</td>
                        <td><strong>${data.total.toLocaleString()} kWh</strong></td>
                    </tr>
                `;
            });
            
            html = `
                <div class="table-card">
                    <div class="table-responsive">
                        <table>
                            <thead>
                                <tr>
                                    <th>Location Name</th>
                                    <th>No. of Readings</th>
                                    <th>Total Consumed / Logged</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${locRows || '<tr><td colspan="3" class="text-center">No location records found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            break;
    }
    
    reportTitle.textContent = title;
    reportContainer.innerHTML = html;
}

function buildReadingsTableHtml(list) {
    if (list.length === 0) {
        return `<div class="table-card" style="padding:2rem; text-align:center; color:var(--text-secondary);">No records to display.</div>`;
    }
    
    let rows = '';
    list.forEach(r => {
        let badge = '';
        if (r.status === 'Pending Supervisor Approval') badge = '<span class="badge badge-pending">Pending</span>';
        else if (r.status === 'Approved') badge = '<span class="badge badge-approved">Approved</span>';
        else badge = '<span class="badge badge-rejected">Rejected</span>';
        
        rows += `
            <tr>
                <td><strong>${r.technicianName}</strong></td>
                <td>${r.location}</td>
                <td>${r.energyMeter}</td>
                <td><strong>${r.meterReading} kWh</strong></td>
                <td>${r.date} ${r.time}</td>
                <td>${badge}</td>
            </tr>
        `;
    });
    
    return `
        <div class="table-card">
            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Technician</th>
                            <th>Location</th>
                            <th>Energy Meter</th>
                            <th>Reading</th>
                            <th>Date / Time</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


// ==========================================
// MANAGER MODULE
// ==========================================
let managerActiveTab = 'submissions'; // 'submissions', 'users', 'reports', 'charts'

function initManagerDashboard() {
    setupManagerNavigation();
    loadManagerSubmissions();
}

function setupManagerNavigation() {
    const navItems = document.querySelectorAll('#managerDashboard .sidebar-item');
    navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            const targetView = item.dataset.view;
            managerActiveTab = targetView;
            
            // Hide all sub-views
            document.getElementById('managerSubmissionsView').classList.add('d-none');
            document.getElementById('managerUsersView').classList.add('d-none');
            document.getElementById('managerMetersView').classList.add('d-none');
            document.getElementById('managerReportsView').classList.add('d-none');
            document.getElementById('managerChartsView').classList.add('d-none');
            
            if (targetView === 'submissions') {
                document.getElementById('managerSubmissionsView').classList.remove('d-none');
                loadManagerSubmissions();
            } else if (targetView === 'users') {
                document.getElementById('managerUsersView').classList.remove('d-none');
                loadManagerUsers();
            } else if (targetView === 'meters') {
                document.getElementById('managerMetersView').classList.remove('d-none');
                loadManagerMeters();
            } else if (targetView === 'reports') {
                document.getElementById('managerReportsView').classList.remove('d-none');
                loadManagerReports();
            } else if (targetView === 'charts') {
                document.getElementById('managerChartsView').classList.remove('d-none');
                loadManagerCharts();
            }
        };
    });
}

// 1. MANAGER SUBMISSIONS VIEW
async function loadManagerSubmissions() {
    const listBody = document.getElementById('managerReadingsList');
    listBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--primary);"><i class="fas fa-spinner fa-spin"></i> Syncing cloud submissions...</td></tr>';
    
    let readings = [];
    if (db.isCloudMode()) {
        try {
            readings = await db.supabase.getMeterReadings();
        } catch (err) {
            console.error("Error loading cloud manager submissions:", err);
            readings = db.getMeterReadings();
        }
    } else {
        readings = db.getMeterReadings();
    }
    
    listBody.innerHTML = '';
    
    if (readings.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center">No technician submissions yet.</td></tr>`;
        return;
    }
    
    readings.forEach(r => {
        const tr = document.createElement('tr');
        
        let statusBadge = '';
        if (r.status === 'Pending Supervisor Approval') statusBadge = '<span class="badge badge-pending">Pending</span>';
        else if (r.status === 'Approved') statusBadge = '<span class="badge badge-approved">Approved</span>';
        else statusBadge = '<span class="badge badge-rejected">Rejected</span>';
        
        tr.innerHTML = `
            <td>
                <div><strong>${r.technicianName}</strong></div>
                <div style="font-size:0.8rem; color:var(--text-secondary);">${r.date} ${r.time}</div>
            </td>
            <td>${r.location}</td>
            <td>${r.energyMeter}</td>
            <td>
                <div style="width:60px; height:40px; border-radius:6px; overflow:hidden; border:1px solid var(--border-color); cursor:pointer;" class="img-preview-cell">
                    <img src="${db.getImageData(r.photo)}" style="width:100%; height:100%; object-fit:cover;" />
                </div>
            </td>
            <td><strong>${r.meterReading} kWh</strong></td>
            <td>${statusBadge}</td>
            <td><span style="font-size:0.85rem; color:var(--text-secondary);">${r.remarks || '-'}</span></td>
        `;
        
        tr.querySelector('.img-preview-cell').onclick = () => {
            showImageZoomModal(r.photo, `${r.location} - ${r.energyMeter}`);
        };
        
        listBody.appendChild(tr);
    });
}

// 2. MANAGER USERS (TECHNICIAN CRUD) VIEW
async function loadManagerUsers() {
    const listBody = document.getElementById('managerUsersList');
    listBody.innerHTML = '';
    
    let users = db.getUsers().filter(u => u.role === 'technician');
    let cloudProfiles = [];
    let locations = [];
    let meters = [];
    if (db.isCloudMode()) {
        try {
            cloudProfiles = await db.supabase.getProfiles();
            locations = await db.supabase.getLocations();
            meters = await db.supabase.getEnergyMeters();
            // Merge cloud profiles with local users list
            users.forEach(u => {
                const matched = cloudProfiles.find(p => p.email === u.username || p.id === u.id);
                if (matched && matched.full_name) {
                    u.name = matched.full_name;
                }
            });
        } catch (err) {
            console.error("Error fetching cloud profiles:", err);
            locations = db.getLocations();
            meters = db.getEnergyMeters();
        }
    } else {
        locations = db.getLocations();
        meters = db.getEnergyMeters();
    }
    
    users.forEach(u => {
        const tr = document.createElement('tr');
        
        // Resolve location and meter names
        const locNames = locations
            .filter(l => u.assignedLocations && u.assignedLocations.includes(l.id))
            .map(l => l.name)
            .join(', ');
            
        const meterNames = meters
            .filter(m => u.assignedMeters && u.assignedMeters.includes(m.id))
            .map(m => m.meter_name || m.name)
            .join(', ');
            
        tr.innerHTML = `
            <td>
                <div><strong>${u.name}</strong></div>
                <span style="font-family:monospace; font-size:0.8rem; color:var(--text-secondary);">@${u.username}</span>
            </td>
            <td><span style="font-family:monospace; font-size:0.9rem;">${u.password}</span></td>
            <td><div style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${locNames}">${locNames || '-'}</div></td>
            <td><div style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${meterNames}">${meterNames || '-'}</div></td>
            <td class="text-right">
                <button class="btn btn-secondary btn-icon action-edit-user" title="Edit Technician" style="margin-right:0.25rem;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-icon action-delete-user" title="Delete Technician"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        
        tr.querySelector('.action-edit-user').onclick = () => {
            showUserEditorModal(u);
        };
        
        tr.querySelector('.action-delete-user').onclick = () => {
            if(confirm(`Are you sure you want to delete Technician: ${u.name}?`)) {
                db.deleteUser(u.username);
                loadManagerUsers();
            }
        };
        
        listBody.appendChild(tr);
    });
    
    // Add user button click handler
    document.getElementById('managerAddTechBtn').onclick = () => {
        showUserEditorModal(null);
    };
}

async function showUserEditorModal(techUser) {
    state.editingUser = techUser;
    
    const isEdit = techUser !== null;
    const modalTitle = isEdit ? 'Edit Technician Details' : 'Add New Technician';
    
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    
    let allLocations = [];
    let allMeters = [];
    if (db.isCloudMode()) {
        try {
            allLocations = await db.supabase.getLocations();
            allMeters = await db.supabase.getEnergyMeters();
        } catch (err) {
            allLocations = db.getLocations();
            allMeters = db.getEnergyMeters();
        }
    } else {
        allLocations = db.getLocations();
        allMeters = db.getEnergyMeters();
    }
    
    // Build locations checkbox HTML
    let locCheckboxes = '';
    allLocations.forEach(loc => {
        const checked = isEdit && techUser.assignedLocations && techUser.assignedLocations.includes(loc.id) ? 'checked' : '';
        locCheckboxes += `
            <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; cursor:pointer;">
                <input type="checkbox" name="assignedLoc" value="${loc.id}" ${checked} />
                <span>${loc.name}</span>
            </label>
        `;
    });
    
    // Build meters checkbox HTML
    let meterCheckboxes = '';
    allMeters.forEach(m => {
        const checked = isEdit && techUser.assignedMeters && techUser.assignedMeters.includes(m.id) ? 'checked' : '';
        const mLocId = m.locationId || m.location_id;
        const locName = allLocations.find(l => l.id === mLocId)?.name || m.locations?.name || 'Unknown';
        const mName = m.meter_name || m.name;
        meterCheckboxes += `
            <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; cursor:pointer;" class="meter-chk-wrapper" data-loc="${mLocId}">
                <input type="checkbox" name="assignedMtr" value="${m.id}" ${checked} />
                <span>${mName} <span style="font-size:0.75rem; color:var(--text-muted);">(${locName})</span></span>
            </label>
        `;
    });

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>${modalTitle}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="techFullName" class="form-control" value="${isEdit ? techUser.name : ''}" required />
                </div>
                
                <div style="display:flex; gap:1rem;">
                    <div class="form-group" style="flex:1;">
                        <label>Username (ID)</label>
                        <input type="text" id="techUsername" class="form-control" value="${isEdit ? techUser.username : ''}" ${isEdit ? 'disabled' : ''} required />
                    </div>
                    <div class="form-group" style="flex:1;">
                        <label>Password</label>
                        <input type="text" id="techPassword" class="form-control" value="${isEdit ? techUser.password : '123'}" required />
                    </div>
                </div>
                
                <div style="display:flex; gap:1.5rem; margin-top:1rem;">
                    <div style="flex:1;">
                        <label style="font-size:0.85rem; color:var(--text-secondary); font-weight:500; display:block; margin-bottom:0.5rem;">Assign Locations</label>
                        <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border-color); padding:0.75rem; border-radius:10px; background:rgba(0,0,0,0.15);" id="locChecksArea">
                            ${locCheckboxes}
                        </div>
                    </div>
                    
                    <div style="flex:1.2;">
                        <label style="font-size:0.85rem; color:var(--text-secondary); font-weight:500; display:block; margin-bottom:0.5rem;">Assign Energy Meters</label>
                        <div style="max-height:180px; overflow-y:auto; border:1px solid var(--border-color); padding:0.75rem; border-radius:10px; background:rgba(0,0,0,0.15);" id="meterChecksArea">
                            ${meterCheckboxes}
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="editorCancel">Cancel</button>
                <button class="btn btn-primary" id="editorSave">Save Changes</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('#editorCancel').onclick = () => modal.remove();
    
    // Dynamic filtration: show/hide assigned meters checkbox based on checked locations
    const updateMeterCheckboxVisibility = () => {
        const checkedLocs = Array.from(modal.querySelectorAll('input[name="assignedLoc"]:checked')).map(chk => chk.value);
        const meterWrappers = modal.querySelectorAll('.meter-chk-wrapper');
        
        meterWrappers.forEach(w => {
            const meterLocId = w.dataset.loc;
            if (checkedLocs.includes(meterLocId)) {
                w.style.display = 'flex';
            } else {
                w.style.display = 'none';
                w.querySelector('input').checked = false; // uncheck if location hidden
            }
        });
    };
    
    // Bind location checked changes
    modal.querySelectorAll('input[name="assignedLoc"]').forEach(chk => {
        chk.onchange = updateMeterCheckboxVisibility;
    });
    
    // Trigger initially
    updateMeterVisibilityOnEdit(modal);
    
    modal.querySelector('#editorSave').onclick = async () => {
        const fullName = modal.querySelector('#techFullName').value.trim();
        const username = modal.querySelector('#techUsername').value.trim();
        const password = modal.querySelector('#techPassword').value.trim();
        
        if(!fullName || !username || !password) {
            alert("All fields are required.");
            return;
        }
        
        const checkedLocs = Array.from(modal.querySelectorAll('input[name="assignedLoc"]:checked')).map(chk => chk.value);
        const checkedMtrs = Array.from(modal.querySelectorAll('input[name="assignedMtr"]:checked')).map(chk => chk.value);
        
        const payload = {
            id: isEdit ? techUser.id : null,
            username: username,
            password: password,
            name: fullName,
            full_name: fullName,
            role: 'technician',
            assignedLocations: checkedLocs,
            assignedMeters: checkedMtrs
        };
        
        const saveBtn = modal.querySelector('#editorSave');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        try {
            await db.saveUser(payload);
        } catch (err) {
            console.error("Error saving user:", err);
        }
        
        modal.remove();
        loadManagerUsers();
    };
}

function updateMeterVisibilityOnEdit(modal) {
    // Show/hide based on loaded values
    const checkedLocs = Array.from(modal.querySelectorAll('input[name="assignedLoc"]:checked')).map(chk => chk.value);
    const meterWrappers = modal.querySelectorAll('.meter-chk-wrapper');
    meterWrappers.forEach(w => {
        const meterLocId = w.dataset.loc;
        if (checkedLocs.includes(meterLocId) || checkedLocs.length === 0) {
            w.style.display = 'flex';
        } else {
            w.style.display = 'none';
        }
    });
}

// 3. MANAGER REPORTS & LOGS VIEW (WITH EXPORTS)
let managerFilteredReadings = [];

async function loadManagerReports() {
    // Fill up filters dynamically
    const filterLoc = document.getElementById('mgrFilterLocation');
    const filterTech = document.getElementById('mgrFilterTech');
    
    filterLoc.innerHTML = '<option value="">All Locations</option>';
    
    let locations = [];
    let users = [];
    if (db.isCloudMode()) {
        try {
            locations = await db.supabase.getLocations();
            const profiles = await db.supabase.getProfiles();
            users = profiles.filter(p => p.role === 'TECHNICIAN');
        } catch (err) {
            locations = db.getLocations();
            users = db.getUsers().filter(u => u.role === 'technician');
        }
    } else {
        locations = db.getLocations();
        users = db.getUsers().filter(u => u.role === 'technician');
    }
    
    locations.forEach(l => {
        filterLoc.innerHTML += `<option value="${l.name}">${l.name}</option>`;
    });
    
    filterTech.innerHTML = '<option value="">All Technicians</option>';
    users.forEach(t => {
        const tName = t.full_name || t.name;
        filterTech.innerHTML += `<option value="${tName}">${tName}</option>`;
    });
    
    // Bind filters
    document.getElementById('mgrFilterSearchBtn').onclick = applyManagerReportFilters;
    document.getElementById('mgrFilterResetBtn').onclick = () => {
        document.getElementById('mgrFilterDateStart').value = '';
        document.getElementById('mgrFilterDateEnd').value = '';
        document.getElementById('mgrFilterLocation').value = '';
        document.getElementById('mgrFilterTech').value = '';
        document.getElementById('mgrFilterStatus').value = '';
        applyManagerReportFilters();
    };
    
    // Export Bindings
    document.getElementById('mgrExportExcelBtn').onclick = exportReportToCSV;
    document.getElementById('mgrExportPdfBtn').onclick = exportReportToPDF;
    
    await applyManagerReportFilters();
}

async function applyManagerReportFilters() {
    const start = document.getElementById('mgrFilterDateStart').value;
    const end = document.getElementById('mgrFilterDateEnd').value;
    const loc = document.getElementById('mgrFilterLocation').value;
    const tech = document.getElementById('mgrFilterTech').value;
    const status = document.getElementById('mgrFilterStatus').value;
    
    const listBody = document.getElementById('mgrReportsListBody');
    listBody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:2rem;"><i class="fas fa-spinner fa-spin"></i> Filtering report data...</td></tr>';
    
    let list = [];
    if (db.isCloudMode()) {
        try {
            list = await db.supabase.getMeterReadings();
        } catch (err) {
            list = db.getMeterReadings();
        }
    } else {
        list = db.getMeterReadings();
    }
    
    if (start) {
        list = list.filter(r => r.date >= start);
    }
    if (end) {
        list = list.filter(r => r.date <= end);
    }
    if (loc) {
        list = list.filter(r => r.location === loc);
    }
    if (tech) {
        list = list.filter(r => r.technicianName === tech);
    }
    if (status) {
        list = list.filter(r => r.status === status);
    }
    
    managerFilteredReadings = list;
    renderManagerReportTable(list);
}

function renderManagerReportTable(list) {
    const listBody = document.getElementById('mgrReportsListBody');
    listBody.innerHTML = '';
    
    if (list.length === 0) {
        listBody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem; color:var(--text-muted);">No records match the current filters.</td></tr>`;
        return;
    }
    
    list.forEach(r => {
        let badge = '';
        if (r.status === 'Pending Supervisor Approval') badge = '<span class="badge badge-pending">Pending</span>';
        else if (r.status === 'Approved') badge = '<span class="badge badge-approved">Approved</span>';
        else badge = '<span class="badge badge-rejected">Rejected</span>';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${r.technicianName}</strong></td>
            <td>${r.location}</td>
            <td>${r.energyMeter}</td>
            <td><strong>${r.meterReading} kWh</strong></td>
            <td>${r.date} ${r.time}</td>
            <td>${badge}</td>
            <td><span style="font-size:0.85rem; color:var(--text-secondary);">${r.remarks || '-'}</span></td>
        `;
        listBody.appendChild(tr);
    });
}

// Export Report to CSV (Excel)
function exportReportToCSV() {
    if (managerFilteredReadings.length === 0) {
        alert("No data available to export.");
        return;
    }
    
    const headers = ['Technician', 'Location', 'Energy Meter', 'Reading (kWh)', 'Date', 'Time', 'Status', 'Remarks'];
    const rows = managerFilteredReadings.map(r => [
        `"${r.technicianName.replace(/"/g, '""')}"`,
        `"${r.location.replace(/"/g, '""')}"`,
        `"${r.energyMeter.replace(/"/g, '""')}"`,
        r.meterReading,
        r.date,
        r.time,
        `"${r.status.replace(/"/g, '""')}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += headers.join(",") + "\n";
    rows.forEach(r => {
        csvContent += r.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `GRS_Energy_Meter_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export Report to PDF via Browser Print dialog
function exportReportToPDF() {
    window.print();
}

// 4. MANAGER CHARTS VIEW
async function loadManagerCharts() {
    let readings = [];
    if (db.isCloudMode()) {
        try {
            readings = await db.supabase.getMeterReadings();
        } catch (err) {
            console.error("Error loading cloud chart readings:", err);
            readings = db.getMeterReadings();
        }
    } else {
        readings = db.getMeterReadings();
    }
    renderDashboardCharts(readings);
}

// 5. MANAGER ENERGY METERS MANAGEMENT VIEW
async function loadManagerMeters() {
    const listBody = document.getElementById('managerMetersList');
    listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--primary);"><i class="fas fa-spinner fa-spin"></i> Loading cloud energy meters...</td></tr>';
    
    let meters = [];
    let locations = [];
    
    if (db.isCloudMode()) {
        try {
            meters = await db.supabase.getEnergyMeters();
            locations = await db.supabase.getLocations();
        } catch (err) {
            console.error("Error fetching cloud meters:", err);
            meters = db.getEnergyMeters();
            locations = db.getLocations();
        }
    } else {
        meters = db.getEnergyMeters();
        locations = db.getLocations();
    }
    
    listBody.innerHTML = '';
    
    if (meters.length === 0) {
        listBody.innerHTML = `<tr><td colspan="4" class="text-center">No energy meters found.</td></tr>`;
    } else {
        meters.forEach(m => {
            const locId = m.locationId || m.location_id;
            const meterName = m.meter_name || m.name;
            const locName = locations.find(l => l.id === locId)?.name || m.locations?.name || 'Unassigned';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span style="font-family:monospace; font-weight:600;">${m.id}</span></td>
                <td><strong>${meterName}</strong></td>
                <td><span class="badge badge-pending" style="color:var(--primary); background:rgba(56, 189, 248, 0.1); border-color:rgba(56, 189, 248, 0.2);">${locName}</span></td>
                <td class="text-right">
                    <button class="btn btn-secondary btn-icon action-edit-meter" title="Edit Meter" style="margin-right:0.25rem;"><i class="fas fa-edit"></i> Edit</button>
                    <button class="btn btn-danger btn-icon action-delete-meter" title="Delete Meter"><i class="fas fa-trash-alt"></i> Delete</button>
                </td>
            `;
            
            tr.querySelector('.action-edit-meter').onclick = () => {
                showMeterEditorModal(m);
            };
            
            tr.querySelector('.action-delete-meter').onclick = async () => {
                const mName = m.meter_name || m.name;
                if (confirm(`Are you sure you want to delete Energy Meter: "${mName}"?`)) {
                    await db.deleteEnergyMeter(m.id);
                    loadManagerMeters();
                }
            };
            
            listBody.appendChild(tr);
        });
    }
    
    document.getElementById('managerAddMeterBtn').onclick = () => {
        showMeterEditorModal(null);
    };
}

async function showMeterEditorModal(meter) {
    const isEdit = meter !== null;
    const modalTitle = isEdit ? 'Edit Energy Meter' : 'Add New Energy Meter';
    
    let locations = [];
    if (db.isCloudMode()) {
        try {
            locations = await db.supabase.getLocations();
        } catch (err) {
            locations = db.getLocations();
        }
    } else {
        locations = db.getLocations();
    }
    
    let locOptions = '';
    const currentLocId = isEdit ? (meter.locationId || meter.location_id) : '';
    locations.forEach(loc => {
        const selected = isEdit && currentLocId === loc.id ? 'selected' : '';
        locOptions += `<option value="${loc.id}" ${selected}>${loc.name}</option>`;
    });

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop show';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>${modalTitle}</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Energy Meter Name</label>
                    <input type="text" id="meterNameInput" class="form-control" value="${isEdit ? (meter.meter_name || meter.name) : ''}" placeholder="e.g. Solar Inverter Submeter" required />
                </div>
                <div class="form-group">
                    <label>Assign to Location</label>
                    <select id="meterLocationSelect" class="form-control" required>
                        <option value="">-- Select Location --</option>
                        ${locOptions}
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="meterCancelBtn">Cancel</button>
                <button class="btn btn-primary" id="meterSaveBtn">Save Meter</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('#meterCancelBtn').onclick = () => modal.remove();
    
    modal.querySelector('#meterSaveBtn').onclick = async () => {
        const meterName = modal.querySelector('#meterNameInput').value.trim();
        const locationId = modal.querySelector('#meterLocationSelect').value;
        
        if (!meterName) {
            alert("Please enter a valid meter name.");
            return;
        }
        if (!locationId) {
            alert("Please select a location for the energy meter.");
            return;
        }
        
        const saveBtn = modal.querySelector('#meterSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        
        const payload = {
            id: isEdit ? meter.id : 'MTR_' + Date.now(),
            name: meterName,
            meter_name: meterName,
            locationId: locationId,
            location_id: locationId
        };
        
        try {
            await db.saveEnergyMeter(payload);
        } catch (err) {
            console.error("Error saving energy meter:", err);
        }
        
        modal.remove();
        loadManagerMeters();
    };
}
