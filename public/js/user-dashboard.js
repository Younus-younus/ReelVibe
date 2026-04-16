// API Base URL
const API_URL = '/api';
let token = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user'));
let userSubscriptionPlan = 'free'; // Global variable to store user's subscription plan
let movieCatalog = [];
let musicCatalog = [];
let movieGenres = [];
let musicGenres = [];
let activePlayerKey = null;
let searchDebounceTimer = null;

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
    
    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
    document.getElementById('searchInput').addEventListener('focus', handleSearchInput);
    document.getElementById('backToBrowseBtn').addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        clearSearchSuggestions();
        switchSection('browse');
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.nav-link[data-section="browse"]')?.classList.add('active');
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) {
            clearSearchSuggestions();
        }
    });
    
    // Filters
    document.getElementById('filterType').addEventListener('change', () => {
        updateBrowseGenreOptions();
        loadContent();
    });
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
        case 'searchResults':
            document.getElementById('searchResultsSection').classList.add('active');
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
        if (filterType === 'all') {
            const [movies, music] = await Promise.all([fetchMovies(genre), fetchMusic(genre)]);

            if (movies.length === 0 && music.length === 0) {
                container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No content available</p></div>';
                return;
            }

            container.innerHTML = `
                <div class="split-content-layout">
                    <section class="split-content-section">
                        <h3 class="split-section-title">Movies</h3>
                        ${movies.length > 0
                            ? `<div class="content-grid split-grid split-movie-grid">${movies.map(item => createContentCard({ ...item, type: 'movie' })).join('')}</div>`
                            : '<div class="empty-state split-empty"><p>No movies found</p></div>'}
                    </section>
                    <section class="split-content-section">
                        <h3 class="split-section-title">Music</h3>
                        ${music.length > 0
                            ? `<div class="content-grid split-grid split-music-grid">${music.map(item => createContentCard({ ...item, type: 'music' })).join('')}</div>`
                            : '<div class="empty-state split-empty"><p>No music found</p></div>'}
                    </section>
                </div>
            `;

            container.querySelectorAll('.split-movie-grid .content-card').forEach((card, index) => {
                card.addEventListener('click', () => playContent({ ...movies[index], type: 'movie' }));
            });

            container.querySelectorAll('.split-music-grid .content-card').forEach((card, index) => {
                card.addEventListener('click', () => playContent({ ...music[index], type: 'music' }));
            });

            return;
        }

        const items = filterType === 'movies'
            ? (await fetchMovies(genre)).map(item => ({ ...item, type: 'movie' }))
            : (await fetchMusic(genre)).map(item => ({ ...item, type: 'music' }));

        if (items.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No content available</p></div>';
            return;
        }

        container.innerHTML = items.map(item => createContentCard(item)).join('');

        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent(items[index]));
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

    if (!genre && data.success) {
        movieCatalog = (data.movies || []).map(item => ({
            ...item,
            type: 'movie',
            subscription_required: normalizeSubscriptionPlan(item.subscription_required)
        }));
    }
    
    // Load genres for filter
    const genreResponse = await fetch(`${API_URL}/movies/genres`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const genreData = await genreResponse.json();
    if (genreData.success) {
        movieGenres = (genreData.genres || []).filter(Boolean);
        updateGenreFilters('movie', movieGenres);
        updateBrowseGenreOptions();
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

    if (!genre && data.success) {
        musicCatalog = (data.music || []).map(item => ({
            ...item,
            type: 'music',
            subscription_required: normalizeSubscriptionPlan(item.subscription_required)
        }));
    }
    
    // Load genres for filter
    const genreResponse = await fetch(`${API_URL}/music/genres`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const genreData = await genreResponse.json();
    if (genreData.success) {
        musicGenres = (genreData.genres || []).filter(Boolean);
        updateGenreFilters('music', musicGenres);
        updateBrowseGenreOptions();
    }
    
    return data.success ? data.music : [];
}

// Update genre filters
function updateGenreFilters(type, genres) {
    const targetId = type === 'movie' ? 'movieGenreFilter' : 'musicGenreFilter';
    setGenreOptions(targetId, genres);
}

function setGenreOptions(selectId, genres) {
    const select = document.getElementById(selectId);
    if (!select) {
        return;
    }

    const previousValue = select.value;
    select.innerHTML = '<option value="">All Genres</option>';

    [...new Set(genres)].forEach(genre => {
        const option = document.createElement('option');
        option.value = genre;
        option.textContent = genre;
        select.appendChild(option);
    });

    if ([...select.options].some(option => option.value === previousValue)) {
        select.value = previousValue;
    }
}

function updateBrowseGenreOptions() {
    const filterType = document.getElementById('filterType')?.value || 'all';
    const browseSelect = document.getElementById('filterGenre');

    if (!browseSelect) {
        return;
    }

    if (filterType === 'movies') {
        setGenreOptions('filterGenre', movieGenres);
        return;
    }

    if (filterType === 'music') {
        setGenreOptions('filterGenre', musicGenres);
        return;
    }

    const allGenres = [...new Set([...movieGenres, ...musicGenres])];
    setGenreOptions('filterGenre', allGenres);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeSubscriptionPlan(plan) {
    return plan === 'basic' ? 'premium' : (plan || 'free');
}

async function getContentCatalog(type) {
    if (type === 'movie' && movieCatalog.length > 0) {
        return movieCatalog;
    }

    if (type === 'music' && musicCatalog.length > 0) {
        return musicCatalog;
    }

    const endpoint = type === 'movie' ? 'movies' : 'music';
    const response = await fetch(`${API_URL}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();

    if (!data.success) {
        return [];
    }

    const catalog = (data.movies || data.music || []).map(item => ({
        ...item,
        type,
        subscription_required: normalizeSubscriptionPlan(item.subscription_required)
    }));

    if (type === 'movie') {
        movieCatalog = catalog;
    } else {
        musicCatalog = catalog;
    }

    return catalog;
}

function getRecommendations(item, catalog) {
    const normalizedGenre = (item.genre || '').toLowerCase();
    const normalizedArtist = (item.artist || '').toLowerCase();

    return catalog
        .filter(candidate => candidate.id !== item.id)
        .map(candidate => {
            let score = 0;

            if (normalizedGenre && (candidate.genre || '').toLowerCase() === normalizedGenre) {
                score += 4;
            }

            if (normalizedArtist && (candidate.artist || '').toLowerCase() === normalizedArtist) {
                score += 3;
            }

            if ((candidate.subscription_required || 'free') === (item.subscription_required || 'free')) {
                score += 1;
            }

            if (candidate.created_at) {
                score += 1;
            }

            return { ...candidate, score };
        })
        .sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            return new Date(right.created_at || 0) - new Date(left.created_at || 0);
        })
        .slice(0, 4);
}

function buildPlayerMetaRows(content, type) {
    const rows = [];

    if (type === 'movie') {
        rows.push(
            { label: 'Genre', value: content.genre || 'Unknown' },
            { label: 'Release Year', value: content.release_year || 'N/A' },
            { label: 'Rating', value: content.rating ? `⭐ ${content.rating}` : 'N/A' }
        );
    } else {
        rows.push(
            { label: 'Artist', value: content.artist || 'Unknown' },
            { label: 'Genre', value: content.genre || 'Unknown' }
        );
    }

    rows.push({
        label: 'Access',
        value: normalizeSubscriptionPlan(content.subscription_required).toUpperCase()
    });

    return rows;
}

function buildPlayerMarkup(content, type) {
    const mediaMarkup = type === 'movie'
        ? `
            <div class="player-video-controls" id="playerVideoControls">
                <label for="videoQualitySelect">Quality</label>
                <select id="videoQualitySelect" class="player-quality-select" aria-label="Video quality">
                    <option value="auto">Auto</option>
                </select>
            </div>
            <video class="player-media" controls autoplay controlsList="nodownload noplaybackrate noremoteplayback" disablePictureInPicture oncontextmenu="return false;">
                <source src="${content.video_url}" type="video/mp4">
                Your browser does not support video playback.
            </video>
        `
        : `
            <div class="player-audio-cover-wrap">
                <img class="player-audio-cover" src="${content.poster_url || 'https://via.placeholder.com/400x400?text=No+Image'}" alt="${escapeHtml(content.title)}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">
            </div>
            <audio class="player-media" controls autoplay controlsList="nodownload noplaybackrate noremoteplayback" oncontextmenu="return false;">
                <source src="${content.audio_url}" type="audio/mpeg">
                Your browser does not support audio playback.
            </audio>
        `;

    const description = type === 'movie'
        ? content.description || 'No description available for this title.'
        : content.description || 'No track description is available yet.';

    const metaRows = buildPlayerMetaRows(content, type).map(row => `
        <div class="player-meta-item">
            <span class="player-meta-label">${escapeHtml(row.label)}</span>
            <span class="player-meta-value">${escapeHtml(row.value)}</span>
        </div>
    `).join('');

    return `
        <div class="player-header">
            <div>
                <div class="player-eyebrow">${type === 'movie' ? 'Movie' : 'Music'}</div>
                <h2>${escapeHtml(content.title)}</h2>
            </div>
            <span class="subscription-badge player-access-badge">${escapeHtml(normalizeSubscriptionPlan(content.subscription_required))}</span>
        </div>

        <div class="player-media-card">
            ${mediaMarkup}
        </div>

        <section class="player-details-card">
            <h3>${type === 'movie' ? 'Description' : 'Track Details'}</h3>
            <p class="player-description">${escapeHtml(description)}</p>
            <div class="player-meta-grid">
                ${metaRows}
            </div>
        </section>

        <section class="recommendations-section">
            <div class="recommendations-header">
                <div>
                    <h3>${type === 'movie' ? 'Recommended Movies' : 'Recommended Music'}</h3>
                    <p>More titles picked from the same mood, genre, and recent catalog.</p>
                </div>
            </div>
            <div id="playerRecommendations" class="recommendations-grid">
                <div class="recommendations-loading">Loading recommendations...</div>
            </div>
        </section>
    `;
}

async function loadPlayerRecommendations(content, type, playerKey) {
    try {
        const catalog = await getContentCatalog(type);
        const recommendations = getRecommendations(content, catalog);
        const recommendationsContainer = document.getElementById('playerRecommendations');

        if (!recommendationsContainer || activePlayerKey !== playerKey) {
            return;
        }

        if (recommendations.length === 0) {
            recommendationsContainer.innerHTML = '<div class="recommendations-empty">No similar titles found yet.</div>';
            return;
        }

        recommendationsContainer.innerHTML = recommendations.map(item => `
            <button class="recommendation-card" type="button" data-id="${item.id}" data-type="${item.type}">
                <img src="${item.poster_url || 'https://via.placeholder.com/180x240?text=No+Image'}" alt="${escapeHtml(item.title)}" onerror="this.src='https://via.placeholder.com/180x240?text=No+Image'">
                <div class="recommendation-card-body">
                    <h4>${escapeHtml(item.title)}</h4>
                    <p>${escapeHtml(item.type === 'movie'
                        ? `${item.genre || 'Unknown'} • ${item.release_year || 'N/A'}`
                        : `${item.artist || 'Unknown'} • ${item.genre || 'Unknown'}`)}</p>
                </div>
            </button>
        `).join('');

        recommendationsContainer.querySelectorAll('.recommendation-card').forEach(card => {
            card.addEventListener('click', () => {
                const selectedType = card.dataset.type;
                const selectedId = Number(card.dataset.id);
                const selectedCatalog = selectedType === 'movie' ? movieCatalog : musicCatalog;
                const selectedItem = selectedCatalog.find(entry => Number(entry.id) === selectedId) || { id: selectedId, type: selectedType };
                playContent(selectedItem);
            });
        });
    } catch (error) {
        console.error('Error loading recommendations:', error);
        const recommendationsContainer = document.getElementById('playerRecommendations');
        if (recommendationsContainer && activePlayerKey === playerKey) {
            recommendationsContainer.innerHTML = '<div class="recommendations-empty">Unable to load recommendations right now.</div>';
        }
    }
}

// Create content card
function createContentCard(item) {
    const posterUrl = item.poster_url || 'https://via.placeholder.com/200x300?text=No+Image';
    const title = item.title;
    const subscriptionStatus = item.subscription_required === 'free' ? 'Free' : 'Premium';
    const meta = item.type === 'movie' 
        ? `${item.genre || 'Unknown'} • ${item.release_year || 'N/A'} • ⭐ ${item.rating || 'N/A'} • ${subscriptionStatus}`
        : `${item.artist || 'Unknown'} • ${item.genre || 'Unknown'} • ${subscriptionStatus}`;
    
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

function getSearchableCatalog() {
    return [...movieCatalog, ...musicCatalog];
}

function normalizeSearchValue(value) {
    return value.trim().toLowerCase();
}

function scoreSearchMatch(item, query) {
    const title = (item.title || '').toLowerCase();
    const artist = (item.artist || '').toLowerCase();
    const genre = (item.genre || '').toLowerCase();
    const description = (item.description || '').toLowerCase();

    if (title === query) return 100;
    if (title.startsWith(query)) return 80;

    let score = 0;
    if (title.includes(query)) score += 30;
    if (artist.includes(query)) score += 25;
    if (genre.includes(query)) score += 15;
    if (description.includes(query)) score += 10;
    return score;
}

function matchesSearchQuery(item, query) {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return false;

    const fields = [item.title, item.artist, item.genre, item.description];
    return fields.some(field => String(field || '').toLowerCase().includes(normalizedQuery));
}

function renderSearchSuggestions(query) {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    const normalizedQuery = normalizeSearchValue(query);

    if (!suggestionsContainer || normalizedQuery.length < 1) {
        clearSearchSuggestions();
        return;
    }

    const suggestions = getSearchableCatalog()
        .filter(item => matchesSearchQuery(item, normalizedQuery))
        .map(item => ({
            ...item,
            score: scoreSearchMatch(item, normalizedQuery)
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);

    if (suggestions.length === 0) {
        suggestionsContainer.innerHTML = '<div class="search-suggestion-empty">No matches</div>';
        suggestionsContainer.classList.add('show');
        return;
    }

    suggestionsContainer.innerHTML = suggestions.map(item => `
        <button type="button" class="search-suggestion" data-id="${item.id}" data-type="${item.type}">
            <img src="${item.poster_url || 'https://via.placeholder.com/60x80?text=No+Image'}" alt="${escapeHtml(item.title)}" onerror="this.src='https://via.placeholder.com/60x80?text=No+Image'">
            <div class="search-suggestion-text">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.type === 'movie'
                    ? `${item.genre || 'Unknown'} • ${item.release_year || 'N/A'}`
                    : `${item.artist || 'Unknown'} • ${item.genre || 'Unknown'}`)}</span>
            </div>
        </button>
    `).join('');

    suggestionsContainer.classList.add('show');

    suggestionsContainer.querySelectorAll('.search-suggestion').forEach(button => {
        button.addEventListener('click', () => {
            const selectedType = button.dataset.type;
            const selectedId = Number(button.dataset.id);
            const selectedCatalog = selectedType === 'movie' ? movieCatalog : musicCatalog;
            const selectedItem = selectedCatalog.find(entry => Number(entry.id) === selectedId);

            if (selectedItem) {
                document.getElementById('searchInput').value = selectedItem.title;
                clearSearchSuggestions();
                playContent(selectedItem);
            }
        });
    });
}

function clearSearchSuggestions() {
    const suggestionsContainer = document.getElementById('searchSuggestions');
    if (!suggestionsContainer) {
        return;
    }

    suggestionsContainer.classList.remove('show');
    suggestionsContainer.innerHTML = '';
}

async function handleSearchInput() {
    const query = document.getElementById('searchInput').value.trim();

    clearTimeout(searchDebounceTimer);

    if (!query) {
        clearSearchSuggestions();
        return;
    }

    if (movieCatalog.length === 0 || musicCatalog.length === 0) {
        await ensureSearchCatalogsLoaded();
    }

    searchDebounceTimer = setTimeout(() => {
        renderSearchSuggestions(query);
    }, 150);
}

async function ensureSearchCatalogsLoaded() {
    await Promise.all([
        movieCatalog.length > 0 ? Promise.resolve(movieCatalog) : fetchMovies(),
        musicCatalog.length > 0 ? Promise.resolve(musicCatalog) : fetchMusic()
    ]);
}

// Play content
async function playContent(item) {
    try {
        const type = item.type === 'music' ? 'music' : 'movie';
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
        const playerKey = `${type}-${content.id}`;
        activePlayerKey = playerKey;
        playerContainer.innerHTML = buildPlayerMarkup(content, type);
        lockPlayerMediaControls(playerContainer);
        initializeVideoQualitySelector(playerContainer, content, type, playerKey);
        
        document.getElementById('playerModal').classList.add('show');
        loadPlayerRecommendations(content, type, playerKey);
    } catch (error) {
        console.error('Error playing content:', error);
        alert('Error loading content');
    }
}

// Close player
function closePlayer() {
    const modal = document.getElementById('playerModal');
    modal.classList.remove('show');
    activePlayerKey = null;
    
    // Stop playback
    const video = modal.querySelector('video');
    const audio = modal.querySelector('audio');
    if (video) video.pause();
    if (audio) audio.pause();
    document.getElementById('playerContainer').innerHTML = '';
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
    
    const name = document.getElementById('profileName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();

    if (!name || !email) {
        alert('Name and email are required');
        return;
    }
    
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

    if (!currentPassword.trim() || !newPassword.trim()) {
        alert('All fields are required');
        return;
    }
    
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
    
    clearSearchSuggestions();
    switchSection('searchResults');
    const container = document.getElementById('searchResultsContent');
    const meta = document.getElementById('searchResultsMeta');
    container.innerHTML = '<div class="loading">Searching...</div>';
    meta.textContent = `Searching for "${query}"`;
    
    try {
        await ensureSearchCatalogsLoaded();

        const encodedQuery = encodeURIComponent(query);

        const [moviesRes, musicRes] = await Promise.all([
            fetch(`${API_URL}/movies?search=${encodedQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/music?search=${encodedQuery}`, {
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
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><p>No results found for "${escapeHtml(query)}"</p></div>`;
            meta.textContent = 'No results found';
            return;
        }
        
        container.innerHTML = content.map(item => createContentCard(item)).join('');
        meta.textContent = `${content.length} result${content.length === 1 ? '' : 's'} found`;
        
        container.querySelectorAll('.content-card').forEach((card, index) => {
            card.addEventListener('click', () => playContent(content[index]));
        });
    } catch (error) {
        console.error('Error searching:', error);
        container.innerHTML = '<div class="empty-state"><p>Error performing search</p></div>';
        meta.textContent = 'Unable to load search results';
    }
}

function preventMediaContextMenu(event) {
    event.preventDefault();
}

function toAbsoluteUrl(url) {
    try {
        return new URL(url, window.location.origin).toString();
    } catch (error) {
        return '';
    }
}

function deriveQualityLabel(url) {
    const lowerUrl = String(url || '').toLowerCase();
    const match = lowerUrl.match(/(2160|1440|1080|720|480|360)p/);
    return match ? `${match[1]}p` : '';
}

function inferQualityCandidates(videoUrl) {
    if (!videoUrl) {
        return [];
    }

    const dotIndex = videoUrl.lastIndexOf('.');
    if (dotIndex <= 0) {
        return [];
    }

    const base = videoUrl.slice(0, dotIndex);
    const extension = videoUrl.slice(dotIndex);

    return [
        { label: '1080p', url: `${base}_1080p${extension}` },
        { label: '720p', url: `${base}_720p${extension}` },
        { label: '480p', url: `${base}_480p${extension}` }
    ];
}

function buildQualityOptionList(videoUrl, qualities) {
    const baseUrl = toAbsoluteUrl(videoUrl);

    const normalizedExplicit = Array.isArray(qualities)
        ? qualities.map(option => {
            if (!option) {
                return null;
            }

            if (typeof option === 'string') {
                const absoluteUrl = toAbsoluteUrl(option);
                return absoluteUrl ? { label: deriveQualityLabel(option) || 'Source', url: absoluteUrl } : null;
            }

            const sourceUrl = option.url || option.src;
            if (!sourceUrl) {
                return null;
            }

            const absoluteUrl = toAbsoluteUrl(sourceUrl);
            if (!absoluteUrl) {
                return null;
            }

            return {
                label: option.label || option.quality || deriveQualityLabel(sourceUrl) || 'Source',
                url: absoluteUrl
            };
        }).filter(Boolean)
        : [];

    const inferred = inferQualityCandidates(videoUrl).map(option => ({
        ...option,
        url: toAbsoluteUrl(option.url)
    })).filter(option => option.url && option.url !== baseUrl);

    const unique = new Map();
    [...normalizedExplicit, ...inferred].forEach(option => {
        if (!unique.has(option.url)) {
            unique.set(option.url, option);
        }
    });

    return Array.from(unique.values());
}

async function validateVideoSource(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-store'
        });

        return response.ok;
    } catch (error) {
        return false;
    }
}

