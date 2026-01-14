import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, onValue, remove, push, onChildAdded, onDisconnect } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBbaSmeaXQ9sJo3PUHOhotdITXjZnc5aOU",
  authDomain: "d-woflow-fighters.firebaseapp.com",
  databaseURL: "https://d-woflow-fighters-default-rtdb.firebaseio.com",
  projectId: "d-woflow-fighters",
  storageBucket: "d-woflow-fighters.firebasestorage.app",
  messagingSenderId: "1094809949354",
  appId: "1:1094809949354:web:cadd71572092a7ba2e6cd3",
  measurementId: "G-SZ09ZGY4T4"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

export { ref, set, get, update, onValue, remove, push, onChildAdded, onDisconnect };
