/**
 * Settings Module
 * Handles test mode configuration
 */
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { showNotification } from './utils.js';

/**
 * Load settings
 */
export async function loadSettings() {
    try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'testMode'));
        
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            const enabled = data.enabled || false;
            const mockTime = data.mockTime || null;
            
            document.getElementById('testModeEnabled').checked = enabled;
            
            if (mockTime) {
                const date = new Date(mockTime);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                document.getElementById('mockTime').value = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
            
            updateMockTimeVisibility(enabled);
        } else {
            document.getElementById('testModeEnabled').checked = false;
            updateMockTimeVisibility(false);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        showNotification('Failed to load settings', 'error');
    }
}

/**
 * Update mock time visibility
 */
function updateMockTimeVisibility(enabled) {
    const mockTimeSetting = document.getElementById('mockTimeSetting');
    if (mockTimeSetting) {
        mockTimeSetting.style.display = enabled ? 'block' : 'none';
    }
}

/**
 * Test mode enabled toggle
 */
document.getElementById('testModeEnabled')?.addEventListener('change', (e) => {
    updateMockTimeVisibility(e.target.checked);
});

/**
 * Set mock time
 */
document.getElementById('setMockTimeBtn')?.addEventListener('click', async () => {
    const enabled = document.getElementById('testModeEnabled').checked;
    const mockTimeInput = document.getElementById('mockTime').value;
    
    if (!enabled) {
        showNotification('Please enable test mode first', 'error');
        return;
    }
    
    if (!mockTimeInput) {
        showNotification('Please select a mock time', 'error');
        return;
    }
    
    try {
        const mockTime = new Date(mockTimeInput).getTime();
        
        await setDoc(doc(db, 'settings', 'testMode'), {
            enabled: true,
            mockTime: mockTime
        }, { merge: true });
        
        showNotification('Mock time set successfully');
    } catch (error) {
        console.error('Error setting mock time:', error);
        showNotification('Failed to set mock time: ' + error.message, 'error');
    }
});

/**
 * Save test mode enabled state
 */
document.getElementById('testModeEnabled')?.addEventListener('change', async (e) => {
    const enabled = e.target.checked;
    
    try {
        if (enabled) {
            // If enabling, keep existing mockTime or set to current time
            const settingsDoc = await getDoc(doc(db, 'settings', 'testMode'));
            const existingMockTime = settingsDoc.exists() ? settingsDoc.data().mockTime : null;
            
            await setDoc(doc(db, 'settings', 'testMode'), {
                enabled: true,
                mockTime: existingMockTime || Date.now()
            }, { merge: true });
        } else {
            // If disabling, clear mock time
            await setDoc(doc(db, 'settings', 'testMode'), {
                enabled: false,
                mockTime: null
            }, { merge: true });
        }
        
        showNotification(`Test mode ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
        console.error('Error updating test mode:', error);
        showNotification('Failed to update test mode', 'error');
        // Revert checkbox
        e.target.checked = !enabled;
    }
});
