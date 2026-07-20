// GRS Smart Energy Monitoring System - Database Layer
// Manages localStorage tables: Users, Locations, EnergyMeters, MeterReadings

const STORAGE_KEYS = {
    USERS: 'grs_users',
    LOCATIONS: 'grs_locations',
    METERS: 'grs_energy_meters',
    READINGS: 'grs_meter_readings'
};

// Seed Data definition
const DEFAULT_LOCATIONS = [
    { id: 'LOC_1', name: 'Admin Block' },
    { id: 'LOC_2', name: 'Assembly Line 1' },
    { id: 'LOC_3', name: 'Warehouse A' },
    { id: 'LOC_4', name: 'Utility Hub' }
];

const DEFAULT_METERS = [
    { id: 'MTR_101', name: 'Admin Main Incomer', locationId: 'LOC_1' },
    { id: 'MTR_102', name: 'Solar Plant Output', locationId: 'LOC_1' },
    { id: 'MTR_201', name: 'Line 1 Power Panel', locationId: 'LOC_2' },
    { id: 'MTR_202', name: 'Heavy Machinery Submeter', locationId: 'LOC_2' },
    { id: 'MTR_301', name: 'Warehouse HVAC Panel', locationId: 'LOC_3' },
    { id: 'MTR_302', name: 'Loading Bay Meter', locationId: 'LOC_3' },
    { id: 'MTR_401', name: 'HVAC Plant Incomer', locationId: 'LOC_4' },
    { id: 'MTR_402', name: 'Air Compressor Submeter', locationId: 'LOC_4' }
];

const DEFAULT_USERS = [
    { username: 'manager', password: '123', name: 'Sujay Kumar', role: 'manager' },
    { username: 'supervisor', password: '123', name: 'Ramesh Hegde', role: 'supervisor' },
    { 
        username: 'tech_suhas', 
        password: '123', 
        name: 'Suhas Gowda', 
        role: 'technician', 
        assignedLocations: ['LOC_1', 'LOC_4'],
        assignedMeters: ['MTR_101', 'MTR_102', 'MTR_401', 'MTR_402']
    },
    { 
        username: 'tech_veeresh', 
        password: '123', 
        name: 'Veeresh Kumar', 
        role: 'technician', 
        assignedLocations: ['LOC_2', 'LOC_3'],
        assignedMeters: ['MTR_201', 'MTR_202', 'MTR_301', 'MTR_302']
    }
];

// Helper to generate dates relative to today
function getDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() - daysOffset);
    return d.toISOString().split('T')[0];
}

