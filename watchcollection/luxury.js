import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, orderBy, doc, getDoc, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

// Firebase configuration
import firebaseConfig from '../config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Initialize AOS
AOS.init({
    duration: 800,
    once: true
});

// UI Elements
const productsGrid = document.getElementById('productsGrid');
const sortSelect = document.getElementById('sortSelect');
const quickViewModal = document.getElementById('quickViewModal');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const cartCount = document.querySelector('.cart-count');

// Filter elements
const minPriceInput = document.getElementById('minPriceInput');
const maxPriceInput = document.getElementById('maxPriceInput');
const priceRangeMinSlider = document.getElementById('price-min');
const priceRangeMaxSlider = document.getElementById('price-max');
const priceProgress = document.getElementById('price-progress');
const applyFiltersBtn = document.querySelector('.apply-filters');
const brandCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');

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

function initializeMobileMenu() {
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    const navbar = document.querySelector('.navbar');

    if (!mobileMenuBtn || !navLinks) return;

    // Toggle menu state
    mobileMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isExpanded = navLinks.classList.contains('active');
        
        // Toggle menu
        navLinks.classList.toggle('active');
        
        // Update button state
        mobileMenuBtn.setAttribute('aria-expanded', (!isExpanded).toString());
        
        // Update icon
        const icon = mobileMenuBtn.querySelector('i');
        if (icon) {
            icon.classList.remove(isExpanded ? 'fa-times' : 'fa-bars');
            icon.classList.add(isExpanded ? 'fa-bars' : 'fa-times');
        }
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navbar.contains(e.target) && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            mobileMenuBtn.setAttribute('aria-expanded', 'false');
            const icon = mobileMenuBtn.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    });
}

// Current filters state
let currentFilters = {};
let allWatches = [];
let currentUser = null;
let priceRangeMin = 0;
let priceRangeMax = 1000000;

// Format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(price);
}

// Show loading state
function showLoading() {
    if (productsGrid) {
        productsGrid.innerHTML = '<div class="loading" style="text-align: center; padding: 2rem; font-size: 1.2rem;">Loading luxury watches...</div>';
    }
}

// Error message display
function errorMessage() {
    return `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error Loading Products</h3>
            <p>We couldn't load the watch collection. Please try again later.</p>
            <button onclick="location.reload()">Retry</button>
        </div>
    `;
}

// Initialize price range based on available products
async function initializePriceRange() {
    try {
        // Get max price from classic watches
        const watchesQuery = query(
            collection(db, 'watches'),
            where('category', '==', 'luxury')
        );
        const snapshot = await getDocs(watchesQuery);
        
        let minPrice = Infinity;
        snapshot.docs.forEach(doc => {
            const price = doc.data().price || 0;
            minPrice = Math.min(minPrice, price);
        });

        // Round up to nearest thousand
        minPrice = (minPrice / 1000) * 1000;

        // Find maximum price
        let maxPrice = 0;
        snapshot.docs.forEach(doc => {
            const price = doc.data().price || 0;
            maxPrice = Math.max(maxPrice, price);
        });

        // Round up to nearest thousand
        maxPrice = (maxPrice / 1000) * 1000;

        // Update range slider elements
        const priceMinSlider = document.getElementById('price-min');
        const priceMaxSlider = document.getElementById('price-max');
        if (priceMinSlider && priceMaxSlider) {
            priceMinSlider.max = maxPrice;
            priceMaxSlider.max = maxPrice;
            priceMaxSlider.value = maxPrice;
            priceMinSlider.value= minPrice;
        }

        // Update number input elements
        const minPriceInput = document.getElementById('minPriceInput');
        const maxPriceInput = document.getElementById('maxPriceInput');
        if (minPriceInput && maxPriceInput) {
            minPriceInput.max = maxPrice;
            maxPriceInput.max = maxPrice;
            maxPriceInput.value = maxPrice;
            minPriceInput.value = minPrice;
        }

        // Update price display
        updatePriceDisplay(minPrice, maxPrice);
        

        return maxPrice;
    } catch (error) {
        console.error('Error initializing price range:', error);
        return 1000000; // Fallback max price
    }
}

