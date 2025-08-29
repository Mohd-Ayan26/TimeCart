import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

// Firebase configuration
import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check authentication state
onAuthStateChanged(auth, (user) => {
    const appContainer = document.getElementById('app-container');
    const loadingSpinner = document.getElementById('loadingSpinner');

    if (user) {
        // User is signed in
        if (window.location.pathname.includes('login.html')) {
            window.location.href = 'home.html';
            return;
        }
        
        // Show app content and hide spinner
        if (appContainer) appContainer.style.display = 'block';
        if (loadingSpinner) loadingSpinner.style.display = 'none';

        // Pre-fill email if available
        const emailInput = document.getElementById('email');
        if (emailInput && user.email) {
            emailInput.value = user.email;
        }
    } else {
        // No user is signed in
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }
    }
});

// Logout functionality
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});