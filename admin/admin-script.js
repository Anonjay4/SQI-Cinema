import { db, auth, isFirebaseInitialized, serverTimestamp, saveMovie, fetchMovies, deleteMovie, updateBookingStatus, saveBooking } from '../firebase.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, getDocs, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let currentAdminSection = 'dashboard';
let isAdminLoggedIn = false;
let adminMovies = [];
let adminBookings = [];
let currentEditingMovieId = null;

document.addEventListener('DOMContentLoaded', function() {
    initializeAdminPanel();
    attachAdminEventListeners();
});

async function initializeAdminPanel() {
    if (!isFirebaseInitialized) {
        console.error("Firebase not initialized. Cannot proceed with admin panel setup.");
        return;
    }
    const loggedIn = await checkAdminSession();
    if (loggedIn) {
        isAdminLoggedIn = true;
        showAdminPanel();
        loadAdminData();
    }
    setupLoginForm();
    setupMovieForm();
}

function readImageAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function attachAdminEventListeners() {
    document.querySelectorAll('.nav-menu .nav-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const sectionId = event.target.dataset.section;
            if (sectionId) {
                window.showAdminSection(sectionId);
            }
        });
    });

    document.querySelector('.mobile-menu-btn')?.addEventListener('click', window.toggleMobileMenu);

    document.querySelectorAll('.mobile-menu-content .mobile-nav-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const sectionId = event.target.dataset.section;
            if (sectionId) {
                window.showAdminSection(sectionId);
                window.closeMobileMenu();
            }
        });
    });

    document.querySelector('.nav-contact .btn-outline')?.addEventListener('click', window.logout);
    document.querySelector('#mobile-menu .btn-outline')?.addEventListener('click', window.logout);

    document.querySelector('.dashboard-actions .btn-primary')?.addEventListener('click', () => window.showAdminSection('movies'));
    document.querySelector('.dashboard-actions .btn-outline')?.addEventListener('click', () => window.showAdminSection('bookings'));

    document.querySelector('#movies .btn-primary')?.addEventListener('click', window.showAddMovieForm);
    document.querySelector('#add-movie-form .btn-outline')?.addEventListener('click', window.hideAddMovieForm);

    document.getElementById('booking-date-filter')?.addEventListener('change', window.filterBookings);
    document.getElementById('booking-movie-filter')?.addEventListener('change', window.filterBookings);
    document.querySelector('.bookings-filters .btn-outline')?.addEventListener('click', window.clearFilters);
}

function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const usernameInput = document.getElementById('admin-username').value.trim();
            const password = document.getElementById('admin-password').value.trim();

            try {
                const adminUserDocRef = doc(db, 'adminUsers', usernameInput);
                const adminUserDocSnap = await getDoc(adminUserDocRef);
                if (!adminUserDocSnap.exists()) {
                    console.error('Error during admin login: Username not found in Firestore.');
                    window.showLoginError();
                    return;
                }
                const adminData = adminUserDocSnap.data();
                const emailToAuthenticate = adminData.email;
                if (!emailToAuthenticate) {
                    console.error('Error during admin login: Email not found for this username in Firestore.');
                    window.showLoginError();
                    return;
                }
                await signInWithEmailAndPassword(auth, emailToAuthenticate, password);
                isAdminLoggedIn = true;
                await saveAdminSession(usernameInput);
                window.showAdminPanel();
                loadAdminData();
                window.hideLoginError();
                window.showToast('Logged in successfully!', 'success');
            } catch (error) {
                console.error('Error during admin login:', error);
                window.showLoginError();
            }
        });
    }
}

async function saveAdminSession(username) {
    try {
        await setDoc(doc(db, 'sessions', username), {
            loggedIn: true,
            lastLogin: serverTimestamp(),
            uid: auth.currentUser.uid,
            lastActive: Date.now()
        });
        localStorage.setItem('sqiCinemaAdminUser', username);
    } catch (error) {
        console.error('Error saving admin session:', error);
    }
}

