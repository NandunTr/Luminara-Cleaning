/* ========================================
   Luminara Cleanings — Employee Dashboard Logic
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let userData = null;
  let myEnrollments = new Set(); // Track bookingIds employee has enrolled in

  // ── Auth Guard ──
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = 'auth.html?role=employee'; return; }
    currentUser = user;

    const doc = await db.collection('users').doc(user.uid).get();
    userData = doc.exists ? doc.data() : {};

    if (userData.role !== 'employee') {
      window.location.href = 'auth.html?role=employee';
      return;
    }

    initDashboard();
  });

  function initDashboard() {
    document.getElementById('sidebar-user-name').textContent = userData.name || currentUser.email;
    document.getElementById('sidebar-avatar').textContent = (userData.name || currentUser.email).charAt(0).toUpperCase();

    // Load profile
    document.getElementById('profile-name').value = userData.name || '';
    document.getElementById('profile-email').value = userData.email || currentUser.email;
    document.getElementById('profile-phone').value = userData.phone || '';

    // Load data
    loadEnrollments();
    loadAvailableProjects();
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
    const panel = document.getElementById(`panel-${panelId}`);
    if (panel) panel.classList.add('active');

    const titles = { overview: 'Employee Dashboard', available: 'Available Projects', 'my-projects': 'My Projects', profile: 'My Profile' };
    document.getElementById('page-title').textContent = titles[panelId] || 'Employee Dashboard';

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

  // ── Load Enrollments ──
  function loadEnrollments() {
    db.collection('enrollments')
      .where('employeeId', '==', currentUser.uid)
      .onSnapshot((snapshot) => {
        const enrollments = [];
        myEnrollments = new Set();

        snapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          enrollments.push(data);
          myEnrollments.add(data.bookingId);
        });

        // Stats
        const enrolled = enrollments.filter(e => e.status === 'enrolled').length;
        const completed = enrollments.filter(e => e.status === 'completed').length;

        document.getElementById('stat-enrolled').textContent = enrolled;
        document.getElementById('stat-completed').textContent = completed;

        // Render my projects
        renderMyProjects(enrollments);

        // Re-render available projects to update enroll buttons
        loadAvailableProjects();
      });
  }

  // ── Load Available Projects ──
  function loadAvailableProjects() {
    db.collection('bookings')
      .where('visibleToEmployees', '==', true)
      .where('status', 'in', ['approved', 'in-progress'])
      .onSnapshot((snapshot) => {
        const projects = [];
        snapshot.forEach(doc => projects.push({ id: doc.id, ...doc.data() }));

        // Count available (not full)
        const available = projects.filter(p => (p.employeesEnrolled || 0) < (p.employeesNeeded || 2)).length;
        document.getElementById('stat-available').textContent = available;

        const badge = document.getElementById('available-count');
        if (available > 0) { badge.textContent = available; badge.style.display = 'inline'; }
        else badge.style.display = 'none';

        renderProjectCards(projects, 'available-projects-container');
        renderProjectCards(projects.slice(0, 3), 'overview-projects');
      });
  }

  function renderProjectCards(projects, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (projects.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No available projects</h3><p>Check back later for new cleaning assignments.</p></div>';
      return;
    }

    const serviceLabels = { residential: 'Residential Cleaning', commercial: 'Commercial & Office', specialized: 'Specialized Services' };

    let html = '<div class="projects-grid">';

    projects.forEach(p => {
      const needed = p.employeesNeeded || 2;
      const enrolled = p.employeesEnrolled || 0;
      const isFull = enrolled >= needed;
      const isEnrolled = myEnrollments.has(p.id);
      const fillPercent = Math.min((enrolled / needed) * 100, 100);

      html += `
        <div class="project-card ${isFull ? 'full' : ''}">
          <div class="project-card-header">
            <span class="project-type">${serviceLabels[p.serviceType] || p.serviceType || 'Cleaning'}</span>
            ${isFull ? '<span class="badge badge-full">FULL</span>' : '<span class="badge badge-open">Open</span>'}
          </div>
          <h3>${capitalize(p.propertyType || 'Property')} Cleaning</h3>
          <div class="project-detail">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
            ${p.preferredDate || '—'} at ${p.preferredTime || '—'}
          </div>
          <div class="project-detail">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
            ${p.address || 'Address TBD'}
          </div>
          <div class="project-detail">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
            Client: ${p.buyerName || 'Anonymous'}
          </div>

          <div class="enrollment-bar">
            <div class="enrollment-bar-label">
              <span>Spots</span>
              <span class="count">${enrolled}/${needed} filled</span>
            </div>
            <div class="enrollment-bar-track">
              <div class="enrollment-bar-fill ${isFull ? 'full' : ''}" style="width: ${fillPercent}%"></div>
            </div>
          </div>

          <div class="project-card-actions">
            ${isEnrolled ? `
              <button class="btn-dashboard btn-secondary-d" disabled style="flex:1;opacity:0.7;">
                ✓ Already Enrolled
              </button>
            ` : isFull ? `
              <button class="btn-dashboard btn-secondary-d" disabled style="flex:1;opacity:0.5;">
                No Spots Available
              </button>
            ` : `
              <button class="btn-dashboard btn-primary-d" style="flex:1;" onclick="enrollInProject('${p.id}')">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Enroll
              </button>
            `}
          </div>
        </div>
      `;
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // ── Enroll in Project ──
  window.enrollInProject = async function(bookingId) {
    try {
      // Get the booking to check capacity
      const bookingRef = db.collection('bookings').doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) {
        showToast('Project not found.', 'error');
        return;
      }

      const booking = bookingDoc.data();
      const needed = booking.employeesNeeded || 2;
      const enrolled = booking.employeesEnrolled || 0;

      if (enrolled >= needed) {
        showToast('This project is already full!', 'error');
        return;
      }

      // Check if already enrolled
      const existingEnrollment = await db.collection('enrollments')
        .where('bookingId', '==', bookingId)
        .where('employeeId', '==', currentUser.uid)
        .get();

      if (!existingEnrollment.empty) {
        showToast('You are already enrolled in this project.', 'error');
        return;
      }

      // Create enrollment
      const batch = db.batch();

      // Add enrollment document
      const enrollmentRef = db.collection('enrollments').doc();
      batch.set(enrollmentRef, {
        bookingId: bookingId,
        employeeId: currentUser.uid,
        employeeName: userData.name || currentUser.email,
        status: 'enrolled',
        enrolledAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Increment enrolled count on booking
      batch.update(bookingRef, {
        employeesEnrolled: firebase.firestore.FieldValue.increment(1)
      });

      await batch.commit();

      showToast('Successfully enrolled in project!', 'success');
    } catch (error) {
      console.error('Enrollment error:', error);
      showToast('Failed to enroll. Please try again.', 'error');
    }
  };

  // ── Render My Projects ──
  function renderMyProjects(enrollments) {
    const container = document.getElementById('my-projects-body');
    if (!container) return;

    if (enrollments.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No enrolled projects</h3><p>Browse available projects and enroll to get started!</p></div>';
      return;
    }

    // Fetch booking details for each enrollment
    const bookingPromises = enrollments.map(e =>
      db.collection('bookings').doc(e.bookingId).get().then(doc => ({
        enrollment: e,
        booking: doc.exists ? doc.data() : null
      }))
    );

    Promise.all(bookingPromises).then(results => {
      let html = `<table class="data-table"><thead><tr>
        <th>Project</th><th>Service</th><th>Date</th><th>Location</th><th>Status</th><th>Actions</th>
      </tr></thead><tbody>`;

      results.forEach(({ enrollment, booking }) => {
        if (!booking) return;

        html += `<tr>
          <td><strong>${booking.bookingId || enrollment.bookingId}</strong></td>
          <td>${capitalize(booking.serviceType || '—')}</td>
          <td>${booking.preferredDate || '—'}</td>
          <td>${booking.address || '—'}</td>
          <td><span class="badge badge-${enrollment.status}">${capitalize(enrollment.status)}</span></td>
          <td>
            ${enrollment.status === 'enrolled' ? `
              <button class="btn-dashboard btn-gold-d btn-sm-d" onclick="markCompleted('${enrollment.id}', '${enrollment.bookingId}')">Mark Complete</button>
            ` : '—'}
          </td>
        </tr>`;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    });
  }

  // ── Mark Project Completed ──
  window.markCompleted = async function(enrollmentId, bookingId) {
    try {
      await db.collection('enrollments').doc(enrollmentId).update({ status: 'completed' });

      // Optionally update user stats
      await db.collection('users').doc(currentUser.uid).update({
        completedJobs: firebase.firestore.FieldValue.increment(1)
      });

      showToast('Project marked as completed! Great work!', 'success');
    } catch (error) {
      console.error('Error marking complete:', error);
      showToast('Failed to update status.', 'error');
    }
  };

  // ── Profile Form ──
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
        document.getElementById('sidebar-user-name').textContent = userData.name;
        document.getElementById('sidebar-avatar').textContent = userData.name.charAt(0).toUpperCase();
        showToast('Profile updated!', 'success');
      } catch (error) {
        showToast('Failed to update profile.', 'error');
      }
    });
  }

  // ── Helper ──
  function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
});
