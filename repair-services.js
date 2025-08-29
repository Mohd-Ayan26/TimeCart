// // Mobile Menu Toggle
// const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
// const navLinks = document.querySelector('.nav-links');

// mobileMenuBtn.addEventListener('click', () => {
//     navLinks.classList.toggle('active');
// });

// // Smooth Scroll
// document.querySelectorAll('a[href^="#"]').forEach(anchor => {
//     anchor.addEventListener('click', function (e) {
//         e.preventDefault();
//         const target = document.querySelector(this.getAttribute('href'));
//         if (target) {
//             target.scrollIntoView({
//                 behavior: 'smooth'
//             });
//         }
//     });
// });

// // Navbar Scroll Effect
// window.addEventListener('scroll', () => {
//     const navbar = document.querySelector('.navbar');
//     if (window.scrollY > 50) {
//         navbar.style.background = '#ffffff';
//         navbar.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
//     } else {
//         navbar.style.background = '#ffffff';
//         navbar.style.boxShadow = 'none';
//     }
// });

// Mobile Menu Toggle Functionality
document.addEventListener('DOMContentLoaded', function() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const navbar = document.querySelector('.navbar');

    // Toggle mobile menu
    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.classList.toggle('active');
            
            // Change hamburger icon to X when menu is open
            const icon = mobileMenuBtn.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
                mobileMenuBtn.setAttribute('aria-expanded', 'true');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close mobile menu when clicking on a link
        const navLinksItems = navLinks.querySelectorAll('a');
        navLinksItems.forEach(link => {
            link.addEventListener('click', function() {
                navLinks.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', function(event) {
            const isClickInsideNav = navbar.contains(event.target);
            
            if (!isClickInsideNav && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Close mobile menu on window resize if screen becomes larger
        window.addEventListener('resize', function() {
            if (window.innerWidth > 768 && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                const icon = mobileMenuBtn.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.style.background = 'rgba(255, 255, 255, 0.95)';
                navbar.style.backdropFilter = 'blur(10px)';
            } else {
                navbar.style.background = '#ffffff';
                navbar.style.backdropFilter = 'none';
            }
        }
    });
});

// Service Card Hover Animation
const serviceCards = document.querySelectorAll('.service-card');
serviceCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-10px)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
    });
});

// Service Item Hover Animation
const serviceItems = document.querySelectorAll('.service-item');
serviceItems.forEach(item => {
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'translateY(-10px)';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.transform = 'translateY(0)';
    });
});

// Initialize cart count from localStorage
window.addEventListener('load', () => {
    const cartCountElement = document.querySelector('.cart-count');
    const savedCartCount = localStorage.getItem('cartCount');
    if (savedCartCount) {
        cartCountElement.textContent = savedCartCount;
    }
});

// Hide loading spinner when page is loaded
window.addEventListener('load', () => {
    const loadingSpinner = document.getElementById('loadingSpinner');
    loadingSpinner.style.display = 'none';
});