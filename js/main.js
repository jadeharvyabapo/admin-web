/**
 * Main Application Controller
 * Handles navigation and page routing
 */
import { setupModalClose } from './utils.js';
import { auth } from './firebase-config.js';
import { loadDashboard } from './dashboard.js';
import { loadEmployees } from './employees.js';
import { preloadFaceEmbeddingModels } from './face-embedding.js';
import { loadGeofences } from './geofences.js';
import { loadAttendance } from './attendance.js';
import { loadReports } from './reports.js';
import { loadSettings } from './settings.js';

// Setup modal close handlers
setupModalClose('employeeModal');
setupModalClose('geofenceModal');

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.getAttribute('data-page');
        if (page) {
            navigateToPage(page);
        }
    });
});

// Dashboard quick action buttons
document.getElementById('dashboardAddEmployee')?.addEventListener('click', () => {
    navigateToPage('employees');
    setTimeout(() => document.getElementById('addEmployeeBtn')?.click(), 400);
});
document.getElementById('dashboardAddGeofence')?.addEventListener('click', () => {
    navigateToPage('geofences');
    setTimeout(() => document.getElementById('addGeofenceBtn')?.click(), 400);
});
document.getElementById('dashboardViewAttendance')?.addEventListener('click', () => {
    navigateToPage('attendance');
});

/**
 * Navigate to a specific page
 */
function navigateToPage(pageName) {
    // Hide all content pages
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageName) {
            link.classList.add('active');
        }
    });
    
    // Load page-specific data
    switch(pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'employees':
            loadEmployees();
            preloadFaceEmbeddingModels();
            break;
        case 'geofences':
            loadGeofences();
            break;
        case 'attendance':
            loadAttendance();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

/**
 * Show dashboard
 */
export function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    navigateToPage('dashboard');
}

// Initialize - show dashboard by default if logged in
if (auth.currentUser) {
    navigateToPage('dashboard');
}