const DEFAULT_READINGS = [
    // Today
    {
        id: 'RD_001',
        technicianName: 'Suhas Gowda',
        location: 'Admin Block',
        energyMeter: 'Admin Main Incomer',
        meterReading: 12450.5,
        photo: 'seeded_image_1',
        date: getDateString(0),
        time: '09:15:30',
        status: 'Pending Supervisor Approval',
        remarks: ''
    },
    {
        id: 'RD_002',
        technicianName: 'Veeresh Kumar',
        location: 'Assembly Line 1',
        energyMeter: 'Line 1 Power Panel',
        meterReading: 85240.2,
        photo: 'seeded_image_2',
        date: getDateString(0),
        time: '10:05:12',
        status: 'Pending Supervisor Approval',
        remarks: ''
    },
    // Yesterday
    {
        id: 'RD_003',
        technicianName: 'Suhas Gowda',
        location: 'Utility Hub',
        energyMeter: 'HVAC Plant Incomer',
        meterReading: 34110.8,
        photo: 'seeded_image_3',
        date: getDateString(1),
        time: '11:22:15',
        status: 'Approved',
        remarks: 'Reading looks correct'
    },
    {
        id: 'RD_004',
        technicianName: 'Veeresh Kumar',
        location: 'Warehouse A',
        energyMeter: 'Warehouse HVAC Panel',
        meterReading: 19820.4,
        photo: 'seeded_image_4',
        date: getDateString(1),
        time: '08:45:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    // Current Week (Previous Days)
    {
        id: 'RD_005',
        technicianName: 'Suhas Gowda',
        location: 'Admin Block',
        energyMeter: 'Solar Plant Output',
        meterReading: 4520.1,
        photo: 'seeded_image_5',
        date: getDateString(2),
        time: '14:30:10',
        status: 'Approved',
        remarks: 'Correct'
    },
    {
        id: 'RD_006',
        technicianName: 'Veeresh Kumar',
        location: 'Assembly Line 1',
        energyMeter: 'Heavy Machinery Submeter',
        meterReading: 62450.7,
        photo: 'seeded_image_6',
        date: getDateString(3),
        time: '16:10:45',
        status: 'Approved',
        remarks: 'Matched machine hours'
    },
    {
        id: 'RD_007',
        technicianName: 'Suhas Gowda',
        location: 'Utility Hub',
        energyMeter: 'Air Compressor Submeter',
        meterReading: 11240.2,
        photo: 'seeded_image_7',
        date: getDateString(4),
        time: '10:00:00',
        status: 'Rejected',
        remarks: 'Image blurry, please re-take'
    },
    // Previous Week (e.g. 7-13 days ago)
    {
        id: 'RD_008',
        technicianName: 'Suhas Gowda',
        location: 'Admin Block',
        energyMeter: 'Admin Main Incomer',
        meterReading: 12210.0,
        photo: 'seeded_image_8',
        date: getDateString(7),
        time: '09:00:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_009',
        technicianName: 'Veeresh Kumar',
        location: 'Assembly Line 1',
        energyMeter: 'Line 1 Power Panel',
        meterReading: 84600.0,
        photo: 'seeded_image_9',
        date: getDateString(8),
        time: '10:00:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_010',
        technicianName: 'Suhas Gowda',
        location: 'Utility Hub',
        energyMeter: 'HVAC Plant Incomer',
        meterReading: 33850.0,
        photo: 'seeded_image_10',
        date: getDateString(9),
        time: '11:00:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_011',
        technicianName: 'Veeresh Kumar',
        location: 'Warehouse A',
        energyMeter: 'Warehouse HVAC Panel',
        meterReading: 19600.0,
        photo: 'seeded_image_11',
        date: getDateString(10),
        time: '08:30:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_012',
        technicianName: 'Suhas Gowda',
        location: 'Admin Block',
        energyMeter: 'Solar Plant Output',
        meterReading: 4400.0,
        photo: 'seeded_image_12',
        date: getDateString(11),
        time: '14:00:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_013',
        technicianName: 'Veeresh Kumar',
        location: 'Assembly Line 1',
        energyMeter: 'Heavy Machinery Submeter',
        meterReading: 61900.0,
        photo: 'seeded_image_13',
        date: getDateString(12),
        time: '16:00:00',
        status: 'Approved',
        remarks: 'Verified'
    },
    {
        id: 'RD_014',
        technicianName: 'Suhas Gowda',
        location: 'Utility Hub',
        energyMeter: 'Air Compressor Submeter',
        meterReading: 11090.0,
        photo: 'seeded_image_14',
        date: getDateString(13),
        time: '10:00:00',
        status: 'Approved',
        remarks: 'Verified'
    }
];

// Seed images (mocked as gradients for visual appeal when viewed)
const SEEDED_IMAGES = {
    'seeded_image_1': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%230f172a"/><stop offset="100%" style="stop-color:%231e293b"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g1)"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2338bdf8" font-family="monospace" font-size="28">12450.5 kWh</text><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="12">METER: Admin Main Incomer</text></svg>',
    'seeded_image_2': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%231e1b4b"/><stop offset="100%" style="stop-color:%23312e81"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g2)"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23818cf8" font-family="monospace" font-size="28">85240.2 kWh</text><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="12">METER: Line 1 Power Panel</text></svg>',
    'seeded_image_3': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2334d399" font-family="monospace" font-size="28">34110.8 kWh</text></svg>',
    'seeded_image_4': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2334d399" font-family="monospace" font-size="28">19820.4 kWh</text></svg>',
    'seeded_image_5': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2334d399" font-family="monospace" font-size="28">04520.1 kWh</text></svg>',
    'seeded_image_6': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%2334d399" font-family="monospace" font-size="28">62450.7 kWh</text></svg>',
    'seeded_image_7': 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%23311212"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23f87171" font-family="monospace" font-size="28">11240.2 kWh</text><text x="50%" y="70%" dominant-baseline="middle" text-anchor="middle" fill="%23991b1b" font-family="sans-serif" font-size="12">BLURRY PHOTO DETECTED</text></svg>'
};

// Initial DB Setup
function initDatabase() {
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.LOCATIONS)) {
        localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(DEFAULT_LOCATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.METERS)) {
        localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(DEFAULT_METERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.READINGS)) {
        localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(DEFAULT_READINGS));
    }
}

