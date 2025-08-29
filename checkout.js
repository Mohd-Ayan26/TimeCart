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

// Global variables
let currentUser = null;
let cartData = [];
let savedAddresses = [];
let selectedAddress = null;
let selectedPaymentMethod = null;
let currentStep = 1;

// UI Elements
const steps = document.querySelectorAll('.step');
const checkoutSteps = document.querySelectorAll('.checkout-step');
const savedAddressesContainer = document.getElementById('savedAddresses');
const addNewAddressBtn = document.getElementById('addNewAddressBtn');
const newAddressForm = document.getElementById('newAddressForm');
const continueToPaymentBtn = document.getElementById('continueToPayment');
const backToAddressBtn = document.getElementById('backToAddress');
const continueToReviewBtn = document.getElementById('continueToReview');
const backToPaymentBtn = document.getElementById('backToPayment');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const successModal = document.getElementById('successModal');
const orderIdDisplay = document.getElementById('orderIdDisplay');
const cartCount = document.querySelector('.cart-count');

// All Indian States
const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount || 0);
}

// Show loading
function showLoading() {
    loadingOverlay.classList.add('show');
}

// Hide loading
function hideLoading() {
    loadingOverlay.classList.remove('show');
}

// Update step progress
function updateStepProgress(stepNumber) {
    currentStep = stepNumber;
    
    steps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < stepNumber) {
            step.classList.add('completed');
        } else if (stepNum === stepNumber) {
            step.classList.add('active');
        }
    });
    
    checkoutSteps.forEach((step, index) => {
        step.classList.remove('active');
        if (index + 1 === stepNumber) {
            step.classList.add('active');
        }
    });
}

// Populate state dropdown
function populateStateDropdown() {
    const stateSelect = document.getElementById('state');
    if (stateSelect) {
        stateSelect.innerHTML = '<option value="">Select State</option>' +
            indianStates.map(state => `<option value="${state}">${state}</option>`).join('');
    }
}

// Load cart data from localStorage or database
async function loadCartData() {
    try {
        // First try to get from localStorage (from cart page)
        const checkoutData = localStorage.getItem('checkoutData');
        if (checkoutData) {
            const orderData = JSON.parse(checkoutData);
            cartData = orderData.items;
            
            // Load saved addresses
            await loadSavedAddresses();
            
            displayOrderSummary();
            return;
        }

        // If no checkout data, load from database
        if (!currentUser) return;

        const cartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid),
            orderBy('addedAt', 'desc')
        );

        const cartSnapshot = await getDocs(cartQuery);
        cartData = cartSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (cartData.length === 0) {
            // Redirect to cart if empty
            window.location.href = 'cart.html';
            return;
        }

        await loadSavedAddresses();
        displayOrderSummary();
    } catch (error) {
        console.error('Error loading cart data:', error);
        window.location.href = 'cart.html';
    }
}

// Display order summary
function displayOrderSummary() {
    const orderItemsContainer = document.getElementById('orderItems');
    const subtotalElement = document.getElementById('subtotal');
    const taxElement = document.getElementById('tax');
    const totalElement = document.getElementById('total');

    if (!orderItemsContainer) return;

    // Display items
    orderItemsContainer.innerHTML = cartData.map(item => `
        <div class="order-item">
            <div class="item-image">
                <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60x60?text=No+Image'">
            </div>
            <div class="item-details">
                <h4>${item.name}</h4>
                <p>${item.brand} × ${item.quantity}</p>
            </div>
            <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
        </div>
    `).join('');

    // Calculate totals
    const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;

    // Update totals
    if (subtotalElement) subtotalElement.textContent = formatCurrency(subtotal);
    if (taxElement) taxElement.textContent = formatCurrency(tax);
    if (totalElement) totalElement.textContent = formatCurrency(total);
}

