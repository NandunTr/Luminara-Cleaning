/* ========================================
   Luminara Cleanings — Auth Logic
   Firebase Authentication
   ======================================== */

document.addEventListener('DOMContentLoaded', () => {
  // ── Elements ──
  const authTabs = document.querySelectorAll('.auth-tab');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authError = document.getElementById('auth-error');
  const modeToggle = document.getElementById('auth-mode-toggle');
  const authDivider = document.getElementById('auth-divider');
  const googleBtn = document.getElementById('google-signin-btn');
  const footerText = document.getElementById('auth-footer-text');
  const switchLink = document.getElementById('auth-switch-link');
  const forgotLink = document.getElementById('forgot-password-link');

  let currentRole = 'buyer';
  let currentMode = 'login';

  // ── Read role from URL params ──
  const urlParams = new URLSearchParams(window.location.search);
  const roleParam = urlParams.get('role');
  if (roleParam && ['buyer', 'employee', 'admin'].includes(roleParam)) {
    currentRole = roleParam;
  }

  // ── Initialize tab state ──
  setActiveTab(currentRole);

  // ── If user is already logged in, redirect ──
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      const role = await getUserRole(user.uid);
      if (role) {
        redirectToDashboard(role);
      }
    }
  });

  // ── Tab Switching ──
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentRole = tab.dataset.role;
      setActiveTab(currentRole);
      hideError();
    });
  });

  function setActiveTab(role) {
    authTabs.forEach(t => t.classList.remove('active'));
    const activeTab = document.querySelector(`[data-role="${role}"]`);
    if (activeTab) activeTab.classList.add('active');

    // Only buyers can sign up; employees & admins can only login
    if (role === 'buyer') {
      modeToggle.style.display = 'flex';
      authDivider.style.display = 'flex';
      googleBtn.style.display = 'flex';
      footerText.style.display = 'block';
      setMode(currentMode);
    } else {
      modeToggle.style.display = 'none';
      signupForm.style.display = 'none';
      loginForm.style.display = 'block';
      authDivider.style.display = 'none';
      googleBtn.style.display = 'none';
      footerText.style.display = 'none';
      currentMode = 'login';
    }
  }

  // ── Mode Switching (Login / Sign Up) ──
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentMode = btn.dataset.mode;
      setMode(currentMode);
      hideError();
    });
  });

  if (switchLink) {
    switchLink.addEventListener('click', (e) => {
      e.preventDefault();
      currentMode = currentMode === 'login' ? 'signup' : 'login';
      setMode(currentMode);
      hideError();
    });
  }

  function setMode(mode) {
    modeBtns.forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-mode="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      signupForm.style.display = 'none';
      footerText.innerHTML = `Don't have an account? <a href="#" id="auth-switch-link">Create one</a>`;
    } else {
      loginForm.style.display = 'none';
      signupForm.style.display = 'block';
      footerText.innerHTML = `Already have an account? <a href="#" id="auth-switch-link">Sign in</a>`;
    }

    // Re-bind the switch link
    const newSwitch = document.getElementById('auth-switch-link');
    if (newSwitch) {
      newSwitch.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = currentMode === 'login' ? 'signup' : 'login';
        setMode(currentMode);
        hideError();
      });
    }
  }

  // ── Error Handling ──
  function showError(message) {
    authError.textContent = message;
    authError.classList.add('show');
  }

  function hideError() {
    authError.classList.remove('show');
  }

  function setLoading(form, loading) {
    const btn = form.querySelector('.auth-submit-btn');
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');

    if (loading) {
      text.style.display = 'none';
      loader.style.display = 'inline-flex';
      btn.disabled = true;
    } else {
      text.style.display = 'inline';
      loader.style.display = 'none';
      btn.disabled = false;
    }
  }

  // ── Login Form Submission ──
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    setLoading(loginForm, true);

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
      const role = await getUserRole(userCredential.user.uid);

      if (!role) {
        showError('Account not found. Please contact support.');
        setLoading(loginForm, false);
        return;
      }

      // Validate role matches tab selection
      if (currentRole !== 'buyer' && role !== currentRole) {
        showError(`This account is registered as "${role}". Please select the correct tab.`);
        await auth.signOut();
        setLoading(loginForm, false);
        return;
      }

      redirectToDashboard(role);
    } catch (error) {
      const errorMessages = {
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password. Please try again.',
        'auth/invalid-email': 'Please enter a valid email address.',
        'auth/too-many-requests': 'Too many attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid credentials. Please check your email and password.',
      };
      showError(errorMessages[error.code] || error.message);
      setLoading(loginForm, false);
    }
  });

  // ── Sign Up Form Submission ──
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    setLoading(signupForm, true);

    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;

    try {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);

      // Update display name
      await userCredential.user.updateProfile({ displayName: name });

      // Create Firestore user document
      await createUserDoc(userCredential.user.uid, {
        email: email,
        name: name,
        phone: phone,
        role: 'buyer', // Sign-up is always buyer
      });

      redirectToDashboard('buyer');
    } catch (error) {
      const errorMessages = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/invalid-email': 'Please enter a valid email address.',
      };
      showError(errorMessages[error.code] || error.message);
      setLoading(signupForm, false);
    }
  });

  // ── Google Sign In ──
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      hideError();

      try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;

        // Check if user doc exists
        const existingDoc = await db.collection('users').doc(user.uid).get();
        if (!existingDoc.exists) {
          // Create new user doc for Google sign-in
          await createUserDoc(user.uid, {
            email: user.email,
            name: user.displayName || '',
            phone: user.phoneNumber || '',
            role: 'buyer',
            avatar: user.photoURL || '',
          });
        }

        const role = await getUserRole(user.uid);
        redirectToDashboard(role || 'buyer');
      } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
          showError(error.message);
        }
      }
    });
  }

  // ── Forgot Password ──
  if (forgotLink) {
    forgotLink.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;

      if (!email) {
        showError('Please enter your email address first.');
        return;
      }

      try {
        await auth.sendPasswordResetEmail(email);
        hideError();
        authError.textContent = '✓ Password reset email sent! Check your inbox.';
        authError.style.background = '#e8f5ee';
        authError.style.borderColor = '#a7d8b8';
        authError.style.color = '#1a5c38';
        authError.classList.add('show');
      } catch (error) {
        showError('Could not send reset email. Please check the email address.');
      }
    });
  }
});
