/**
 * Firebase Configuration
 * Using modular SDK v12.7.0
 */
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCeLBvw_85L187mai0RYH46hmwh_C_zIAo",
    authDomain: "attendance-system-c73f0.firebaseapp.com",
    projectId: "attendance-system-c73f0",
    storageBucket: "attendance-system-c73f0.firebasestorage.app",
    messagingSenderId: "151911675034",
    appId: "1:151911675034:web:f53944314b7d7ac11d5b23",
    measurementId: "G-W93TGBDNYE"
};

// Initialize Firebase (analytics omitted so login/auth always work)
const app = initializeApp(firebaseConfig);

// Secondary app used only for creating employee accounts (keeps admin signed in on primary auth)
let secondaryAuth = null;
function getSecondaryAuth() {
    if (!secondaryAuth) {
        try {
            const secondaryApp = initializeApp(firebaseConfig, 'AttendanceSystemSecondary');
            secondaryAuth = getAuth(secondaryApp);
        } catch (e) {
            if (!e.code || e.code !== 'app/duplicate-app') throw e;
            const secondaryApp = getApp('AttendanceSystemSecondary');
            secondaryAuth = getAuth(secondaryApp);
        }
    }
    return secondaryAuth;
}

/**
 * Create a Firebase Auth user (email/password). Uses a secondary auth instance so the admin stays signed in.
 * @returns {Promise<string>} The new user's UID
 */
export async function createEmployeeAuthUser(email, password) {
    const auth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await signOut(auth);
    return uid;
}

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