async function checkAdminSession() {
    const username = localStorage.getItem('sqiCinemaAdminUser');
    if (!username) return false;

    try {
        const sessionDoc = await getDoc(doc(db, 'sessions', username));
        if (sessionDoc.exists) {
            const sessionData = sessionDoc.data();

            const now = Date.now();
            const lastActive = sessionData.lastActive || 0;
            const sessionAge = now - lastActive;

            const sessionTimeout = 0.5 * 60 * 1000; // 30 seconds
            if (sessionAge > sessionTimeout) {
                localStorage.removeItem('sqiCinemaAdminUser');
                return false;
            }

            return sessionData.loggedIn === true && auth.currentUser !== null;
        }
        return false;
    } catch (error) {
        console.error('Error checking admin session:', error);
        return false;
    }
}


window.logout = async function() {
    try {
        const username = localStorage.getItem('sqiCinemaAdminUser');
        if (username) {
            await setDoc(doc(db, 'sessions', username), {
                loggedIn: false,
                lastLogout: serverTimestamp()
            });
        }
        await auth.signOut();
    } catch (error) {
        console.error('Error logging out:', error);
    }
    isAdminLoggedIn = false;
    localStorage.removeItem('sqiCinemaAdminUser');
    document.getElementById('login-section').classList.add('active');
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('login-form').reset();
    window.hideLoginError();
    window.showToast('Logged out successfully', 'success');
}

window.showLoginError = function() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

window.hideLoginError = function() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

window.showAdminPanel = function() {
    document.getElementById('login-section').classList.remove('active');
    document.getElementById('admin-panel').style.display = 'block';
    window.showAdminSection('dashboard');
}

window.showAdminSection = function(sectionId) {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    currentAdminSection = sectionId;
    if (sectionId === 'dashboard') {
        updateDashboardStats();
    } else if (sectionId === 'movies') {
        displayAdminMovies();
    } else if (sectionId === 'bookings') {
        displayBookings();
        populateMovieFilter();
    }
    window.closeMobileMenu();
}

window.toggleMobileMenu = function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu) {
        mobileMenu.classList.toggle('active');
    }
}

window.closeMobileMenu = function() {
    const mobileMenu = document.querySelector('.mobile-menu');
    if (mobileMenu) {
        mobileMenu.classList.remove('active');
    }
}

async function loadAdminData() {
    await loadMoviesFromFirestore();
    await loadBookingsFromFirestore();
    updateDashboardStats();
}

async function loadMoviesFromFirestore() {
    try {
        adminMovies = await fetchMovies();
        console.log('Loaded movies:', adminMovies);
        displayAdminMovies();
    } catch (error) {
        console.error('Error loading movies from Firestore:', error);
        adminMovies = [];
    }
}

// --- SAFE DATE HANDLING FUNCTION ---
function getDateAsDateObject(dateField) {
    if (!dateField) return null;
    if (typeof dateField.toDate === "function") return dateField.toDate();
    if (typeof dateField === "string") return new Date(dateField);
    return null;
}

async function loadBookingsFromFirestore() {
    try {
        const snapshot = await getDocs(collection(db, 'bookings'));
        adminBookings = [];
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            adminBookings.push({
                id: docSnap.id,
                ...data,
                date: getDateAsDateObject(data.date),
                bookingDate: getDateAsDateObject(data.createdAt)
            });
        });

        // Mark seats as taken based on bookings - This logic is for the client-side seat map,
        // not directly for admin panel display. It's fine to keep it here for now,
        // but it doesn't directly affect the admin bookings table.
        adminBookings.forEach(booking => {
            booking.seats.forEach(seat => {
                const seatElement = document.querySelector(`[data-seat-id="${seat}"]`);
                if (seatElement) {
                    seatElement.classList.add('taken'); // Mark seat as taken
                }
            });
        });

        displayBookings();
    } catch (error) {
        console.error('Error loading bookings from Firestore:', error);
        adminBookings = [];
    }
}



