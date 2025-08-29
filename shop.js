// Initialize AOS
AOS.init({
    duration: 800,
    once: true
});

// Initialize Swiper
const swiper = new Swiper('.hero-swiper', {
    loop: true,
    autoplay: {
        delay: 5000,
        disableOnInteraction: false,
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    }
});

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');

mobileMenuBtn?.addEventListener('click', () => {
    navLinks.classList.toggle('active');
});

// Cart functionality
let cartCount = 0;
const cartCountElement = document.querySelector('.cart-count');
const addToCartButtons = document.querySelectorAll('.add-to-cart');

addToCartButtons.forEach(button => {
    button.addEventListener('click', () => {
        cartCount++;
        cartCountElement.textContent = cartCount;
        
        // Add animation
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Added to Cart';
        button.style.background = '#45a049';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.background = '';
        }, 2000);

        // Store cart count in localStorage
        localStorage.setItem('cartCount', cartCount);
    });
});

// Initialize cart count from localStorage
window.addEventListener('load', () => {
    const savedCartCount = localStorage.getItem('cartCount');
    if (savedCartCount) {
        cartCount = parseInt(savedCartCount);
        cartCountElement.textContent = cartCount;
    }
});

// Quick View functionality
const quickViewButtons = document.querySelectorAll('.quick-view');
quickViewButtons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        // Implement quick view modal functionality here
        console.log('Quick view clicked');
    });
});

// Category card click handlers
document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
        const category = card.classList[1];
        // Implement category filtering here
        console.log(`Filtering for category: ${category}`);
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Product image hover effect
document.querySelectorAll('.product-card').forEach(card => {
    const image = card.querySelector('img');
    const originalSrc = image.src;
    
    card.addEventListener('mouseenter', () => {
        // You can add alternate image sources for hover effect
        // image.src = alternateImage;
    });
    
    card.addEventListener('mouseleave', () => {
        image.src = originalSrc;
    });
});