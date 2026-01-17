# Offline Profile Feature - Mobile Testing Guide

## What Was Fixed

### Issues Resolved:
1. ✅ **Cache structure mismatch** - Offline saves now use correct `{ user: {...}, success: true }` format
2. ✅ **Immediate UI update** - Profile changes now reflect instantly when saving offline
3. ✅ **Consistent cache keys** - Both GET and PUT use the same `'user-profile'` cache key
4. ✅ **Proper data propagation** - Local state updates immediately after offline save

## Testing Instructions

### Prerequisites
1. Build the app: `npm run build`
2. Start the server: `node server.js` or `npm start`
3. Access on mobile via your local IP (e.g., `http://192.168.1.x:3000`)

### Test 1: Online Profile Save
1. Navigate to `/profile-pwa`
2. Ensure "Online" indicator shows in top-right
3. Edit your name, email, or bio
4. Click "Save Changes"
5. ✅ Should show "Profile updated successfully!"
6. Refresh the page
7. ✅ Changes should persist

### Test 2: Offline Profile Save
1. Navigate to `/profile-pwa`
2. Open browser DevTools (Chrome on mobile: `chrome://inspect`)
3. Go to Network tab → Check "Offline" checkbox
   - **OR on mobile**: Enable Airplane mode
4. Verify "Offline" indicator appears (orange badge)
5. Edit your profile (name, email, bio)
6. Click "Save Changes"
7. ✅ Should show "Saved locally! Will sync when online."
8. ✅ **NEW**: Changes should appear immediately in the form
9. ✅ Yellow banner should appear with "Sync Now" button
10. Navigate away and come back to `/profile-pwa`
11. ✅ Your offline changes should still be there

### Test 3: Sync After Coming Online
1. While still having offline changes (yellow banner visible)
2. Disable offline mode / Turn off Airplane mode
3. Wait for "Online" indicator to appear (green badge)
4. Click "Sync Now" button in the yellow banner
5. ✅ Should show "Changes synced successfully!"
6. ✅ Yellow banner should disappear
7. ✅ Profile should reload from server

### Test 4: Offline → Close App → Reopen
1. Go offline (Airplane mode or DevTools offline)
2. Make profile changes and save
3. ✅ Verify "Saved locally!" message
4. Close the browser/app completely
5. Reopen the app and navigate to `/profile-pwa`
6. ✅ Your offline changes should still be there (IndexedDB persistence)
7. ✅ Yellow "Sync Now" banner should appear
8. Go online and click "Sync Now"
9. ✅ Changes should sync to server

### Test 5: Multiple Offline Edits
1. Go offline
2. Edit name → Save → ✅ See confirmation
3. Edit bio → Save → ✅ See confirmation  
4. Edit email → Save → ✅ See confirmation
5. All changes should be visible in the form
6. Go online
7. Click "Sync Now"
8. ✅ All changes should sync in order

## Expected Behavior Summary

| Scenario | Expected Outcome |
|----------|-----------------|
| Save while **online** | ✅ Saves to server immediately, shows success |
| Save while **offline** | ✅ Saves locally, shows in UI immediately, queues for sync |
| Return **online** with queued changes | ✅ Shows yellow banner with "Sync Now" button |
| Click "Sync Now" | ✅ Sends all queued changes to server, reloads profile |
| Refresh while **offline** | ✅ Shows cached data, displays "Cannot refresh while offline" |
| Close/reopen app with offline changes | ✅ Changes persist (IndexedDB), sync banner appears |

## Mobile Browser Testing

### Chrome (Android)
1. Open Chrome on Android
2. Visit your app URL
3. Chrome DevTools: Desktop Chrome → `chrome://inspect` → Connect device
4. Enable "Offline" in Network tab

### Safari (iOS)
1. Open Safari on iPhone
2. Visit your app URL  
3. Desktop Safari → Develop → [Your iPhone] → Enable "Disable Caches"
4. Or use Airplane mode on the device

### PWA Install Test (Bonus)
1. Visit `/profile-pwa` on mobile browser
2. Look for "Add to Home Screen" prompt
3. Install the app
4. Launch from home screen
5. Test offline functionality as standalone app

## Console Debugging

Open browser console to see debug messages:

```
Online: Fetching from API... /api/public/profile
✅ Saved to cache with key: user-profile

Offline: Queueing request for later
✅ Cached locally with key: user-profile

Back online! You can now sync your changes.
Processing queued action: /api/public/profile
✅ Successfully synced: /api/public/profile
```

## Common Issues & Solutions

### Issue: Changes don't appear after offline save
- ✅ **FIXED**: Profile state now updates immediately in `handleSave()`

### Issue: Sync button doesn't appear
- Check: `hasQueuedChanges.value` should be `true`
- Check console for queue errors
- Solution: Clear IndexedDB and try again

### Issue: "Cannot refresh while offline"
- Expected behavior when offline
- Use cached data until back online

### Issue: Data doesn't persist after app close
- Check if IndexedDB is supported
- Check browser storage settings
- Private/Incognito mode may clear storage

## Developer Tools Commands

```javascript
// Check IndexedDB in browser console
indexedDB.databases().then(console.log)

// Check what's in cache
const request = indexedDB.open('EaseMyCargoDB', 1)
request.onsuccess = () => {
  const db = request.result
  const tx = db.transaction('cache', 'readonly')
  const store = tx.objectStore('cache')
  const getAll = store.getAll()
  getAll.onsuccess = () => console.log('Cache:', getAll.result)
}

// Check queue
// (Same as above but use 'queue' instead of 'cache')
```

## Success Criteria

✅ Profile saves instantly when offline  
✅ Changes visible immediately in UI  
✅ Yellow sync banner appears when offline changes exist  
✅ Sync button works when back online  
✅ Data persists across app restarts  
✅ No errors in console  
✅ Works on both mobile browsers and installed PWA  

---

**Note**: Make sure service worker is registered. Check Application tab in DevTools → Service Workers.
