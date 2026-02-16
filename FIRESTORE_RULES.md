# Firestore Security Rules for Admin Dashboard

The admin dashboard requires Firestore security rules that allow authenticated users to read and write to specific collections.

## Required Rules

Go to Firebase Console → Firestore Database → Rules tab and use these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write Employees collection
    match /Employees/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write Attendance collection
    match /Attendance/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write geofences collection
    match /geofences/{document=**} {
      allow read, write: if request.auth != null;
    }
    
    // Allow authenticated users to read/write settings collection
    match /settings/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## How to Apply

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `attendance-system-c73f0`
3. Click on **Firestore Database** in the left menu
4. Click on the **Rules** tab
5. Copy and paste the rules above
6. Click **Publish** (important: not just Save!)

## Testing

After publishing the rules:
1. Wait 30-60 seconds for rules to propagate
2. Refresh the admin dashboard
3. The dashboard should now load data successfully

**Note:** Face verification uses only face embeddings (numeric vectors) stored in Firestore—no raw images are stored. Firebase Storage is not required for face verification.

## Troubleshooting

If you still see "Failed to load dashboard data":
1. Check browser console (F12) for detailed error messages
2. Verify you're logged in (check Firebase Auth)
3. Verify rules are published (not just saved)
4. Wait a bit longer for rules to propagate
5. Try logging out and logging back in

