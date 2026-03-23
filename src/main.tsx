import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, getDoc } from './firebase';

// Expose Firebase functions to the global window object for the inline scripts in index.html
declare global {
  interface Window {
    signInWithGoogle: () => Promise<void>;
    signOutUser: () => Promise<void>;
    currentUser: any;
    syncToFirestore: () => Promise<void>;
  }
}

window.signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    window.currentUser = user;
    
    // Check if user data exists in Firestore
    const docRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.backupData) {
        // Restore data to localStorage
        Object.entries(data.backupData).forEach(([k, v]) => {
          try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch(e) {}
        });
      }
    } else {
      // Create new user document
      await setDoc(docRef, {
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date().toISOString()
      });
    }
    
    // Reload the page to apply the data
    location.reload();
  } catch (error) {
    console.error('Error signing in with Google', error);
    alert('Error signing in with Google. Please try again.');
  }
};

window.signOutUser = async () => {
  try {
    await signOut(auth);
    window.currentUser = null;
    localStorage.clear(); // Clear local data on sign out
    location.reload();
  } catch (error) {
    console.error('Error signing out', error);
  }
};

window.syncToFirestore = async () => {
  if (!window.currentUser) return;
  
  try {
    // Collect all data to backup
    const backupData: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        try {
          backupData[key] = JSON.parse(value || '');
        } catch (e) {
          backupData[key] = value;
        }
      }
    }
    
    // Save to Firestore
    const docRef = doc(db, 'users', window.currentUser.uid);
    await setDoc(docRef, {
      backupData,
      lastSynced: new Date().toISOString()
    }, { merge: true });
    
    console.log('Data synced to Firestore successfully');
  } catch (error) {
    console.error('Error syncing to Firestore', error);
  }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.currentUser = user;
    // Dispatch an event so the inline scripts know the user is authenticated
    window.dispatchEvent(new CustomEvent('userAuthenticated', { detail: user }));
  } else {
    window.currentUser = null;
    window.dispatchEvent(new CustomEvent('userSignedOut'));
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
