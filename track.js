// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, orderBy } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let allOrders = [];

// Track specific order by order number
async function trackOrder() {
    const orderNumber = document.getElementById('orderNumber').value.trim();
    if (!orderNumber) {
        // alert('Please enter an order number');
        showNotification('Please enter an order number');
        return;
    }

    showLoading();
    try {
        let foundOrder = null;
        let orderType = '';

        // First, try to find in watch-orders collection by orderNumber
        const watchOrdersQuery = query(
            collection(db, 'orders'), 
            where('orderNumber', '==', orderNumber)
        );
        const watchOrdersSnapshot = await getDocs(watchOrdersQuery);

        if (!watchOrdersSnapshot.empty) {
            foundOrder = { id: watchOrdersSnapshot.docs[0].orderNumber, ...watchOrdersSnapshot.docs[0].data() };
            orderType = 'watch';
        } else {
            // If not found in watch-orders, search in orders collection by id
            const repairOrdersQuery = query(
                collection(db, 'orders'), 
                where('id', '==', orderNumber)
            );
            const repairOrdersSnapshot = await getDocs(repairOrdersQuery);

            if (!repairOrdersSnapshot.empty) {
                foundOrder = { id: repairOrdersSnapshot.docs[0].id, ...repairOrdersSnapshot.docs[0].data() };
                orderType = 'repair';
            }
        }

        if (foundOrder) {
            displaySingleOrder(foundOrder, orderType);
            
            // Show success message
            showNotification(`Order ${orderNumber} found!`, 'success');
        } else {
            showNotification('Order not found. Please check your order number and try again.', 'error');
        }
    } catch (error) {
        console.error('Error tracking order:', error);
        showNotification('Error tracking order. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

// Display single order details
function displaySingleOrder(order, orderType) {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = '';

    // Add a header for the search result
    const searchResultHeader = document.createElement('div');
    searchResultHeader.innerHTML = `
        <div style="background: linear-gradient(135deg, #4CAF50, #45a049); color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
            <h3><i class="fas fa-check-circle"></i> Order Found!</h3>
            <p>Here are the details for order: <strong>${order.orderNumber || order.id}</strong></p>
        </div>
    `;
    ordersList.appendChild(searchResultHeader);

    if (orderType === 'watch') {
        ordersList.appendChild(createWatchOrderCard(order));
    } else {
        ordersList.appendChild(createRepairOrderCard(order));
    }

    // Scroll to the order
    ordersList.scrollIntoView({ behavior: 'smooth' });
}

// Load user orders
async function loadUserOrders() {
    if (!currentUser) return;

    showLoading();
    try {
        // Fetch repair orders
        const repairOrdersQuery = query(
            collection(db, 'orders'),
            where('userEmail', '==', currentUser.email),
            orderBy('timestamp', 'desc')
        );
        const repairOrdersSnapshot = await getDocs(repairOrdersQuery);

        // Fetch watch orders
        const watchOrdersQuery = query(
            collection(db, 'orders'),
            where('customerEmail', '==', currentUser.email),
            orderBy('timestamp', 'desc')
        );
        const watchOrdersSnapshot = await getDocs(watchOrdersQuery);

        // Combine and sort orders
        allOrders = [
            ...repairOrdersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                orderType: 'repair'
            })),
            ...watchOrdersSnapshot.docs.map(doc => ({
                id: doc.orderNumber,
                ...doc.data(),
                orderType: 'watch'
            }))
        ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        displayOrders('all');
    } catch (error) {
        console.error('Error loading orders:', error);
        showNotification('Error loading orders. Please refresh the page.', 'error');
    } finally {
        hideLoading();
    }
}

// Display orders based on filter
function displayOrders(filter) {
    const ordersList = document.getElementById('ordersList');
    let filteredOrders = allOrders;

    if (filter === 'pickup') {
        filteredOrders = allOrders.filter(order => order.type === 'pickup');
    } else if (filter === 'store') {
        filteredOrders = allOrders.filter(order => order.type === 'store');
    } else if (filter === 'watch') {
        filteredOrders = allOrders.filter(order => order.orderType === 'watch');
    }

    if (filteredOrders.length === 0) {
        ordersList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 20px; color: #ddd;"></i>
                <h3>No orders found</h3>
                <p>You don't have any orders in this category yet.</p>
            </div>
        `;
        return;
    }

    ordersList.innerHTML = '';
    filteredOrders.forEach(order => {
        if (order.orderType === 'watch') {
            ordersList.appendChild(createWatchOrderCard(order));
        } else {
            ordersList.appendChild(createRepairOrderCard(order));
        }
    });
}

// Create watch order card
function createWatchOrderCard(order) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';

    const statusClass = getStatusClass(order.status);
    const statusText = getStatusText(order.status);

    orderCard.innerHTML = `
        <div class="order-header">
            <div class="order-id">${order.orderNumber}</div>
            <div class="order-type watch-order">
                <i class="fas fa-shopping-bag"></i> Watch Purchase
            </div>
        </div>

        <div class="order-details">
            <div class="detail-group">
                <h4><i class="fas fa-user"></i> Customer Information</h4>
                <p><strong>Name:</strong> ${order.customerName}</p>
                <p><strong>Email:</strong> ${order.customerEmail}</p>
                <p><strong>Phone:</strong> ${order.customerPhone}</p>
            </div>

            <div class="detail-group">
                <h4><i class="fas fa-info-circle"></i> Order Information</h4>
                <p><strong>Order Date:</strong> ${new Date(order.timestamp).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                <p><strong>Payment Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
                <p><strong>Payment Status:</strong> <span class="status-badge ${order.paymentStatus}">${order.paymentStatus.toUpperCase()}</span></p>
                <p><strong>Order Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
            </div>

            <div class="detail-group">
                <h4><i class="fas fa-map-marker-alt"></i> Shipping Address</h4>
                <p><strong>Name:</strong> ${order.shippingAddress.fullName}</p>
                <p><strong>Address:</strong> ${order.shippingAddress.address}</p>
                ${order.shippingAddress.address2 ? `<p><strong>Address 2:</strong> ${order.shippingAddress.address2}</p>` : ''}
                <p><strong>City:</strong> ${order.shippingAddress.city}, ${order.shippingAddress.state}</p>
                <p><strong>Pincode:</strong> ${order.shippingAddress.pincode}</p>
                <p><strong>Phone:</strong> ${order.shippingAddress.phone}</p>
                <p><strong>Address Type:</strong> ${order.shippingAddress.addressType.charAt(0).toUpperCase() + order.shippingAddress.addressType.slice(1)}</p>
            </div>

            <div class="detail-group">
                <h4><i class="fas fa-shopping-cart"></i> Order Summary</h4>
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <img src="${item.image}" alt="${item.name}" class="item-image" onerror="this.src='https://via.placeholder.com/80x80?text=Watch'">
                            <div class="item-details">
                                <h5>${item.name}</h5>
                                <p><strong>Brand:</strong> ${item.brand}</p>
                                <p><strong>Quantity:</strong> ${item.quantity}</p>
                                <p><strong>Price:</strong> ₹${item.price.toLocaleString('en-IN')}</p>
                                <p><strong>Watch ID:</strong> ${item.watchId}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="order-totals">
                    <p><strong>Subtotal:</strong> ₹${order.subtotal.toLocaleString('en-IN')}</p>
                    <p><strong>Tax:</strong> ₹${order.tax.toLocaleString('en-IN')}</p>
                    <p class="total-amount"><strong>Total Amount:</strong> ₹${order.totalAmount.toLocaleString('en-IN')}</p>
                </div>
            </div>
        </div>

        ${createWatchOrderTimeline(order.status)}
    `;

    return orderCard;
}

// Create repair order card
function createRepairOrderCard(order) {
    const orderCard = document.createElement('div');
    orderCard.className = 'order-card';

    const statusClass = getStatusClass(order.status);
    const statusText = getStatusText(order.status);

    orderCard.innerHTML = `
        <div class="order-header">
            <div class="order-id">${order.id}</div>
            <div class="order-type ${order.type === 'pickup' ? 'pickup-order' : 'store-order'}">
                <i class="fas fa-${order.type === 'pickup' ? 'truck' : 'store'}"></i>
                ${order.type === 'pickup' ? 'Repair Pickup' : 'Store Visit'}
            </div>
        </div>

        <div class="order-details">
            <div class="detail-group">
                <h4><i class="fas fa-user"></i> Customer Information</h4>
                <p><strong>Name:</strong> ${order.customerName}</p>
                <p><strong>Phone:</strong> ${order.phone}</p>
                <p><strong>Email:</strong> ${order.email}</p>
                ${order.address ? `<p><strong>Address:</strong> ${order.address}</p>` : ''}
            </div>

            <div class="detail-group">
                <h4><i class="fas fa-tools"></i> Service Details</h4>
                <p><strong>Watch Brand:</strong> ${order.brand}</p>
                <p><strong>Service Type:</strong> ${order.service}</p>
                <p><strong>Issue:</strong> ${order.issue}</p>
                <p><strong>Express Service:</strong> ${order.express ? 'Yes' : 'No'}</p>
                <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusText}</span></p>
            </div>

            <div class="detail-group">
                <h4><i class="fas fa-calendar-alt"></i> Appointment Details</h4>
                <p><strong>Date:</strong> ${order.date}</p>
                ${order.time ? `<p><strong>Time:</strong> ${order.time}</p>` : ''}
                ${order.store ? `<p><strong>Store:</strong> ${order.store}</p>` : ''}
                <p><strong>Order Date:</strong> ${new Date(order.timestamp).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                ${order.price ? `<p class="total-amount"><strong>Total Price:</strong> ₹${order.price.toLocaleString('en-IN')}</p>` : ''}
            </div>
        </div>

        ${createRepairOrderTimeline(order.status)}
    `;

    return orderCard;
}

// Create watch order timeline
function createWatchOrderTimeline(status) {
    const steps = [
        { key: 'pending', icon: 'fas fa-clipboard-check', label: 'Order Placed' },
        { key: 'confirmed', icon: 'fas fa-check-circle', label: 'Confirmed' },
        { key: 'processing', icon: 'fas fa-box', label: 'Processing' },
        { key: 'shipped', icon: 'fas fa-truck', label: 'Shipped' },
        { key: 'delivered', icon: 'fas fa-home', label: 'Delivered' }
    ];

    const currentStepIndex = steps.findIndex(step => step.key === status);

    return `
        <div class="status-timeline">
            ${steps.map((step, index) => `
                <div class="status-step ${index <= currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}">
                    <i class="${step.icon}"></i>
                    <span>${step.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Create repair order timeline
function createRepairOrderTimeline(status) {
    const steps = [
        { key: 'order_place', icon: 'fas fa-clipboard-check', label: 'Order Placed' },
        { key: 'pickup_scheduled', icon: 'fas fa-calendar-check', label: 'Pickup/Visit Scheduled' },
        { key: 'in_service', icon: 'fas fa-tools', label: 'In Service' },
        { key: 'completed', icon: 'fas fa-check-circle', label: 'Completed' },
        { key: 'delivered', icon: 'fas fa-home', label: 'Delivered' }
    ];

    const currentStepIndex = steps.findIndex(step => step.key === status);

    return `
        <div class="status-timeline">
            ${steps.map((step, index) => `
                <div class="status-step ${index <= currentStepIndex ? 'completed' : ''} ${index === currentStepIndex ? 'active' : ''}">
                    <i class="${step.icon}"></i>
                    <span>${step.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Helper functions
function getStatusClass(status) {
    const statusMap = {
        'pending': 'status-pending',
        'confirmed': 'status-confirmed',
        'processing': 'status-processing',
        'shipped': 'status-shipped',
        'delivered': 'status-delivered',
        'order_placed': 'status-pending',
        'pickup_scheduled': 'status-confirmed',
        'in_service': 'status-processing',
        'completed': 'status-completed'
    };
    return statusMap[status] || 'status-pending';
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'processing': 'Processing',
        'shipped': 'Shipped',
        'delivered': 'Delivered',
        'order_placed': 'Order Placed',
        'pickup_scheduled': 'Pickup Scheduled',
        'in_service': 'In Service',
        'completed': 'Completed'
    };
    return statusMap[status] || 'Pending';
}

function showLoading() {
    const ordersList = document.getElementById('ordersList');
    ordersList.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p style="margin-top: 20px; color: #666;">Searching for your order...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading will be hidden when orders are displayed
}

function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: inherit; font-size: 18px; cursor: pointer; margin-left: 10px;">&times;</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Tab switching
function showOrders(filter) {
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    displayOrders(filter);
}

// Authentication state change
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        loadUserOrders();
    } else {
        // Show login message for unauthenticated users
        const ordersList = document.getElementById('ordersList');
        ordersList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-sign-in-alt" style="font-size: 48px; margin-bottom: 20px; color: #ddd;"></i>
                <h3>Please Login</h3>
                <p>You need to login to view your orders.</p>
                <a href="login.html?redirect=${encodeURIComponent(window.location.pathname)}" 
                   style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
                   Login Now
                </a>
            </div>
        `;
    }
});

// Make functions globally available
window.trackOrder = trackOrder;
window.showOrders = showOrders;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set up enter key for search
    document.getElementById('orderNumber').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            trackOrder();
        }
    });
    
    // Add CSS for notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    // document.head.appendChild(style);

    // const menuBtn = document.querySelector('.mobile-menu-btn');
    // const navLinks = document.querySelector('.nav-links');

    // if (menuBtn && navLinks) {
    //     menuBtn.addEventListener('click', function() {
    //         navLinks.classList.toggle('active');
    //     });
    // }
});
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