async function saveMoviesToFirestore() {
    try {
        for (const movie of adminMovies) {
            await saveMovie(movie);
        }
        await loadMoviesFromFirestore();
        window.showToast('Movies saved to Firestore!', 'success');
    } catch (error) {
        console.error('Error saving movies:', error);
        window.showToast('Failed to save movies.', 'error');
    }
}

function updateDashboardStats() {
    const totalMoviesEl = document.getElementById('total-movies');
    const totalBookingsEl = document.getElementById('total-bookings');
    const totalRevenueEl = document.getElementById('total-revenue');
    const todayBookingsEl = document.getElementById('today-bookings');

    if (totalMoviesEl) totalMoviesEl.textContent = adminMovies.length;
    if (totalBookingsEl) totalBookingsEl.textContent = adminBookings.length;

    const totalRevenue = adminBookings
    .filter(booking => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
    if (totalRevenueEl) totalRevenueEl.textContent = `₦${totalRevenue.toLocaleString()}`;

    const today = new Date().toISOString().split('T')[0];
    const todayBookings = adminBookings.filter(booking => {
        if (!booking.date) return false;
        let bookingDateStr = '';
        if (typeof booking.date === 'string') {
            bookingDateStr = new Date(booking.date).toISOString().split('T')[0];
        } else if (booking.date instanceof Date) {
            bookingDateStr = booking.date.toISOString().split('T')[0];
        }
        return bookingDateStr === today;
    });
    if (todayBookingsEl) todayBookingsEl.textContent = todayBookings.length;
}

function setupMovieForm() {
    const movieForm = document.getElementById('movie-form');
    if (movieForm) {
        // Default submit behavior is to add a new movie
        movieForm.addEventListener('submit', addNewMovieHandler);
    }
}

// Handler for adding a new movie
async function addNewMovieHandler(e) {
    e.preventDefault();
    const form = document.getElementById('movie-form');
    const formData = new FormData(form);

    const newMovie = {
        title: formData.get('title'),
        image: await readImageAsBase64(formData.get('image')),
        rating: parseFloat(formData.get('rating')),
        duration: formData.get('duration'),
        genre: formData.get('genre'),
        showtimes: formData.get('showtimes').split(',').map(time => time.trim()),
        status: formData.get('status'),
        releaseDate: new Date(formData.get('releaseDate')),
        endDate: new Date(formData.get('endDate'))
    };

    const result = await saveMovie(newMovie);
    if (result.success) {
        window.showToast('Movie added!', 'success');
        await loadMoviesFromFirestore();
        window.hideAddMovieForm();
    } else {
        window.showToast('Failed to add movie.', 'error');
    }
}


window.showAddMovieForm = function () {
    document.getElementById('add-movie-form').style.display = 'block';
    const movieForm = document.getElementById('movie-form');
    movieForm.reset();

    // Clear image preview
    const imageField = document.getElementById('movie-image');
    const existingPreview = imageField.parentNode.querySelector('img');
    if (existingPreview) existingPreview.remove();

    // currentEditingMovieId = null;

    const submitBtn = movieForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '✅ Add Movie';
    movieForm.removeEventListener('submit', updateMovieHandler);
    movieForm.addEventListener('submit', addNewMovieHandler);
}

window.hideAddMovieForm = function() {
    document.getElementById('add-movie-form').style.display = 'none';
    // Reset form submit handler to default (add new movie) when hiding
    const movieForm = document.getElementById('movie-form');
    movieForm.removeEventListener('submit', updateMovieHandler);
    movieForm.addEventListener('submit', addNewMovieHandler);
}

async function addNewMovie() {
    // This function is now replaced by addNewMovieHandler
    // Keeping it for reference if other parts of the code still call it directly
    const form = document.getElementById('movie-form');
    const formData = new FormData(form);

    const newMovie = {
        title: formData.get('title'),
        image: formData.get('image'),
        rating: parseFloat(formData.get('rating')),
        duration: formData.get('duration'),
        genre: formData.get('genre'),
        showtimes: formData.get('showtimes').split(',').map(time => time.trim()),
        status: formData.get('status'),
        releaseDate: new Date(formData.get('releaseDate'))
    };

    const result = await saveMovie(newMovie);
    if (result.success) {
        window.showToast('Movie added!', 'success');
        await loadMoviesFromFirestore();
        window.hideAddMovieForm();
    } else {
        window.showToast('Failed to add movie.', 'error');
    }
}

function displayAdminMovies() {
    const moviesGrid = document.getElementById('admin-movies-grid');
    if (!moviesGrid) return;

    moviesGrid.innerHTML = '';
    adminMovies.forEach(movie => {
        const movieCard = createAdminMovieCard(movie);
        moviesGrid.appendChild(movieCard);
    });
}

function createAdminMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'admin-movie-card';

    let formattedReleaseDate = 'N/A';
    if (movie.releaseDate) {
        if (movie.releaseDate instanceof Date) {
            formattedReleaseDate = formatDate(movie.releaseDate.toISOString().split('T')[0]);
        } else if (typeof movie.releaseDate === 'string') {
            formattedReleaseDate = formatDate(movie.releaseDate);
        }
    }

    card.innerHTML = `
        <div class="admin-movie-image">
            <img src="${movie.image}" alt="${movie.title}" onerror="this.src='public/placeholder.svg'">
            <div class="movie-status-badge ${movie.status}">
                ${movie.status === 'now-showing' ? '🎬 Now Showing' : '🗓️ Coming Soon'}
            </div>
        </div>
        <div class="admin-movie-info">
            <h3 class="admin-movie-title">${movie.title}</h3>
            <div class="admin-movie-details">
                <div>⭐ ${movie.rating}</div>
                <div>🕒 ${movie.duration}</div>
                <div>🎭 ${movie.genre}</div>
                <div>📅 ${formattedReleaseDate}</div>
            </div>
            <div class="admin-movie-actions">
                <button class="btn btn-outline btn-small" data-movie-id="${movie.id}" data-action="edit">
                    ✏️ Edit
                </button>
                <button class="btn btn-danger btn-small" data-movie-id="${movie.id}" data-action="delete">
                    🗑️ Delete
                </button>
            </div>
        </div>
    `;

    card.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => window.editMovie(e.target.dataset.movieId));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => window.deleteMovie(e.target.dataset.movieId));
    return card;
}