async function resolveVideoQualityOptions(content) {
    const baseUrl = toAbsoluteUrl(content.video_url);
    if (!baseUrl) {
        return [];
    }

    const candidates = buildQualityOptionList(content.video_url, content.video_qualities);
    const checks = await Promise.all(candidates.map(async option => ({
        option,
        available: await validateVideoSource(option.url)
    })));

    const verified = checks.filter(entry => entry.available).map(entry => entry.option);

    return [
        { label: 'Auto', url: baseUrl },
        ...verified
    ];
}

function changeVideoQuality(videoElement, sourceElement, selectedUrl) {
    if (!videoElement || !sourceElement || !selectedUrl) {
        return;
    }

    const currentTime = videoElement.currentTime || 0;
    const wasPaused = videoElement.paused;
    const previousVolume = videoElement.volume;
    const previousMuted = videoElement.muted;
    const previousPlaybackRate = videoElement.playbackRate;

    sourceElement.src = selectedUrl;
    videoElement.load();

    const restorePlaybackState = () => {
        const maxSeek = Number.isFinite(videoElement.duration) ? Math.max(videoElement.duration - 0.25, 0) : currentTime;
        videoElement.currentTime = Math.min(currentTime, maxSeek);
        videoElement.volume = previousVolume;
        videoElement.muted = previousMuted;
        videoElement.playbackRate = previousPlaybackRate;

        if (!wasPaused) {
            videoElement.play().catch(() => {
                // Ignore autoplay interruption after source switch.
            });
        }
    };

    videoElement.addEventListener('loadedmetadata', restorePlaybackState, { once: true });
}