// Update price range display
function updatePriceRange() {
    const minVal = parseInt(priceRangeMinSlider.value);
    const maxVal = parseInt(priceRangeMaxSlider.value);
    
    // Update progress bar
    if (priceProgress) {
        priceProgress.style.left = (minVal / priceRangeMaxSlider.max) * 100 + '%';
        priceProgress.style.right = 100 - (maxVal / priceRangeMaxSlider.max) * 100 + '%';
    }
    
    // Update input fields
    if (minPriceInput) minPriceInput.value = minVal;
    if (maxPriceInput) maxPriceInput.value = maxVal;
    
    updatePriceDisplay();
}

// Update price display text
function updatePriceDisplay(min = priceRangeMin, max = priceRangeMax) {
    const priceDisplay = document.querySelector('.price-display');
    if (priceDisplay) {
        priceDisplay.textContent = `${formatPrice(min)} - ${formatPrice(max)}`;
    }
}

// Load luxury watches with filters and sorting
async function loadLuxuryWatches(filters = {}) {
    try {
        showLoading();
        
        // Start with base query
        let q = query(
            collection(db, 'watches'),
            where('category', '==', 'luxury'),
            where('hidden', '!=', true)
        );
        
        // Apply price filters
        if (filters.minPrice || filters.maxPrice) {
            const priceConstraints = [];
            if (filters.minPrice) priceConstraints.push(where('price', '>=', filters.minPrice));
            if (filters.maxPrice) priceConstraints.push(where('price', '<=', filters.maxPrice));
            q = query(q, ...priceConstraints);
        }
        
        // Apply brand filter (limited to 10 brands for Firestore 'in' query)
        if (filters.brands?.length > 0 && filters.brands.length <= 10) {
            const formattedBrands = filters.brands.map(brand => 
                brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase()
            );
            q = query(q, where('brand', 'in', formattedBrands));
        }
        
        // Apply sorting
        const sortValue = sortSelect?.value || 'featured';
        switch (sortValue) {
            case 'priceAsc':
                q = query(q, orderBy('price', 'asc'));
                break;
            case 'priceDesc':
                q = query(q, orderBy('price', 'desc'));
                break;
            case 'newest':
                q = query(q, orderBy('createdAt', 'desc'));
                break;
            case 'name':
                q = query(q, orderBy('name', 'asc'));
                break;
            default:
                // For featured, we'll sort client-side after fetching
                break;
        }
        
        const snapshot = await getDocs(q);
        
        let watches = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Apply brand filtering client-side if more than 10 brands
        if (filters.brands?.length > 10) {
            watches = watches.filter(watch => 
                filters.brands.includes(watch.brand?.toLowerCase())
            );
        }
        
        // Apply feature filtering client-side
        if (filters.features && filters.features.length > 0) {
            watches = watches.filter(watch => {
                const watchFeatures = watch.features?.map(f => f.toLowerCase()) || [];
                return filters.features.some(feature => 
                    watchFeatures.some(wf => wf.includes(feature.toLowerCase()))
                );
            });
        }
        
        // Sort by featured if that's the selected option
        if (sortValue === 'featured') {
            watches.sort((a, b) => (b.featured || 0) - (a.featured || 0));
        }
        
        allWatches = watches;
        displayWatches(watches);
        
    } catch (error) {
        console.error('Error loading luxury watches:', error);
        if (productsGrid) {
            productsGrid.innerHTML = errorMessage();
        }
    }
}

// Display watches in grid
function displayWatches(watches) {
    if (!productsGrid) return;
    
    if (watches.length === 0) {
        productsGrid.innerHTML = '<p class="no-products" style="text-align: center; padding: 2rem; color: #666;">No luxury watches found matching your criteria.</p>';
        return;
    }

    productsGrid.innerHTML = watches.map(watch => `
        <div class="product-card" data-aos="fade-up">
            <div class="product-image">
                <img src="${watch.image}" alt="${watch.name}" onerror="this.src='https://via.placeholder.com/300x250?text=No+Image'">
                <button class="quick-view-btn" onclick="quickView('${watch.id}')">
                    Quick View
                </button>
            </div>
            <div class="product-info">
                <h3 class="product-name">${watch.name}</h3>
                <p class="product-brand">${watch.brand}</p>
                <div class="product-price">${formatPrice(watch.price)}</div>
                <div class="stock-info" style="color: ${(watch.stock || 0) > 0 ? '#4CAF50' : '#f44336'}; font-size: 0.9rem; margin: 0.5rem 0;">
                    ${(watch.stock || 0) > 0 ? `${watch.stock} in stock` : 'Out of stock'}
                </div>
                <button class="add-to-cart" onclick="addToCart('${watch.id}')" ${(watch.stock || 0) <= 0 ? 'disabled style="background: #ccc; cursor: not-allowed;"' : ''}>
                    <i class="fas fa-shopping-cart"></i> ${(watch.stock || 0) > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
            </div>
        </div>
    `).join('');
}

