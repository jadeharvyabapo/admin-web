# Attendance System - Admin Web Dashboard

A web-based admin dashboard for managing the Attendance System.

## Features

1. **Employee Management**
   - View all employees
   - Add new employees
   - Edit employee details
   - Activate/Deactivate employees
   - Filter by department and category
   - Search functionality

2. **Geofence Management**
   - Add geofences (name, latitude, longitude, radius)
   - Edit existing geofences
   - Delete geofences

3. **Attendance Monitoring**
   - View attendance records by date
   - Filter by department and category
   - Identify On-Time, Late, and Absent status
   - View morning, afternoon, and overtime sessions

4. **Test Mode Settings**
   - Enable/disable test mode
   - Set mock time for testing attendance behavior
   - Mobile app will use mock time when test mode is enabled

5. **Dashboard**
   - Overview statistics
   - Total employees count
   - Active employees count
   - Today's attendance count
   - Late count for today

## Setup Instructions

### 1. Firebase Configuration

The Firebase configuration is already set up in `admin-web/js/firebase-config.js` with your project credentials.

### 2. Admin Access

The admin dashboard uses Firebase Authentication directly. Any authenticated user can access the dashboard.

1. Use your preconfigured Firebase Auth account (email/password)
2. Simply log in with your Firebase Auth credentials
3. No additional Firestore documents needed for admin access

### 3. Firestore Collections

The admin dashboard expects the following Firestore collections:

#### `Employees` Collection (capital E)
Each document should have:
- `employeeId` (string) - Unique employee identifier
- `name` (string) - Employee name
- `role` (string) - "staff" or "faculty" (NOT "admin")
- `category` (string | null) - "organic" or "part-time" (null for staff)
- `position` (string | null) - Job position
- `department` (string) - Department name
- `administrativeFunction` (string | null) - Optional administrative function
- `modeOfInstruction` (string | null) - "FacetoFace" or "Online" (for faculty only)
- `active` (boolean) - Whether employee is active

#### `geofences` Collection
Each document should have:
- `name` (string) - Geofence name
- `latitude` (number) - Center latitude
- `longitude` (number) - Center longitude
- `radius` (number) - Radius in meters

#### `settings` Collection
Document ID: `testMode`
- `enabled` (boolean) - Whether test mode is enabled
- `mockTime` (number | null) - Mock time in milliseconds (timestamp)

### 4. Deploy the Admin Dashboard

You can deploy the admin dashboard in several ways:

#### Option A: Firebase Hosting (Recommended)
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting: `firebase init hosting`
4. Set public directory to `admin-web`
5. Deploy: `firebase deploy --only hosting`

#### Option B: Local Web Server
1. Use any local web server (e.g., Python's http.server, Node's http-server)
2. Navigate to the `admin-web` directory
3. Serve the files

#### Option C: Any Static Hosting Service
- Upload the `admin-web` folder to services like:
  - Netlify
  - Vercel
  - GitHub Pages
  - AWS S3 + CloudFront

## Usage

1. Open the admin dashboard in a web browser
2. Login with your preconfigured admin credentials (Firebase Auth email/password)
3. Navigate through the different sections using the top navigation
4. Use the dashboard to manage employees, geofences, view attendance, and configure test mode

## Security Notes

- The admin dashboard uses Firebase Authentication for login
- Only users with admin role in the `users` collection can access the dashboard
- Make sure to configure proper Firestore security rules for production use
- The dashboard should be served over HTTPS in production

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Responsive design works on desktop and tablet devices

## Troubleshooting

### "Access denied" error
- Make sure you're logged in with a valid Firebase Auth account
- Check that your email/password credentials are correct
- Verify Firebase Authentication is properly configured

### "Failed to load" errors
- Check Firebase configuration in `firebase-config.js`
- Verify Firestore security rules allow authenticated admin access
- Check browser console for detailed error messages

### Test mode not working
- Ensure `settings/testMode` document exists in Firestore
- Check that `enabled` field is set to `true`
- Verify `mockTime` is a valid timestamp (milliseconds)
