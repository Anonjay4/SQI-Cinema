// Import individual functions from firebase.js
import { 
    db, 
    saveMovie, 
    fetchMovies, 
    saveBooking,
    query,
    where,
    getDocs, 
    collection
} from './firebase.js'; 

// Global variables
let currentSection = 'home';
let bookingStep = 'date';
let selectedMovie = null;
let selectedDate = null;
let selectedShowtime = '';
let selectedSeats = [];
let selectedFood = {};
let customerDetails = {};
let totalAmount = 0;
let movies = [];

// Default movies (for initial Firestore population)
const defaultMovies = [
    {
        title: "The Guardian",
        image: "src/assets/movie-guardian.jpg",
        rating: 8.7,
        duration: "2h 15m",
        genre: "Action/Thriller",
        showtimes: ["2:00 PM", "5:30 PM", "8:45 PM"],
        status: "now-showing",
        releaseDate: new Date("2024-01-15")
    },
    {
        title: "Love Actually",
        image: "src/assets/movie-love.jpg",
        rating: 7.8,
        duration: "1h 58m",
        genre: "Romance/Comedy",
        showtimes: ["1:30 PM", "4:15 PM", "7:00 PM"],
        status: "now-showing",
        releaseDate: new Date("2024-01-20")
    },
    {
        title: "Cosmic Journey",
        image: "src/assets/movie-cosmic.jpg",
        rating: 9.1,
        duration: "2h 35m",
        genre: "Sci-Fi/Adventure",
        showtimes: ["3:00 PM", "6:30 PM", "9:30 PM"],
        status: "now-showing",
        releaseDate: new Date("2024-01-10")
    },
    {
        title: "Adventure Island",
        image: "src/assets/movie-adventure.jpg",
        rating: 8.2,
        duration: "1h 45m",
        genre: "Animation/Family",
        showtimes: ["12:00 PM", "2:30 PM", "5:00 PM"],
        status: "coming-soon",
        releaseDate: addDays(new Date(), 7)
    }
];

// Food menu data
const foodMenu = [
    { id: 'popcorn-small', name: 'Small Popcorn', price: 1500, category: 'snacks' },
    { id: 'popcorn-large', name: 'Large Popcorn', price: 2500, category: 'snacks' },
    { id: 'nachos', name: 'Nachos with Cheese', price: 2000, category: 'snacks' },
    { id: 'hotdog', name: 'Hot Dog', price: 1800, category: 'snacks' },
    { id: 'coke-small', name: 'Small Coke', price: 800, category: 'drinks' },
    { id: 'coke-large', name: 'Large Coke', price: 1200, category: 'drinks' },
    { id: 'water', name: 'Bottled Water', price: 500, category: 'drinks' },
    { id: 'juice', name: 'Fresh Juice', price: 1000, category: 'drinks' }
];

// Utility function to add days to date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await initializeMoviesInFirestore();
    initializePage();
    // Attach event listeners after the DOM is loaded
    attachEventListeners(); 
});

async function initializeMoviesInFirestore() {
    try {
        // Ensure db is available before trying to use it
        if (!db) {
            console.error("Firestore DB not initialized. Cannot initialize movies.");
            return;
        }
        // Corrected: Use fetchMovies from the imported module
        const existingMovies = await fetchMovies(); 
        if (existingMovies.length === 0) { // Check if collection is empty
            for (const movie of defaultMovies) {
                await saveMovie(movie); // Use saveMovie from the imported module
            }
        }
        movies = await fetchMovies(); // Re-fetch after potential initialization
    } catch (error) {
        console.error('Error initializing movies in Firestore:', error);
        movies = defaultMovies; // Fallback to default movies if Firestore fails
    }
}

function initializePage() {
    populateMovies();
    initializeBookingFlow();
    generateSeatMap();
    initializeFoodMenu();
    setupFormValidation();
    // initializeDateSelector(); // This will be called within startBooking now
    updateNavigation();
}