// Quick view functionality
window.quickView = async (watchId) => {
    try {
        const watch = allWatches.find(w => w.id === watchId);
        if (!watch) {
            console.error('Watch not found');
            return;
        }
        
        const modalContent = quickViewModal?.querySelector('.product-details');
        if (!modalContent) return;
        
        modalContent.innerHTML = `
            <div class="quick-view-grid">
                <div class="quick-view-image">
                    <img src="${watch.image}" alt="${watch.name}">
                </div>
                <div class="quick-view-info">
                    <h2>${watch.name}</h2>
                    <p class="brand" style="color: #666; margin: 0.5rem 0; font-size: 1.1rem;">${watch.brand}</p>
                    <p class="price" style="font-size: 1.8rem; color: #4CAF50; font-weight: bold; margin: 1rem 0;">${formatPrice(watch.price)}</p>
                    <div class="stock-info" style="color: ${(watch.stock || 0) > 0 ? '#4CAF50' : '#f44336'}; margin: 1rem 0; font-weight: 600;">
                        <i class="fas fa-${(watch.stock || 0) > 0 ? 'check-circle' : 'times-circle'}"></i>
                        ${(watch.stock || 0) > 0 ? `${watch.stock} in stock` : 'Out of stock'}
                    </div>
                    <div class="description" style="margin: 1.5rem 0; line-height: 1.6; color: #555;">
                        <h3 style="margin-bottom: 0.5rem; color: #333;">Description</h3>
                        <p>${watch.description || 'No description available.'}</p>
                    </div>
                    <div class="features" style="margin: 1.5rem 0;">
                        <h3 style="margin-bottom: 0.8rem; color: #333;">Features</h3>
                        <ul style="margin-left: 1.2rem; line-height: 1.8;">
                            ${watch.features?.map(feature => `<li style="margin-bottom: 0.4rem; color: #555;"><i class="fas fa-check" style="color: #4CAF50; margin-right: 0.5rem;"></i>${feature}</li>`).join('') || '<li style="color: #999;">No features listed</li>'}
                        </ul>
                    </div>
                    <button class="add-to-cart" onclick="addToCart('${watchId}')" 
                            style="width: 100%; padding: 1.2rem; background: ${(watch.stock || 0) > 0 ? '#4CAF50' : '#ccc'}; 
                                   color: white; border: none; border-radius: 8px; cursor: ${(watch.stock || 0) > 0 ? 'pointer' : 'not-allowed'};
                                   font-size: 1.1rem; font-weight: 600; margin-top: 1rem;"
                            ${(watch.stock || 0) <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-shopping-cart" style="margin-right: 0.5rem;"></i>
                        ${(watch.stock || 0) > 0 ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                </div>
            </div>
        `;
        
        quickViewModal?.classList.add('active');
        
        // Scroll to top of modal content
        setTimeout(() => {
            modalContent.scrollTop = 0;
        }, 100);
        
    } catch (error) {
        console.error('Error loading watch details:', error);
    }
};

// Close modal
document.querySelector('.close-modal')?.addEventListener('click', () => {
    quickViewModal?.classList.remove('active');
});

// Close modal when clicking outside
quickViewModal?.addEventListener('click', (e) => {
    if (e.target === quickViewModal) {
        quickViewModal.classList.remove('active');
    }
});

// Check stock availability and current cart quantity
async function checkStockAndCartQuantity(watchId) {
    try {
        // Get watch stock
        const watchDoc = await getDoc(doc(db, 'watches', watchId));
        if (!watchDoc.exists()) {
            return { available: false, message: 'Product not found' };
        }

        const watchData = watchDoc.data();
        const availableStock = watchData.stock || 0;

        if (availableStock <= 0) {
            return { available: false, message: 'Product is out of stock' };
        }

        // Check current quantity in cart
        const cartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid),
            where('watchId', '==', watchId)
        );
        
        const cartSnapshot = await getDocs(cartQuery);
        const currentCartQuantity = cartSnapshot.empty ? 0 : cartSnapshot.docs[0].data().quantity || 0;

        if (currentCartQuantity >= availableStock) {
            return { 
                available: false, 
                message: `Maximum available quantity (${availableStock}) already in cart`
            };
        }

        if (currentCartQuantity >= 10) {
            return { 
                available: false, 
                message: 'Maximum 10 items per product allowed'
            };
        }

        return { 
            available: true, 
            currentCartQuantity: currentCartQuantity,
            availableStock: availableStock
        };
    } catch (error) {
        console.error('Error checking stock and cart:', error);
        return { available: false, message: 'Error checking availability' };
    }
}

