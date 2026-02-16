/**
 * Authentication Module
 * Handles admin login and authentication state
 * Uses Firebase Authentication directly - any authenticated user can access
 */
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { showDashboard } from './main.js';

function getLoginErrorMessage(error) {
    const code = error?.code || '';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/user-disabled') return 'This account has been disabled.';
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/wrong-password') return 'Incorrect password.';
    if (code === 'auth/invalid-credential') return 'Invalid email or password.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later or reset your password.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
    return error?.message || 'Login failed. Please check your credentials.';
}

// Check authentication state on page load
function initAuth() {
    if (window.location.protocol === 'file:') {
        showLogin();
        const err = document.getElementById('loginError');
        if (err) err.textContent = 'Admin must be served over HTTP/HTTPS (e.g. run a local server). Opening the file directly will not work.';
        return;
    }
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                showDashboard();
            } else {
                showLogin();
            }
        });
    } else {
        showError('Unable to connect. Please refresh the page.');
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

/**
 * Handle login form submission
 */
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = e.target?.querySelector('button[type="submit"]');
    const errorDiv = document.getElementById('loginError');

    const email = (emailInput?.value || '').trim();
    const password = passwordInput?.value || '';

    if (errorDiv) errorDiv.textContent = '';
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error('Login error:', error);
        showError(getLoginErrorMessage(error));
    }
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Login';
    }
});

/**
 * Handle logout
 */
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showLogin();
    } catch (error) {
        console.error('Logout error:', error);
    }
});

/**
 * Show login page
 */
function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

/**
 * Show error message
 */
function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
    } else {
        alert(message);
    }
}

// Export functions for use in other modules
export { showLogin, showError };
