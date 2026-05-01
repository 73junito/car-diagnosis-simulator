/*
  Firebase config example.
  1) Create a project in Firebase Console and enable Firestore.
  2) Copy your config object into a new file named `firebase-config.js` (same folder).
  3) Keep `firebase-config.js` out of version control (add to .gitignore).

  Example below — replace the placeholder strings with your project's values.
*/

// Example: window.firebaseConfig = { apiKey: '...', authDomain: '...', projectId: '...', ... };
window.firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

// Rename this file to `firebase-config.js` and populate real values.
