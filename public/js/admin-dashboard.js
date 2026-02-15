// API Base URL
const API_URL = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));

// Check authentication and admin role
if (!token || !currentUser || currentUser.role !== 'admin') {
    window.location.href = '/login';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    initializeUserMenu();
    loadAnalytics();
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
    
    // Add buttons
    document.getElementById('addMovieBtn').addEventListener('click', () => openMovieModal());
    document.getElementById('addMusicBtn').addEventListener('click', () => openMusicModal());
    
    // Modal close buttons
    document.getElementById('closeMovieModal').addEventListener('click', closeMovieModal);
    document.getElementById('closeMusicModal').addEventListener('click', closeMusicModal);
    
    // Forms
    document.getElementById('movieForm').addEventListener('submit', saveMovie);
    document.getElementById('musicForm').addEventListener('submit', saveMusic);
}

// Switch sections
function switchSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    switch(section) {
        case 'analytics':
            document.getElementById('analyticsSection').classList.add('active');
            loadAnalytics();
            break;
        case 'movies':
            document.getElementById('moviesSection').classList.add('active');
            loadMovies();
            break;
        case 'music':
            document.getElementById('musicSection').classList.add('active');
            loadMusic();
            break;
        case 'users':
            document.getElementById('usersSection').classList.add('active');
            loadUsers();
            break;
        case 'subscriptions':
            document.getElementById('subscriptionsSection').classList.add('active');
            loadSubscriptions();
            break;
    }
}

// Load analytics
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_URL}/users/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const analytics = data.analytics;
            
            document.getElementById('totalUsers').textContent = analytics.totalUsers;
            document.getElementById('totalMovies').textContent = analytics.totalMovies;
            document.getElementById('totalMusic').textContent = analytics.totalMusic;
            document.getElementById('recentUsers').textContent = analytics.recentUsers;
            
            // Subscription stats
            const statsContainer = document.getElementById('subscriptionStats');
            statsContainer.innerHTML = analytics.subscriptionStats.map(stat => `
                <div class="stat-item">
                    <h4>${stat.plan}</h4>
                    <p>${stat.count}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// Load movies
async function loadMovies() {
    const container = document.getElementById('moviesContent');
    container.innerHTML = '<div class="loading">Loading movies...</div>';
    
    try {
        const response = await fetch(`${API_URL}/movies`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success || data.movies.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No movies found</p></div>';
            return;
        }
        
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Genre</th>
                        <th>Year</th>
                        <th>Rating</th>
                        <th>Subscription</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.movies.map(movie => `
                        <tr>
                            <td>${movie.id}</td>
                            <td>${movie.title}</td>
                            <td>${movie.genre || 'N/A'}</td>
                            <td>${movie.release_year || 'N/A'}</td>
                            <td>${movie.rating || 'N/A'}</td>
                            <td><span class="subscription-badge">${movie.subscription_required}</span></td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-small btn-warning" onclick="editMovie(${movie.id})">Edit</button>
                                    <button class="btn btn-small btn-error" onclick="deleteMovie(${movie.id})">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading movies:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading movies</p></div>';
    }
}

// Load music
async function loadMusic() {
    const container = document.getElementById('musicContent');
    container.innerHTML = '<div class="loading">Loading music...</div>';
    
    try {
        const response = await fetch(`${API_URL}/music`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success || data.music.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No music found</p></div>';
            return;
        }
        
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Title</th>
                        <th>Artist</th>
                        <th>Genre</th>
                        <th>Subscription</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.music.map(music => `
                        <tr>
                            <td>${music.id}</td>
                            <td>${music.title}</td>
                            <td>${music.artist || 'N/A'}</td>
                            <td>${music.genre || 'N/A'}</td>
                            <td><span class="subscription-badge">${music.subscription_required}</span></td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-small btn-warning" onclick="editMusic(${music.id})">Edit</button>
                                    <button class="btn btn-small btn-error" onclick="deleteMusic(${music.id})">Delete</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading music:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading music</p></div>';
    }
}

// Load users
async function loadUsers() {
    const container = document.getElementById('usersContent');
    container.innerHTML = '<div class="loading">Loading users...</div>';
    
    try {
        const response = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success || data.users.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No users found</p></div>';
            return;
        }
        
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Subscription</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.users.map(user => `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.name}</td>
                            <td>${user.email}</td>
                            <td><span class="subscription-badge">${user.role}</span></td>
                            <td>${user.subscription_plan || 'None'}</td>
                            <td>${new Date(user.created_at).toLocaleDateString()}</td>
                            <td>
                                <div class="action-buttons">
                                    ${user.role === 'user' ? 
                                        `<button class="btn btn-small btn-success" onclick="promoteUser(${user.id})">Make Admin</button>` :
                                        `<button class="btn btn-small btn-warning" onclick="demoteUser(${user.id})">Remove Admin</button>`
                                    }
                                    ${user.id !== currentUser.id ? 
                                        `<button class="btn btn-small btn-error" onclick="deleteUser(${user.id})">Delete</button>` : 
                                        ''
                                    }
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading users</p></div>';
    }
}