window.editMovie = function (movieId) {
    const movie = adminMovies.find(m => m.id === movieId);
    if (!movie) {
        window.showToast('Movie not found.', 'error');
        return;
    }

    currentEditingMovieId = movieId;

    // Show form
    window.showAddMovieForm();

    // Fill in form values
    document.getElementById('movie-title').value = movie.title || '';
    document.getElementById('movie-rating').value = movie.rating || '';
    document.getElementById('movie-duration').value = movie.duration || '';
    document.getElementById('movie-genre').value = movie.genre || '';
    document.getElementById('movie-status').value = movie.status || '';
    document.getElementById('movie-showtimes').value = movie.showtimes?.join(', ') || '';

    if (movie.releaseDate instanceof Date) {
        document.getElementById('movie-release-date').value = movie.releaseDate.toISOString().split('T')[0];
    }

    if (movie.endDate instanceof Date) {
        document.getElementById('movie-end-date').value = movie.endDate.toISOString().split('T')[0];
    }

    // Handle image preview
    const imageInput = document.getElementById('movie-image');
    const existingPreview = imageInput.parentNode.querySelector('img');
    if (existingPreview) existingPreview.remove();

    if (movie.image) {
        const preview = document.createElement('img');
        preview.src = movie.image;
        preview.style.width = '100px';
        preview.style.marginTop = '10px';
        imageInput.parentNode.appendChild(preview);
    }

    // Switch form to update mode
    const movieForm = document.getElementById('movie-form');
    const submitBtn = movieForm.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '✅ Update Movie';

    movieForm.removeEventListener('submit', addNewMovieHandler);
    movieForm.removeEventListener('submit', updateMovieHandler); // Prevent stacking listeners
    movieForm.addEventListener('submit', updateMovieHandler);
};