// Get button element for cart operations
function getButtonElement(watchId) {
    const buttons = document.querySelectorAll('.add-to-cart');
    for (const button of buttons) {
        if (button.getAttribute('onclick')?.includes(watchId)) {
            return button;
        }
    }
    return null;
}

// Set button state during cart operations
function setButtonState(button, state) {
    switch (state) {
        case 'loading':
            button.classList.add('adding');
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            button.disabled = true;
            break;
        case 'success':
            button.classList.remove('adding');
            button.classList.add('success');
            button.innerHTML = '<i class="fas fa-check"></i> Added!';
            break;
        case 'error':
            button.classList.remove('adding');
            button.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
            button.disabled = false;
            break;
        default:
            button.classList.remove('adding', 'success');
            button.innerHTML = '<i class="fas fa-shopping-cart"></i> Add to Cart';
            button.disabled = false;
    }
}

// Show login prompt
function showLoginPrompt() {
    alert('Please login to add items to cart');
    // Alternatively, you could show a modal login form here
}

// Add to cart functionality
window.addToCart = async (watchId) => {
    if (!currentUser) {
        showLoginPrompt();
        return;
    }

    const button = getButtonElement(watchId);
    if (!button) return;
    
    setButtonState(button, 'loading');

    try {
        const watch = allWatches.find(w => w.id === watchId);
        if (!watch) {
            console.error('Watch not found');
            return;
        }

        // Check stock and cart quantity
        const stockCheck = await checkStockAndCartQuantity(watchId);
        if (!stockCheck.available) {
            setButtonState(button, 'error');
            alert(stockCheck.message);
            return;
        }

        // Check if item already exists in cart
        const existingCartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid),
            where('watchId', '==', watchId)
        );
        
        const existingCartSnapshot = await getDocs(existingCartQuery);
        
        if (!existingCartSnapshot.empty) {
            // Item already in cart, update quantity
            const existingItem = existingCartSnapshot.docs[0];
            const currentQuantity = existingItem.data().quantity || 1;
            const newQuantity = Math.min(currentQuantity + 1, stockCheck.availableStock, 10);
            
            await updateDoc(doc(db, 'cart', existingItem.id), {
                quantity: newQuantity,
                updatedAt: new Date().toISOString()
            });
        } else {
            // Add new item to cart
            const cartItem = {
                userId: currentUser.uid,
                watchId: watchId,
                name: watch.name,
                price: watch.price,
                image: watch.image,
                brand: watch.brand,
                quantity: 1,
                addedAt: new Date().toISOString()
            };

            await addDoc(collection(db, 'cart'), cartItem);
        }

        // Update cart count
        await updateCartCount();
        
        // Show success state
        setButtonState(button, 'success');
        
        // Reset button after 2 seconds
        setTimeout(() => {
            setButtonState(button, 'default');
        }, 2000);
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        setButtonState(button, 'error');
        alert('Error adding item to cart. Please try again.');
    }
};

// Update cart count (sum of all quantities)
async function updateCartCount() {
    if (!currentUser) return;
    
    try {
        const cartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid)
        );
        const cartSnapshot = await getDocs(cartQuery);
        
        // Calculate total quantity (sum of all item quantities)
        const totalQuantity = cartSnapshot.docs.reduce((total, doc) => {
            return total + (doc.data().quantity || 1);
        }, 0);
        
        if (cartCount) cartCount.textContent = totalQuantity;
        localStorage.setItem('cartCount', totalQuantity);
    } catch (error) {
        console.error('Error updating cart count:', error);
        // Fallback to localStorage
        const savedCartCount = localStorage.getItem('cartCount');
        if (savedCartCount && cartCount) {
            cartCount.textContent = savedCartCount;
        }
    }
}

