// API Base URL
const API_URL = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));
let userSubscriptionPlan = 'free'; // Global variable to store user's subscription plan

// Check authentication
if (!token || !currentUser) {
    window.location.href = '/login';
}

// Redirect admin to admin dashboard
if (currentUser.role === 'admin') {
    window.location.href = '/admin-dashboard';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeUserMenu();
    initializeMobileNav();
    loadUserProfile();
    loadContent();
    setupEventListeners();
});

function initializeMobileNav() {
    const dashboardNav = document.querySelector('.dashboard-nav');
    const toggleBtn = document.getElementById('mobileNavToggle');

    if (!dashboardNav || !toggleBtn) {
        return;
    }

    const closeMobileNav = () => {
        dashboardNav.classList.remove('mobile-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
    };

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dashboardNav.classList.toggle('mobile-open');
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dashboard-nav')) {
            closeMobileNav();
        }
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            closeMobileNav();
        }
    });

    document.querySelectorAll('.nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeMobileNav();
            }
        });
    });
}

// Initialize user menu
function initializeUserMenu() {
    const userInitials = document.getElementById('userInitials');
    const userName = document.getElementById('userName');
    
    if (currentUser.name) {
        const initials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
        userInitials.textContent = initials;
        userName.textContent = currentUser.name;
    }
    
    // Toggle dropdown
    document.getElementById('userMenuBtn').addEventListener('click', () => {
        document.getElementById('userDropdown').classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu')) {
            document.getElementById('userDropdown').classList.remove('show');
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            switchSection(section);
            
            // Update active nav
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Profile menu item in dropdown
    document.querySelectorAll('.dropdown-item[data-section]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
            document.getElementById('userDropdown').classList.remove('show');
            document.querySelector('.dashboard-nav')?.classList.remove('mobile-open');
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        });
    });
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    });
    
    // Search
    document.getElementById('searchBtn').addEventListener('click', () => {
        performSearch();
    });
    
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // Filters
    document.getElementById('filterType').addEventListener('change', loadContent);
    document.getElementById('filterGenre').addEventListener('change', loadContent);
    document.getElementById('movieGenreFilter').addEventListener('change', () => loadMovies());
    document.getElementById('musicGenreFilter').addEventListener('change', () => loadMusic());
    
    // Profile forms
    document.getElementById('profileForm').addEventListener('submit', updateProfile);
    document.getElementById('passwordForm').addEventListener('submit', changePassword);

    // Membership cancel action from profile page
    document.getElementById('cancelMembershipBtn').addEventListener('click', cancelMembershipFromProfile);
    
    // Close player modal
    document.getElementById('closePlayer').addEventListener('click', closePlayer);
}

// Switch sections
function switchSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    switch(section) {
        case 'browse':
            document.getElementById('browseSection').classList.add('active');
            loadContent();
            break;
        case 'movies':
            document.getElementById('moviesSection').classList.add('active');
            loadMovies();
            break;
        case 'music':
            document.getElementById('musicSection').classList.add('active');
            loadMusic();
            break;
        case 'history':
            document.getElementById('historySection').classList.add('active');
            loadHistory();
            break;
        case 'subscription':
            document.getElementById('subscriptionSection').classList.add('active');
            loadSubscription();
            break;
        case 'profile':
            document.getElementById('profileSection').classList.add('active');
            loadProfileSection();
            break;
    }
}

async function loadProfileSection() {
    await Promise.all([loadUserProfile(), loadProfileSubscriptionStatus()]);
}

