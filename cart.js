import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

// Firebase configuration
import firebaseConfig from './config.js';

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
const loadingState = document.getElementById('loadingState');
const emptyCart = document.getElementById('emptyCart');
const cartContent = document.getElementById('cartContent');
const cartItems = document.getElementById('cartItems');
const cartCount = document.querySelector('.cart-count');
const itemCount = document.getElementById('itemCount');
const subtotalElement = document.getElementById('subtotal');
const taxElement = document.getElementById('tax');
const totalElement = document.getElementById('total');
const checkoutBtn = document.getElementById('checkoutBtn');
const clearCartBtn = document.getElementById('clearCartBtn');
const successMessage = document.getElementById('successMessage');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');



// Global variables
let currentUser = null;
let cartData = [];
let pendingAction = null;

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount || 0);
}

// Show success message
function showSuccessMessage(message) {
    const messageElement = successMessage.querySelector('span');
    if (messageElement) {
        messageElement.textContent = message;
    }
    successMessage.classList.add('show');
    setTimeout(() => {
        successMessage.classList.remove('show');
    }, 3000);
}

// Show confirmation modal
function showConfirmModal(message, action) {
    confirmMessage.textContent = message;
    pendingAction = action;
    confirmModal.classList.add('active');
}

// Hide confirmation modal
function hideConfirmModal() {
    confirmModal.classList.remove('active');
    pendingAction = null;
}

// Calculate total quantity (sum of all item quantities)
function calculateTotalQuantity() {
    return cartData.reduce((total, item) => total + (item.quantity || 1), 0);
}

// Calculate unique items count (number of different products)
function calculateUniqueItemsCount() {
    return cartData.length;
}

// Enhanced check if item is still available in stock and visible
async function checkItemAvailability(cartItem) {
    try {
        const watchDoc = await getDoc(doc(db, 'watches', cartItem.watchId));
        if (!watchDoc.exists()) {
            return { available: false, message: 'Product no longer exists', currentStock: 0, outOfStock: true, hidden: false };
        }

        const watchData = watchDoc.data();
        const currentStock = watchData.stock || 0;
        const isHidden = watchData.hidden || false;

        // Check if product is hidden (visibility turned off)
        if (isHidden) {
            return { 
                available: false, 
                message: 'Product is currently unavailable', 
                currentStock: currentStock,
                outOfStock: true,
                hidden: true
            };
        }

        // Check stock availability
        if (currentStock <= 0) {
            return { available: false, message: 'Out of stock', currentStock: 0, outOfStock: true, hidden: false };
        }

        if (cartItem.quantity > currentStock) {
            return { 
                available: true, 
                message: `Only ${currentStock} items available (you have ${cartItem.quantity} in cart)`,
                currentStock: currentStock,
                needsUpdate: true,
                outOfStock: false,
                hidden: false
            };
        }

        return { available: true, currentStock: currentStock, outOfStock: false, hidden: false };
    } catch (error) {
        console.error('Error checking item availability:', error);
        return { available: false, message: 'Error checking availability', currentStock: 0, outOfStock: true, hidden: false };
    }
}

// Load cart items for current user
async function loadCartItems() {
    if (!currentUser) return;

    try {
        loadingState.style.display = 'flex';
        emptyCart.style.display = 'none';
        cartContent.style.display = 'none';

        const q = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid),
            orderBy('addedAt', 'desc')
        );

        const snapshot = await getDocs(q);
        cartData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        loadingState.style.display = 'none';

        if (cartData.length === 0) {
            emptyCart.style.display = 'block';
            updateCartCounts(0, 0);
        } else {
            // Check availability for all items
            await checkCartItemsAvailability();
            cartContent.style.display = 'block';
            displayCartItems();
            updateCartSummary();
            updateCartCounts(calculateTotalQuantity(), calculateUniqueItemsCount());
        }

    } catch (error) {
        console.error('Error loading cart items:', error);
        loadingState.style.display = 'none';
        emptyCart.style.display = 'block';
    }
}

