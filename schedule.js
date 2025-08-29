// Initialize EmailJS and Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";

import firebaseConfig from './config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);



(function() {
    emailjs.init("YOUR_EMAILJS_USER_ID_HERE");
})();


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

document.getElementById('repairForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show loading spinner with message
    const loadingSpinner = document.getElementById('loadingSpinner');
    const spinner = loadingSpinner.querySelector('.spinner');
    const message = document.createElement('p');
    message.style.marginTop = '20px';
    message.style.color = '#4CAF50';
    message.textContent = 'Processing your order...';
    spinner.insertAdjacentElement('afterend', message);
    loadingSpinner.style.display = 'flex';
    
    // Disable form submission
    const submitButton = this.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            throw new Error('User not authenticated');
        }

        // Generate unique order ID
        const orderId = 'PK' + Date.now();
        
        // Get form values
        const formData = {
            id: orderId,
            type: 'pickup',
            userEmail: user.email,
            customerName: document.getElementById('name').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            address: document.getElementById('address').value,
            brand: document.getElementById('brand').value,
            issue: document.getElementById('issue').value,
            service: document.getElementById('service').value,
            express: document.getElementById('express').checked,
            date: document.getElementById('date').value,
            time: document.getElementById('time').value,
            terms: document.getElementById('terms').checked,
            status: 'order_placed',
            timestamp: new Date().toISOString()
        };

        // Calculate total price
        let totalPrice = 0;
        switch(formData.service) {
            case 'battery':
                totalPrice = 200;
                break;
            case 'full':
                totalPrice = 500;
                break;
            case 'glass':
                totalPrice = 150;
                break;
            case 'Nothing':
                totalPrice = 0;
                break;    
        }
        if(totalPrice === 0)
            {
                totalPrice="(As per the issue) ";
                if(formData.express)
                {
                    totalPrice+= "+ express service-- ₹"
                }
            }
        if (formData.express) {
            totalPrice += 100;
        }

        formData.price = totalPrice;

        // Save order to Firebase
        await addDoc(collection(db, 'orders'), formData);

        // Get time slot text
        const timeSelect = document.getElementById('time');
        const timeText = timeSelect.options[timeSelect.selectedIndex].text;

        // Send confirmation email
        const emailParams = {
            to_email: formData.email,
            to_name: formData.customerName,
            order_id: orderId,
            service_type: formData.service,
            pickup_date: formData.date,
            pickup_time: timeText,
            address: formData.address,
            total_price: totalPrice,
            express_service: formData.express ? 'Yes' : 'No'
        };

        await emailjs.send(
            'YOUR_SERVICE_ID_HERE',       // instead of 'service_xto6huz'
            'YOUR_TEMPLATE_ID_HERE',      // instead of 'template_yqzmgcr'
            emailParams
        );
        

        // Hide loading spinner
        loadingSpinner.style.display = 'none';

        // Hide the form
        document.getElementById('repairForm').style.display = 'none';
       


        // Create and show confirmation page
        const confirmationHtml = `
            <div class="confirmation-page">
                <div class="confirmation-header">
                    <i class="fas fa-check-circle"></i>
                    <h2>Pickup Scheduled!</h2>
                    <p>Thank you for choosing our service. Your pickup details are below:</p>
                    <p><strong>Order ID: ${orderId}</strong></p>
                </div>
                
                <div class="confirmation-details">
                    <div class="detail-group">
                        <h3><i class="fas fa-user"></i> Customer Details</h3>
                        <p><strong>Name:</strong> ${formData.customerName}</p>
                        <p><strong>Phone:</strong> ${formData.phone}</p>
                        <p><strong>Email:</strong> ${formData.email}</p>
                    </div>

                    <div class="detail-group">
                        <h3><i class="fas fa-map-marker-alt"></i> Pickup Details</h3>
                        <p><strong>Address:</strong> ${formData.address}</p>
                        <p><strong>Date:</strong> ${formData.date}</p>
                        <p><strong>Time Slot:</strong> ${timeText}</p>
                    </div>

                    <div class="detail-group">
                        <h3><i class="fas fa-watch"></i> Service Details</h3>
                        <p><strong>Watch Brand:</strong> ${formData.brand}</p>
                        <p><strong>Service Type:</strong> ${formData.service}</p>
                        <p><strong>Express Service:</strong> ${formData.express ? 'Yes' : 'No'}</p>
                        <p><strong>Issue Description:</strong> ${formData.issue}</p>
                        <p class="total-price"><strong>Total Price:</strong> ₹${totalPrice}</p>
                    </div>

                    <div class="confirmation-footer">
                        <p><i class="fas fa-truck"></i> Our pickup executive will arrive at the scheduled time.</p>
                        <p><i class="fas fa-envelope"></i> A confirmation email has been sent to ${formData.email}</p>
                        <p><i class="fas fa-info-circle"></i> Pickup and delivery are completely FREE!</p>
                        <div class="action-buttons">
                            <button onclick="window.location.reload()" class="book-another">
                                <i class="fas fa-calendar-plus"></i> Schedule Another Pickup
                            </button>
                            <br>
                            <br>
                            <button onclick="window.location.href='track.html'" class="track-order">
                                <i class="fas fa-search"></i> Track Your Order
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Insert confirmation page
        const container = document.querySelector('.container');
        container.insertAdjacentHTML('beforeend', confirmationHtml);

        // Reset form for next use
        this.reset();
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
        loadingSpinner.style.display = 'none';
        
        // Re-enable form submission
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-calendar-check"></i> Schedule Free Pickup';
    }
});

// Set minimum date to today
const dateInput = document.getElementById('date');
const today = new Date().toISOString().split('T')[0];
dateInput.min = today;

// Pre-fill email from logged in user
onAuthStateChanged(auth, (user) => {
    if (user) {
        const emailInput = document.getElementById('email');
        emailInput.value = user.email;
    }
});