// New function to attach all event listeners
function attachEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const sectionId = event.target.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    // Mobile menu button
    document.querySelector('.mobile-menu-btn')?.addEventListener('click', toggleMobileMenu);

    // Mobile navigation items
    document.querySelectorAll('.mobile-nav-item').forEach(button => {
        button.addEventListener('click', (event) => {
            const sectionId = event.target.dataset.section;
            if (sectionId) {
                showSection(sectionId);
                closeMobileMenu();
            }
        });
    });

    // Hero section buttons
    document.querySelector('.hero-buttons .btn-primary')?.addEventListener('click', () => showSection('movies'));
    document.querySelector('.hero-buttons .btn-outline')?.addEventListener('click', () => showSection('about'));

    // Booking section buttons (if they exist)
    document.querySelector('#no-movie-selected .btn-primary')?.addEventListener('click', () => showSection('movies'));

    // Payment button (now on details step)
    // This listener is attached in setupFormValidation now
    // document.getElementById('pay-button')?.addEventListener('click', processPayment);

    // Add event listeners for movie card showtime buttons dynamically
    // This will be handled by the createMovieCard function, but we need to ensure
    // the startBooking function is globally accessible or passed correctly.
    // For now, we'll keep startBooking global for simplicity with dynamic HTML.
    // A better approach would be to create elements and attach listeners directly.
}


async function populateMovies() {
    const nowShowingGrid = document.getElementById('now-showing-grid');
    const comingSoonGrid = document.getElementById('coming-soon-grid');

    try {
        movies = await fetchMovies(); // Use fetchMovies from the imported module
    } catch (error) {
        console.error('Error fetching movies from Firebase:', error);
        // If fetching from Firebase fails, use the default movies
        movies = defaultMovies; 
    }

    if (nowShowingGrid) {
        nowShowingGrid.innerHTML = '';
        const nowShowing = movies.filter(m => m.status === 'now-showing');
        nowShowing.forEach(movie => {
            nowShowingGrid.appendChild(createMovieCard(movie));
        });
    }

    if (comingSoonGrid) {
        comingSoonGrid.innerHTML = '';
        const comingSoon = movies.filter(m => m.status === 'coming-soon');
        comingSoon.forEach(movie => {
            comingSoonGrid.appendChild(createMovieCard(movie));
        });
    }
}

function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    
    card.innerHTML = `
        <div class="movie-image">
            <img src="${movie.image}" alt="${movie.title}" onerror="this.src='public/placeholder.svg'">
            <div class="movie-rating">
                <span>⭐</span>
                <span>${movie.rating}</span>
            </div>
            ${movie.status === 'coming-soon' ? '<div class="coming-soon-badge">🗓️ Coming Soon</div>' : ''}
        </div>
        <div class="movie-info">
            <h3 class="movie-title">${movie.title}</h3>
            <div class="movie-details">
                <span>🕒 ${movie.duration}</span>
                <span class="movie-genre">${movie.genre}</span>
            </div>
            ${movie.status === 'coming-soon' ? 
                `<div class="coming-soon-date">Available from: ${formatDate(movie.releaseDate.toISOString().split('T')[0])}</div>
                 <button class="btn btn-outline" data-movie-title="${movie.title}" data-release-date="${movie.releaseDate.toISOString().split('T')[0]}" data-action="book-advance">Book in Advance</button>` :
                `<div class="movie-showtimes">
                    <p class="showtimes-label">Showtimes:</p>
                    <div class="showtimes-grid">
                        ${movie.showtimes.map(time => 
                            `<button class="showtime-btn" data-movie-title="${movie.title}" data-showtime="${time}" data-action="book-now">${time}</button>`
                        ).join('')}
                    </div>
                 </div>`
            }
        </div>
    `;
    
    // Attach event listeners dynamically instead of using onclick attributes
    const bookAdvanceBtn = card.querySelector('[data-action="book-advance"]');
    if (bookAdvanceBtn) {
        bookAdvanceBtn.addEventListener('click', () => {
            startBooking(bookAdvanceBtn.dataset.movieTitle, bookAdvanceBtn.dataset.releaseDate);
        });
    }

    const showtimeBtns = card.querySelectorAll('[data-action="book-now"]');
    showtimeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            startBooking(btn.dataset.movieTitle, null, btn.dataset.showtime);
        });
    });

    return card;
}

function initializeBookingFlow() {
    const bookingFlow = document.getElementById('booking-flow');
    const noMovieSelected = document.getElementById('no-movie-selected');
    
    if (!selectedMovie) {
        if (bookingFlow) bookingFlow.style.display = 'none';
        if (noMovieSelected) noMovieSelected.style.display = 'block';
    } else {
        if (bookingFlow) bookingFlow.style.display = 'block';
        if (noMovieSelected) noMovieSelected.style.display = 'none';
        updateBookingSteps();
    }
}