// Enhanced check availability for all cart items with visibility handling
async function checkCartItemsAvailability() {
    const outOfStockItems = [];
    const hiddenItems = [];
    const updatedItems = [];

    for (let i = 0; i < cartData.length; i++) {
        const item = cartData[i];
        const availability = await checkItemAvailability(item);

        if (availability.hidden) {
            // Mark item as out of stock due to being hidden
            cartData[i].outOfStock = true;
            cartData[i].hidden = true;
            cartData[i].originalQuantity = cartData[i].quantity;
            cartData[i].quantity = 0;
            hiddenItems.push(item);
        } else if (availability.outOfStock) {
            // Mark item as out of stock
            cartData[i].outOfStock = true;
            cartData[i].hidden = false;
            cartData[i].originalQuantity = cartData[i].quantity;
            cartData[i].quantity = 0;
            outOfStockItems.push(item);
        } else if (availability.needsUpdate) {
            // Update quantity to available stock
            try {
                await updateDoc(doc(db, 'cart', item.id), {
                    quantity: availability.currentStock,
                    updatedAt: new Date().toISOString()
                });
                cartData[i].quantity = availability.currentStock;
                cartData[i].outOfStock = false;
                cartData[i].hidden = false;
                updatedItems.push({ item: item.name, newQuantity: availability.currentStock });
            } catch (error) {
                console.error('Error updating cart item quantity:', error);
            }
        } else {
            // Item is available, ensure it's not marked as out of stock or hidden
            cartData[i].outOfStock = false;
            cartData[i].hidden = false;
        }
    }

    // Show messages for different scenarios
    if (hiddenItems.length > 0) {
        const itemNames = hiddenItems.map(item => item.name).join(', ');
        showSuccessMessage(`Items currently unavailable: ${itemNames}`);
    }

    if (outOfStockItems.length > 0) {
        const itemNames = outOfStockItems.map(item => item.name).join(', ');
        showSuccessMessage(`Items out of stock: ${itemNames}`);
    }

    // Show quantity update messages
    if (updatedItems.length > 0) {
        const updateMessages = updatedItems.map(item => 
            `${item.item}: quantity updated to ${item.newQuantity}`
        ).join('; ');
        showSuccessMessage(`Stock updated: ${updateMessages}`);
    }
}