// Load user profile
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            document.getElementById('profileName').value = data.user.name;
            document.getElementById('profileEmail').value = data.user.email;

            // About user block in profile section
            document.getElementById('aboutUserName').textContent = data.user.name || 'N/A';
            document.getElementById('aboutUserEmail').textContent = data.user.email || 'N/A';
            document.getElementById('aboutUserRole').textContent = data.user.role || 'user';
            document.getElementById('aboutUserJoined').textContent = data.user.created_at
                ? new Date(data.user.created_at).toLocaleDateString()
                : 'N/A';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadProfileSubscriptionStatus() {
    try {
        const response = await fetch(`${API_URL}/subscriptions/my-subscription`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();
        const statusContainer = document.getElementById('profileSubscriptionStatus');
        const cancelBtn = document.getElementById('cancelMembershipBtn');

        if (data.success && data.subscription) {
            const sub = data.subscription;
            const planName = (sub.plan_name || 'free').toLowerCase();

            userSubscriptionPlan = planName;

            statusContainer.innerHTML = `
                <p><strong>Current Plan:</strong> ${planName.toUpperCase()}</p>
                <p><strong>Status:</strong> ${sub.status}</p>
                <p><strong>Start Date:</strong> ${new Date(sub.start_date).toLocaleDateString()}</p>
                <p><strong>End Date:</strong> ${sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}</p>
            `;

            // Allow direct cancel only for active premium memberships
            cancelBtn.style.display = (planName === 'premium' && sub.status === 'active') ? 'inline-block' : 'none';
        } else {
            userSubscriptionPlan = 'free';
            statusContainer.innerHTML = '<p>No active subscription found.</p>';
            cancelBtn.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading profile subscription status:', error);
    }
}

// Load content (Browse)
async function loadContent() {
    const container = document.getElementById('browseContent');
    container.innerHTML = '<div class="loading">Loading content...</div>';
    
    const filterType = document.getElementById('filterType').value;
    const genre = document.getElementById('filterGenre').value;
    
    try {
        let content = [];
        
        if (filterType === 'all' || filterType === 'movies') {
            const movies = await fetchMovies(genre);
            content.push(...movies.map(m => ({ ...m, type: 'movie' })));
        }
        
        if (filterType === 'all' || filterType === 'music') {
            const music = await fetchMusic(genre);
            content.push(...music.map(m => ({ ...m, type: 'music' })));
        }
        
        if (content.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No content available</p></div>';
            return;
        }
        
        container.innerHTML = content.map(item => createContentCard(item)).join('');
        
        // Add click handlers
        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent(content[index]));
        });
    } catch (error) {
        console.error('Error loading content:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading content</p></div>';
    }
}

// Load movies
async function loadMovies() {
    const container = document.getElementById('moviesContent');
    container.innerHTML = '<div class="loading">Loading movies...</div>';
    
    const genre = document.getElementById('movieGenreFilter').value;
    
    try {
        const movies = await fetchMovies(genre);
        
        console.log('Load Movies - Total movies fetched:', movies.length);
        console.log('Load Movies - Current user plan:', userSubscriptionPlan);
        
        if (movies.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎬</div><p>No movies available</p></div>';
            return;
        }
        
        container.innerHTML = movies.map(movie => createContentCard({ ...movie, type: 'movie' })).join('');
        
        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent({ ...movies[index], type: 'movie' }));
        });
    } catch (error) {
        console.error('Error loading movies:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading movies</p></div>';
    }
}

// Load music
async function loadMusic() {
    const container = document.getElementById('musicContent');
    container.innerHTML = '<div class="loading">Loading music...</div>';
    
    const genre = document.getElementById('musicGenreFilter').value;
    
    try {
        const music = await fetchMusic(genre);
        
        if (music.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎵</div><p>No music available</p></div>';
            return;
        }
        
        container.innerHTML = music.map(item => createContentCard({ ...item, type: 'music' })).join('');
        
        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent({ ...music[index], type: 'music' }));
        });
    } catch (error) {
        console.error('Error loading music:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading music</p></div>';
    }
}

