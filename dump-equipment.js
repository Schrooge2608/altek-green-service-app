const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const firebaseConfig = {
  projectId: 'demo-altek-green',
  // Local emulator or demo project?
};
// I cannot easily access the user's local Firebase unless it's running in emulator.
// The user's app connects to their live firebase.
// I can write a Next.js server action to dump the equipment names to a file.
