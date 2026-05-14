import { auth } from './firebase.js';
import { signInWithEmailAndPassword } from 'firebase/auth';

console.log('Testing login...');
signInWithEmailAndPassword(auth, 'demo.shop@servicehub.com', 'demo123').then(() => {
  console.log('Logged in successfully!');
}).catch(console.error);