// Fetch movies
async function fetchMovies(genre = '') {
    const url = genre ? `${API_URL}/movies?genre=${genre}` : `${API_URL}/movies`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    console.log('Fetch Movies Response:', data);
    console.log('Number of movies:', data.movies?.length);
    console.log('User Plan:', data.userPlan);
    
    // Store user's subscription plan from response
    if (data.userPlan) {
        userSubscriptionPlan = data.userPlan;
    }
    
    // Load genres for filter
    const genreResponse = await fetch(`${API_URL}/movies/genres`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const genreData = await genreResponse.json();
    if (genreData.success) {
        updateGenreFilters('movie', genreData.genres);
    }
    
    return data.success ? data.movies : [];
}

// Fetch music
async function fetchMusic(genre = '') {
    const url = genre ? `${API_URL}/music?genre=${genre}` : `${API_URL}/music`;
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
    
    // Store user's subscription plan from response
    if (data.userPlan) {
        userSubscriptionPlan = data.userPlan;
    }
    
    // Load genres for filter
    const genreResponse = await fetch(`${API_URL}/music/genres`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const genreData = await genreResponse.json();
    if (genreData.success) {
        updateGenreFilters('music', genreData.genres);
    }
    
    return data.success ? data.music : [];
}

// Update genre filters
function updateGenreFilters(type, genres) {
    const filterIds = type === 'movie' 
        ? ['filterGenre', 'movieGenreFilter']
        : ['filterGenre', 'musicGenreFilter'];
    
    filterIds.forEach(id => {
        const select = document.getElementById(id);
        if (select && select.options.length <= 1) {
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                select.appendChild(option);
            });
        }
    });
}

// Create content card
function createContentCard(item) {
    const posterUrl = item.poster_url || 'https://via.placeholder.com/200x300?text=No+Image';
    const title = item.title;
    const meta = item.type === 'movie' 
        ? `${item.genre || 'Unknown'} • ${item.release_year || 'N/A'} • ⭐ ${item.rating || 'N/A'}`
        : `${item.artist || 'Unknown'} • ${item.genre || 'Unknown'}`;
    
    // Check if user has access to this content
    const requiredPlan = item.subscription_required === 'basic' ? 'premium' : item.subscription_required;
    const hasAccess = 
        requiredPlan === 'free' ||
        (userSubscriptionPlan === 'premium');
    
    // Show lock icon if user doesn't have access
    const lockIcon = !hasAccess ? '<div class="lock-overlay">🔒</div>' : '';
    
    const badge = requiredPlan !== 'free' 
        ? `<span class="subscription-badge ${!hasAccess ? 'locked' : ''}">${requiredPlan}</span>`
        : '';
    
    return `
        <div class="content-card ${!hasAccess ? 'locked-content' : ''}" data-id="${item.id}">
            ${badge}
            ${lockIcon}
            <img src="${posterUrl}" alt="${title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            <div class="content-card-info">
                <div class="content-card-title">${title}</div>
                <div class="content-card-meta">${meta}</div>
            </div>
        </div>
    `;
}

