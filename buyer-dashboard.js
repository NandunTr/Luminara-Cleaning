/* ========================================
   Luminara Cleanings — Buyer Dashboard Logic
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let userData = null;

  // ── Auth Guard ──
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'auth.html?role=buyer';
      return;
    }
    currentUser = user;

    const doc = await db.collection('users').doc(user.uid).get();
    userData = doc.exists ? doc.data() : { name: user.displayName, email: user.email };

    initDashboard();
  });

  function initDashboard() {
    // Set user info in sidebar
    const nameEl = document.getElementById('sidebar-user-name');
    const avatarEl = document.getElementById('sidebar-avatar');
    if (nameEl) nameEl.textContent = userData.name || currentUser.email;
    if (avatarEl) avatarEl.textContent = (userData.name || currentUser.email).charAt(0).toUpperCase();

    // Set min date
    const dateInput = document.getElementById('db-date');
    if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

    // Load bookings
    loadBookings();

    // Load profile
    loadProfile();
  }

  // ── Navigation ──
  const navItems = document.querySelectorAll('.sidebar-nav-item[data-panel]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const panel = item.dataset.panel;
      switchPanel(panel);
    });
  });

  // Make switchPanel global so buttons can call it
  window.switchPanel = function(panelId) {
    // Update nav
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`[data-panel="${panelId}"]`);
    if (activeNav) activeNav.classList.add('active');

    // Update panels
    document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`panel-${panelId}`);
    if (activePanel) activePanel.classList.add('active');

    // Update title
    const titles = { overview: 'Dashboard', bookings: 'My Bookings', 'new-booking': 'Book New Cleaning', profile: 'My Profile' };
    document.getElementById('page-title').textContent = titles[panelId] || 'Dashboard';

    // Close mobile sidebar
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  };

  // ── Mobile Menu ──
  document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebar-overlay').classList.toggle('show');
  });

  document.getElementById('sidebar-overlay').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  });

  // ── Logout ──
  document.getElementById('logout-btn').addEventListener('click', () => signOutUser());

  // ── Load Bookings ──
  function loadBookings() {
    // Real-time listener
    db.collection('bookings')
      .where('buyerId', '==', currentUser.uid)
      .orderBy('createdAt', 'desc')
      .onSnapshot((snapshot) => {
        const bookings = [];
        snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

        // Update stats
        const total = bookings.length;
        const active = bookings.filter(b => ['pending', 'approved', 'in-progress'].includes(b.status)).length;
        const completed = bookings.filter(b => b.status === 'completed').length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-active').textContent = active;
        document.getElementById('stat-completed').textContent = completed;

        const countBadge = document.getElementById('bookings-count');
        if (active > 0) {
          countBadge.textContent = active;
          countBadge.style.display = 'inline';
        } else {
          countBadge.style.display = 'none';
        }

        // Render recent (overview)
        renderBookingsTable(bookings.slice(0, 5), 'recent-bookings-body');

        // Render all bookings
        renderBookingsTable(bookings, 'all-bookings-body');
      }, (error) => {
        console.error('Error loading bookings:', error);
        document.getElementById('recent-bookings-body').innerHTML = renderEmpty('No bookings yet', 'Book your first cleaning to get started!');
        document.getElementById('all-bookings-body').innerHTML = renderEmpty('No bookings yet', 'Book your first cleaning to get started!');
      });
  }

  function renderBookingsTable(bookings, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (bookings.length === 0) {
      container.innerHTML = renderEmpty('No bookings yet', 'Book your first cleaning to get started!');
      return;
    }

    const statusLabels = {
      'pending': 'Pending',
      'approved': 'Approved',
      'in-progress': 'In Progress',
      'completed': 'Completed',
      'cancelled': 'Cancelled'
    };

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Service</th>
            <th>Date</th>
            <th>Status</th>
            <th>Cleaners</th>
          </tr>
        </thead>
        <tbody>
    `;

    bookings.forEach(b => {
      html += `
        <tr>
          <td><strong>${b.bookingId || b.id}</strong></td>
          <td>${capitalize(b.serviceType || '—')}</td>
          <td>${b.preferredDate || '—'}</td>
          <td><span class="badge badge-${b.status}">${statusLabels[b.status] || b.status}</span></td>
          <td>${b.employeesEnrolled || 0}/${b.employeesNeeded || 2}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ── New Booking Form ──
  const bookingForm = document.getElementById('dashboard-booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const bookingData = {
        bookingId: generateBookingId(),
        buyerId: currentUser.uid,
        buyerName: userData.name || '',
        buyerEmail: userData.email || currentUser.email,
        buyerPhone: userData.phone || '',
        serviceType: document.getElementById('db-service-type').value,
        propertyType: document.getElementById('db-property-type').value,
        preferredDate: document.getElementById('db-date').value,
        preferredTime: document.getElementById('db-time').value,
        employeesNeeded: parseInt(document.getElementById('db-employees').value) || 2,
        employeesEnrolled: 0,
        address: document.getElementById('db-address').value,
        notes: document.getElementById('db-notes').value,
        status: 'pending',
        visibleToEmployees: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        await db.collection('bookings').doc(bookingData.bookingId).set(bookingData);
        showToast('Booking submitted successfully!', 'success');
        bookingForm.reset();
        switchPanel('bookings');
      } catch (error) {
        console.error('Error creating booking:', error);
        showToast('Failed to submit booking. Please try again.', 'error');
      }
    });
  }

  // ── Profile ──
  function loadProfile() {
    document.getElementById('profile-name').value = userData.name || '';
    document.getElementById('profile-email').value = userData.email || currentUser.email;
    document.getElementById('profile-phone').value = userData.phone || '';
  }

  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      try {
        await db.collection('users').doc(currentUser.uid).update({
          name: document.getElementById('profile-name').value,
          phone: document.getElementById('profile-phone').value,
        });

        userData.name = document.getElementById('profile-name').value;
        userData.phone = document.getElementById('profile-phone').value;

        document.getElementById('sidebar-user-name').textContent = userData.name;
        document.getElementById('sidebar-avatar').textContent = userData.name.charAt(0).toUpperCase();

        showToast('Profile updated successfully!', 'success');
      } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Failed to update profile.', 'error');
      }
    });
  }

  // ── Helpers ──
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function renderEmpty(title, desc) {
    return `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
        <h3>${title}</h3>
        <p>${desc}</p>
      </div>
    `;
  }
});