// Enhanced display cart items with better status indicators
function displayCartItems() {
    if (!cartItems) return;

    cartItems.innerHTML = cartData.map(item => {
        let statusMessage = '';
        let statusClass = '';
        
        if (item.hidden) {
            statusMessage = 'Currently unavailable';
            statusClass = 'out-of-stock';
        } else if (item.outOfStock) {
            statusMessage = 'Out of stock';
            statusClass = 'out-of-stock';
        }

        return `
            <div class="cart-item ${statusClass}" data-aos="fade-up" style="${statusClass ? 'opacity: 0.6; background: #f9f9f9;' : ''}">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
                    ${statusClass ? `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(220, 53, 69, 0.9); color: white; padding: 0.3rem 0.6rem; border-radius: 4px; font-size: 0.7rem; font-weight: bold;">${statusMessage.toUpperCase()}</div>` : ''}
                </div>
                <div class="item-details">
                    <h3>${item.name}</h3>
                    <p class="item-brand">${item.brand}</p>
                    <p class="item-price">${formatCurrency(item.price)}</p>
                    ${statusClass ? `<p style="color: #dc3545; font-size: 0.9rem; font-weight: 500; margin-top: 0.5rem;"><i class="fas fa-exclamation-triangle"></i> ${statusMessage}</p>` : ''}
                </div>
                <div class="quantity-controls">
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', ${Math.max(0, item.quantity - 1)})" ${item.quantity <= 1 || statusClass ? 'disabled' : ''}>
                        <i class="fas fa-minus"></i>
                    </button>
                    <input type="number" class="quantity-input" value="${statusClass ? 0 : item.quantity}" min="0" max="10" 
                           onchange="updateQuantity('${item.id}', parseInt(this.value))" readonly>
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', ${item.quantity + 1})" ${item.quantity >= 10 || statusClass ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i>
                    </button>
                </div>
                <button class="remove-item" onclick="removeFromCart('${item.id}', '${item.name}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// Update cart summary
function updateCartSummary() {
    // Only include available items in calculation
    const availableItems = cartData.filter(item => !item.outOfStock && !item.hidden);
    const subtotal = availableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    if (subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
    if (taxElement) taxElement.textContent = formatCurrency(tax);
    if (totalElement) totalElement.textContent = formatCurrency(total);

    // Disable checkout if no available items
    if (checkoutBtn) {
        const hasAvailableItems = availableItems.length > 0 && availableItems.some(item => item.quantity > 0);
        checkoutBtn.disabled = !hasAvailableItems;
        if (!hasAvailableItems) {
            checkoutBtn.style.background = '#ccc';
            checkoutBtn.style.cursor = 'not-allowed';
            checkoutBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> No Available Items';
        } else {
            checkoutBtn.style.background = '';
            checkoutBtn.style.cursor = '';
            checkoutBtn.innerHTML = '<i class="fas fa-credit-card"></i> Proceed to Checkout';
        }
    }
}

// Update both cart counts
function updateCartCounts(totalQuantity, uniqueItems) {
    // Update cart count in navbar (total quantity - sum of all quantities of available items)
    const availableQuantity = cartData.filter(item => !item.outOfStock && !item.hidden).reduce((total, item) => total + item.quantity, 0);
    
    if (cartCount) {
        cartCount.textContent = availableQuantity;
    }
    
    // Update item count in cart header (sum of all quantities of available items)
    if (itemCount) {
        itemCount.textContent = availableQuantity;
    }
    
    // Update localStorage for other pages
    localStorage.setItem('cartCount', availableQuantity);
}

// Check stock availability for a watch
async function checkStockAvailability(watchId, requestedQuantity) {
    try {
        const watchDoc = await getDoc(doc(db, 'watches', watchId));
        if (!watchDoc.exists()) {
            return { available: false, message: 'Product not found' };
        }

        const watchData = watchDoc.data();
        const availableStock = watchData.stock || 0;
        const isHidden = watchData.hidden || false;

        if (isHidden) {
            return { available: false, message: 'Product is currently unavailable' };
        }

        if (availableStock < requestedQuantity) {
            return { 
                available: false, 
                message: `Only ${availableStock} items available in stock`,
                availableStock: availableStock
            };
        }

        return { available: true, availableStock: availableStock };
    } catch (error) {
        console.error('Error checking stock:', error);
        return { available: false, message: 'Error checking stock availability' };
    }
}

// Enhanced update quantity with visibility checks
window.updateQuantity = async (cartItemId, newQuantity) => {
    if (newQuantity < 0) return;

    try {
        // Find the cart item
        const cartItem = cartData.find(item => item.id === cartItemId);
        if (!cartItem) {
            showSuccessMessage('Cart item not found');
            return;
        }

        // If quantity is 0, mark as out of stock but don't remove
        if (newQuantity === 0) {
            cartItem.outOfStock = true;
            cartItem.quantity = 0;
            displayCartItems();
            updateCartSummary();
            updateCartCounts(calculateTotalQuantity(), calculateUniqueItemsCount());
            showSuccessMessage('Item marked as unavailable');
            return;
        }

        // Check stock and visibility availability
        const stockCheck = await checkStockAvailability(cartItem.watchId, newQuantity);
        if (!stockCheck.available) {
            showSuccessMessage(stockCheck.message);
            return;
        }

        // Limit to maximum 10 per item
        if (newQuantity > 10) {
            showSuccessMessage('Maximum 10 items allowed per product');
            return;
        }

        await updateDoc(doc(db, 'cart', cartItemId), {
            quantity: newQuantity,
            updatedAt: new Date().toISOString()
        });

        // Update local data
        const itemIndex = cartData.findIndex(item => item.id === cartItemId);
        if (itemIndex !== -1) {
            cartData[itemIndex].quantity = newQuantity;
            cartData[itemIndex].outOfStock = false; // Mark as available again
            cartData[itemIndex].hidden = false; // Mark as visible again
            displayCartItems();
            updateCartSummary();
            updateCartCounts(calculateTotalQuantity(), calculateUniqueItemsCount());
            showSuccessMessage('Quantity updated successfully!');
        }

    } catch (error) {
        console.error('Error updating quantity:', error);
        showSuccessMessage('Error updating quantity. Please try again.');
    }
};

// Remove item from cart
window.removeFromCart = (cartItemId, itemName) => {
    showConfirmModal(
        `Are you sure you want to remove "${itemName}" from your cart?`,
        async () => {
            try {
                await deleteDoc(doc(db, 'cart', cartItemId));
                
                // Update local data
                cartData = cartData.filter(item => item.id !== cartItemId);
                
                if (cartData.length === 0) {
                    cartContent.style.display = 'none';
                    emptyCart.style.display = 'block';
                    updateCartCounts(0, 0);
                } else {
                    displayCartItems();
                    updateCartSummary();
                    updateCartCounts(calculateTotalQuantity(), calculateUniqueItemsCount());
                }
                
                showSuccessMessage('Item removed from cart!');
                
            } catch (error) {
                console.error('Error removing item:', error);
                showSuccessMessage('Error removing item. Please try again.');
            }
        }
    );
};

// Clear entire cart
function clearCart() {
    showConfirmModal(
        'Are you sure you want to clear your entire cart? This action cannot be undone.',
        async () => {
            try {
                // Delete all cart items for current user
                const deletePromises = cartData.map(item => 
                    deleteDoc(doc(db, 'cart', item.id))
                );
                
                await Promise.all(deletePromises);
                
                cartData = [];
                cartContent.style.display = 'none';
                emptyCart.style.display = 'block';
                updateCartCounts(0, 0);
                
                showSuccessMessage('Cart cleared successfully!');
                
            } catch (error) {
                console.error('Error clearing cart:', error);
                showSuccessMessage('Error clearing cart. Please try again.');
            }
        }
    );
}

// Load saved addresses for checkout
async function loadSavedAddresses() {
    if (!currentUser) return [];

    try {
        const addressQuery = query(
            collection(db, 'addresses'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const addressSnapshot = await getDocs(addressQuery);
        return addressSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error loading saved addresses:', error);
        return [];
    }
}

// Enhanced proceed to checkout with better filtering
async function proceedToCheckout() {
    // Filter out out-of-stock and hidden items
    const availableItems = cartData.filter(item => !item.outOfStock && !item.hidden && item.quantity > 0);
    
    if (availableItems.length === 0) {
        showSuccessMessage('No available items in your cart!');
        return;
    }

    // Re-check availability before checkout
    await checkCartItemsAvailability();

    // Filter again after availability check
    const finalAvailableItems = cartData.filter(item => !item.outOfStock && !item.hidden && item.quantity > 0);
    
    if (finalAvailableItems.length === 0) {
        showSuccessMessage('All items in your cart are currently unavailable!');
        cartContent.style.display = 'none';
        emptyCart.style.display = 'block';
        updateCartCounts(0, 0);
        return;
    }

    // Calculate totals for available items only
    const subtotal = finalAvailableItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    // Load saved addresses
    const savedAddresses = await loadSavedAddresses();

    // Create order data with only available items
    const orderData = {
        userId: currentUser.uid,
        customerName: currentUser.displayName || currentUser.email,
        customerEmail: currentUser.email,
        items: finalAvailableItems.map(item => ({
            watchId: item.watchId,
            name: item.name,
            brand: item.brand,
            price: item.price,
            quantity: item.quantity,
            image: item.image
        })),
        subtotal: subtotal,
        tax: tax,
        totalAmount: total,
        status: 'pending',
        timestamp: new Date().toISOString(),
        type: 'purchase',
        savedAddresses: savedAddresses
    };

    // Store order data in localStorage for checkout page
    localStorage.setItem('checkoutData', JSON.stringify(orderData));
    
    // Redirect to checkout page
    window.location.href = 'checkout.html';
}

// Event listeners
clearCartBtn?.addEventListener('click', clearCart);
checkoutBtn?.addEventListener('click', proceedToCheckout);

// Confirmation modal events
confirmOk?.addEventListener('click', () => {
    if (pendingAction) {
        pendingAction();
    }
    hideConfirmModal();
});

confirmCancel?.addEventListener('click', hideConfirmModal);

// Close modal when clicking outside
confirmModal?.addEventListener('click', (e) => {
    if (e.target === confirmModal) {
        hideConfirmModal();
    }
});

// Mobile menu toggle
mobileMenuBtn?.addEventListener('click', () => {
    navLinks?.classList.toggle('active');
});

// Logout functionality
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'login.html';
    });
});

// Initialize cart count from localStorage
function initializeCartCount() {
    const savedCartCount = localStorage.getItem('cartCount');
    if (savedCartCount && cartCount) {
        cartCount.textContent = savedCartCount;
    }
}

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        currentUser = user;
        loadCartItems();
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initializeCartCount();
});