/**
 * Geofence Management Module
 */
import { db } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { showModal, hideModal, showNotification } from './utils.js';

let geofencesData = [];

/**
 * Default geofence configuration matching Android app defaults
 */
const DEFAULT_GEOFENCE = {
    name: 'Main Campus (Administration / MIS Office)',
    latitude: 9.976222,  // 9°58'34.4"N (temporary)
    longitude: 123.405111, // 123°24'18.4"E (temporary)
    radius: 17.0  // Radius in meters
};

/**
 * Initialize default geofence if collection is empty
 */
async function initializeDefaultGeofence() {
    try {
        const geofencesSnapshot = await getDocs(collection(db, 'geofences'));
        
        // If no geofences exist, create the default one
        if (geofencesSnapshot.empty) {
            console.log('No geofences found. Creating default geofence...');
            await addDoc(collection(db, 'geofences'), DEFAULT_GEOFENCE);
            console.log('Default geofence created successfully');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error initializing default geofence:', error);
        return false;
    }
}

/**
 * Load geofences from Firestore
 */
export async function loadGeofences() {
    try {
        // Initialize default geofence if collection is empty
        await initializeDefaultGeofence();
        
        const geofencesSnapshot = await getDocs(collection(db, 'geofences'));
        console.log('Loading geofences - snapshot size:', geofencesSnapshot.size);
        console.log('Geofences docs:', geofencesSnapshot.docs);
        
        geofencesSnapshot.docs.forEach((doc, index) => {
            console.log(`Geofence doc ${index}:`, {
                id: doc.id,
                data: doc.data()
            });
        });
        
        geofencesData = geofencesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Geofences data array:', geofencesData);
        
        renderGeofences();
    } catch (error) {
        console.error('Error loading geofences:', error);
        console.error('Error details:', error.code, error.message);
        showNotification('Failed to load geofences: ' + error.message, 'error');
    }
}

/**
 * Render geofences table
 */
function renderGeofences() {
    const tbody = document.getElementById('geofencesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (geofencesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No geofences found</td></tr>';
        return;
    }
    
    geofencesData.forEach(geo => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${geo.name || '-'}</td>
            <td>${geo.latitude || '-'}</td>
            <td>${geo.longitude || '-'}</td>
            <td>${geo.radius || '-'}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="window.editGeofence('${geo.id}')">Edit</button>
                <button class="btn btn-danger btn-small" onclick="window.deleteGeofence('${geo.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Make functions available globally for onclick handlers
window.editGeofence = function(geofenceId) {
    const geo = geofencesData.find(g => g.id === geofenceId);
    if (!geo) return;
    
    document.getElementById('geofenceModalTitle').textContent = 'Edit Geofence';
    document.getElementById('geofenceIdEdit').value = geofenceId;
    document.getElementById('geoName').value = geo.name || '';
    document.getElementById('geoLatitude').value = geo.latitude || '';
    document.getElementById('geoLongitude').value = geo.longitude || '';
    document.getElementById('geoRadius').value = geo.radius || '';
    
    showModal('geofenceModal');
};

window.deleteGeofence = async function(geofenceId) {
    if (!confirm('Are you sure you want to delete this geofence?')) {
        return;
    }
    
    try {
        await deleteDoc(doc(db, 'geofences', geofenceId));
        showNotification('Geofence deleted successfully');
        loadGeofences();
    } catch (error) {
        console.error('Error deleting geofence:', error);
        showNotification('Failed to delete geofence', 'error');
    }
};

/**
 * Add geofence button handler
 */
document.getElementById('addGeofenceBtn')?.addEventListener('click', () => {
    document.getElementById('geofenceModalTitle').textContent = 'Add Geofence';
    document.getElementById('geofenceForm').reset();
    document.getElementById('geofenceIdEdit').value = '';
    showModal('geofenceModal');
});

/**
 * Geofence form submission
 */
document.getElementById('geofenceForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const geofenceId = document.getElementById('geofenceIdEdit').value;
    const geofenceData = {
        name: document.getElementById('geoName').value,
        latitude: parseFloat(document.getElementById('geoLatitude').value),
        longitude: parseFloat(document.getElementById('geoLongitude').value),
        radius: parseFloat(document.getElementById('geoRadius').value)
    };
    
    try {
        if (geofenceId) {
            // Update existing
            await updateDoc(doc(db, 'geofences', geofenceId), geofenceData);
            showNotification('Geofence updated successfully');
        } else {
            // Create new
            await addDoc(collection(db, 'geofences'), geofenceData);
            showNotification('Geofence added successfully');
        }
        
        hideModal('geofenceModal');
        loadGeofences();
    } catch (error) {
        console.error('Error saving geofence:', error);
        showNotification('Failed to save geofence: ' + error.message, 'error');
    }
});
