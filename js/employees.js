/**
 * Employee Management Module
 */
import { db, createEmployeeAuthUser } from './firebase-config.js';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { showModal, hideModal, showNotification } from './utils.js';
import { generateFaceEmbedding, preloadFaceEmbeddingModels } from './face-embedding.js';

let employeesData = [];
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
async function loadGeofencesForEmployees() {
    try {
        // Initialize default geofence if collection is empty
        await initializeDefaultGeofence();
        
        const geofencesSnapshot = await getDocs(collection(db, 'geofences'));
        geofencesData = geofencesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading geofences:', error);
    }
}

/**
 * Load employees from Firestore
 */
export async function loadEmployees() {
    try {
        // Load geofences for reference
        await loadGeofencesForEmployees();
        
        // Load employees - collection name is "Employees" (capital E)
        const employeesSnapshot = await getDocs(collection(db, 'Employees'));
        
        console.log('Loading employees - snapshot size:', employeesSnapshot.size);
        console.log('Employees docs:', employeesSnapshot.docs);
        
        employeesSnapshot.docs.forEach((doc, index) => {
            console.log(`Employee doc ${index}:`, {
                id: doc.id,
                data: doc.data()
            });
        });
        
        employeesData = employeesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        console.log('Employees data array:', employeesData);
        
        // Populate department filter
        const departments = [...new Set(employeesData.map(emp => emp.department).filter(Boolean))];
        const deptFilter = document.getElementById('departmentFilter');
        if (deptFilter) {
            deptFilter.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptFilter.appendChild(option);
            });
        }
        
        renderEmployees();
    } catch (error) {
        console.error('Error loading employees:', error);
        console.error('Error details:', error.code, error.message);
        showNotification('Failed to load employees: ' + error.message, 'error');
    }
}

/**
 * Render employees table
 */

function renderEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!tbody) return;
    
    const searchTerm = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    const deptFilter = document.getElementById('departmentFilter')?.value || '';
    const categoryFilter = document.getElementById('categoryFilter')?.value || '';
    
    let filtered = employeesData.filter(emp => {
        const matchesSearch = !searchTerm || 
            emp.employeeId?.toLowerCase().includes(searchTerm) ||
            emp.name?.toLowerCase().includes(searchTerm);
        const matchesDept = !deptFilter || emp.department === deptFilter;
        const matchesCategory = !categoryFilter || 
            (emp.category?.toLowerCase() === categoryFilter.toLowerCase());
        
        return matchesSearch && matchesDept && matchesCategory;
    });
    
    tbody.innerHTML = '';
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No employees found</td></tr>';
        return;
    }
    
    filtered.forEach(emp => {
        // Format mode of instruction for display
        let modeDisplay = emp.modeOfInstruction || '-';
        if (modeDisplay === 'FacetoFace') {
            modeDisplay = 'Face-to-Face';
        } else if (modeDisplay === 'Online') {
            modeDisplay = 'Work from Home';
        }
        
        // Get geofence name
        let geofenceDisplay = '-';
        if (emp.geofenceId) {
            const geofence = geofencesData.find(g => g.id === emp.geofenceId);
            geofenceDisplay = geofence ? geofence.name : '-';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${emp.employeeId || emp.id}</td>
            <td>${emp.name || '-'}</td>
            <td>${emp.role || '-'}</td>
            <td>${emp.category || '-'}</td>
            <td>${emp.department || '-'}</td>
            <td>${modeDisplay}</td>
            <td>${geofenceDisplay}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="window.editEmployee('${emp.id}')">Edit</button>
                <button class="btn btn-danger btn-small" onclick="window.deleteEmployee('${emp.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Populate geofence dropdown
 */
async function populateGeofenceDropdown() {
    await loadGeofencesForEmployees();
    const geofenceSelect = document.getElementById('empGeofence');
    if (!geofenceSelect) return;
    
    // Clear existing options except "None"
    geofenceSelect.innerHTML = '<option value="">None</option>';
    
    geofencesData.forEach(geo => {
        const option = document.createElement('option');
        option.value = geo.id;
        option.textContent = geo.name || geo.id;
        geofenceSelect.appendChild(option);
    });
}

// Make functions available globally for onclick handlers
window.editEmployee = async function(employeeId) {
    const emp = employeesData.find(e => e.id === employeeId);
    if (!emp) return;
    
    // Load geofences and populate dropdown
    await populateGeofenceDropdown();
    
    document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
    document.getElementById('employeeIdEdit').value = employeeId;
    document.getElementById('empEmployeeId').value = emp.employeeId || emp.id;
    document.getElementById('empName').value = emp.name || '';
    document.getElementById('empRole').value = emp.role || 'staff';
    document.getElementById('empCategory').value = emp.category || '';
    document.getElementById('empPosition').value = emp.position || '';
    document.getElementById('empCollege').value = emp.college || '';
    document.getElementById('empDepartment').value = emp.department || '';
    document.getElementById('empAdminFunction').value = emp.administrativeFunction || '';
    document.getElementById('empModeOfInstruction').value = emp.modeOfInstruction || '';
    document.getElementById('empGeofence').value = emp.geofenceId || '';
    document.getElementById('empUsername').value = emp.email || emp.username || '';
    document.getElementById('empUsername').readOnly = false;
    document.getElementById('empPassword').value = '';
    document.getElementById('empPassword').required = false;
    document.getElementById('empPasswordGroup').style.display = 'none';
    document.getElementById('empFacePhoto').value = '';
    
    // Face embedding: show status if any
    const previewDiv = document.getElementById('empFacePhotoPreview');
    const previewImg = document.getElementById('empFacePhotoPreviewImg');
    const currentLabel = document.getElementById('empFacePhotoCurrentLabel');
    if (emp.faceEmbedding && Array.isArray(emp.faceEmbedding) && emp.faceEmbedding.length > 0) {
        previewDiv.style.display = 'block';
        previewImg.style.display = 'none';
        currentLabel.textContent = 'Face registered. Choose a new photo to replace.';
    } else {
        previewDiv.style.display = 'none';
        previewImg.src = '';
        currentLabel.textContent = '';
    }
    
    // Show/hide mode of instruction based on role
    updateModeOfInstructionVisibility();
    
    showModal('employeeModal');
    preloadFaceEmbeddingModels();
};

/**
 * Delete employee (Firestore document only; Firebase Auth user remains until removed in Firebase Console)
 */
window.deleteEmployee = async function(employeeId) {
    if (!confirm('Are you sure you want to delete this employee? Their Firestore record will be removed. The login account (Firebase Authentication) must be removed separately in Firebase Console if needed.')) {
        return;
    }
    try {
        await deleteDoc(doc(db, 'Employees', employeeId));
        showNotification('Employee deleted successfully');
        loadEmployees();
    } catch (error) {
        console.error('Error deleting employee:', error);
        showNotification('Failed to delete employee: ' + (error?.message || error), 'error');
    }
};

/**
 * Add employee button handler
 */
document.getElementById('addEmployeeBtn')?.addEventListener('click', async () => {
    // Load geofences and populate dropdown
    await populateGeofenceDropdown();
    
    document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    document.getElementById('employeeForm').reset();
    document.getElementById('employeeIdEdit').value = '';
    document.getElementById('empUsername').readOnly = false;
    document.getElementById('empUsername').required = true;
    document.getElementById('empPassword').required = true;
    document.getElementById('empPasswordGroup').style.display = 'block';
    document.getElementById('empFacePhotoPreview').style.display = 'none';
    document.getElementById('empFacePhotoPreviewImg').src = '';
    updateModeOfInstructionVisibility();
    showModal('employeeModal');
    preloadFaceEmbeddingModels();
});

/**
 * Employee form submission
 */
document.getElementById('employeeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn?.textContent;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
    }
    
    const employeeId = document.getElementById('employeeIdEdit').value;
    const facePhotoFile = document.getElementById('empFacePhoto').files[0];
    const username = (document.getElementById('empUsername').value || '').trim();
    const password = document.getElementById('empPassword').value;
    
    const employeeData = {
        employeeId: document.getElementById('empEmployeeId').value,
        name: document.getElementById('empName').value,
        role: document.getElementById('empRole').value,
        category: document.getElementById('empCategory').value || null,
        position: document.getElementById('empPosition').value || null,
        college: document.getElementById('empCollege').value || null,
        department: document.getElementById('empDepartment').value,
        administrativeFunction: document.getElementById('empAdminFunction').value || null,
        modeOfInstruction: document.getElementById('empModeOfInstruction').value || null,
        geofenceId: document.getElementById('empGeofence').value || null
    };
    
    if (employeeData.role === 'staff' && !employeeData.category) {
        employeeData.category = null;
    }
    
    if (employeeData.category) {
        if (employeeData.category.toLowerCase() === 'organic') {
            employeeData.category = 'Organic';
        } else if (employeeData.category.toLowerCase() === 'part-time') {
            employeeData.category = 'Part-Time';
        }
    }
    
    try {
        if (employeeId) {
            // Edit: keep existing User UID; allow updating email (saved to Firestore; Firebase Auth login email must be changed in Firebase Console if needed)
            const emp = employeesData.find(e => e.id === employeeId);
            if (emp?.['User UID']) employeeData['User UID'] = emp['User UID'];
            employeeData.email = username || emp?.email || '';
        } else {
            // Add: require username and password, create Firebase Auth user, set User UID
            if (!username || !password) {
                showNotification('Username (email) and Password are required when adding an employee.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText || 'Save'; }
                return;
            }
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters.', 'error');
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText || 'Save'; }
                return;
            }
            if (submitBtn) submitBtn.textContent = 'Creating account...';
            const uid = await createEmployeeAuthUser(username, password);
            employeeData['User UID'] = uid;
            employeeData.email = username;
        }
        
        // Generate and store face embedding if a new photo was selected
        if (facePhotoFile) {
            employeeData.faceEmbedding = await generateFaceEmbedding(facePhotoFile, (msg) => {
                if (submitBtn) submitBtn.textContent = msg;
            });
        } else if (employeeId) {
            const emp = employeesData.find(e => e.id === employeeId);
            if (emp?.faceEmbedding && Array.isArray(emp.faceEmbedding)) {
                employeeData.faceEmbedding = emp.faceEmbedding;
            }
        }
        
        if (employeeId) {
            await updateDoc(doc(db, 'Employees', employeeId), employeeData);
            showNotification('Employee updated successfully');
        } else {
            await setDoc(doc(db, 'Employees', employeeData.employeeId), employeeData);
            showNotification('Employee added successfully');
        }
        
        hideModal('employeeModal');
        loadEmployees();
    } catch (error) {
        console.error('Error saving employee:', error);
        const errMsg = error?.message || String(error);
        showNotification('Failed to save employee: ' + errMsg, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText || 'Save';
        }
    }
});

/**
 * Update mode of instruction visibility based on role
 * Mode of instruction is now available for all employees
 */
document.getElementById('empRole')?.addEventListener('change', updateModeOfInstructionVisibility);

function updateModeOfInstructionVisibility() {
    // Mode of instruction is available for all employees (not just faculty)
    // Always show the field
    const modeGroup = document.getElementById('modeOfInstructionGroup');
    if (modeGroup) {
        modeGroup.style.display = 'block';
    }
}

// Search and filter handlers
document.getElementById('employeeSearch')?.addEventListener('input', renderEmployees);
document.getElementById('departmentFilter')?.addEventListener('change', renderEmployees);
document.getElementById('categoryFilter')?.addEventListener('change', renderEmployees);
