// API Base URL
const API_URL = '/api';

const registerForm = document.getElementById('registerForm');
const emailStatus = document.getElementById('emailStatus');
const errorDiv = document.getElementById('errorMessage');
const otpGroup = document.getElementById('otpGroup');
const otpInput = document.getElementById('otp');
const submitBtn = document.getElementById('registerSubmitBtn');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirmPassword');

let otpSent = false;

function setEmailStatus(message, state = 'info') {
    emailStatus.textContent = message || '';
    emailStatus.className = 'email-status';

    if (message) {
        emailStatus.classList.add(state);
    }
}

function updateOtpUiState() {
    otpGroup.classList.toggle('show', otpSent);
    otpInput.required = otpSent;
    submitBtn.textContent = otpSent ? 'Verify OTP & Sign Up' : 'Send OTP';

    nameInput.readOnly = otpSent;
    emailInput.readOnly = otpSent;
    passwordInput.readOnly = otpSent;
    confirmPasswordInput.readOnly = otpSent;
}

updateOtpUiState();

// Register Form Handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    const name = nameInput.value;
    const email = emailInput.value;
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!otpSent) {
        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.classList.add('show');
            return;
        }
    }
    
    try {
        const endpoint = otpSent ? `${API_URL}/auth/verify-registration-otp` : `${API_URL}/auth/send-registration-otp`;
        const payload = otpSent
            ? { email, otp: otpInput.value }
            : { name, email, password };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (!data.success) {
            errorDiv.textContent = data.message;
            errorDiv.classList.add('show');
            return;
        }

        if (!otpSent) {
            otpSent = true;
            updateOtpUiState();
            setEmailStatus(data.message || 'OTP sent. Please check your email.', 'success');
            return;
        }

        alert('Registration successful! Please login.');
        window.location.href = '/login';
    } catch (error) {
        console.error('Registration error:', error);
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.add('show');
    }
});