function initializeDateSelector(minDate = null) {
    const dateSelector = document.getElementById('date-selector');
    if (!dateSelector) return;
    
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day

    let effectiveMinDate = today;
    if (minDate) {
        const movieReleaseDate = new Date(minDate);
        movieReleaseDate.setHours(0, 0, 0, 0);
        if (movieReleaseDate > effectiveMinDate) {
            effectiveMinDate = movieReleaseDate;
        }
    }

    let maxDate = addDays(today, 30);
    if (selectedMovie?.endDate) {
        const end = new Date(selectedMovie.endDate);
        if (!isNaN(end)) maxDate = end;
    }

    for (let d = new Date(today); d <= maxDate; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
    }

    
    dateSelector.innerHTML = '';
    dates.forEach(date => {
        const dateBtn = document.createElement('button');
        dateBtn.className = 'date-btn';
        dateBtn.innerHTML = `
            <div class="date-day">${date.toLocaleDateString('en-US', { weekday: 'short' })}</div>
            <div class="date-number">${date.getDate()}</div>
            <div class="date-month">${date.toLocaleDateString('en-US', { month: 'short' })}</div>
        `;
        
        const currentIterationDate = new Date(date);
        currentIterationDate.setHours(0, 0, 0, 0);

        if (currentIterationDate < effectiveMinDate) {
            dateBtn.disabled = true;
            dateBtn.classList.add('disabled');
        }

        // Attach event listener dynamically
        dateBtn.addEventListener('click', () => selectDate(date, dateBtn));
        dateSelector.appendChild(dateBtn);
    });
}

