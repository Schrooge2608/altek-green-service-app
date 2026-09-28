const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc } = require('firebase/firestore');

// Since we cannot run this directly against their live prod database without service accounts,
// we will build a small client-side "Wipe Data" button into the page temporarily, or just wipe it inside the Bulk Import function.
