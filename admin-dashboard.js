import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-storage.js";

// Firebase configuration
import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Global chart instances to prevent canvas reuse errors
let salesChart = null;
let categoryChart = null;

// Status workflows for different order types
const WATCH_ORDER_STATUSES = [
    { key: 'pending', icon: 'fas fa-clipboard-check', label: 'Order Placed' },
    { key: 'confirmed', icon: 'fas fa-check-circle', label: 'Confirmed' },
    { key: 'processing', icon: 'fas fa-box', label: 'Processing' },
    { key: 'shipped', icon: 'fas fa-truck', label: 'Shipped' },
    { key: 'delivered', icon: 'fas fa-home', label: 'Delivered' }
];

const SERVICE_ORDER_STATUSES = [
    { key: 'order_placed', icon: 'fas fa-clipboard-check', label: 'Order Placed' },
    { key: 'pickup_scheduled', icon: 'fas fa-calendar-check', label: 'Pickup/Visit Scheduled' },
    { key: 'in_service', icon: 'fas fa-tools', label: 'In Service' },
    { key: 'completed', icon: 'fas fa-check-circle', label: 'Completed' },
    { key: 'delivered', icon: 'fas fa-home', label: 'Delivered' }
];

// UI Elements
const loadingSpinner = document.getElementById('loadingSpinner');
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const productDetailsModal = document.getElementById('productDetailsModal');
const orderDetailsModal = document.getElementById('orderDetailsModal');
const successMessage = document.getElementById('successMessage');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const sidebar = document.querySelector('.sidebar');

// Date filter elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const filterBtn = document.querySelector('.filter-btn');

// Show success message
function showSuccessMessage(message = 'Operation completed successfully!') {
    if (successMessage) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount || 0);
}

// Show/Hide loading spinner
function showLoading() {
    loadingSpinner?.classList.remove('hidden');
}

function hideLoading() {
    loadingSpinner?.classList.add('hidden');
}

// Mobile menu toggle
mobileMenuBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('active');
});

// Tab switching
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (item.id === 'logoutBtn') {
            auth.signOut().then(() => {
                window.location.href = 'login.html';
            });
            return;
        }

        const tabId = item.dataset.tab;
        
        navItems.forEach(nav => nav.classList.remove('active'));
        tabContents.forEach(tab => tab.classList.remove('active'));
        
        item.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');

        loadTabData(tabId);
    });
});

// Helper function to detect order type by ID format
function detectOrderTypeById(id) {
    if (typeof id !== 'string') return null;
    
    // Watch orders: "ORD-" prefix or "PK" prefix
    if (id.startsWith('ORD-') || id.startsWith('PK')) {
        return 'purchase';
    }
    
    // Service orders: "SV" prefix or other patterns
    if (id.startsWith('SV') || id.length > 10) {
        return 'store';
    }
    if (id.startsWith('PK') || id.length > 10) {
        return 'pickup';
    }
    
    
    // Default to service for unknown patterns
    return 'service';
}

// Get order display ID based on order type
function getOrderDisplayId(order) {
    if (order.type === 'purchase' && order.orderNumber) {
        return order.orderNumber; // e.g., "ORD-1750512884212" or "PK1751221999566"
    } else if (order.type === 'pickup' || order.type === 'store') {
        return order.id; // e.g., "SV1750269445163"
    } else {
        return order.id; // fallback to document ID
    }
}

// Get order total amount based on order type
function getOrderTotal(order) {
    let total = 0;

    if (order.type === 'purchase') {
        // For watch purchases, use totalAmount first, then subtotal
        if (typeof order.totalAmount === 'number') {
            total = order.totalAmount;
        } else if (typeof order.subtotal === 'number') {
            total = order.subtotal;
        }
    } else {
        // For repair, store, pickup orders, use price
        if (typeof order.price === 'number') {
            total = order.price;
        }
    }

    return total;
}


// Get order type display name
function getOrderTypeDisplay(order) {
    switch (order.type) {
        case 'purchase':
            return 'Watch Purchase';
        case 'pickup':
            return 'Repair Service';
        case 'store':
            return 'Store Visit';
        default:
            return 'Order';
    }
}

// Get status configuration based on order type
function getStatusConfig(orderType) {
    return orderType === 'purchase' ? WATCH_ORDER_STATUSES : SERVICE_ORDER_STATUSES;
}

