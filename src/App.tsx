/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import { auth, db, provider, signInWithPopup, onAuthStateChanged, signOut, doc, setDoc, getDoc } from './firebase';

export default function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const currentUser = result.user;
      
      // Check if user data exists in Firestore
      const docRef = doc(db, 'users', currentUser.uid);
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
          email: currentUser.email,
          displayName: currentUser.displayName,
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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.clear(); // Clear local data on sign out
      location.reload();
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const handleSync = async () => {
    if (!user) return;
    
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
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, {
        backupData,
        lastSynced: new Date().toISOString()
      }, { merge: true });
      
      alert('Data synced to Firestore successfully');
    } catch (error) {
      console.error('Error syncing to Firestore', error);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Toukir's Flow</h1>
      {user ? (
        <div>
          <p>Welcome, {user.displayName}!</p>
          <button onClick={handleSync} style={{ marginRight: '10px' }}>Sync Data to Cloud</button>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      ) : (
        <div>
          <p>Please sign in to sync your data.</p>
          <button onClick={handleSignIn}>Sign in with Google</button>
        </div>
      )}
    </div>
  );
}