// Load saved addresses
async function loadSavedAddresses() {
    if (!currentUser) return;

    try {
        const addressQuery = query(
            collection(db, 'addresses'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const addressSnapshot = await getDocs(addressQuery);
        savedAddresses = addressSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        displaySavedAddresses();
    } catch (error) {
        console.error('Error loading saved addresses:', error);
        savedAddresses = [];
        displaySavedAddresses();
    }
}

// Display saved addresses
function displaySavedAddresses() {
    if (!savedAddressesContainer) return;

    if (savedAddresses.length === 0) {
        savedAddressesContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666; background: #f9f9f9; border-radius: 8px; margin-bottom: 1rem;">
                <i class="fas fa-map-marker-alt" style="font-size: 2rem; margin-bottom: 1rem; color: #ccc;"></i>
                <p>No saved addresses found</p>
                <p style="font-size: 0.9rem;">Add a new address below to get started</p>
            </div>
        `;
        return;
    }

    savedAddressesContainer.innerHTML = savedAddresses.map((address, index) => `
        <div class="address-card ${index === 0 ? 'selected' : ''}" data-address-id="${address.id}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <h4 style="margin: 0; color: #333;">
                    <i class="fas fa-${address.addressType === 'home' ? 'home' : address.addressType === 'office' ? 'building' : 'map-marker-alt'}" style="margin-right: 0.5rem; color: #4CAF50;"></i>
                    ${address.fullName} (${address.addressType.charAt(0).toUpperCase() + address.addressType.slice(1)})
                </h4>
                <span style="background: #4CAF50; color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.7rem;">
                    ${address.addressType.toUpperCase()}
                </span>
            </div>
            <p style="margin: 0.3rem 0; color: #555;">
                <i class="fas fa-map-marker-alt" style="margin-right: 0.5rem; color: #666;"></i>
                ${address.address}
            </p>
            ${address.address2 ? `<p style="margin: 0.3rem 0; color: #555; margin-left: 1.2rem;">${address.address2}</p>` : ''}
            <p style="margin: 0.3rem 0; color: #555; margin-left: 1.2rem;">
                ${address.city}, ${address.state} - ${address.pincode}
            </p>
            <p style="margin: 0.3rem 0; color: #555;">
                <i class="fas fa-phone" style="margin-right: 0.5rem; color: #666;"></i>
                ${address.phone}
            </p>
            <div style="margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid #eee; font-size: 0.8rem; color: #888;">
                <i class="fas fa-clock" style="margin-right: 0.3rem;"></i>
                Added ${new Date(address.createdAt).toLocaleDateString()}
            </div>
        </div>
    `).join('');

    // Set first address as selected by default
    if (savedAddresses.length > 0) {
        selectedAddress = savedAddresses[0];
    }

    // Add click handlers for address selection
    document.querySelectorAll('.address-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            const addressId = card.dataset.addressId;
            selectedAddress = savedAddresses.find(addr => addr.id === addressId);
        });
    });
}

// Toggle new address form
addNewAddressBtn?.addEventListener('click', () => {
    const isVisible = newAddressForm.style.display !== 'none';
    newAddressForm.style.display = isVisible ? 'none' : 'block';
    addNewAddressBtn.innerHTML = isVisible ? 
        '<i class="fas fa-plus"></i> Add New Address' : 
        '<i class="fas fa-minus"></i> Cancel';
    
    // Clear form when hiding
    if (isVisible) {
        document.getElementById('productForm')?.reset();
    }
});

// Validate address form
function validateAddressForm() {
    const requiredFields = ['fullName', 'phone', 'address', 'city', 'state', 'pincode'];
    let isValid = true;

    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        const formGroup = field?.parentElement;
        
        if (!field || !field.value.trim()) {
            formGroup?.classList.add('error');
            isValid = false;
        } else {
            formGroup?.classList.remove('error');
        }
    });

    // Validate phone number
    const phone = document.getElementById('phone');
    if (phone && phone.value && !/^[6-9]\d{9}$/.test(phone.value)) {
        phone.parentElement?.classList.add('error');
        isValid = false;
    }

    // Validate pincode
    const pincode = document.getElementById('pincode');
    if (pincode && pincode.value && !/^\d{6}$/.test(pincode.value)) {
        pincode.parentElement?.classList.add('error');
        isValid = false;
    }

    return isValid;
}

// Save new address
async function saveNewAddress() {
    if (!validateAddressForm()) {
        return false;
    }

    try {
        const addressData = {
            userId: currentUser.uid,
            fullName: document.getElementById('fullName').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('address').value.trim(),
            address2: document.getElementById('address2').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value,
            pincode: document.getElementById('pincode').value.trim(),
            addressType: document.getElementById('addressType').value,
            createdAt: new Date().toISOString()
        };

        const docRef = await addDoc(collection(db, 'addresses'), addressData);
        selectedAddress = { id: docRef.id, ...addressData };

        // Hide form and reload addresses
        newAddressForm.style.display = 'none';
        addNewAddressBtn.innerHTML = '<i class="fas fa-plus"></i> Add New Address';
        
        // Clear form
        document.getElementById('fullName').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('address').value = '';
        document.getElementById('address2').value = '';
        document.getElementById('city').value = '';
        document.getElementById('state').value = '';
        document.getElementById('pincode').value = '';
        document.getElementById('addressType').value = 'home';
        
        await loadSavedAddresses();

        return true;
    } catch (error) {
        console.error('Error saving address:', error);
        alert('Error saving address. Please try again.');
        return false;
    }
}

// Continue to payment step
continueToPaymentBtn?.addEventListener('click', async () => {
    // Check if address is selected or new address form is filled
    if (!selectedAddress && newAddressForm.style.display === 'none') {
        alert('Please select an address or add a new one');
        return;
    }

    // If new address form is visible, save it first
    if (newAddressForm.style.display !== 'none') {
        const saved = await saveNewAddress();
        if (!saved) return;
    }

    if (!selectedAddress) {
        alert('Please select an address');
        return;
    }

    updateStepProgress(2);
});

// Payment method selection
document.querySelectorAll('.payment-method').forEach(method => {
    method.addEventListener('click', () => {
        document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
        method.classList.add('selected');
        
        const radio = method.querySelector('input[type="radio"]');
        radio.checked = true;
        selectedPaymentMethod = radio.value;

        // Show/hide card details
        const cardDetails = document.getElementById('cardDetails');
        if (selectedPaymentMethod === 'card') {
            cardDetails.classList.add('show');
        } else {
            cardDetails.classList.remove('show');
        }
    });
});

// Card number formatting
document.getElementById('cardNumber')?.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\s/g, '').replace(/[^0-9]/gi, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    e.target.value = formattedValue;
});

// Expiry date formatting
document.getElementById('expiryDate')?.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }
    e.target.value = value;
});

// CVV validation
document.getElementById('cvv')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '');
});

// Continue to review step
continueToReviewBtn?.addEventListener('click', () => {
    if (!selectedPaymentMethod) {
        alert('Please select a payment method');
        return;
    }

    // Validate card details if card payment is selected
    if (selectedPaymentMethod === 'card') {
        const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
        const cardName = document.getElementById('cardName').value.trim();
        const expiryDate = document.getElementById('expiryDate').value;
        const cvv = document.getElementById('cvv').value;

        if (!cardNumber || cardNumber.length < 13 || !cardName || !expiryDate || !cvv) {
            alert('Please fill in all card details');
            return;
        }
    }

    populateReviewSection();
    updateStepProgress(3);
});

// Populate review section
function populateReviewSection() {
    // Review address
    const reviewAddress = document.getElementById('reviewAddress');
    if (reviewAddress && selectedAddress) {
        reviewAddress.innerHTML = `
            <div class="address-card selected" style="border: 2px solid #4CAF50; background: rgba(76, 175, 80, 0.05);">
                <h4 style="color: #4CAF50; margin-bottom: 0.5rem;">
                    <i class="fas fa-${selectedAddress.addressType === 'home' ? 'home' : selectedAddress.addressType === 'office' ? 'building' : 'map-marker-alt'}" style="margin-right: 0.5rem;"></i>
                    ${selectedAddress.fullName} (${selectedAddress.addressType.charAt(0).toUpperCase() + selectedAddress.addressType.slice(1)})
                </h4>
                <p style="margin: 0.3rem 0;">${selectedAddress.address}</p>
                ${selectedAddress.address2 ? `<p style="margin: 0.3rem 0;">${selectedAddress.address2}</p>` : ''}
                <p style="margin: 0.3rem 0;">${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}</p>
                <p style="margin: 0.3rem 0;">
                    <i class="fas fa-phone" style="margin-right: 0.5rem;"></i>
                    ${selectedAddress.phone}
                </p>
            </div>
        `;
    }

    // Review payment method
    const reviewPayment = document.getElementById('reviewPayment');
    if (reviewPayment && selectedPaymentMethod) {
        const paymentMethods = {
            card: 'Credit/Debit Card',
            upi: 'UPI Payment',
            netbanking: 'Net Banking',
            cod: 'Cash on Delivery'
        };

        let paymentDetails = paymentMethods[selectedPaymentMethod];
        if (selectedPaymentMethod === 'card') {
            const cardNumber = document.getElementById('cardNumber').value;
            const maskedCard = '**** **** **** ' + cardNumber.slice(-4);
            paymentDetails += ` (${maskedCard})`;
        }

        reviewPayment.innerHTML = `
            <div style="padding: 1rem; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #4CAF50;">
                <h4 style="margin: 0 0 0.5rem 0; color: #4CAF50;">
                    <i class="fas fa-${selectedPaymentMethod === 'card' ? 'credit-card' : selectedPaymentMethod === 'upi' ? 'mobile-alt' : selectedPaymentMethod === 'netbanking' ? 'university' : 'money-bill-wave'}" style="margin-right: 0.5rem;"></i>
                    ${paymentDetails}
                </h4>
                <p style="margin: 0; color: #666; font-size: 0.9rem;">
                    ${selectedPaymentMethod === 'cod' ? 'Pay when you receive your order' : 'Secure payment processing'}
                </p>
            </div>
        `;
    }

    // Review items
    const reviewItems = document.getElementById('reviewItems');
    if (reviewItems) {
        reviewItems.innerHTML = cartData.map(item => `
            <div class="order-item" style="padding: 1rem; border: 1px solid #eee; border-radius: 8px; margin-bottom: 1rem;">
                <div class="item-image">
                    <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
                </div>
                <div class="item-details" style="flex: 1;">
                    <h4 style="margin: 0 0 0.3rem 0;">${item.name}</h4>
                    <p style="margin: 0; color: #666;">${item.brand} × ${item.quantity}</p>
                </div>
                <div class="item-price" style="font-weight: bold; color: #4CAF50;">
                    ${formatCurrency(item.price * item.quantity)}
                </div>
            </div>
        `).join('');
    }
}

// Back navigation
backToAddressBtn?.addEventListener('click', () => updateStepProgress(1));
backToPaymentBtn?.addEventListener('click', () => updateStepProgress(2));

// Update stock in database after successful order
async function updateStockQuantities(orderItems) {
    const updatePromises = orderItems.map(async (item) => {
        try {
            const watchDoc = await getDoc(doc(db, 'watches', item.watchId));
            if (watchDoc.exists()) {
                const currentStock = watchDoc.data().stock || 0;
                const newStock = Math.max(0, currentStock - item.quantity);
                
                await updateDoc(doc(db, 'watches', item.watchId), {
                    stock: newStock,
                    updatedAt: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error(`Error updating stock for ${item.name}:`, error);
        }
    });

    await Promise.all(updatePromises);
}

// Place order
placeOrderBtn?.addEventListener('click', async () => {
    if (!selectedAddress || !selectedPaymentMethod) {
        alert('Please complete all steps');
        return;
    }

    showLoading();

    try {
        // Calculate totals
        const subtotal = cartData.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.18;
        const total = subtotal + tax;

        // Create order data
        const orderData = {
            userId: currentUser.uid,
            customerName: selectedAddress.fullName,
            customerEmail: currentUser.email,
            customerPhone: selectedAddress.phone,
            shippingAddress: selectedAddress,
            paymentMethod: selectedPaymentMethod,
            items: cartData.map(item => ({
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
            paymentStatus: selectedPaymentMethod === 'cod' ? 'pending' : 'paid',
            timestamp: new Date().toISOString(),
            type: 'purchase',
            orderNumber: 'ORD-' + Date.now()
        };

        // Save order to database
        const orderRef = await addDoc(collection(db, 'orders'), orderData);

        // Update stock quantities in database
        await updateStockQuantities(orderData.items);

        // Clear cart from database
        const cartQuery = query(
            collection(db, 'cart'),
            where('userId', '==', currentUser.uid)
        );
        const cartSnapshot = await getDocs(cartQuery);
        const deletePromises = cartSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);

        // Clear localStorage
        localStorage.removeItem('checkoutData');
        localStorage.setItem('cartCount', '0');

        // Update cart count
        if (cartCount) cartCount.textContent = '0';

        hideLoading();

        // Show success modal
        orderIdDisplay.textContent = `Order ID: ${orderData.orderNumber}`;
        successModal.classList.add('show');

        // Update step to completion
        updateStepProgress(4);

    } catch (error) {
        console.error('Error placing order:', error);
        hideLoading();
        alert('Error placing order. Please try again.');
    }
});

// Mobile menu toggle
document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
    document.querySelector('.nav-links')?.classList.toggle('active');
});

// Cart button click
document.getElementById('cartBtn')?.addEventListener('click', () => {
    window.location.href = 'cart.html';
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
        populateStateDropdown();
        loadCartData();
        initializeCartCount();
    }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initializeCartCount();
});