async function initializeVideoQualitySelector(container, content, type, playerKey) {
    if (type !== 'movie') {
        return;
    }

    const videoElement = container.querySelector('video.player-media');
    const sourceElement = videoElement?.querySelector('source');
    const qualitySelect = container.querySelector('#videoQualitySelect');

    if (!videoElement || !sourceElement || !qualitySelect) {
        return;
    }

    const qualityOptions = await resolveVideoQualityOptions(content);

    if (playerKey && activePlayerKey !== playerKey) {
        return;
    }

    qualitySelect.innerHTML = qualityOptions.map(option => `
        <option value="${escapeHtml(option.url)}">${escapeHtml(option.label)}</option>
    `).join('');

    const hasSelectableOptions = qualityOptions.length > 1;
    qualitySelect.disabled = !hasSelectableOptions;

    if (!hasSelectableOptions) {
        const controls = container.querySelector('#playerVideoControls');
        if (controls) {
            controls.classList.add('single-source');
        }
    }

    qualitySelect.addEventListener('change', (event) => {
        const selectedUrl = event.target.value;
        if (!selectedUrl) {
            return;
        }

        changeVideoQuality(videoElement, sourceElement, selectedUrl);
    });
}

function lockPlayerMediaControls(container) {
    container.querySelectorAll('video, audio').forEach(media => {
        media.addEventListener('contextmenu', preventMediaContextMenu);
        media.addEventListener('dragstart', preventMediaContextMenu);
        media.setAttribute('controlsList', 'nodownload noplaybackrate noremoteplayback');
    });
}

// Make subscribeToPlan available globally
window.subscribeToPlan = subscribeToPlan;