// Database helper functions
const db = {
    // USERS Table
    getUsers() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
    },
    saveUser(user) {
        const users = this.getUsers();
        const existingIndex = users.findIndex(u => u.username === user.username);
        if (existingIndex >= 0) {
            users[existingIndex] = { ...users[existingIndex], ...user };
        } else {
            users.push(user);
        }
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return user;
    },
    deleteUser(username) {
        let users = this.getUsers();
        users = users.filter(u => u.username !== username);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        return true;
    },

    // LOCATIONS Table
    getLocations() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOCATIONS) || '[]');
    },
    saveLocation(loc) {
        const locs = this.getLocations();
        locs.push(loc);
        localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locs));
        return loc;
    },

    // ENERGY METERS Table
    getEnergyMeters() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.METERS) || '[]');
    },
    saveEnergyMeter(meter) {
        const meters = this.getEnergyMeters();
        const existingIndex = meters.findIndex(m => m.id === meter.id);
        if (existingIndex >= 0) {
            meters[existingIndex] = { ...meters[existingIndex], ...meter };
        } else {
            meter.id = meter.id || 'MTR_' + Date.now();
            meters.push(meter);
        }
        localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(meters));
        return meter;
    },
    deleteEnergyMeter(id) {
        let meters = this.getEnergyMeters();
        meters = meters.filter(m => m.id !== id);
        localStorage.setItem(STORAGE_KEYS.METERS, JSON.stringify(meters));

        // Unassign deleted meter from any technician
        let users = this.getUsers();
        let updatedUsers = false;
        users.forEach(u => {
            if (u.assignedMeters && u.assignedMeters.includes(id)) {
                u.assignedMeters = u.assignedMeters.filter(mId => mId !== id);
                updatedUsers = true;
            }
        });
        if (updatedUsers) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }
        return true;
    },

    // METER READINGS Table
    getMeterReadings() {
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.READINGS) || '[]');
    },
    saveMeterReading(reading) {
        const readings = this.getMeterReadings();
        reading.id = reading.id || 'RD_' + Date.now();
        readings.unshift(reading); // Add to beginning (newest first)
        localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
        return reading;
    },
    updateMeterReading(id, updatedFields) {
        const readings = this.getMeterReadings();
        const index = readings.findIndex(r => r.id === id);
        if (index >= 0) {
            readings[index] = { ...readings[index], ...updatedFields };
            localStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readings));
            return readings[index];
        }
        return null;
    },

    // Get Image helper
    getImageData(photoId) {
        if (photoId && photoId.startsWith('data:image')) {
            return photoId;
        }
        return SEEDED_IMAGES[photoId] || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="sans-serif" font-size="14">No Image Data</text></svg>';
    }
};

// Initialize database immediately on load
initDatabase();

export default db;
