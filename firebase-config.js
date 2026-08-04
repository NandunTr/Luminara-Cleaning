/* ========================================
   Luminara Cleanings — Firebase Configuration
   ========================================
   Replace the placeholder values below with
   your real Firebase project credentials from:
   https://console.firebase.google.com
   ======================================== */

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyC2GRuurhfvXSUGEjcyC8OKnnPI26cdwYA",
  authDomain: "luminara-cleanings.firebaseapp.com",
  databaseURL: "https://luminara-cleanings-default-rtdb.firebaseio.com",
  projectId: "luminara-cleanings",
  storageBucket: "luminara-cleanings.firebasestorage.app",
  messagingSenderId: "491760447285",
  appId: "1:491760447285:web:6e9fa30168bf7da950267c",
  measurementId: "G-G6TSFY2W1X"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// ──────────────────────────────────────
// Auth Helper Functions
// ──────────────────────────────────────

/**
 * Get current user's role from Firestore
 */
async function getUserRole(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      return doc.data().role;
    }
    return null;
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
}

/**
 * Create user document in Firestore
 */
async function createUserDoc(uid, data) {
  try {
    await db.collection('users').doc(uid).set({
      uid: uid,
      email: data.email,
      name: data.name || '',
      phone: data.phone || '',
      role: data.role || 'buyer',
      avatar: data.avatar || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error creating user doc:', error);
    throw error;
  }
}

/**
 * Redirect based on user role
 */
function redirectToDashboard(role) {
  switch (role) {
    case 'admin':
      window.location.href = 'admin-dashboard.html';
      break;
    case 'employee':
      window.location.href = 'employee-dashboard.html';
      break;
    case 'buyer':
    default:
      window.location.href = 'buyer-dashboard.html';
      break;
  }
}

/**
 * Auth guard — redirect to login if not authenticated
 */
function requireAuth(allowedRoles = []) {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'auth.html';
        reject('Not authenticated');
        return;
      }

      if (allowedRoles.length > 0) {
        const role = await getUserRole(user.uid);
        if (!allowedRoles.includes(role)) {
          window.location.href = 'auth.html';
          reject('Unauthorized role');
          return;
        }
        resolve({ user, role });
      } else {
        const role = await getUserRole(user.uid);
        resolve({ user, role });
      }
    });
  });
}

/**
 * Sign out and redirect to home
 */
async function signOutUser() {
  try {
    await auth.signOut();
    window.location.href = 'index.html';
  } catch (error) {
    console.error('Error signing out:', error);
  }
}

/**
 * Format Firestore timestamp to readable date
 */
function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">
      ${type === 'success' ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>' : 
        type === 'error' ? '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>' :
        '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" /></svg>'}
    </div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Generate a unique booking ID
 */
function generateBookingId() {
  return 'LUM-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();
}
