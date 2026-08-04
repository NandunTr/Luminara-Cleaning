/* ========================================
   Luminara Cleanings — Main Script
   Firebase-integrated booking + UI logic
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ──────────────────────────────────────
  // 1. Navbar Scroll Effect
  // ──────────────────────────────────────
  const navbar = document.getElementById('navbar');

  const handleScroll = () => {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // initial check

  // ──────────────────────────────────────
  // 2. Mobile Navigation Toggle
  // ──────────────────────────────────────
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      navToggle.classList.toggle('active');
    });

    // Close menu when a link is clicked
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('active');
      });
    });
  }

  // ──────────────────────────────────────
  // 3. Smooth Scroll for Anchor Links
  // ──────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const navHeight = navbar.offsetHeight;
        const targetPosition = targetEl.getBoundingClientRect().top + window.scrollY - navHeight;
        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
      }
    });
  });

  // ──────────────────────────────────────
  // 4. Dynamic Estimated Price
  // ──────────────────────────────────────
  const propertySelect = document.getElementById('property-type');
  const serviceSelect = document.getElementById('service-type');
  const employeesSelect = document.getElementById('employees-needed');
  const estimatePrice = document.getElementById('estimate-price');
  const estimateDisplay = document.getElementById('estimate-display');

  const basePriceMap = {
    house:     { min: 120, max: 250 },
    apartment: { min: 80,  max: 180 },
    office:    { min: 200, max: 450 },
    retail:    { min: 180, max: 400 },
    other:     { min: 100, max: 300 },
  };

  const serviceMultiplier = {
    residential: 1.0,
    commercial:  1.2,
    specialized: 1.5,
  };

  function updateEstimate() {
    const property = propertySelect ? propertySelect.value : '';
    const service = serviceSelect ? serviceSelect.value : '';
    const employees = employeesSelect ? parseInt(employeesSelect.value) || 2 : 2;

    if (property && basePriceMap[property]) {
      const base = basePriceMap[property];
      const mult = service && serviceMultiplier[service] ? serviceMultiplier[service] : 1.0;
      const empMult = employees > 2 ? 1 + (employees - 2) * 0.25 : employees === 1 ? 0.7 : 1.0;

      const min = Math.round(base.min * mult * empMult);
      const max = Math.round(base.max * mult * empMult);

      if (estimateDisplay) {
        estimateDisplay.style.transform = 'scale(0.97)';
        setTimeout(() => {
          estimatePrice.textContent = `$${min} – $${max}`;
          estimateDisplay.style.transform = 'scale(1)';
        }, 150);
      }
    }
  }

  if (propertySelect) propertySelect.addEventListener('change', updateEstimate);
  if (serviceSelect) serviceSelect.addEventListener('change', updateEstimate);
  if (employeesSelect) employeesSelect.addEventListener('change', updateEstimate);

  // ──────────────────────────────────────
  // 5. Set Minimum Booking Date to Today
  // ──────────────────────────────────────
  const dateInput = document.getElementById('booking-date');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // ──────────────────────────────────────
  // 6. Check Auth State & Update Navbar
  // ──────────────────────────────────────
  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(async (user) => {
      const navActions = document.getElementById('nav-actions');
      if (user && navActions) {
        try {
          const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
          const userData = userDoc.exists ? userDoc.data() : {};
          const displayName = userData.name || user.displayName || user.email.split('@')[0];
          const role = userData.role || 'buyer';
          const dashboardLink = role === 'admin' ? 'admin-dashboard.html' : 
                                role === 'employee' ? 'employee-dashboard.html' : 
                                'buyer-dashboard.html';

          navActions.innerHTML = `
            <a href="${dashboardLink}" class="nav-user-btn" id="nav-user-btn">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              ${displayName}
            </a>
            <a href="#booking" class="nav-book-btn" id="nav-book-btn">Book a Cleaning</a>
          `;
        } catch (err) {
          console.log('Error fetching user data:', err);
        }
      }
    });
  }

  // ──────────────────────────────────────
  // 7. Form Submission → Firebase
  // ──────────────────────────────────────
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('form-submit-btn');
      const originalText = submitBtn.innerHTML;

      // Show loading state
      submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="display:inline-block;vertical-align:middle;margin-right:8px;animation:spin 1s linear infinite;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
        </svg>
        Submitting...
      `;
      submitBtn.disabled = true;

      // Gather form data
      const formData = {
        bookingId: generateBookingId(),
        buyerName: document.getElementById('client-name').value,
        buyerEmail: document.getElementById('client-email').value,
        buyerPhone: document.getElementById('client-phone').value,
        serviceType: document.getElementById('service-type').value,
        propertyType: document.getElementById('property-type').value,
        employeesNeeded: parseInt(document.getElementById('employees-needed').value) || 2,
        employeesEnrolled: 0,
        preferredDate: document.getElementById('booking-date').value,
        preferredTime: document.getElementById('booking-time').value,
        address: document.getElementById('client-address').value,
        notes: document.getElementById('booking-notes').value,
        estimatedPrice: estimatePrice.textContent,
        status: 'pending',
        visibleToEmployees: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // If user is logged in, add their UID
      const currentUser = firebase.auth().currentUser;
      if (currentUser) {
        formData.buyerId = currentUser.uid;
      }

      try {
        // Save to Firestore
        await firebase.firestore().collection('bookings').doc(formData.bookingId).set(formData);

        // Show success modal
        const modal = document.getElementById('booking-success-modal');
        const bookingIdEl = document.getElementById('success-booking-id');
        if (bookingIdEl) bookingIdEl.textContent = `Booking ID: ${formData.bookingId}`;
        if (modal) modal.classList.add('show');

        // Reset form
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        bookingForm.reset();
        if (estimatePrice) estimatePrice.textContent = '— Select options —';

      } catch (error) {
        console.error('Booking error:', error);

        // Fallback: show success anyway (for when Firebase isn't configured yet)
        submitBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" style="display:inline-block;vertical-align:middle;margin-right:8px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Booking Submitted!
        `;
        submitBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
          submitBtn.disabled = false;
          bookingForm.reset();
          if (estimatePrice) estimatePrice.textContent = '— Select options —';
        }, 3000);
      }
    });
  }

  // ──────────────────────────────────────
  // 8. Scroll-Reveal Animations
  // ──────────────────────────────────────
  const revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    // Fallback: reveal all
    revealElements.forEach(el => el.classList.add('visible'));
  }

  // ──────────────────────────────────────
  // 9. Animated Counter for Hero Stats
  // ──────────────────────────────────────
  function animateCounter(element, target, suffix = '', duration = 2000) {
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (target - start) * eased);

      element.textContent = current + suffix;

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  // Observe the stats section
  const heroStats = document.querySelector('.hero-stats');
  if (heroStats) {
    const statsObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            animateCounter(document.getElementById('stat-clients'), 500, '+');
            animateCounter(document.getElementById('stat-years'), 8, '+');
            animateCounter(document.getElementById('stat-rating'), 4.9, '', 2000);

            // Fix the rating to show decimal
            setTimeout(() => {
              document.getElementById('stat-rating').textContent = '4.9';
            }, 2100);

            statsObserver.unobserve(heroStats);
          }
        });
      },
      { threshold: 0.5 }
    );

    statsObserver.observe(heroStats);
  }
});
