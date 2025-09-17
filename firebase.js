// Firebase Configuration and Database Functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
// Ensure all necessary Firestore functions are imported
import { getFirestore, query, where, collection, getDocs, addDoc, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, Timestamp, getDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDHgPQTgGr5BpMPK2U1M7nuz6C3wexdp40",
    authDomain: "sqi-cinema.firebaseapp.com",
    projectId: "sqi-cinema",
    storageBucket: "sqi-cinema.firebasestorage.app",
    messagingSenderId: "665752788714",
    appId: "1:665752788714:web:91da462d3a1e12ee070193"
};

let app;
let db;
let auth;
let isFirebaseInitialized = false;
// Remove FirebaseAPI global variable, it will be exported directly

function normalizeDateForStorage(input) {
    if (!input) return null;

    let date;
    if (input instanceof Date) {
        date = new Date(input.getTime());
    } else if (typeof input === 'string') {
        date = new Date(`${input}T00:00:00`);
    } else {
        return null;
    }

    if (isNaN(date.getTime())) {
        return null;
    }

    date.setHours(0, 0, 0, 0);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createSeatDocumentId(movieTitle, dateStr, showtime) {
    const sanitize = (value) =>
        (value || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'unknown';

    return `${sanitize(movieTitle)}_${dateStr}_${sanitize(showtime)}`;
}

function initializeFirebase() {
    try {
        if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && 
            firebaseConfig.projectId !== "YOUR_PROJECT_ID_HERE") {
                
            isFirebaseInitialized = true;
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app); // Initialize Firebase Authentication
            
            console.log("Firebase initialized successfully");
            return true;
        } else {
            console.log("Firebase not initialized - using placeholder config");
            return false;
        }
    } catch (error) {
        console.error("Error initializing Firebase:", error);
        return false;
    }
}

// Call initializeFirebase immediately when the module loads
initializeFirebase();

// Save movie to Firestore
async function saveMovie(movie) {
    try {
        if (!isFirebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        const movieData = {
            title: movie.title,
            image: movie.image,
            rating: movie.rating,
            duration: movie.duration,
            genre: movie.genre,
            showtimes: movie.showtimes,
            status: movie.status,
            releaseDate: movie.releaseDate ? Timestamp.fromDate(new Date(movie.releaseDate)) : null,
            endDate: movie.endDate ? Timestamp.fromDate(new Date(movie.endDate)) : null
        };

        if (movie.id) {
            await setDoc(doc(db, 'movies', movie.id), movieData);
            return { success: true, id: movie.id };
        } else {
            const docRef = await addDoc(collection(db, 'movies'), movieData);
            return { success: true, id: docRef.id };
        }
    } catch (error) {
        console.error('Error saving movie:', error);
        return { success: false, error };
    }
}

// Fetch all movies from Firestore
async function fetchMovies() {
    try {
        if (!isFirebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        // Corrected: Use collection and getDocs
        const snapshot = await getDocs(collection(db, 'movies'));
        const movies = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            movies.push({
                id: doc.id,
                ...data,
                releaseDate: data.releaseDate ? data.releaseDate.toDate() : null,
                endDate: data.endDate ? data.endDate.toDate() : null
            });
        });
        return movies;
    } catch (error) {
        console.error('Error fetching movies:', error);
        return [];
    }
}

// Delete a movie from Firestore
async function deleteMovie(movieId) {
    try {
        if (!isFirebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        await deleteDoc(doc(db, 'movies', movieId));
        return { success: true };
    } catch (error) {
        console.error('Error deleting movie:', error);
        return { success: false, error };
    }
}

// Save booking to Firestore
async function saveBooking(bookingData) {
    try {
        if (!isFirebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        const normalizedDate = normalizeDateForStorage(bookingData.date);
        const booking = {
            ...bookingData,
            createdAt: serverTimestamp(),
            date: normalizedDate
        };

        const docRef = await addDoc(collection(db, 'bookings'), booking);
        
         // Mark seats as taken in Firestore for the specific movie, date, and showtime
        if (
            Array.isArray(bookingData.seats) &&
            bookingData.seats.length > 0 &&
            normalizedDate &&
            bookingData.showtime &&
            bookingData.movieTitle
        ) {
            const seatDocId = createSeatDocumentId(
                bookingData.movieTitle,
                normalizedDate,
                bookingData.showtime
            );
            const seatsRef = doc(db, 'seats', seatDocId);

            await setDoc(
                seatsRef,
                {
                    movieTitle: bookingData.movieTitle,
                    date: normalizedDate,
                    showtime: bookingData.showtime,
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );

            await updateDoc(seatsRef, {
                seats: arrayUnion(...bookingData.seats)
            });
        }

        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Error saving booking:', error);
        return { success: false, error };
    }
}

// Update booking status in Firestore
async function updateBookingStatus(bookingId, status) {
    try {
        if (!isFirebaseInitialized) {
            throw new Error("Firebase not initialized");
        }

        await updateDoc(doc(db, 'bookings', bookingId), { status });
        return { success: true };
    } catch (error) {
        console.error('Error updating booking status:', error);
        return { success: false, error };
    }
}

// Remove window.FirebaseAPI and export functions directly
export { 
    db, 
    auth, 
    isFirebaseInitialized, 
    serverTimestamp, 
    saveMovie, 
    fetchMovies,
    deleteMovie,
    saveBooking,
    updateBookingStatus,
    getDoc,
    getDocs,
    collection,
    query,
    where
};
