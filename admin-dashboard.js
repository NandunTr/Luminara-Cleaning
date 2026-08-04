/* ========================================
   Luminara Cleanings — Admin Dashboard Logic
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let userData = null;

  // ── Auth Guard ──
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'auth.html?role=admin'; return; }
    currentUser = user;

    const doc = await db.collection('users').doc(user.uid).get();
    userData = doc.exists ? doc.data() : {};

    if (userData.role !== 'admin') {
      window.location.href = 'auth.html?role=admin';
      return;
    }

    initDashboard();
  });

  function initDashboard() {
    document.getElementById('sidebar-user-name').textContent = userData.name || 'Admin';
    document.getElementById('sidebar-avatar').textContent = (userData.name || 'A').charAt(0).toUpperCase();
    loadBookings();
    loadEmployees();
  }

  // ── Navigation ──
  const navItems = document.querySelectorAll('.sidebar-nav-item[data-panel]');
  navItems.forEach(item => {
    item.addEventListener('click', () => switchPanel(item.dataset.panel));
  });

  window.switchPanel = function(panelId) {
    navItems.forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`[data-panel="${panelId}"]`);
    if (activeNav) activeNav.classList.add('active');

    document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`panel-${panelId}`);
    if (activePanel) activePanel.classList.add('active');

    const titles = { overview: 'Admin Dashboard', bookings: 'All Bookings', employees: 'Manage Employees' };
    document.getElementById('page-title').textContent = titles[panelId] || 'Admin Dashboard';

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  };

  // ── Mobile ──
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
    db.collection('bookings').orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
      const bookings = [];
      snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));

      // Stats
      document.getElementById('stat-total').textContent = bookings.length;
      document.getElementById('stat-pending').textContent = bookings.filter(b => b.status === 'pending').length;
      document.getElementById('stat-completed').textContent = bookings.filter(b => b.status === 'completed').length;

      const pending = bookings.filter(b => b.status === 'pending').length;
      const badge = document.getElementById('pending-count');
      if (pending > 0) { badge.textContent = pending; badge.style.display = 'inline'; }
      else badge.style.display = 'none';

      renderAdminBookings(bookings.slice(0, 5), 'recent-bookings-body', true);
      renderAdminBookings(bookings, 'all-bookings-body', false);
    });
  }

  function renderAdminBookings(bookings, containerId, isRecent) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (bookings.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No bookings yet</h3><p>Bookings from customers will appear here.</p></div>';
      return;
    }

    const statusLabels = { pending: 'Pending', approved: 'Approved', 'in-progress': 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };

    let html = `<table class="data-table"><thead><tr>
      <th>ID</th><th>Client</th><th>Service</th><th>Date</th><th>Cleaners</th><th>Status</th><th>Visible</th><th>Actions</th>
    </tr></thead><tbody>`;

    bookings.forEach(b => {
      const isFull = b.employeesEnrolled >= b.employeesNeeded;
      html += `<tr>
        <td><strong>${b.bookingId || b.id}</strong></td>
        <td>${b.buyerName || '—'}<br><small style="color:#94a3b8;">${b.buyerEmail || ''}</small></td>
        <td>${capitalize(b.serviceType || '—')}</td>
        <td>${b.preferredDate || '—'}</td>
        <td>${b.employeesEnrolled || 0}/${b.employeesNeeded || 2} ${isFull ? '<span class="badge badge-full">FULL</span>' : ''}</td>
        <td><span class="badge badge-${b.status}">${statusLabels[b.status] || b.status}</span></td>
        <td>
          <label class="toggle-switch">
            <input type="checkbox" ${b.visibleToEmployees ? 'checked' : ''} onchange="toggleVisibility('${b.id}', this.checked)" />
            <span class="toggle-slider"></span>
          </label>
        </td>
        <td>
          ${b.status === 'pending' ? `
            <button class="btn-dashboard btn-success-d btn-sm-d" onclick="updateBookingStatus('${b.id}', 'approved')" title="Approve">Approve</button>
          ` : ''}
          ${b.status === 'approved' ? `
            <button class="btn-dashboard btn-primary-d btn-sm-d" onclick="updateBookingStatus('${b.id}', 'in-progress')" title="Start">Start</button>
          ` : ''}
          ${b.status === 'in-progress' ? `
            <button class="btn-dashboard btn-gold-d btn-sm-d" onclick="updateBookingStatus('${b.id}', 'completed')" title="Complete">Complete</button>
          ` : ''}
          ${['pending', 'approved'].includes(b.status) ? `
            <button class="btn-dashboard btn-danger-d btn-sm-d" onclick="updateBookingStatus('${b.id}', 'cancelled')" title="Cancel" style="margin-left:4px;">✕</button>
          ` : ''}
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  // ── Booking Actions (global) ──
  window.updateBookingStatus = async function(bookingId, status) {
    try {
      await db.collection('bookings').doc(bookingId).update({ status });
      showToast(`Booking ${status}!`, 'success');
    } catch (error) {
      showToast('Failed to update booking.', 'error');
    }
  };

  window.toggleVisibility = async function(bookingId, visible) {
    try {
      await db.collection('bookings').doc(bookingId).update({ visibleToEmployees: visible });
      showToast(visible ? 'Project visible to employees' : 'Project hidden from employees', 'info');
    } catch (error) {
      showToast('Failed to update visibility.', 'error');
    }
  };

  // ── Load Employees ──
  function loadEmployees() {
    db.collection('users').where('role', '==', 'employee').onSnapshot((snapshot) => {
      const employees = [];
      snapshot.forEach(doc => employees.push({ id: doc.id, ...doc.data() }));

      document.getElementById('stat-employees').textContent = employees.length;
      renderEmployees(employees);
    });
  }

  function renderEmployees(employees) {
    const container = document.getElementById('employees-body');
    if (!container) return;

    if (employees.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No employees yet</h3><p>Click "Add Employee" to create an employee account.</p></div>';
      return;
    }

    let html = `<table class="data-table"><thead><tr>
      <th>Name</th><th>Email</th><th>Phone</th><th>Specialization</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>`;

    employees.forEach(e => {
      html += `<tr>
        <td><strong>${e.name || '—'}</strong></td>
        <td>${e.email || '—'}</td>
        <td>${e.phone || '—'}</td>
        <td>${capitalize(e.specialization || 'general')}</td>
        <td><span class="badge badge-${e.status || 'active'}">${capitalize(e.status || 'active')}</span></td>
        <td>
          <button class="btn-dashboard btn-sm-d ${e.status === 'active' ? 'btn-danger-d' : 'btn-success-d'}" 
            onclick="toggleEmployeeStatus('${e.id}', '${e.status === 'active' ? 'inactive' : 'active'}')">
            ${e.status === 'active' ? 'Deactivate' : 'Activate'}
          </button>
        </td>
      </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  window.toggleEmployeeStatus = async function(uid, newStatus) {
    try {
      await db.collection('users').doc(uid).update({ status: newStatus });
      showToast(`Employee ${newStatus}!`, 'success');
    } catch (error) {
      showToast('Failed to update employee.', 'error');
    }
  };

  // ── Add Employee Modal ──
  document.getElementById('add-employee-btn').addEventListener('click', () => {
    document.getElementById('add-employee-modal').classList.add('show');
  });

  document.getElementById('confirm-add-employee').addEventListener('click', async () => {
    const name = document.getElementById('emp-name').value;
    const email = document.getElementById('emp-email').value;
    const phone = document.getElementById('emp-phone').value;
    const password = document.getElementById('emp-password').value;
    const specialization = document.getElementById('emp-specialization').value;

    if (!name || !email || !password || password.length < 6) {
      showToast('Please fill all required fields (password min 6 chars).', 'error');
      return;
    }

    try {
      // Create employee auth account using a secondary Firebase app to avoid logging out admin
      const secondaryApp = firebase.initializeApp(firebase.app().options, 'SecondaryApp_' + Date.now());
      const secondaryAuth = secondaryApp.auth();

      const userCredential = await secondaryAuth.createUserWithEmailAndPassword(email, password);
      const newUid = userCredential.user.uid;

      // Sign out from secondary and delete the secondary app
      await secondaryAuth.signOut();
      await secondaryApp.delete();

      // Create Firestore document
      await db.collection('users').doc(newUid).set({
        uid: newUid,
        email: email,
        name: name,
        phone: phone,
        role: 'employee',
        specialization: specialization,
        status: 'active',
        completedJobs: 0,
        rating: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast(`Employee "${name}" added successfully!`, 'success');
      document.getElementById('add-employee-modal').classList.remove('show');
      document.getElementById('add-employee-form').reset();

    } catch (error) {
      console.error('Error adding employee:', error);
      if (error.code === 'auth/email-already-in-use') {
        showToast('An account with this email already exists.', 'error');
      } else {
        showToast('Failed to add employee: ' + error.message, 'error');
      }
    }
  });

  // ── Helpers ──
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});
