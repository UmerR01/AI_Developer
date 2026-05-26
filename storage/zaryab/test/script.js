document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const navLinks = document.querySelector('.nav-links');
    const bookNowBtn = document.querySelector('.book-now-btn');
    const body = document.body;

    // Create mobile navigation overlay
    const mobileNavOverlay = document.createElement('div');
    mobileNavOverlay.classList.add('nav-overlay');
    mobileNavOverlay.innerHTML = `
        <i class="fas fa-times close-btn"></i>
        <ul class="nav-links-mobile">
            <li><a href="#home">Home</a></li>
            <li><a href="#destinations">Destinations</a></li>
            <li><a href="#packages">Packages</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#contact">Contact</a></li>
            <li><button class="book-now-btn-mobile">Book Now</button></li>
        </ul>
    `;
    body.appendChild(mobileNavOverlay);

    const closeBtn = mobileNavOverlay.querySelector('.close-btn');
    const mobileNavLinks = mobileNavOverlay.querySelectorAll('.nav-links-mobile a');
    const mobileBookNowBtn = mobileNavOverlay.querySelector('.book-now-btn-mobile');

    hamburgerMenu.addEventListener('click', () => {
        mobileNavOverlay.classList.add('open');
        body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
    });

    closeBtn.addEventListener('click', () => {
        mobileNavOverlay.classList.remove('open');
        body.style.overflow = 'auto'; // Restore scrolling
    });

    mobileNavLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileNavOverlay.classList.remove('open');
            body.style.overflow = 'auto';
        });
    });

    mobileBookNowBtn.addEventListener('click', () => {
        alert('Booking functionality coming soon!');
        mobileNavOverlay.classList.remove('open');
        body.style.overflow = 'auto';
    });

    // Sticky navbar on scroll
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }
    });

    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Newsletter form validation
    const newsletterEmail = document.getElementById('newsletter-email');
    const subscribeBtn = document.querySelector('.subscribe-btn');

    subscribeBtn.addEventListener('click', () => {
        if (newsletterEmail.value && newsletterEmail.checkValidity()) {
            alert(`Thank you for subscribing, ${newsletterEmail.value}!`);
            newsletterEmail.value = '';
        } else {
            alert('Please enter a valid email address.');
        }
    });

    // Basic search card validation (optional: can be expanded)
    const searchBtn = document.querySelector('.search-card .search-btn');
    searchBtn.addEventListener('click', () => {
        const destination = document.querySelector('.search-card input[type="text"]').value;
        const date = document.querySelector('.search-card input[type="date"]').value;
        const travelers = document.querySelector('.search-card input[type="number"]').value;

        if (destination && date && travelers) {
            alert(`Searching for ${travelers} travelers to ${destination} on ${date}.`);
        } else {
            alert('Please fill in all search fields.');
        }
    });

    // Testimonial Slider (basic implementation - could be enhanced with a library)
    const testimonialSlider = document.querySelector('.testimonial-slider');
    // If you add more testimonials, you can implement a full slider here.
    // For now, it just displays them in a flex container.

});
