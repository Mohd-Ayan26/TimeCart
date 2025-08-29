import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

import firebaseConfig from './config.js';

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    const navbar = document.querySelector('.navbar');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });

        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = mobileMenuBtn.querySelector('i');
            icon.classList.toggle('fa-bars');
            icon.classList.toggle('fa-times');
            mobileMenuBtn.setAttribute('aria-expanded', navLinks.classList.contains('active').toString());
        });
    }

    window.addEventListener('scroll', () => {
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!user.photoURL) {
                await updateProfile(user, {
                    photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`
                });
            }
            updateUserProfile(user);
            updateCartCount(user.uid);
            checkAdminStatus(user.email);
        } else {
            window.location.href = 'login.html';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && profileDropdown) {
            profileDropdown.classList.remove('show');
        }
    });
});

function updateUserProfile(user) {
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const profileImage = document.getElementById('profileImage');
    const dropdownProfileImage = document.getElementById('dropdownProfileImage');

    const imageUrl = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}`;

    if (userName) userName.textContent = user.displayName || 'User';
    if (userEmail) userEmail.textContent = user.email;
    if (profileImage) profileImage.src = imageUrl;
    if (dropdownProfileImage) dropdownProfileImage.src = imageUrl;
}

async function updateCartCount(userId) {
    try {
        const cartQuery = query(collection(db, 'cart'), where('userId', '==', userId));
        const snapshot = await getDocs(cartQuery);
        const count = snapshot.docs.reduce((sum, doc) => sum + (doc.data().quantity || 0), 0);

        const cartCount = document.querySelector('.cart-count');
        if (cartCount) {
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error updating cart count:', error);
    }
}

function checkAdminStatus(email) {
    const adminLink = document.getElementById('adminLink');
    if (adminLink) {
        adminLink.style.display = email === 'your-mail@gmail.com' ? 'inline' : 'none';
    }
}

// This update ensures user profile photo is always set, using ui-avatars if missing, and displays it correctly in profile image placeholders.