// Play content
async function playContent(item) {
    try {
        const type = item.type;
        const endpoint = type === 'movie' ? 'movies' : 'music';
        
        const response = await fetch(`${API_URL}/${endpoint}/${item.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success) {
            // Show subscription upgrade message if access denied
            if (response.status === 403) {
                const requiredPlan = (data.requiredPlan || item.subscription_required || 'premium') === 'basic'
                    ? 'premium'
                    : (data.requiredPlan || item.subscription_required || 'premium');
                alert(`🔒 ${data.message}\n\nThis content requires ${requiredPlan.toUpperCase()} subscription.\nPlease visit the Subscription page to upgrade.`);
            } else {
                alert(data.message);
            }
            return;
        }
        
        const content = data.movie || data.music;
        const playerContainer = document.getElementById('playerContainer');
        
        if (type === 'movie') {
            playerContainer.innerHTML = `
                <h2>${content.title}</h2>
                <p>${content.description || ''}</p>
                <video controls autoplay>
                    <source src="${content.video_url}" type="video/mp4">
                    Your browser does not support video playback.
                </video>
            `;
        } else {
            playerContainer.innerHTML = `
                <h2>${content.title}</h2>
                <p>Artist: ${content.artist || 'Unknown'}</p>
                <img src="${content.poster_url}" alt="${content.title}" style="max-width: 400px; border-radius: 8px; margin: 1rem 0;">
                <audio controls autoplay>
                    <source src="${content.audio_url}" type="audio/mpeg">
                    Your browser does not support audio playback.
                </audio>
            `;
        }
        
        document.getElementById('playerModal').classList.add('show');
    } catch (error) {
        console.error('Error playing content:', error);
        alert('Error loading content');
    }
}

// Close player
function closePlayer() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('show');
    
    // Stop playback
    const video = modal.querySelector('video');
    const audio = modal.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
}

// Load history
async function loadHistory() {
    const container = document.getElementById('historyContent');
    container.innerHTML = '<div class="loading">Loading history...</div>';
    
    try {
        const response = await fetch(`${API_URL}/users/watch-history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success || data.history.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📺</div><p>No watch history yet</p></div>';
            return;
        }
        
        container.innerHTML = data.history.map(item => {
            const title = item.movie_title || item.music_title;
            const poster = item.movie_poster || item.music_poster;
            const type = item.movie_id ? 'Movie' : 'Music';
            const date = new Date(item.watched_at).toLocaleDateString();
            
            return `
                <div class="history-item">
                    <img src="${poster}" alt="${title}" onerror="this.src='https://via.placeholder.com/80?text=No+Image'">
                    <div class="history-info">
                        <div class="history-title">${title}</div>
                        <div class="history-meta">${type} • Watched on ${date}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading history:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading history</p></div>';
    }
}

// Load subscription
async function loadSubscription() {
    try {
        // Load current subscription
        const subResponse = await fetch(`${API_URL}/subscriptions/my-subscription`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const subData = await subResponse.json();
        
        const currentPlanDiv = document.getElementById('currentPlan');
        if (subData.success && subData.subscription) {
            const sub = subData.subscription;
            currentPlanDiv.innerHTML = `
                <h4>${sub.plan_name.toUpperCase()}</h4>
                <p class="price">$${sub.price}/month</p>
                <p>${sub.description}</p>
                <p>Status: <strong>${sub.status}</strong></p>
                ${sub.end_date ? `<p>Expires: ${new Date(sub.end_date).toLocaleDateString()}</p>` : ''}
            `;
        } else {
            currentPlanDiv.innerHTML = '<p>No active subscription</p>';
        }
        
        // Load available plans
        const plansResponse = await fetch(`${API_URL}/subscriptions/plans`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const plansData = await plansResponse.json();
        
        if (plansData.success) {
            const plansGrid = document.getElementById('availablePlans');
            plansGrid.innerHTML = plansData.plans.map(plan => {
                const isCurrent = subData.subscription?.plan_id === plan.id;
                const isPaid    = parseFloat(plan.price) > 0;
                const btnLabel  = isCurrent
                    ? 'Current Plan'
                    : isPaid ? '💳 Pay & Upgrade' : 'Switch to Free';
                const btnDisabled = isCurrent ? 'disabled' : '';
                const priceLabel = parseFloat(plan.price) === 0
                    ? 'Free'
                    : `₹${parseFloat(plan.price).toFixed(2)}<span>/month</span>`;
                return `
                <div class="plan-card${isCurrent ? ' current-active-plan' : ''}">
                    <h4>${plan.name.toUpperCase()}</h4>
                    <p class="price">${priceLabel}</p>
                    <p>${plan.description}</p>
                    ${isPaid && !isCurrent ? '<p class="payment-note"><small>🔒 Secure payment via Razorpay</small></p>' : ''}
                    <button class="btn btn-primary" onclick="subscribeToPlan(${plan.id}, ${plan.price}, '${plan.name.toUpperCase()}')" ${btnDisabled}>
                        ${btnLabel}
                    </button>
                </div>`;
            }).join('');
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

// Subscribe to plan
// price > 0  → premium: opens Razorpay in-page checkout modal
// price === 0 → free: direct subscribe (no payment)
async function subscribeToPlan(planId, price, planName) {
    const isPaid = parseFloat(price) > 0;

    if (isPaid) {
        try {
            // Step 1: Create a Razorpay order on the backend
            const orderRes = await fetch(`${API_URL}/payments/create-order`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan_id: planId })
            });
            const orderData = await orderRes.json();

            if (!orderData.success) {
                alert(orderData.message || 'Could not initiate payment. Please try again.');
                return;
            }

            // Step 2: Open the Razorpay checkout modal
            const options = {
                key:         orderData.key_id,
                amount:      orderData.amount,
                currency:    orderData.currency,
                name:        'ReelVibe',
                description: `${planName} Plan – 1 Month Access`,
                image:       '/favicon.ico',
                order_id:    orderData.order_id,
                prefill: {
                    name:  currentUser?.name  || '',
                    email: currentUser?.email || '',
                },
                theme: { color: '#e50914' },

                // Step 3: On successful payment, verify signature on the backend
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch(`${API_URL}/payments/verify-payment`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                razorpay_order_id:   response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature:  response.razorpay_signature,
                                plan_id:             planId,
                            })
                        });
                        const verifyData = await verifyRes.json();

                        if (verifyData.success) {
                            alert('🎉 ' + verifyData.message);
                            loadSubscription();
                            loadProfileSubscriptionStatus();
                        } else {
                            alert('Payment received but activation failed: ' + verifyData.message);
                        }
                    } catch (err) {
                        console.error('Verify payment error:', err);
                        alert('Payment received but verification failed. Please contact support.');
                    }
                },

                modal: {
                    ondismiss: function () {
                        // User closed the modal without paying — no action needed
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response) {
                alert('Payment failed: ' + (response.error.description || 'Unknown error'));
            });
            rzp.open();

        } catch (error) {
            console.error('Error opening Razorpay checkout:', error);
            alert('Error initiating payment. Please try again.');
        }

    } else {
        // Free plan – direct subscribe (no payment needed)
        if (!confirm('Switch to the Free plan? Premium access will be removed.')) return;

        try {
            const response = await fetch(`${API_URL}/subscriptions/subscribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ plan_id: planId })
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message);
                loadSubscription();
                loadProfileSubscriptionStatus();
            } else {
                alert(data.message);
            }
        } catch (error) {
            console.error('Error subscribing:', error);
            alert('Error processing subscription');
        }
    }
}

