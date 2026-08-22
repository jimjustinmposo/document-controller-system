# Document Controller - Double Click Bug Fix

## Problem Summary
When clicking the "Advance" button to move a document to the next stage, the UI doesn't update until you click it a **second time**. This is a frustrating user experience.

---

## Root Cause Analysis

### The Buggy Code (Lines 68-71)
```javascript
const moveWithRefresh=async(id,dir)=>{
  await load();        // ❌ WRONG: Load OLD data first
  await move(id,dir);  // Send advance request
};
```

### What Happens:
1. **First Click:**
   - `load()` fetches the CURRENT state from server (unchanged)
   - `move()` sends POST request to advance document
   - UI still shows OLD state because no re-fetch happened after move
   - User sees no change

2. **Second Click:**
   - `load()` now fetches the NEW state (from the previous click's move)
   - User finally sees the change from click #1

### The Logic Error:
The function loads data **BEFORE** making the change, not **AFTER**. It's like asking "What's in the fridge?" → "Let me check" → but then you don't check after you take something out.

---

## Solution

### The Fix (Reversed Order)
```javascript
const moveWithRefresh=async(id,dir)=>{
  await move(id,dir);  // ✅ CORRECT: Make the move first
  await load();        // ✅ Then fetch updated data
};
```

### Why This Works:
1. **First Click:**
   - `move()` sends POST request to server, document advances
   - `load()` immediately fetches FRESH data from server
   - UI updates with new state instantly
   - User sees result immediately ✅

2. **Second Click:**
   - Same process, updates happen immediately ✅

---

## Changes Made

### File: `main.jsx` (Lines 63-66)

**Before:**
```javascript
const moveWithRefresh=async(id,dir)=>{
  await load();
  await move(id,dir);
};
```

**After:**
```javascript
// Move first, THEN refresh to get updated data immediately
const moveWithRefresh=async(id,dir)=>{
  await move(id,dir);
  await load();
};
```

### Bonus Fix: Detail Panel (Lines 493-510)
Also fixed the `doMove` function in the Detail component to follow the same pattern:

**Before:**
```javascript
const doMove=async dir=>{
  if(busy)return;
  setBusy(true);
  try{
    await load();      // Wrong order
    await move(id,dir);
  }finally{
    setBusy(false);
  }
};
```

**After:**
```javascript
const doMove=async dir=>{
  if(busy)return;
  setBusy(true);
  try{
    await move(id,dir); // Correct order
    await load();
  }finally{
    setBusy(false);
  }
};
```

---

## Testing the Fix

After applying the changes:

1. ✅ Click "Advance" button once
2. ✅ Watch the document stage update immediately
3. ✅ No need to click twice
4. ✅ Same behavior for "Back" button
5. ✅ Works in both Documents list view and Detail panel

---

## Technical Details

### Why Order Matters in Async/Await

```javascript
// WRONG - loads old data then makes change (no update)
await load();        // Server: "State is X"
await move(id,dir);  // Server: "Changed to Y"
// UI still shows X because we loaded before the change

// RIGHT - makes change then loads new data (instant update)
await move(id,dir);  // Server: "Changed to Y"
await load();        // Server: "State is Y"
// UI shows Y immediately because we loaded after
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| Clicks needed | 2 | 1 |
| User experience | Confusing | Instant feedback |
| API calls | Same (1 advance + 2 loads) | Same (1 advance + 1 load) |
| Code complexity | Same | Same |

**This is a simple order-of-operations fix that makes a huge UX difference!**
