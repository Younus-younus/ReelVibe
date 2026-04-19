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

// Password validation regex and function
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;

function validatePasswordFormat(password) {
    if (!password) return { valid: false, errors: [] };
    
    const errors = [];
    if (password.length < 8) errors.push('length');
    if (!/[A-Z]/.test(password)) errors.push('capital');
    if (!/[0-9]/.test(password)) errors.push('number');
    if (!/[!@#$%^&*]/.test(password)) errors.push('special');
    
    return { valid: errors.length === 0, errors };
}

function updatePasswordRequirements(password) {
    const requirements = {
        'req-length': password.length >= 8,
        'req-capital': /[A-Z]/.test(password),
        'req-number': /[0-9]/.test(password),
        'req-special': /[!@#$%^&*]/.test(password)
    };
    
    Object.entries(requirements).forEach(([id, met]) => {
        const element = document.getElementById(id);
        if (element) {
            if (met) {
                element.classList.remove('unmet');
                element.classList.add('met');
            } else {
                element.classList.remove('met');
                element.classList.add('unmet');
            }
        }
    });
}

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

// Password input event listener
passwordInput.addEventListener('input', () => {
    updatePasswordRequirements(passwordInput.value);
});

// Register Form Handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    errorDiv.textContent = '';
    errorDiv.classList.remove('show');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!otpSent && (!name || !email || !password.trim() || !confirmPassword.trim())) {
        errorDiv.textContent = 'All fields are required';
        errorDiv.classList.add('show');
        return;
    }

    if (otpSent && !otpInput.value.trim()) {
        errorDiv.textContent = 'OTP is required';
        errorDiv.classList.add('show');
        return;
    }

    if (!otpSent) {
        if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.classList.add('show');
            return;
        }

        // Validate password format
        const passwordValidation = validatePasswordFormat(password);
        if (!passwordValidation.valid) {
            let errorMsg = 'Password must have: ';
            const requirementMessages = {
                'length': 'minimum 8 characters',
                'capital': 'Capital letter',
                'number': 'Numbers',
                'special': 'Special symbol (!@#$%^&*)'
            };
            
            const missing = passwordValidation.errors.map(err => requirementMessages[err]).join(', ');
            errorDiv.textContent = 'Password requirements not met: ' + missing;
            errorDiv.classList.add('show');
            return;
        }
    }
    
    try {
        const endpoint = otpSent ? `${API_URL}/auth/verify-registration-otp` : `${API_URL}/auth/send-registration-otp`;
        const payload = otpSent
            ? { email, otp: otpInput.value.trim() }
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