async function cancelMembershipFromProfile() {
    if (!confirm('Are you sure you want to cancel your membership?')) return;

    try {
        const response = await fetch(`${API_URL}/subscriptions/cancel`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            alert(data.message);
            userSubscriptionPlan = 'free';
            await Promise.all([loadProfileSubscriptionStatus(), loadSubscription(), loadContent()]);
        } else {
            alert(data.message || 'Unable to cancel membership');
        }
    } catch (error) {
        console.error('Error cancelling membership from profile:', error);
        alert('Error cancelling membership');
    }
}

// Update profile
async function updateProfile(e) {
    e.preventDefault();
    
    const name = document.getElementById('profileName').value;
    const email = document.getElementById('profileEmail').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Profile updated successfully');
            currentUser.name = name;
            currentUser.email = email;
            localStorage.setItem('user', JSON.stringify(currentUser));
            initializeUserMenu();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile');
    }
}

// Change password
async function changePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('Password changed successfully');
            document.getElementById('passwordForm').reset();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error changing password:', error);
        alert('Error changing password');
    }
}

// Perform search
async function performSearch() {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    
    switchSection('browse');
    
    const container = document.getElementById('browseContent');
    container.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const [moviesRes, musicRes] = await Promise.all([
            fetch(`${API_URL}/movies?search=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/music?search=${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        
        const moviesData = await moviesRes.json();
        const musicData = await musicRes.json();
        
        const content = [
            ...(moviesData.movies || []).map(m => ({ ...m, type: 'movie' })),
            ...(musicData.music || []).map(m => ({ ...m, type: 'music' }))
        ];
        
        if (content.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No results found for "${query}"</p></div>`;
            return;
        }
        
        container.innerHTML = content.map(item => createContentCard(item)).join('');
        
        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent(content[index]));
        });
    } catch (error) {
        console.error('Error searching:', error);
        container.innerHTML = '<div class="empty-state"><p>Error performing search</p></div>';
    }
}

// Make subscribeToPlan available globally
window.subscribeToPlan = subscribeToPlan;
