/**
 * Utility Functions
 */
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

/**
 * Format timestamp to readable date/time
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format time only
 */
export function formatTime(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Format date only
 */
export function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Show modal
 */
export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

/**
 * Hide modal
 */
export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Setup modal close handlers
 */
export function setupModalClose(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    const closeButtons = modal.querySelectorAll('.modal-close');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            hideModal(modalId);
        });
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal(modalId);
        }
    });
}

/**
 * Show loading state
 */
export function showLoading(element) {
    if (element) {
        element.textContent = 'Loading...';
        element.disabled = true;
    }
}

/**
 * Hide loading state
 */
export function hideLoading(element) {
    if (element) {
        element.disabled = false;
    }
}

/**
 * Show notification
 */
export function showNotification(message, type = 'info') {
    // Simple alert for now, can be enhanced with toast notifications
    alert(message);
}
