import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-analytics.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    updateProfile,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

// Firebase configuration
import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// UI Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const resetPasswordForm = document.getElementById('resetPasswordForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const googleSignInBtn = document.getElementById('googleSignIn');
const forgotPasswordLink = document.getElementById('forgotPassword');
const backToLoginLink = document.getElementById('backToLogin');
const loadingSpinner = document.getElementById('loadingSpinner');

// Get redirect URL from query parameters
const urlParams = new URLSearchParams(window.location.search);
const redirectUrl = urlParams.get('redirect') || 'home.html';

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const forms = document.querySelectorAll('.auth-form');
        forms.forEach(form => form.classList.remove('active'));

        if (targetTab === 'login') {
            loginForm.classList.add('active');
        } else if (targetTab === 'register') {
            registerForm.classList.add('active');
        }
    });
});

// Loading Spinner
function showLoading() {
    loadingSpinner.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner.classList.add('hidden');
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'exclamation-circle'}"></i>
        ${message}
    `;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// Show forgot password form
function showForgotPasswordForm() {
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    document.querySelector('.social-auth').style.display = 'none';
    tabBtns.forEach(btn => btn.classList.remove('active'));
    resetPasswordForm.classList.add('active');
}

// Show login form
function showLoginForm() {
    resetPasswordForm.classList.remove('active');
    loginForm.classList.add('active');
    document.querySelector('.social-auth').style.display = 'block';
    tabBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-tab="login"]').classList.add('active');
}

// Save user data to Firestore
async function saveUserData(userId, userData) {
    try {
        await setDoc(doc(db, "users", userId), {
            ...userData,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Error saving user data:", error);
        throw error;
    }
}

// Login Form Submit
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showToast('Successfully signed in!');
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'An error occurred during login.';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            default:
                errorMessage = error.message;
        }
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

// Register Form Submit
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match!', 'error');
        hideLoading();
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters long!', 'error');
        hideLoading();
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: name });

        await saveUserData(user.uid, {
            name,
            email,
            authProvider: 'email'
        });

        showToast('Account created successfully!', 'success');
        window.location.href = redirectUrl;

    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'An error occurred during registration.';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account with this email already exists.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please choose a stronger password.';
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection and try again.';
                break;
            default:
                errorMessage = error.message;
        }
        showToast(errorMessage, 'error');

        if (error.code === 'auth/email-already-in-use') {
            setTimeout(() => {
                const switchToLogin = confirm('This email is already registered. Switch to the login form?');
                if (switchToLogin) {
                    showLoginForm();
                    document.getElementById('loginEmail').value = email;
                    document.getElementById('loginPassword').focus();
                }
            }, 1000);
        }

    } finally {
        hideLoading();
    }
});

// Reset Password Form Submit
resetPasswordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const email = document.getElementById('resetEmail').value;

    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Password reset email sent!', 'success');

        resetPasswordForm.innerHTML = `
            <div class="reset-success">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: #4CAF50; margin-bottom: 1rem;"></i>
                <h3>Email Sent!</h3>
                <p>We've sent password reset instructions to <strong>${email}</strong></p>
                <button type="button" onclick="showLoginForm()" class="auth-btn" style="margin-top: 1rem;">
                    <i class="fas fa-arrow-left"></i> Back to Login
                </button>
            </div>
        `;
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'An error occurred while sending the reset email.';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            default:
                errorMessage = error.message;
        }
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

// Google Sign In
googleSignInBtn.addEventListener('click', async () => {
    showLoading();
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        await saveUserData(user.uid, {
            name: user.displayName,
            email: user.email,
            authProvider: 'google'
        });

        showToast('Successfully signed in with Google!');
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Google sign in error:', error);
        let errorMessage = 'An error occurred during Google sign in.';
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                errorMessage = 'Sign in was cancelled.';
                break;
            case 'auth/popup-blocked':
                errorMessage = 'Popup was blocked. Please allow popups and try again.';
                break;
            default:
                errorMessage = error.message;
        }
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

// Forgot Password & Back to Login Links
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordForm();
});

backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

// Check Authentication State
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (window.location.pathname.includes('login.html')) {
            window.location.href = redirectUrl;
        }
    }
});

// Make functions globally available
window.showLoginForm = showLoginForm;
window.showForgotPasswordForm = showForgotPasswordForm;