// Get status display information
function getStatusDisplay(status, orderType) {
    const statusConfig = getStatusConfig(orderType);
    const statusInfo = statusConfig.find(s => s.key === status) || statusConfig[0];
    return statusInfo;
}

// Get next status in workflow
function getNextStatus(currentStatus, orderType) {
    const statusConfig = getStatusConfig(orderType);
    const currentIndex = statusConfig.findIndex(s => s.key === currentStatus);
    
    if (currentIndex === -1) {
        return statusConfig[0].key; // Return first status if current not found
    }
    
    const nextIndex = (currentIndex + 1) % statusConfig.length;
    return statusConfig[nextIndex].key;
}

// Filter orders by date range
function filterOrdersByDate(orders, startDate, endDate) {
    if (!startDate && !endDate) return orders;
    
    return orders.filter(order => {
        const orderDate = new Date(order.timestamp);
        const start = startDate ? new Date(startDate) : new Date('1970-01-01');
        const end = endDate ? new Date(endDate + 'T23:59:59') : new Date();
        
        return orderDate >= start && orderDate <= end;
    });
}

// Apply date filter
function applyDateFilter() {
    const startDate = startDateInput?.value;
    const endDate = endDateInput?.value;
    
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert('Start date cannot be later than end date');
        return;
    }
    
    loadTabData('dashboard');
    if (document.getElementById('orders')?.classList.contains('active')) {
        loadOrders();
    }
    
    showSuccessMessage('Date filter applied successfully!');
}

// Date filter event listener
filterBtn?.addEventListener('click', applyDateFilter);

// Load dashboard data with date filtering and correct total calculation
async function loadDashboardData() {
    try {
        const [ordersSnapshot, productsSnapshot] = await Promise.all([
            getDocs(collection(db, 'orders')),
            getDocs(collection(db, 'watches'))
        ]);

        let orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Apply date filter
        const startDate = startDateInput?.value;
        const endDate = endDateInput?.value;
        orders = filterOrdersByDate(orders, startDate, endDate);

        // Calculate total sales using the correct amount field with proper handling
        const totalSales = orders.reduce((sum, order) => {
            const orderTotal = getOrderTotal(order);
            return sum + (orderTotal || 0);
        }, 0);

        // Separate orders by type for better analytics
        const watchOrders = orders.filter(order => order.type === 'purchase');
        const repairOrders = orders.filter(order => order.type === 'pickup');
        const storeOrders = orders.filter(order => order.type === 'store');

        // Calculate separate totals for verification
        const watchSales = watchOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
        const serviceSales = [...repairOrders, ...storeOrders].reduce((sum, order) => sum + getOrderTotal(order), 0);

        console.log('Sales Breakdown:', {
            totalSales,
            watchSales,
            serviceSales,
            watchOrdersCount: watchOrders.length,
            serviceOrdersCount: repairOrders.length + storeOrders.length
        });

        // Update statistics
        const totalOrdersElement = document.getElementById('totalOrders');
        const totalSalesElement = document.getElementById('totalSales');
        const totalProductsElement = document.getElementById('totalProducts');

        if (totalOrdersElement) totalOrdersElement.textContent = orders.length;
        if (totalSalesElement) totalSalesElement.textContent = formatCurrency(totalSales);
        if (totalProductsElement) totalProductsElement.textContent = productsSnapshot.size;

        // Create charts
        createSalesChart(orders);
        createCategoryChart(productsSnapshot.docs);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showSuccessMessage('Error loading dashboard data. Please try again.');
    }
}