// Handler for updating an existing movie
async function updateMovieHandler(e) {
    e.preventDefault();
    if (!currentEditingMovieId) {
        window.showToast('No movie selected for update.', 'error');
        return;
    }

    const form = document.getElementById('movie-form');
    const formData = new FormData(form);

    const updatedMovie = {
        id: currentEditingMovieId,
        title: formData.get('title'),
        rating: parseFloat(formData.get('rating')),
        duration: formData.get('duration'),
        genre: formData.get('genre'),
        status: formData.get('status'),
        showtimes: formData.get('showtimes').split(',').map(s => s.trim()),
        releaseDate: new Date(formData.get('releaseDate')),
        endDate: new Date(formData.get('endDate'))
    };

    const imageFile = formData.get('image');
    if (imageFile && imageFile.size > 0) {
        updatedMovie.image = await readImageAsBase64(imageFile);
    } else {
        const existing = adminMovies.find(m => m.id === currentEditingMovieId);
        updatedMovie.image = existing?.image || '';
    }

    const result = await saveMovie(updatedMovie);
    if (result.success) {
        window.showToast('Movie updated!', 'success');
        await loadMoviesFromFirestore();
        window.hideAddMovieForm();
        currentEditingMovieId = null;
    } else {
        window.showToast('Failed to update movie.', 'error');
    }
}


window.deleteMovie = async function(movieId) {
    if (!confirm('Are you sure you want to delete this movie?')) return;
    const result = await deleteMovie(movieId);
    if (result.success) {
        window.showToast('Movie deleted!', 'success');
        await loadMoviesFromFirestore();
    } else {
        window.showToast('Failed to delete movie.', 'error');
    }
}

function displayBookings() {
    const tableBody = document.getElementById('bookings-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    adminBookings.forEach(booking => {
        const row = createBookingRow(booking);
        tableBody.appendChild(row);
    });
}

function createBookingRow(booking) {
    const row = document.createElement('tr');
    let formattedBookingDate = 'N/A';
    if (booking.date) {
        if (booking.date instanceof Date) {
            formattedBookingDate = formatDate(booking.date.toISOString().split('T')[0]);
        } else if (typeof booking.date === 'string') {
            formattedBookingDate = formatDate(booking.date);
        }
    }
    row.innerHTML = `
        <td>${booking.id}</td>
        <td>
            <div>${booking.customerName}</div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground);">${booking.customerEmail}</div>
        </td>
        <td>${booking.movieTitle}</td>
        <td>
            <div>${formattedBookingDate}</div>
            <div style="font-size: 0.75rem; color: var(--muted-foreground);">${booking.showtime}</div>
        </td>
        <td>${(booking.seats || []).join(', ')}</td>
        <td>₦${booking.totalAmount ? booking.totalAmount.toLocaleString() : '0'}</td>
        <td>
            <span class="booking-status ${booking.status}">${booking.status ? booking.status.toUpperCase() : ''}</span>
        </td>
        <td>
            <div class="booking-actions">
                <button class="btn btn-outline btn-small" data-booking-id="${booking.id}" data-action="view">
                    👁️ View
                </button>
                <button class="btn btn-danger btn-small" data-booking-id="${booking.id}" data-action="cancel">
                    ❌ Cancel
                </button>
            </div>
        </td>
    `;
    row.querySelector('[data-action="view"]')?.addEventListener('click', (e) => window.viewBookingDetails(e.target.dataset.bookingId));
    row.querySelector('[data-action="cancel"]')?.addEventListener('click', (e) => window.cancelBooking(e.target.dataset.bookingId));
    return row;
}

function populateMovieFilter() {
    const movieFilter = document.getElementById('booking-movie-filter');
    if (!movieFilter) return;
    movieFilter.innerHTML = '<option value="">All Movies</option>';
    const uniqueMovies = [...new Set(adminBookings.map(booking => booking.movieTitle))];
    uniqueMovies.forEach(movieTitle => {
        const option = document.createElement('option');
        option.value = movieTitle;
        option.textContent = movieTitle;
        movieFilter.appendChild(option);
    });
}

