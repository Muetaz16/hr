import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyA08OvHbbBR9AkYYuERhwTgAiQ5T93Xs8M",
    authDomain: "iph-hr-system.firebaseapp.com",
    projectId: "iph-hr-system",
    storageBucket: "iph-hr-system.firebasestorage.app",
    messagingSenderId: "953795040648",
    appId: "1:953795040648:web:ec5339df146602f867163d",
    measurementId: "G-LZQY3HGJWF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
