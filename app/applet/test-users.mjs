import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./src/firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const usersSnap = await getDocs(collection(db, 'users'));
  const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log("USERS:", JSON.stringify(users.map(u => ({id: u.id, email: u.email, role: u.role, createdAt: u.createdAt})), null, 2));
  
  const ordersSnap = await getDocs(collection(db, 'orders'));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const missingEmailOrders = orders.filter(o => !o.userEmail);
  console.log("Orders without email:", missingEmailOrders.length);
}

run();