// Load subscriptions
async function loadSubscriptions() {
    const container = document.getElementById('subscriptionsContent');
    container.innerHTML = '<div class="loading">Loading subscriptions...</div>';
    
    try {
        const response = await fetch(`${API_URL}/subscriptions/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (!data.success || data.subscriptions.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No subscriptions found</p></div>';
            return;
        }
        
        container.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.subscriptions.map(sub => `
                        <tr>
                            <td>${sub.id}</td>
                            <td>${sub.user_name}</td>
                            <td>${sub.email}</td>
                            <td>${sub.plan_name}</td>
                            <td>${new Date(sub.start_date).toLocaleDateString()}</td>
                            <td>${sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}</td>
                            <td><span class="subscription-badge">${sub.status}</span></td>
                            <td>
                                <select onchange="updateSubscriptionStatus(${sub.id}, this.value)" class="filter-select">
                                    <option value="active" ${sub.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="expired" ${sub.status === 'expired' ? 'selected' : ''}>Expired</option>
                                    <option value="cancelled" ${sub.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                                </select>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        console.error('Error loading subscriptions:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading subscriptions</p></div>';
    }
}

// Movie Modal Functions
function openMovieModal(movieId = null) {
    const modal = document.getElementById('movieModal');
    const form = document.getElementById('movieForm');
    const title = document.getElementById('movieModalTitle');
    
    form.reset();
    document.getElementById('movieId').value = '';
    title.textContent = 'Add Movie';
    
    if (movieId) {
        // Load movie data for editing
        loadMovieForEdit(movieId);
        title.textContent = 'Edit Movie';
    }
    
    modal.classList.add('show');
}

function closeMovieModal() {
    document.getElementById('movieModal').classList.remove('show');
}

async function loadMovieForEdit(movieId) {
    try {
        const response = await fetch(`${API_URL}/movies/${movieId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const movie = data.movie;
            document.getElementById('movieId').value = movie.id;
            document.getElementById('movieTitle').value = movie.title;
            document.getElementById('movieDescription').value = movie.description || '';
            document.getElementById('movieGenre').value = movie.genre || '';
            document.getElementById('movieYear').value = movie.release_year || '';
            document.getElementById('movieRating').value = movie.rating || '';
            document.getElementById('movieSubscription').value = movie.subscription_required;
        }
    } catch (error) {
        console.error('Error loading movie:', error);
    }
}

async function saveMovie(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const movieId = document.getElementById('movieId').value;
    
    // Remove movieId from formData
    formData.delete('movieId');
    
    try {
        const url = movieId ? `${API_URL}/movies/${movieId}` : `${API_URL}/movies`;
        const method = movieId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            closeMovieModal();
            loadMovies();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error saving movie:', error);
        alert('Error saving movie');
    }
}

async function deleteMovie(movieId) {
    if (!confirm('Are you sure you want to delete this movie?')) return;
    
    try {
        const response = await fetch(`${API_URL}/movies/${movieId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            loadMovies();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error deleting movie:', error);
        alert('Error deleting movie');
    }
}

// Music Modal Functions
function openMusicModal(musicId = null) {
    const modal = document.getElementById('musicModal');
    const form = document.getElementById('musicForm');
    const title = document.getElementById('musicModalTitle');
    
    form.reset();
    document.getElementById('musicId').value = '';
    title.textContent = 'Add Music';
    
    if (musicId) {
        loadMusicForEdit(musicId);
        title.textContent = 'Edit Music';
    }
    
    modal.classList.add('show');
}

function closeMusicModal() {
    document.getElementById('musicModal').classList.remove('show');
}

async function loadMusicForEdit(musicId) {
    try {
        const response = await fetch(`${API_URL}/music/${musicId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            const music = data.music;
            document.getElementById('musicId').value = music.id;
            document.getElementById('musicTitle').value = music.title;
            document.getElementById('musicArtist').value = music.artist || '';
            document.getElementById('musicGenre').value = music.genre || '';
            document.getElementById('musicSubscription').value = music.subscription_required;
        }
    } catch (error) {
        console.error('Error loading music:', error);
    }
}

async function saveMusic(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const musicId = document.getElementById('musicId').value;
    
    formData.delete('musicId');
    
    try {
        const url = musicId ? `${API_URL}/music/${musicId}` : `${API_URL}/music`;
        const method = musicId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            closeMusicModal();
            loadMusic();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error saving music:', error);
        alert('Error saving music');
    }
}

async function deleteMusic(musicId) {
    if (!confirm('Are you sure you want to delete this music?')) return;
    
    try {
        const response = await fetch(`${API_URL}/music/${musicId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            loadMusic();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error deleting music:', error);
        alert('Error deleting music');
    }
}

// User Management Functions
async function promoteUser(userId) {
    if (!confirm('Are you sure you want to make this user an admin?')) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'admin' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error promoting user:', error);
        alert('Error promoting user');
    }
}

async function demoteUser(userId) {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ role: 'user' })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error demoting user:', error);
        alert('Error demoting user');
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            loadUsers();
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user');
    }
}

// Subscription Management
async function updateSubscriptionStatus(subId, status) {
    try {
        const response = await fetch(`${API_URL}/subscriptions/${subId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
        } else {
            alert(data.message);
            loadSubscriptions();
        }
    } catch (error) {
        console.error('Error updating subscription:', error);
        alert('Error updating subscription');
        loadSubscriptions();
    }
}

// Make functions available globally
window.editMovie = (id) => openMovieModal(id);
window.deleteMovie = deleteMovie;
window.editMusic = (id) => openMusicModal(id);
window.deleteMusic = deleteMusic;
window.promoteUser = promoteUser;
window.demoteUser = demoteUser;
window.deleteUser = deleteUser;
window.updateSubscriptionStatus = updateSubscriptionStatus;