function selectDate(date, element) {
    if (element.disabled) return; // Prevent selecting disabled dates

    document.querySelectorAll('.date-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedDate = date;
    
    if (selectedMovie) {
        updateShowtimesForMovie();
    }
    
    updateBookingSummary();
    updatePayButtonAmount();
    addContinueButtonToDateStep();
    if (selectedMovie && date && selectedShowtime) {
        markTakenSeats(selectedMovie.title, date.toISOString().split('T')[0], selectedShowtime);
    }
}

function updateShowtimesForMovie() {
    const movie = movies.find(m => m.title === selectedMovie.title);
    if (!movie) return;
    
    const showtimesContainer = document.createElement('div');
    showtimesContainer.className = 'showtimes-selection';
    showtimesContainer.innerHTML = `
        <h4>Select Showtime:</h4>
        <div class="showtimes-grid">
            ${movie.showtimes.map(time => 
                `<button class="showtime-btn" data-showtime="${time}">${time}</button>`
            ).join('')}
        </div>
    `;
    
    const dateStep = document.getElementById('date-step');
    if (dateStep) {
        const existingShowtimes = dateStep.querySelector('.showtimes-selection');
        if (existingShowtimes) {
            existingShowtimes.remove();
        }
        const cardContent = dateStep.querySelector('.card-content');
        if (cardContent) {
            cardContent.appendChild(showtimesContainer);
            // Attach event listeners to newly created showtime buttons
            showtimesContainer.querySelectorAll('.showtime-btn').forEach(btn => {
                btn.addEventListener('click', (event) => selectShowtime(event.target.dataset.showtime, event.target));
            });
        }
    }
}

function selectShowtime(time, element) {
    document.querySelectorAll('.showtime-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    element.classList.add('selected');
    selectedShowtime = time;
    
    updateBookingSummary();
    updatePayButtonAmount();
    addContinueButtonToDateStep();

    if (selectedMovie && selectedDate && selectedShowtime) {
        markTakenSeats(selectedMovie.title, selectedDate.toISOString().split('T')[0], selectedShowtime);
    }
}

function addContinueButtonToDateStep() {
    if (selectedDate && selectedShowtime) {
        const dateStep = document.getElementById('date-step');
        if (dateStep) {
            const existingButton = dateStep.querySelector('.continue-to-seats-btn');
            if (existingButton) {
                existingButton.remove();
            }
            
            const cardContent = dateStep.querySelector('.card-content');
            if (cardContent) {
                const continueButton = document.createElement('button');
                continueButton.className = 'btn btn-primary continue-to-seats-btn';
                continueButton.style.marginTop = '1rem';
                continueButton.style.width = '100%';
                continueButton.textContent = 'Continue to Seat Selection';
                // Attach event listener dynamically
                continueButton.addEventListener('click', () => goToStep('seats'));
                cardContent.appendChild(continueButton);
            }
        }
    }
}

function initializeFoodMenu() {
    const foodMenuContainer = document.getElementById('food-menu');
    if (!foodMenuContainer) return;
    
    const snacks = foodMenu.filter(item => item.category === 'snacks');
    const drinks = foodMenu.filter(item => item.category === 'drinks');
    
    foodMenuContainer.innerHTML = `
        <div class="food-category">
            <h4>Snacks</h4>
            <div class="food-items">
                ${snacks.map(item => createFoodItem(item)).join('')}
            </div>
        </div>
        <div class="food-category">
            <h4>Drinks</h4>
            <div class="food-items">
                ${drinks.map(item => createFoodItem(item)).join('')}
            </div>
        </div>
    `;

    // Attach event listeners for food quantity controls
    foodMenuContainer.querySelectorAll('.quantity-btn').forEach(btn => {
        const itemId = btn.closest('.food-item').dataset.id;
        const change = btn.textContent === '-' ? -1 : 1;
        btn.addEventListener('click', () => updateFoodQuantity(itemId, change));
    });

    // Attach event listeners for navigation buttons within food step
    document.querySelector('#food-step .btn-outline')?.addEventListener('click', () => goToStep('seats'));
    document.querySelector('#food-step .btn-primary')?.addEventListener('click', () => goToStep('details'));
}

function createFoodItem(item) {
    return `
        <div class="food-item" data-id="${item.id}" data-price="${item.price}">
            <div class="food-info">
                <h5>${item.name}</h5>
                <div class="food-price">₦${item.price.toLocaleString()}</div>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" data-item-id="${item.id}" data-change="-1">-</button>
                <span class="quantity-display">0</span>
                <button class="quantity-btn" data-item-id="${item.id}" data-change="1">+</button>
            </div>
        </div>
    `;
}

// Make these functions global or export them if needed by other modules
// For simplicity with HTML onclicks (though we're moving away from them),
// we'll define them globally for now.
window.showSection = function(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
    
    currentSection = sectionId;
    
    closeMobileMenu();
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

window.startBooking = function(movieTitle, releaseDate = null, showtime = null) {
    const movie = movies.find(m => m.title === movieTitle);
    if (!movie) return;
    
    selectedMovie = {
        title: movieTitle,
        time: showtime || movie.showtimes[0],
        status: movie.status,
        releaseDate: movie.releaseDate, // Ensure releaseDate is a Date object
        endDate: movie.endDate
    };
    
    bookingStep = 'date';
    selectedDate = null;
    selectedShowtime = showtime || '';
    selectedSeats = [];
    selectedFood = {};
    customerDetails = {};
    
    showSection('booking');
    initializeBookingFlow();
    updateSelectedMovieInfo();
    updateBookingSummary();
    initializeDateSelector(selectedMovie.releaseDate); // Pass releaseDate to date selector
    
    if (showtime) {
        setTimeout(() => {
            updateShowtimesForMovie();
            const showtimeButtons = document.querySelectorAll('.showtime-btn');
            showtimeButtons.forEach(btn => {
                if (btn.textContent === showtime) {
                    btn.classList.add('selected');
                }
            });
            addContinueButtonToDateStep();
        }, 100);
    }
}

window.goToStep = function(step) {
    bookingStep = step;
    updateBookingSteps();
    if (step === 'details') {
        updateBookingSummary(); // Update summary on details step
        updatePayButtonAmount(); // Update pay button amount
    }
}

window.printTicket = function() {
    window.print();
}

window.resetBooking = function() {
    selectedMovie = null;
    selectedDate = null;
    selectedShowtime = '';
    selectedSeats = [];
    selectedFood = {};
    customerDetails = {};
    totalAmount = 0;
    bookingStep = 'date';
    
    document.querySelectorAll('.seat.selected').forEach(seat => {
        seat.classList.remove('selected');
    });
    
    document.querySelectorAll('.quantity-display').forEach(qty => {
        qty.textContent = '0';
    });
    
    const form = document.getElementById('booking-form');
    if (form) form.reset();
    
    showSection('movies');
    initializeBookingFlow();
}


function updateNavigation() {
    document.querySelectorAll('.nav-item').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelector(`[data-section="${currentSection}"]`)?.classList.add('active');
}


function updateSelectedMovieInfo() {
    const movieInfo = document.getElementById('selected-movie-info');
    if (movieInfo && selectedMovie) {
        movieInfo.innerHTML = `
            <span class="movie-title">${selectedMovie.title}</span>
            <span class="separator">•</span>
            <span>${selectedMovie.time}</span>
            ${selectedMovie.status === 'coming-soon' ? 
                '<span class="separator">•</span><span class="coming-soon-badge">Coming Soon</span>' : ''
            }
        `;
        movieInfo.style.display = 'flex';
    }
}

function updateBookingSteps() {
    const steps = ['date', 'seats', 'food', 'details', 'ticket']; // Removed 'payment' step
    const currentStepIndex = steps.indexOf(bookingStep);
    
    document.querySelectorAll('.progress-steps .step').forEach((step, index) => {
        if (index <= currentStepIndex) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.booking-step-content > .step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const currentStepContent = document.getElementById(`${bookingStep}-step`);
    if (currentStepContent) {
        currentStepContent.classList.add('active');
    }
}

function handleSeatClick(e) {
    const seatElement = e.currentTarget;
    const seatId = seatElement.dataset.seatId;
    toggleSeat(seatId, seatElement);
}


function generateSeatMap() {
    const seatMap = document.getElementById('seat-map');
    if (!seatMap) return;
    
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const seatsPerRow = 12;
    
    seatMap.innerHTML = '';
    
    rows.forEach(row => {
        const seatRowContainer = document.createElement('div');
        seatRowContainer.className = 'seat-row-container'; // New container for row label and seats
        
        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = row;
        seatRowContainer.appendChild(rowLabel);
        
        const seatsInRow = document.createElement('div');
        seatsInRow.className = 'seats-in-row'; // New class for the actual seats in a row
        
        for (let i = 1; i <= seatsPerRow; i++) {
            const seatId = `${row}${i}`;
            const seat = document.createElement('div');
            seat.className = 'seat';
            seat.textContent = i;
            seat.dataset.seatId = seatId;
            
            // All seats are initially available
            seat.addEventListener('click', handleSeatClick);
            
            seatsInRow.appendChild(seat);
        }
        
        seatRowContainer.appendChild(seatsInRow);
        seatMap.appendChild(seatRowContainer);
    });
}

function toggleSeat(seatId, seatElement) {
    if (seatElement.classList.contains('taken')) return;
    
    if (selectedSeats.includes(seatId)) {
        selectedSeats = selectedSeats.filter(seat => seat !== seatId);
        seatElement.classList.remove('selected');
    } else {
        selectedSeats.push(seatId);
        seatElement.classList.add('selected');
    }
    
    updateSeatsDisplay();
    updateBookingSummary();
    updatePayButtonAmount(); // Update pay button amount when seats change
}

function updateSeatsDisplay() {
    const summary = document.getElementById('selected-seats-summary');
    
    if (selectedSeats.length > 0) {
        if (summary) {
            summary.style.display = 'block';
            
            summary.innerHTML = '';
            
            const title = document.createElement('h4');
            title.textContent = 'Selected Seats:';
            title.style.fontSize = '0.875rem';
            title.style.fontWeight = '500';
            title.style.marginBottom = '0.5rem';
            summary.appendChild(title);
            
            const seatsListContainer = document.createElement('div');
            seatsListContainer.className = 'selected-seats-list';
            seatsListContainer.style.display = 'flex';
            seatsListContainer.style.flexWrap = 'wrap';
            seatsListContainer.style.gap = '0.25rem';
            seatsListContainer.style.marginBottom = '0.5rem';
            
            selectedSeats.forEach(seat => {
                const badge = document.createElement('span');
                badge.className = 'seat-badge';
                badge.textContent = seat;
                seatsListContainer.appendChild(badge);
            });
            summary.appendChild(seatsListContainer);
            
            const ticketCost = selectedSeats.length * 2500;
            const totalElement = document.createElement('p');
            totalElement.className = 'seats-total';
            totalElement.style.fontSize = '0.875rem';
            totalElement.style.color = 'var(--muted-foreground)';
            totalElement.style.marginBottom = '1rem';
            totalElement.textContent = `Total: ${selectedSeats.length} seat${selectedSeats.length !== 1 ? 's' : ''} × ₦2,500 = ₦${ticketCost.toLocaleString()}`;
            summary.appendChild(totalElement);
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'step-actions';
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '0.75rem';
            
            const backButton = document.createElement('button');
            backButton.className = 'btn btn-outline';
            backButton.style.flex = '1';
            backButton.textContent = 'Back to Date';
            backButton.addEventListener('click', () => goToStep('date')); // Attach event listener
            
            const continueButton = document.createElement('button');
            continueButton.className = 'btn btn-primary';
            continueButton.style.flex = '1';
            continueButton.textContent = 'Continue to Food & Drinks';
            continueButton.addEventListener('click', () => goToStep('food')); // Attach event listener
            
            buttonContainer.appendChild(backButton);
            buttonContainer.appendChild(continueButton);
            summary.appendChild(buttonContainer);
        }
    } else {
        if (summary) summary.style.display = 'none';
    }
}

function updateFoodQuantity(itemId, change) {
    const currentQuantity = selectedFood[itemId] || 0;
    const newQuantity = Math.max(0, currentQuantity + change);
    
    if (newQuantity === 0) {
        delete selectedFood[itemId];
    } else {
        selectedFood[itemId] = newQuantity;
    }
    
    const foodItem = document.querySelector(`[data-id="${itemId}"]`);
    if (foodItem) {
        const quantityDisplay = foodItem.querySelector('.quantity-display');
        if (quantityDisplay) {
            quantityDisplay.textContent = newQuantity;
        }
    }
    
    updateBookingSummary();
    updatePayButtonAmount(); // Update pay button amount when food changes
}

function setupFormValidation() {
    const form = document.getElementById('booking-form');
    if (!form) return;
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('customer-name')?.value.trim();
        const email = document.getElementById('customer-email')?.value.trim();
        const phone = document.getElementById('customer-phone')?.value.trim();
        
        if (name && email && phone && email.includes('@')) { // Removed paymentMethod check
            customerDetails = {
                name,
                email,
                phone
            };
            
            processPayment(); // Directly call processPayment
        } else {
            alert('Please fill in all required customer details correctly.');
        }
    });
}

function updatePayButtonAmount() {
    const ticketCost = selectedSeats.length * 2500;
    let foodCost = 0;
    
    Object.entries(selectedFood).forEach(([itemId, quantity]) => {
        const foodItem = foodMenu.find(item => item.id === itemId);
        if (foodItem) {
            foodCost += quantity * foodItem.price;
        }
    });
    
    totalAmount = ticketCost + foodCost;
    
    const paymentAmountSpan = document.getElementById('payment-amount');
    if (paymentAmountSpan) {
        paymentAmountSpan.textContent = totalAmount.toLocaleString();
    }

    const payButton = document.getElementById('pay-button');
    if (payButton) {
        payButton.disabled = totalAmount === 0; // Disable if total is 0
    }
}

console.log('PaystackPop:', window.PaystackPop);

function resetButtonState() {
    const payButton = document.getElementById('pay-button');
    if (payButton) {
        payButton.disabled = false;
        payButton.innerHTML = `Proceed to Payment - ₦${totalAmount.toLocaleString()}`;
    }
}

function processPayment() {
    const payButton = document.getElementById('pay-button');
    payButton.disabled = true;
    payButton.innerHTML = '⏳ Processing...';

    // Validate input
    if (!customerDetails.email || !customerDetails.name || !customerDetails.phone || totalAmount < 1) {
        alert('Please fill in all required fields.');
        resetButtonState();
        return;
    }

    // Prepare booking data
    const bookingData = {
        customerName: customerDetails.name,
        customerEmail: customerDetails.email,
        customerPhone: customerDetails.phone,
        movieTitle: selectedMovie.title,
        showtime: selectedShowtime,
        date: selectedDate ? selectedDate.toISOString().split('T')[0] : '',
        seats: selectedSeats,
        totalAmount: totalAmount,
        bookingDate: new Date().toISOString()
    };

    // ⚡️ IMPORTANT: setup must be triggered immediately inside this function
    const handler = PaystackPop.setup({
        key: 'pk_test_e624e942dba637d5cd680259acd142ca26338728',
        email: bookingData.customerEmail,
        amount: bookingData.totalAmount * 100, // in kobo
        currency: 'NGN',
        ref: 'ref_' + Date.now(),

        callback: function () {
            // Payment successful
            bookingData.status = 'confirmed';

            saveBooking(bookingData)
                .then(() => {
                    alert('Payment successful! Booking confirmed.');
                    generateTicket();
                    // Send email via Brevo
                    fetch("https://api.brevo.com/v3/smtp/email", {
                    method: "POST",
                    headers: {
                        "accept": "application/json",
                        "api-key": "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", 
                        "content-type": "application/json"
                    },
                    body: JSON.stringify({
                        sender: {
                        name: "SQI Cinema",
                        email: "fagbenleolajide2021@gmail.com" 
                        },
                        to: [
                        {
                            email: bookingData.customerEmail,
                            name: bookingData.customerName
                        }
                        ],
                        templateId: 1, 
                        params: {
                        customer_name: bookingData.customerName,
                        movie_title: bookingData.movieTitle,
                        seats: bookingData.seats.join(', '),
                        date: bookingData.date,
                        time: bookingData.showtime,
                        total_amount: `₦${bookingData.totalAmount.toLocaleString()}`
                        }
                    })
                    })
                    .then(response => {
                    if (response.ok) {
                        console.log("✅ Brevo email sent");
                    } else {
                        console.error("❌ Brevo email failed:", response.statusText);
                    }
                    })
                    .catch(error => {
                    console.error("❌ Brevo email error:", error);
                    });
                    goToStep('ticket');
                })
                .catch((error) => {
                    console.error('Booking save failed:', error);
                    alert('Payment was successful, but we couldn’t save the booking. Please contact support.');
                })
                .finally(() => {
                    resetButtonState();
                });
        },

        onClose: function () {
            // User cancelled
            bookingData.status = 'cancelled';

            saveBooking(bookingData)
                .then(() => {
                    alert('Payment was cancelled. Booking marked as cancelled.');
                })
                .catch((error) => {
                    console.error('Failed to save cancelled booking:', error);
                    alert('Could not save the cancelled booking. Please try again.');
                })
                .finally(() => {
                    resetButtonState();
                });
        }
    });

    // 🟢 This must be called immediately — do not wrap in async!
    handler.openIframe();
}





function generateTicket() {
    const ticketNumber = 'SQI' + Date.now().toString().slice(-6);
    
    const ticketDisplay = document.getElementById('ticket-display');
    if (ticketDisplay && selectedMovie) {
        const ticketCost = selectedSeats.length * 2500;
        let foodCost = 0;
        let foodItemsHtml = '';
        
        if (Object.keys(selectedFood).length > 0) {
            Object.entries(selectedFood).forEach(([itemId, quantity]) => {
                const foodItem = foodMenu.find(item => item.id === itemId);
                if (foodItem) {
                    const itemTotal = quantity * foodItem.price;
                    foodCost += itemTotal;
                    foodItemsHtml += `<p><strong>${foodItem.name}:</strong> ${quantity} × ₦${foodItem.price.toLocaleString()} = ₦${itemTotal.toLocaleString()}</p>`;
                }
            });
        }
        
        ticketDisplay.innerHTML = `
            <div class="ticket">
                <div class="ticket-header">
                    <h2 class="ticket-title">🎬 SQI CINEMA</h2>
                    <p class="ticket-reference">Ticket #${ticketNumber}</p>
                </div>
                
                <div class="ticket-details">
                    <div class="ticket-section">
                        <h4>Movie Details</h4>
                        <p><strong>Movie:</strong> ${selectedMovie.title}</p>
                        <p><strong>Date:</strong> ${selectedDate ? formatDate(selectedDate.toISOString().split('T')[0]) : 'Not selected'}</p>
                        <p><strong>Time:</strong> ${selectedShowtime}</p>
                        <p><strong>Seats:</strong> ${selectedSeats.join(', ')}</p>
                    </div>
                    
                    <div class="ticket-section">
                        <h4>Customer Details</h4>
                        <p><strong>Name:</strong> ${customerDetails.name}</p>
                        <p><strong>Email:</strong> ${customerDetails.email}</p>
                        <p><strong>Phone:</strong> ${customerDetails.phone}</p>
                    </div>
                    
                    ${foodItemsHtml ? `
                        <div class="ticket-section">
                            <h4>Food & Drinks</h4>
                            ${foodItemsHtml}
                        </div>
                    ` : ''}
                </div>
                
                <div class="ticket-total">
                    <div class="ticket-total-amount">Total: ₦${totalAmount.toLocaleString()}</div>
                </div>
                
                <div class="ticket-actions">
                    <button class="btn btn-primary" onclick="printTicket()">🖨️ Print Ticket</button>
                    <button class="btn btn-outline" onclick="resetBooking()">📱 New Booking</button>
                </div>
            </div>
        `;
    }
}


function updateBookingSummary() {
    const sidebarSummary = document.getElementById('sidebar-summary');
    if (!sidebarSummary || !selectedMovie) return;
    
    const ticketCost = selectedSeats.length * 2500;
    let foodCost = 0;
    
    Object.entries(selectedFood).forEach(([itemId, quantity]) => {
        const foodItem = foodMenu.find(item => item.id === itemId);
        if (foodItem) {
            foodCost += quantity * foodItem.price;
        }
    });
    
    const total = ticketCost + foodCost;
    
    sidebarSummary.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Movie:</span>
            <span class="summary-value">${selectedMovie.title}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Showtime:</span>
            <span class="summary-value">${selectedShowtime}</span>
        ${selectedDate ? `
            <div class="summary-item">
                <span class="summary-label">Date:</span>
                <span class="summary-value">${formatDate(selectedDate)}</span>
            </div>
        ` : ''}
        ${selectedSeats.length > 0 ? `
            <div class="summary-item">
                <span class="summary-label">Seats:</span>
                <span class="summary-value">${selectedSeats.join(', ')}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Tickets:</span>
                <span class="summary-value">₦${ticketCost.toLocaleString()}</span>
            </div>
        ` : ''}
        ${foodCost > 0 ? `
            <div class="summary-item">
                <span class="summary-label">Food & Drinks:</span>
                <span class="summary-value">₦${foodCost.toLocaleString()}</span>
            </div>
        ` : ''}
        ${(ticketCost > 0 || foodCost > 0) ? `
            <div class="summary-item summary-total">
                <span class="summary-label">Total:</span>
                <span class="summary-value">₦${total.toLocaleString()}</span>
            </div>
        ` : ''}
    `;
    updatePayButtonAmount(); // Ensure Pay button syncs with new total
}

async function markTakenSeats(movieTitle, dateStr, showtime) {
    // You MUST import 'query', 'where', 'collection', and 'getDocs' from Firestore at the top
    const q = query(
        collection(db, 'bookings'),
        where('movieTitle', '==', movieTitle),
        where('date', '==', dateStr),
        where('showtime', '==', showtime)
    );
    const snapshot = await getDocs(q);
    const takenSeats = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (Array.isArray(data.seats)) takenSeats.push(...data.seats);
    });

    // Reset all seats to available first
    document.querySelectorAll('.seat').forEach(seat => {
        seat.classList.remove('taken');
        seat.classList.remove('selected'); // Also clear selected state
        // seat.addEventListener('click', () => toggleSeat(seat.dataset.seatId, seat)); // Re-attach listener
    });

    // Mark seats that are actually taken
    takenSeats.forEach(seatId => {
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (seatElement) {
            seatElement.classList.add('taken');
            // seatElement.removeEventListener('click', () => toggleSeat(seatId, seatElement)); // Remove listener for taken seats
        }
    });

    // Re-select previously selected seats if they are not taken
    selectedSeats = selectedSeats.filter(seatId => {
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (seatElement && !seatElement.classList.contains('taken')) {
            seatElement.classList.add('selected');
            return true;
        }
        return false;
    });
    updateSeatsDisplay(); // Update display after re-filtering selected seats
}

function formatDate(input) {
    if (!input) return 'N/A';
    const date = (input instanceof Date) ? input : new Date(input + 'T00:00:00');
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}


document.addEventListener('click', function(e) {
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    
    if (mobileMenu && mobileMenu.classList.contains('active') && 
        !mobileMenu.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        closeMobileMenu();
    }
});

// Removed the duplicate DOMContentLoaded listener for payButton
// and the mobile-nav-item listeners as they are now handled in attachEventListeners.