// Create sales chart with proper cleanup
function createSalesChart(orders) {
    const ctx = document.getElementById('salesChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (salesChart) {
        salesChart.destroy();
        salesChart = null;
    }
    
    const monthlyData = orders.reduce((acc, order) => {
        const date = new Date(order.timestamp);
        const month = date.toLocaleString('default', { month: 'short' });
        const amount = getOrderTotal(order);
        acc[month] = (acc[month] || 0) + amount;
        return acc;
    }, {});

    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(monthlyData),
            datasets: [{
                label: 'Monthly Sales',
                data: Object.values(monthlyData),
                borderColor: '#4CAF50',
                backgroundColor: 'rgba(76, 175, 80, 0.1)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Monthly Sales Trend'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '₹' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

// Create category chart with proper cleanup
function createCategoryChart(products) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart if it exists
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    
    const categoryData = products.reduce((acc, product) => {
        const category = product.data().category;
        acc[category] = (acc[category] || 0) + 1;
        return acc;
    }, {});

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(categoryData),
            datasets: [{
                data: Object.values(categoryData),
                backgroundColor: [
                    '#4CAF50',
                    '#2196F3',
                    '#FFC107',
                    '#9C27B0',
                    '#FF5722'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Products by Category'
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Load products
async function loadProducts() {
    try {
        const productsSnapshot = await getDocs(collection(db, 'watches'));
        const productsTableBody = document.getElementById('productsTableBody');
        
        if (!productsTableBody) return;
        
        productsTableBody.innerHTML = productsSnapshot.docs.map(doc => {
            const product = { id: doc.id, ...doc.data() };
            return `
                <tr>
                    <td><img src="${product.image}" alt="${product.name}" class="product-image-small" onerror="this.src='https://via.placeholder.com/50x50?text=No+Image'"></td>
                    <td>${product.name}</td>
                    <td>${product.category}</td>
                    <td>${formatCurrency(product.price)}</td>
                    <td>${product.stock || 0}</td>
                    <td>
                        <button onclick="toggleProductVisibility('${product.id}', ${!product.hidden})" 
                                class="btn-visibility ${product.hidden ? 'hidden' : ''}"
                                title="${product.hidden ? 'Show Product' : 'Hide Product'}">
                            <i class="fas fa-${product.hidden ? 'eye-slash' : 'eye'}"></i>
                        </button>
                    </td>
                    <td>
                        <button onclick="viewProduct('${product.id}')" class="btn-view" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="editProduct('${product.id}')" class="btn-edit" title="Edit Product">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteProduct('${product.id}')" class="btn-delete" title="Delete Product">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading products:', error);
        showSuccessMessage('Error loading products. Please try again.');
    }
}

// Product form handling
productForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    try {
        const formData = new FormData(productForm);
        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            price: parseFloat(formData.get('price')),
            stock: parseInt(formData.get('stock')),
            description: formData.get('description'),
            image: formData.get('image'),
            brand: formData.get('brand'),
            features: formData.get('features').split(',').map(f => f.trim()).filter(f => f),
            hidden: !formData.get('visible'),
            createdAt: new Date().toISOString()
        };

        if (productForm.dataset.editId) {
            await updateDoc(doc(db, 'watches', productForm.dataset.editId), {
                ...productData,
                updatedAt: new Date().toISOString()
            });
            showSuccessMessage('Product updated successfully!');
        } else {
            await addDoc(collection(db, 'watches'), productData);
            showSuccessMessage('Product added successfully!');
        }

        productModal?.classList.remove('active');
        productForm.reset();
        delete productForm.dataset.editId;
        await loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showSuccessMessage('Error saving product. Please try again.');
    } finally {
        hideLoading();
    }
});

// View product details
window.viewProduct = async (productId) => {
    try {
        const productDoc = await getDoc(doc(db, 'watches', productId));
        if (!productDoc.exists()) {
            showSuccessMessage('Product not found');
            return;
        }
        
        const product = productDoc.data();
        
        const productDetails = document.getElementById('productDetails');
        if (!productDetails) return;
        
        productDetails.innerHTML = `
            <img src="${product.image}" alt="${product.name}" class="product-image-large" onerror="this.src='https://via.placeholder.com/200x200?text=No+Image'">
            <div class="details-grid">
                <div class="details-item">
                    <div class="details-label">Name</div>
                    <div class="details-value">${product.name}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Category</div>
                    <div class="details-value">${product.category}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Brand</div>
                    <div class="details-value">${product.brand}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Price</div>
                    <div class="details-value">${formatCurrency(product.price)}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Stock</div>
                    <div class="details-value">${product.stock || 0}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Status</div>
                    <div class="details-value">
                        <span class="status-badge ${product.hidden ? 'pending' : 'completed'}">
                            ${product.hidden ? 'Hidden' : 'Visible'}
                        </span>
                    </div>
                </div>
                <div class="details-item">
                    <div class="details-label">Features</div>
                    <div class="details-value">${product.features?.join(', ') || 'None'}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Created</div>
                    <div class="details-value">${new Date(product.createdAt).toLocaleString()}</div>
                </div>
            </div>
            <div class="details-item">
                <div class="details-label">Description</div>
                <div class="details-value">${product.description}</div>
            </div>
        `;
        
        productDetailsModal?.classList.add('active');
    } catch (error) {
        console.error('Error loading product details:', error);
        showSuccessMessage('Error loading product details. Please try again.');
    }
};

// Edit product
window.editProduct = async (productId) => {
    try {
        const productDoc = await getDoc(doc(db, 'watches', productId));
        if (!productDoc.exists()) {
            showSuccessMessage('Product not found');
            return;
        }
        
        const product = productDoc.data();
        
        const form = document.getElementById('productForm');
        if (!form) return;
        
        form.elements['name'].value = product.name;
        form.elements['category'].value = product.category;
        form.elements['brand'].value = product.brand;
        form.elements['price'].value = product.price;
        form.elements['stock'].value = product.stock || 0;
        form.elements['description'].value = product.description;
        form.elements['image'].value = product.image;
        form.elements['features'].value = product.features?.join(', ') || '';
        form.elements['visible'].checked = !product.hidden;
        
        form.dataset.editId = productId;
        productModal?.classList.add('active');
    } catch (error) {
        console.error('Error loading product details:', error);
        showSuccessMessage('Error loading product details. Please try again.');
    }
};

// Enhanced delete product with proper error handling
window.deleteProduct = async (productId) => {
    if (!productId) {
        showSuccessMessage('Error: Product ID is required');
        return;
    }

    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to delete this product? This action cannot be undone.');
    if (!confirmed) {
        return;
    }

    showLoading();
    try {
        // First check if product exists
        const productDoc = await getDoc(doc(db, 'watches', productId));
        if (!productDoc.exists()) {
            showSuccessMessage('Error: Product not found');
            return;
        }

        const productData = productDoc.data();
        const productName = productData.name || 'Unknown Product';

        // Delete the product
        await deleteDoc(doc(db, 'watches', productId));
        
        // Also remove from any user carts to maintain data consistency
        try {
            const cartQuery = query(collection(db, 'cart'), where('watchId', '==', productId));
            const cartSnapshot = await getDocs(cartQuery);
            
            const deleteCartPromises = cartSnapshot.docs.map(cartDoc => 
                deleteDoc(doc(db, 'cart', cartDoc.id))
            );
            
            await Promise.all(deleteCartPromises);
            
            if (cartSnapshot.docs.length > 0) {
                console.log(`Removed ${cartSnapshot.docs.length} cart items for deleted product`);
            }
        } catch (cartError) {
            console.error('Error cleaning up cart items:', cartError);
            // Don't fail the main operation for cart cleanup errors
        }
        
        await loadProducts();
        showSuccessMessage(`Product "${productName}" deleted successfully!`);
        
    } catch (error) {
        console.error('Error deleting product:', error);
        showSuccessMessage('Error deleting product. Please try again.');
    } finally {
        hideLoading();
    }
};

// Enhanced toggle product visibility with cart updates
window.toggleProductVisibility = async (productId, hidden) => {
    if (!productId) {
        showSuccessMessage('Error: Product ID is required');
        return;
    }

    showLoading();
    try {
        // First check if product exists
        const productDoc = await getDoc(doc(db, 'watches', productId));
        if (!productDoc.exists()) {
            showSuccessMessage('Error: Product not found');
            return;
        }

        const productData = productDoc.data();
        const productName = productData.name || 'Unknown Product';

        // Update product visibility
        await updateDoc(doc(db, 'watches', productId), {
            hidden: hidden,
            updatedAt: new Date().toISOString()
        });

        // If hiding the product, mark cart items as out of stock
        if (hidden) {
            try {
                const cartQuery = query(collection(db, 'cart'), where('watchId', '==', productId));
                const cartSnapshot = await getDocs(cartQuery);
                
                const updateCartPromises = cartSnapshot.docs.map(cartDoc => 
                    updateDoc(doc(db, 'cart', cartDoc.id), {
                        outOfStock: true,
                        originalQuantity: cartDoc.data().quantity,
                        quantity: 0,
                        updatedAt: new Date().toISOString()
                    })
                );
                
                await Promise.all(updateCartPromises);
                
                if (cartSnapshot.docs.length > 0) {
                    console.log(`Marked ${cartSnapshot.docs.length} cart items as out of stock for hidden product`);
                }
            } catch (cartError) {
                console.error('Error updating cart items:', cartError);
                // Don't fail the main operation for cart update errors
            }
        } else {
            // If showing the product, restore cart items if they were marked as out of stock
            try {
                const cartQuery = query(
                    collection(db, 'cart'), 
                    where('watchId', '==', productId),
                    where('outOfStock', '==', true)
                );
                const cartSnapshot = await getDocs(cartQuery);
                
                const restoreCartPromises = cartSnapshot.docs.map(cartDoc => {
                    const cartData = cartDoc.data();
                    return updateDoc(doc(db, 'cart', cartDoc.id), {
                        outOfStock: false,
                        quantity: cartData.originalQuantity || 1,
                        updatedAt: new Date().toISOString()
                    });
                });
                
                await Promise.all(restoreCartPromises);
                
                if (cartSnapshot.docs.length > 0) {
                    console.log(`Restored ${cartSnapshot.docs.length} cart items for visible product`);
                }
            } catch (cartError) {
                console.error('Error restoring cart items:', cartError);
                // Don't fail the main operation for cart restore errors
            }
        }
        
        await loadProducts();
        showSuccessMessage(`Product "${productName}" ${hidden ? 'hidden' : 'shown'} successfully!`);
        
    } catch (error) {
        console.error('Error updating product visibility:', error);
        showSuccessMessage('Error updating product visibility. Please try again.');
    } finally {
        hideLoading();
    }
};

// Load orders with correct display logic and date filtering
async function loadOrders() {
    try {
        const ordersSnapshot = await getDocs(
            query(collection(db, 'orders'), 
            orderBy('timestamp', 'desc'))
        );
        
        let orders = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Apply date filter
        const startDate = startDateInput?.value;
        const endDate = endDateInput?.value;
        orders = filterOrdersByDate(orders, startDate, endDate);
        
        const ordersTableBody = document.getElementById('ordersTableBody');
        if (!ordersTableBody) return;
        
        ordersTableBody.innerHTML = orders.map(order => {
            const displayId = getOrderDisplayId(order);
            const totalAmount = getOrderTotal(order);
            const orderType = getOrderTypeDisplay(order);
            const statusInfo = getStatusDisplay(order.status || (order.type === 'purchase' ? 'pending' : 'order_placed'), order.type);
            
            // Determine items display
            let itemsDisplay = '';
            if (order.type === 'purchase' && order.items) {
                itemsDisplay = `${order.items.length} items`;
            } else if (order.type === 'pickup') {
                itemsDisplay = `Pickup for repair of - ${order.service  || 'Service'}`;
            } else if (order.type === 'store') {
                itemsDisplay = `Store Visit - ${order.service || 'Service'}`;
            } else {
                itemsDisplay = '1 service';
            }
            
            // Create appropriate update button based on order type and ID format
            let updateButton = '';
            if (order.type === 'purchase') {
                // For watch orders, use orderNumber if available, otherwise use document ID
                const updateId = order.orderNumber || order.id;
                updateButton = `<button onclick="updateWatchOrderStatus('${updateId}')" class="btn-edit" title="Update Status">
                    <i class="fas fa-edit"></i>
                </button>`;
            } else {
                // For service orders, always use document ID
                updateButton = `<button onclick="updateServiceOrderStatus('${order.id}')" class="btn-edit" title="Update Status">
                    <i class="fas fa-edit"></i>
                </button>`;
            }
            
            return `
                <tr>
                    <td>
                        <div style="font-weight: bold; color: #4CAF50;">${displayId}</div>
                        <div style="font-size: 0.8rem; color: #666;">${orderType}</div>
                    </td>
                    <td>${order.customerName}</td>
                    <td>${itemsDisplay}</td>
                    <td>
                        <div style="font-weight: bold;">${formatCurrency(totalAmount)}</div>
                        ${order.type === 'purchase' && order.tax ? 
                            `<div style="font-size: 0.8rem; color: #666;">+${formatCurrency(order.tax)} tax</div>` : 
                            ''
                        }
                    </td>
                    <td>
                        <span class="status-badge ${statusInfo.key}" title="${statusInfo.label}">
                            <i class="${statusInfo.icon}"></i> ${statusInfo.label}
                        </span>
                    </td>
                    <td>${new Date(order.timestamp).toLocaleDateString()}</td>
                    <td>
                        <button onclick="viewOrder('${order.id}')" class="btn-view" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${updateButton}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading orders:', error);
        showSuccessMessage('Error loading orders. Please try again.');
    }
}


// Update watch order status using orderNumber or document ID
window.updateWatchOrderStatus = async (identifier) => {
    if (!identifier) {
        console.error('Order identifier is required');
        showSuccessMessage('Error: Missing order identifier');
        return;
    }

    try {
        showLoading();
        
        let orderDoc;
        let orderData;
        let docId;
        
        // First try to find by orderNumber field
        if (identifier.startsWith('ORD-') ) {
            const ordersQuery = query(
                collection(db, 'orders'),
                where('orderNumber', '==', identifier),
                where('type', '==', 'purchase')
            );
            const ordersSnapshot = await getDocs(ordersQuery);
            
            if (!ordersSnapshot.empty) {
                orderDoc = ordersSnapshot.docs[0];
                orderData = orderDoc.data();
                docId = orderDoc.id;
            }
        }
        
        // If not found by orderNumber, try by document ID
        if (!orderData) {
            try {
                orderDoc = await getDoc(doc(db, 'orders', identifier));
                if (orderDoc.exists()) {
                    orderData = orderDoc.data();
                    docId = identifier;
                    
                    // Verify it's a purchase order
                    if (orderData.type !== 'purchase') {
                        console.error('Order is not a purchase order:', identifier);
                        showSuccessMessage('Error: This is not a watch order');
                        return;
                    }
                }
            } catch (error) {
                console.error('Error fetching order by document ID:', error);
            }
        }
        
        if (!orderData) {
            console.error('Watch order not found with identifier:', identifier);
            showSuccessMessage('Error: Watch order not found');
            return;
        }
        
        // Get current status and determine next status
        const currentStatus = orderData.status || 'pending';
        const newStatus = getNextStatus(currentStatus, 'purchase');
        
        // Update the order status in database using the document ID
        await updateDoc(doc(db, 'orders', docId), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        
        // Get status display information for success message
        const statusInfo = getStatusDisplay(newStatus, 'purchase');
        const displayId = orderData.orderNumber || identifier;
        showSuccessMessage(`Watch order ${displayId} status updated to: ${statusInfo.label}`);
        
        // Reload the orders table
        await loadOrders();
        
    } catch (error) {
        console.error('Error updating watch order status:', error);
        showSuccessMessage('Error updating watch order status. Please try again.');
    } finally {
        hideLoading();
    }
};

// Update service order status for repair and store service orders using document ID
//import { collection, query, where, getDocs } from "firebase/firestore";

// Update service order status for repair, store, and pickup service orders using document ID
window.updateServiceOrderStatus = async (orderId) => {
    if (!orderId) {
        console.error('Order ID is required');
        showSuccessMessage('Error: Missing order ID');
        return;
    }

    try {
        showLoading();
        
        // Query orders collection by field 'id' instead of document ID
        const ordersQuery = query(collection(db, 'orders'), where('id', '==', orderId));
        const querySnapshot = await getDocs(ordersQuery);
        
        if (querySnapshot.empty) {
            console.error('Service order not found with ID:', orderId);
            showSuccessMessage('Error: Service order not found');
            return;
        }
        
        // Assuming IDs are unique, take the first matched document
        const orderDoc = querySnapshot.docs[0];
        const orderData = orderDoc.data();
        
        if (!orderData) {
            console.error('Order data is empty for ID:', orderId);
            showSuccessMessage('Error: Order data is corrupted');
            return;
        }
        
        // Verify it's a valid service order (repair, store, or pickup)
        if ( orderData.type !== 'store' && orderData.type !== 'pickup') {
            console.error('Order is not a valid service order. ID:', orderId, 'Type:', orderData.type);
            showSuccessMessage('Error: This is not a valid service order');
            return;
        }
        
        const orderType = orderData.type;
        const currentStatus = orderData.status || 'order_placed';
        const newStatus = getNextStatus(currentStatus, orderType);
        
        // Update the order status in Firestore
        await updateDoc(orderDoc.ref, {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
        
        // Get status display information for UI feedback
        const statusInfo = getStatusDisplay(newStatus, orderType);
        const orderTypeDisplay = orderType === 'store' 
                ? 'Store Visit Service' 
                : 'Pickup Service';
        
        showSuccessMessage(`${orderTypeDisplay} order ${orderId} status updated to: ${statusInfo.label}`);
        
        // Reload the orders table or list
        await loadOrders();
        
    } catch (error) {
        console.error('Error updating service order status:', error);
        showSuccessMessage('Error updating service order status. Please try again.');
    } finally {
        hideLoading();
    }
};

window.viewOrder = async (orderId) => {
    try {
        let orderDoc = await getDoc(doc(db, 'orders', orderId));

        // If not found by document ID, fallback to orderNumber (purchase) or id (pickup/store)
        if (!orderDoc.exists()) {
            // Try orderNumber for purchase orders
            const orderNumberQuery = query(collection(db, 'orders'), where('orderNumber', '==', orderId));
            const orderNumberSnapshot = await getDocs(orderNumberQuery);

            if (!orderNumberSnapshot.empty) {
                orderDoc = orderNumberSnapshot.docs[0];
            } else {
                // Try id field for pickup/store orders
                const idQuery = query(collection(db, 'orders'), where('id', '==', orderId));
                const idSnapshot = await getDocs(idQuery);

                if (!idSnapshot.empty) {
                    orderDoc = idSnapshot.docs[0];
                } else {
                    showSuccessMessage('Order not found');
                    return;
                }
            }
        }

        const order = orderDoc.data();

        const displayId = order.orderNumber || order.id || orderId;
        const totalAmount = getOrderTotal(order);
        const orderType = getOrderTypeDisplay(order);
        const statusInfo = getStatusDisplay(order.status || (order.type === 'purchase' ? 'pending' : 'order_placed'), order.type);

        const orderDetails = document.getElementById('orderDetails');
        if (!orderDetails) return;

        let orderContent = `
            <div class="details-grid">
                <div class="details-item">
                    <div class="details-label">Order ID</div>
                    <div class="details-value" style="font-weight: bold; color: #4CAF50;">${displayId}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Order Type</div>
                    <div class="details-value">${orderType}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Customer</div>
                    <div class="details-value">${order.customerName || order.shippingAddress?.fullName || 'N/A'}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Status</div>
                    <div class="details-value">
                        <span class="status-badge ${statusInfo.key}">
                            <i class="${statusInfo.icon}"></i> ${statusInfo.label}
                        </span>
                    </div>
                </div>
                <div class="details-item">
                    <div class="details-label">Date</div>
                    <div class="details-value">${new Date(order.timestamp || order.createdAt).toLocaleString()}</div>
                </div>
                <div class="details-item">
                    <div class="details-label">Total Amount</div>
                    <div class="details-value" style="font-weight: bold; color: #4CAF50;">${formatCurrency(totalAmount)}</div>
                </div>
            </div>
        `;

        // Purchase orders
        if (order.type === 'purchase' && order.items) {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Items</div>
                    <table style="width: 100%; margin-top: 1rem; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f5f5f5;">
                                <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd;">Product</th>
                                <th style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">Price</th>
                                <th style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">Qty</th>
                                <th style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map(item => `
                                <tr>
                                    <td style="padding: 0.5rem; border: 1px solid #ddd;">${item.name}</td>
                                    <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${formatCurrency(item.price)}</td>
                                    <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${item.quantity}</td>
                                    <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${formatCurrency(item.price * item.quantity)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #ddd; font-weight: bold;">
                                <td colspan="3" style="padding: 0.5rem; border: 1px solid #ddd;">Subtotal</td>
                                <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${formatCurrency(order.subtotal || totalAmount)}</td>
                            </tr>
                            ${order.tax ? `
                                <tr>
                                    <td colspan="3" style="padding: 0.5rem; border: 1px solid #ddd;">Tax</td>
                                    <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${formatCurrency(order.tax)}</td>
                                </tr>
                                <tr style="font-weight: bold; color: #4CAF50;">
                                    <td colspan="3" style="padding: 0.5rem; border: 1px solid #ddd;">Total</td>
                                    <td style="padding: 0.5rem; text-align: right; border: 1px solid #ddd;">${formatCurrency(order.totalAmount || totalAmount)}</td>
                                </tr>
                            ` : ''}
                        </tfoot>
                    </table>
                </div>
            `;
        }

        // Pickup orders
        else if (order.type === 'pickup') {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Pickup Details</div>
                    <div class="details-value">
                        <p><strong>Watch Brand:</strong> ${order.brand || 'Not specified'}</p>
                        <p><strong>Issue:</strong> ${order.issue || 'Not specified'}</p>
                        <p><strong>Service:</strong> ${order.service || 'Not specified'}</p>
                        <p><strong>Service Price:</strong> ${formatCurrency(order.price || 0)}</p>
                        ${order.address ? `<p><strong>Pickup Address:</strong> ${order.address}</p>` : ''}
                        ${order.date ? `<p><strong>Pickup Date:</strong> ${order.date}</p>` : ''}
                        ${order.time ? `<p><strong>Pickup Time:</strong> ${order.time}</p>` : ''}
                        ${order.express ? `<p><strong>Express Service:</strong> Yes</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Store orders
        else if (order.type === 'store') {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Store Visit Details</div>
                    <div class="details-value">
                        <p><strong>Store Location:</strong> ${order.store || 'Not specified'}</p>
                        <p><strong>Service:</strong> ${order.service || 'General inquiry'}</p>
                        <p><strong>Issue:</strong> ${order.issue || 'Not specified'}</p>
                        <p><strong>Watch Brand:</strong> ${order.brand || 'Not specified'}</p>
                        <p><strong>Service Fee:</strong> ${formatCurrency(order.price || 0)}</p>
                        ${order.date ? `<p><strong>Appointment Date:</strong> ${order.date}</p>` : ''}
                        ${order.time ? `<p><strong>Appointment Time:</strong> ${order.time}</p>` : ''}
                        ${order.express ? `<p><strong>Express Service:</strong> Yes</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Contact Information
        if (order.email || order.phone || order.customerEmail || order.customerPhone) {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Contact Information</div>
                    <div class="details-value">
                        ${order.email ? `<p><strong>Email:</strong> ${order.email}</p>` : ''}
                        ${order.customerEmail ? `<p><strong>Email:</strong> ${order.customerEmail}</p>` : ''}
                        ${order.phone ? `<p><strong>Phone:</strong> ${order.phone}</p>` : ''}
                        ${order.customerPhone ? `<p><strong>Phone:</strong> ${order.customerPhone}</p>` : ''}
                        ${order.userEmail ? `<p><strong>User Email:</strong> ${order.userEmail}</p>` : ''}
                    </div>
                </div>
            `;
        }

        // Payment Method
        if (order.paymentMethod) {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Payment Method</div>
                    <div class="details-value">
                        <p><strong>Method:</strong> ${order.paymentMethod.toUpperCase()}</p>
                        <p><strong>Status:</strong> ${order.paymentStatus || 'Pending'}</p>
                    </div>
                </div>
            `;
        }

        // Terms acceptance
        if ((order.type === 'repair' || order.type === 'store' || order.type === 'pickup') && order.terms !== undefined) {
            orderContent += `
                <div class="details-item">
                    <div class="details-label">Terms & Conditions</div>
                    <div class="details-value">
                        <p><strong>Accepted:</strong> ${order.terms ? 'Yes' : 'No'}</p>
                    </div>
                </div>
            `;
        }

        orderDetails.innerHTML = orderContent;
        orderDetailsModal?.classList.add('active');

    } catch (error) {
        console.error('Error loading order details:', error);
        showSuccessMessage('Error loading order details. Please try again.');
    }
};



// Load tab data
async function loadTabData(tabId) {
    showLoading();
    try {
        switch (tabId) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'products':
                await loadProducts();
                break;
            case 'orders':
                await loadOrders();
                break;
        }
    } catch (error) {
        console.error('Error loading data:', error);
        showSuccessMessage('Error loading data. Please try again.');
    } finally {
        hideLoading();
    }
}

// Modal functions
window.openProductModal = () => {
    productModal?.classList.add('active');
    productForm?.reset();
    delete productForm?.dataset.editId;
};

window.closeProductModal = () => {
    productModal?.classList.remove('active');
    productForm?.reset();
    delete productForm?.dataset.editId;
};

window.closeProductDetailsModal = () => {
    productDetailsModal?.classList.remove('active');
};

window.closeOrderDetailsModal = () => {
    orderDetailsModal?.classList.remove('active');
};

// Initialize admin panel
function initializeAdmin() {
    loadDashboardData();
    
    // Initialize date filters with current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    if (startDateInput) startDateInput.valueAsDate = firstDay;
    if (endDateInput) endDateInput.valueAsDate = lastDay;
}

// Check authentication state
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    } else {
        initializeAdmin();
    }
});