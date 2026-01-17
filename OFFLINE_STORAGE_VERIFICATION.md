# Offline Storage Verification Guide

## How to Verify Profile Data is Saved Locally

### Method 1: Browser DevTools (Desktop Chrome/Firefox)

1. **Open the app**: Go to `https://easemycargo77-auckg4bkedcfhsh0.eastus2-01.azurewebsites.net/profile-pwa`
2. **Open DevTools**: Press `F12` or Right-click → Inspect
3. **Go to Application tab** (Chrome) or Storage tab (Firefox)
4. **Click IndexedDB** → `EaseMyCargoDB` → `cache`
5. **Look for an entry with key**: `user-profile`

### Method 2: Console Commands

Open DevTools Console and run:

```javascript
// Check if IndexedDB is available
console.log('IndexedDB available:', !!window.indexedDB)

// Check what's in the cache
const request = indexedDB.open('EaseMyCargoDB', 1)
request.onsuccess = () => {
  const db = request.result
  const tx = db.transaction('cache', 'readonly')
  const store = tx.objectStore('cache')
  const getAllRequest = store.getAll()
  
  getAllRequest.onsuccess = () => {
    console.log('Cache contents:', getAllRequest.result)
  }
}

// Check what's in the queue (pending syncs)
const queueRequest = indexedDB.open('EaseMyCargoDB', 1)
queueRequest.onsuccess = () => {
  const db = queueRequest.result
  const tx = db.transaction('queue', 'readonly')
  const store = tx.objectStore('queue')
  const getAllRequest = store.getAll()
  
  getAllRequest.onsuccess = () => {
    console.log('Queue contents (pending syncs):', getAllRequest.result)
  }
}
```

### Method 3: Test the Complete Flow

**Step 1: Go Online and Load Profile**
```
1. Visit /profile-pwa
2. Verify profile loads (should show your name, email, bio)
3. Check DevTools → IndexedDB → EaseMyCargoDB → cache
4. Should see entry with key "user-profile" containing your data
```

**Step 2: Go Offline and Edit**
```
1. Enable Airplane Mode (or DevTools Offline mode)
2. Wait for "Offline" badge to turn orange
3. Edit the bio field (add some text like "Flight Attendant")
4. Click "Save Changes"
5. Should see: "Saved locally! Will sync when online."
6. Yellow sync banner should appear
```

**Step 3: Verify Data Saved Locally**
```
1. Open DevTools Console
2. Run the console command above for cache contents
3. Should see your updated bio in the cache
4. Example output:
   {
     "key": "user-profile",
     "value": {
       "user": {
         "name": "...",
         "email": "...",
         "bio": "Flight Attendant" ← YOUR CHANGE
       },
       "success": true
     },
     "timestamp": 1705513200000,
     "ttl": 86400
   }
```

**Step 4: Refresh Page While Offline**
```
1. Still in offline mode
2. Click "Refresh" button
3. Should see: "Loaded from local storage (offline)"
4. Your bio changes should still be visible
```

**Step 5: Go Online and Sync**
```
1. Disable Airplane Mode / Enable internet
2. Wait for badge to turn green (Online)
3. Should see "Sync Now" button in yellow banner
4. Click "Sync Now"
5. Should see: "Changes synced successfully!"
6. Profile should reload from server
7. Check queue is now empty (no pending items)
```

## Expected Console Output

### When Data is Saved (Offline Save)
```
Offline: Queueing request for later
(ProfilePage) Saved locally! Will sync when online.
```

### When Data is Synced (Online)
```
Back online! You can now sync your changes.
Processing queued action: /api/public/profile
Successfully synced: /api/public/profile
Changes synced successfully!
```

## Troubleshooting

### Issue: Cache is empty after saving offline
**Check:**
- Is IndexedDB supported in the browser?
- Are you using private/incognito mode? (Clear storage)
- Check console for errors

**Solution:**
```javascript
// Force check IndexedDB support
console.log('IndexedDB:', 'indexedDB' in window ? 'Supported' : 'Not supported')
console.log('LocalStorage:', 'localStorage' in window ? 'Supported' : 'Not supported')
```

### Issue: Data saved but refresh loses it
**Check:**
- Is TTL expired? (Should be 24 hours)
- Browser storage might be cleared
- Private browsing might auto-clear storage

### Issue: Sync button doesn't appear after going online
**Check:**
- Queue has pending actions: Use console command to check queue
- Network is actually online: Check browser network tab
- Refresh the page to re-check queue

## Mobile Testing (Chrome Remote Debugging)

**For Android:**
1. Connect Android phone via USB
2. On desktop, open `chrome://inspect`
3. Find your phone and click "inspect"
4. Now you can use DevTools on desktop to debug mobile
5. Go to Application → IndexedDB same as desktop

**For iOS:**
1. Connect iPhone to Mac
2. Safari → Develop → [Your iPhone]
3. Select the tab running your app
4. Web Inspector → Storage → IndexedDB

## Success Criteria

✅ Cache shows `user-profile` key with your data  
✅ Offline edits appear in cache after save  
✅ Refresh loads from cache when offline  
✅ Queue shows pending actions when offline  
✅ Queue clears after successful sync  
✅ Profile reloads from server after sync  

---

**Note**: All data is stored locally on the device. Clearing browser data will remove cached profiles and pending syncs.
