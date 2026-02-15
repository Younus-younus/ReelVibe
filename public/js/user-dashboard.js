// API Base URL
const API_URL = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));

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
    loadUserProfile();
    loadContent();
    setupEventListeners();
});

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
            loadUserProfile();
            break;
    }
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
        }
    } catch (error) {
        console.error('Error loading profile:', error);
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
    
    const badge = item.subscription_required !== 'free' 
        ? `<span class="subscription-badge">${item.subscription_required}</span>`
        : '';
    
    return `
        <div class="content-card" data-id="${item.id}">
            ${badge}
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
            alert(data.message);
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
            plansGrid.innerHTML = plansData.plans.map(plan => `
                <div class="plan-card">
                    <h4>${plan.name.toUpperCase()}</h4>
                    <p class="price">$${plan.price}<span>/month</span></p>
                    <p>${plan.description}</p>
                    <button class="btn btn-primary" onclick="subscribeToPlan(${plan.id})">
                        ${subData.subscription?.plan_id === plan.id ? 'Current Plan' : 'Subscribe'}
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

// Subscribe to plan
async function subscribeToPlan(planId) {
    if (!confirm('Are you sure you want to change your subscription?')) return;
    
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
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error subscribing:', error);
        alert('Error processing subscription');
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
