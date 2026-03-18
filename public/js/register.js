// API Base URL
const API_URL = '/api';

const registerForm = document.getElementById('registerForm');
const emailInput = document.getElementById('email');
const emailStatus = document.getElementById('emailStatus');
const errorDiv = document.getElementById('errorMessage');

let lastVerifiedEmail = null;
let lastVerification = null;
let verificationRequestId = 0;

function setEmailStatus(message, state = 'info') {
    emailStatus.textContent = message || '';
    emailStatus.className = 'email-status';

    if (message) {
        emailStatus.classList.add(state);
    }
}

async function verifyEmail(email, showLoading = true) {
    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail) {
        setEmailStatus('');
        return null;
    }

    if (trimmedEmail === lastVerifiedEmail && lastVerification) {
        return lastVerification;
    }

    verificationRequestId += 1;
    const currentRequestId = verificationRequestId;

    if (showLoading) {
        setEmailStatus('Checking email...', 'loading');
    }

    try {
        const response = await fetch(`${API_URL}/auth/verify-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: trimmedEmail })
        });

        const data = await response.json();
        if (currentRequestId !== verificationRequestId) {
            return null;
        }

        if (!response.ok || !data.success) {
            setEmailStatus(data.message || 'Email verification failed', 'error');
            return null;
        }

        const verification = data.verification;
        lastVerifiedEmail = trimmedEmail;
        lastVerification = verification;

        if (!verification.isValidSyntax || !verification.hasMxRecords || verification.exists === false) {
            setEmailStatus(data.message || 'Please enter a valid, reachable email address', 'error');
        } else if (!verification.isApiCheckPerformed) {
            setEmailStatus(data.message || 'Email domain is valid', 'info');
        } else {
            setEmailStatus('Email verified successfully', 'success');
        }

        return verification;
    } catch (error) {
        console.error('Email verification error:', error);
        if (currentRequestId === verificationRequestId) {
            setEmailStatus('Could not verify email right now', 'error');
        }
        return null;
    }
}

emailInput.addEventListener('input', () => {
    lastVerifiedEmail = null;
    lastVerification = null;
    setEmailStatus('');
});

emailInput.addEventListener('blur', async () => {
    await verifyEmail(emailInput.value);
});

// Register Form Handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate passwords match
    if (password !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.classList.add('show');
        return;
    }

    const verification = await verifyEmail(email, false);
    if (!verification) {
        errorDiv.textContent = 'Unable to verify your email right now. Please try again.';
        errorDiv.classList.add('show');
        return;
    }

    if (!verification.isValidSyntax || !verification.hasMxRecords || verification.exists === false) {
        errorDiv.textContent = 'Please provide an active email address before signing up.';
        errorDiv.classList.add('show');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Registration successful! Please login.');
            window.location.href = '/login';
        } else {
            errorDiv.textContent = data.message;
            errorDiv.classList.add('show');
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.add('show');
    }
});
