/**
 * Assessment Entry Point
 *
 * Handles:
 * - Explicit learner attestation requirement
 * - Assessment attempt initialization
 * - Secure redirect to scenario
 */

const form = document.querySelector('#assessmentAttestation');
const attestation = document.querySelector('#attestation');
const beginButton = document.querySelector('#beginAssessment');
const errorMessage = document.querySelector('#errorMessage');
const loading = document.querySelector('#loading');

// Enable button only when attestation is checked
attestation.addEventListener('change', () => {
  beginButton.disabled = !attestation.checked;
});

// Handle form submission
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!attestation.checked) {
    showError('You must agree to the assessment conditions.');
    return;
  }

  try {
    clearError();
    showLoading(true);

    // Get authentication token from Supabase
    // In production, this would be obtained from the authenticated session
    const token = getAuthToken();

    if (!token) {
      showError('Authentication required. Please log in and try again.');
      showLoading(false);
      return;
    }

    // POST to create assessment attempt
    const response = await fetch('/api/assessment-attempts/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify({
        delivery_mode: 'independent_non_proctored_assessment',
        learner_attestation: true,
        attestation_timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start assessment');
    }

    const { attempt_id, launch_url } = await response.json();

    // Store attempt ID for later reference
    sessionStorage.setItem('assessment_attempt_id', attempt_id);
    sessionStorage.setItem('delivery_mode', 'independent_non_proctored_assessment');

    // Redirect to assessment scenario
    // The scenario loader will read mode=assessment from URL
    window.location.assign(launch_url);
  } catch (err) {
    console.error('Assessment startup failed:', err);
    showError(err.message || 'Unable to start assessment. Please try again.');
    showLoading(false);
  }
});

/**
 * Get authentication token
 *
 * In a real implementation, this would:
 * 1. Check sessionStorage for existing token
 * 2. Retrieve from Supabase session if available
 * 3. Redirect to login if not authenticated
 */
function getAuthToken() {
  // For now, check localStorage for development
  // Production: Supabase session management
  const session = localStorage.getItem('sb-supabase-session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      return parsed.access_token;
    } catch (e) {
      console.warn('Failed to parse session:', e);
    }
  }

  // Fallback: Check sessionStorage
  return sessionStorage.getItem('auth_token');
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.classList.remove('active');
}

function showLoading(active) {
  if (active) {
    loading.classList.add('active');
    beginButton.disabled = true;
  } else {
    loading.classList.remove('active');
    beginButton.disabled = !attestation.checked;
  }
}
