/**
 * Debug script to check what collections exist
 * Run this in browser console to see all collections
 */
import { db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

export async function debugCollections() {
    console.log('=== DEBUGGING COLLECTIONS ===');
    
    // Try different collection name variations
    const collectionNames = ['Attendance', 'Attendace', 'attendance', 'employees', 'Employees'];
    
    for (const name of collectionNames) {
        try {
            const snapshot = await getDocs(collection(db, name));
            console.log(`Collection "${name}": ${snapshot.size} documents`);
            if (snapshot.size > 0) {
                snapshot.docs.forEach((doc, index) => {
                    console.log(`  Doc ${index}:`, doc.id, doc.data());
                });
            }
        } catch (error) {
            console.log(`Collection "${name}": Error - ${error.message}`);
        }
    }
}

// Make it available globally
window.debugCollections = debugCollections;