// Apply filters functionality
async function applyFilters() {
    showLoading();
    
    // Get filter values
    const minPrice = parseInt(minPriceInput?.value) || priceRangeMin;
    const maxPrice = parseInt(maxPriceInput?.value) || priceRangeMax;
    const selectedBrands = Array.from(brandCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value.toLowerCase());
    
    // Validate price range
    if (minPrice > maxPrice) {
        alert('Minimum price cannot be greater than maximum price');
        return;
    }
    
    // Apply filters
    currentFilters = {
        minPrice,
        maxPrice,
        brands: selectedBrands
    };
    
    await loadLuxuryWatches(currentFilters);
}

// Setup mobile UI
function setupMobileUI() {
    // Mobile menu toggle
    initializeMobileMenu();
    
    // Mobile filter toggle functionality
    const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
    const filtersSection = document.querySelector('.filters');
    
    if (mobileFilterToggle && filtersSection) {
        // Initialize mobile filter state
        if (window.innerWidth <= 768) {
            filtersSection.classList.add('mobile-collapsed');
            mobileFilterToggle.setAttribute('aria-expanded', 'false');
        }
        
        // Toggle filter visibility on mobile
        mobileFilterToggle.addEventListener('click', () => {
            const isExpanded = mobileFilterToggle.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                filtersSection.classList.remove('mobile-expanded');
                filtersSection.classList.add('mobile-collapsed');
                mobileFilterToggle.setAttribute('aria-expanded', 'false');
            } else {
                filtersSection.classList.remove('mobile-collapsed');
                filtersSection.classList.add('mobile-expanded');
                mobileFilterToggle.setAttribute('aria-expanded', 'true');
            }
        });
        
        // Handle window resize to manage filter visibility
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                // Desktop view - show filters normally
                filtersSection.classList.remove('mobile-collapsed', 'mobile-expanded');
                mobileFilterToggle.setAttribute('aria-expanded', 'false');
            } else {
                // Mobile view - collapse filters by default
                if (!filtersSection.classList.contains('mobile-expanded')) {
                    filtersSection.classList.add('mobile-collapsed');
                }
            }
        });
    }
}

// Initialize cart count from database
async function initializeCartCount() {
    if (!currentUser) return;
    await updateCartCount();
}

// Initialize page
async function initializePage() {
    await initializePriceRange();
    await loadLuxuryWatches();
    setupMobileUI();
    updatePriceDisplay();
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializeMobileMenu();
    
    // Price range sliders
    if (priceRangeMinSlider && priceRangeMaxSlider) {
        priceRangeMinSlider.addEventListener('input', () => {
            if (parseInt(priceRangeMinSlider.value) > parseInt(priceRangeMaxSlider.value)) {
                priceRangeMinSlider.value = priceRangeMaxSlider.value;
            }
            updatePriceRange();
        });
        
        priceRangeMaxSlider.addEventListener('input', () => {
            if (parseInt(priceRangeMaxSlider.value) < parseInt(priceRangeMinSlider.value)) {
                priceRangeMaxSlider.value = priceRangeMinSlider.value;
            }
            updatePriceRange();
        });
    }
    
    // Price inputs
    minPriceInput?.addEventListener('input', (e) => {
        if (priceRangeMinSlider) {
            const value = Math.max(priceRangeMin, Math.min(priceRangeMax, parseInt(e.target.value) || priceRangeMin));
            priceRangeMinSlider.value = value;
            e.target.value = value;
            updatePriceDisplay();
        }
    });
    
    maxPriceInput?.addEventListener('input', (e) => {
        const value = Math.max(priceRangeMin, Math.min(priceRangeMax, parseInt(e.target.value) || priceRangeMax));
        e.target.value = value;
        updatePriceDisplay();
    });
    
    // Apply filters
    applyFiltersBtn?.addEventListener('click', applyFilters);
    
    // Sort functionality
    sortSelect?.addEventListener('change', () => {
        loadLuxuryWatches(currentFilters);
    });
    
    // Cart button
    document.getElementById('cartBtn')?.addEventListener('click', () => {
        window.location.href = '../cart.html';
    });
    
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = '../login.html';
        });
    });
    
    // Initialize page
    initializePage();
});


// Handle authentication state
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '../login.html';
    } else {
        currentUser = user;
        initializeCartCount();
    }
});

// Handle window resize for responsive adjustments
window.addEventListener('resize', setupMobileUI);