window.filterBookings = function() {
    const dateFilter = document.getElementById('booking-date-filter').value;
    const movieFilter = document.getElementById('booking-movie-filter').value;
    let filteredBookings = adminBookings;
    if (dateFilter) {
        filteredBookings = filteredBookings.filter(booking => {
            if (!booking.date) return false;
            let bookingDateStr = '';
            if (typeof booking.date === 'string') {
                bookingDateStr = new Date(booking.date).toISOString().split('T')[0];
            } else if (booking.date instanceof Date) {
                bookingDateStr = booking.date.toISOString().split('T')[0];
            }
            return bookingDateStr === dateFilter;
        });
    }
    if (movieFilter) {
        filteredBookings = filteredBookings.filter(booking => booking.movieTitle === movieFilter);
    }
    displayFilteredBookings(filteredBookings);
}

function displayFilteredBookings(bookings) {
    const tableBody = document.getElementById('bookings-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    bookings.forEach(booking => {
        const row = createBookingRow(booking);
        tableBody.appendChild(row);
    });
}

window.clearFilters = function() {
    document.getElementById('booking-date-filter').value = '';
    document.getElementById('booking-movie-filter').value = '';
    displayBookings();
}

window.viewBookingDetails = function(bookingId) {
    const booking = adminBookings.find(b => b.id === bookingId);
    if (!booking) return;
    let formattedBookingDate = '';
    if (booking.date) {
        if (booking.date instanceof Date) {
            formattedBookingDate = booking.date.toLocaleString();
        } else if (typeof booking.date === 'string') {
            formattedBookingDate = new Date(booking.date).toLocaleString();
        }
    }
    const details = `
        Booking ID: ${booking.id}
        Customer: ${booking.customerName}
        Email: ${booking.customerEmail}
        Phone: ${booking.customerPhone}
        Movie: ${booking.movieTitle}
        Date: ${formattedBookingDate}
        Showtime: ${booking.showtime}
        Seats: ${(booking.seats || []).join(', ')}
        Total Amount: ₦${booking.totalAmount ? booking.totalAmount.toLocaleString() : '0'}
        Status: ${booking.status ? booking.status.toUpperCase() : ''}
        Booking Date: ${booking.bookingDate instanceof Date ? booking.bookingDate.toLocaleString() : ''}
    `;
    alert(details);
}

window.cancelBooking = async function(bookingId) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        try {
            await updateBookingStatus(bookingId, 'cancelled');
            window.showToast('Booking cancelled successfully!', 'warning');
            await loadBookingsFromFirestore();
            updateDashboardStats();
        } catch (error) {
            console.error('Error cancelling booking:', error);
            window.showToast('Failed to cancel booking.', 'error');
        }
    }
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

window.showToast = function(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const toastId = 'toast-' + Date.now();
    toast.id = toastId;
    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${getToastIcon(type)} ${getToastTitle(type)}</span>
            <button class="toast-close" data-toast-id="${toastId}">&times;</button>
        </div>
        <div class="toast-description">${message}</div>
    `;
    toastContainer.appendChild(toast);
    toast.querySelector('.toast-close')?.addEventListener('click', (e) => window.closeToast(e.target.dataset.toastId));
    setTimeout(() => {
        window.closeToast(toastId);
    }, 5000);
}

function getToastIcon(type) {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
}

function getToastTitle(type) {
    switch (type) {
        case 'success': return 'Success';
        case 'error': return 'Error';
        case 'warning': return 'Warning';
        default: return 'Info';
    }
}

window.closeToast = function(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

window.AdminAPI = {
    addBooking: async (bookingData) => {
        try {
            const result = await saveBooking(bookingData);
            return result.id;
        } catch (error) {
            console.error('Error adding booking from site:', error);
            return null;
        }
    },
    getMovies: () => adminMovies,
    getBookings: () => adminBookings
};
