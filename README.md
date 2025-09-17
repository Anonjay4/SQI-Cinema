# SQI Cinema Booking App

SQI Cinema is a web-based movie booking experience for selecting movies, reserving seats, and purchasing tickets with integrated payment and email confirmation flows. The application uses Firebase for persistence and Paystack for payments.

## Features

- 🎬 **Movie catalogue** with now showing and coming soon titles sourced from Firestore.
- 🗓️ **Date and showtime selection** with local-timezone handling to avoid mismatched bookings.
- 💺 **Interactive seat map** that reflects taken seats for each movie, date, and showtime.
- 🍿 **Food & drinks add-ons** with automatic pricing in the booking summary.
- 💳 **Paystack payment integration** and transactional email notifications through Brevo.
- 🛠️ **Admin dashboard** for managing movies and reviewing bookings.

## Tech Stack

- HTML, CSS, and vanilla JavaScript
- Firebase (Firestore & Authentication)
- Paystack Payments
- Brevo transactional email API

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/sqi-cinema.git
   cd sqi-cinema
   ```
2. Serve the site using any static file server (for example with VS Code Live Server or `npx serve .`).
3. Update the Firebase configuration in `firebase.js` if you need to point to a different project.
4. For payments, replace the Paystack public key in `script.js` with your own test or live key.
5. (Optional) Update the Brevo API key in `script.js` if you plan to use email notifications.

## Firebase Setup Tips

- Ensure Firestore has `movies`, `bookings`, and `seats` collections.
- The admin panel (available under `/admin/index.html`) requires Firebase Authentication credentials; configure users in the Firebase console.
- When deploying, configure Firestore security rules to restrict write access as needed.

## Seat Reservation Logic

Each confirmed booking stores a normalized `YYYY-MM-DD` date string and updates a `seats/{movie-date-showtime}` document. The client uses these details to mark seats as taken for the corresponding movie, date, and showtime, preventing double bookings.

## Contributing

1. Fork the repository and create a feature branch.
2. Commit your changes with clear messages.
3. Open a pull request describing your updates.

## License

This project is provided as-is for educational purposes. Adapt and customize it to fit your cinema experience.
