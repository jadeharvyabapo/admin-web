/**
 * Dashboard Module
 * Displays statistics and overview
 */
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getTodayDateString } from './utils.js';
import { showNotification } from './utils.js';

/**
 * Load dashboard data
 */
export async function loadDashboard() {
    // Set loading state
    const totalEmployeesEl = document.getElementById('totalEmployees');
    const activeEmployeesEl = document.getElementById('activeEmployees');
    const todayAttendanceEl = document.getElementById('todayAttendance');
    const lateTodayEl = document.getElementById('lateToday');
    
    if (totalEmployeesEl) totalEmployeesEl.textContent = 'Loading...';
    if (activeEmployeesEl) activeEmployeesEl.textContent = 'Loading...';
    if (todayAttendanceEl) todayAttendanceEl.textContent = 'Loading...';
    if (lateTodayEl) lateTodayEl.textContent = 'Loading...';
    
    try {
        // Load employee stats - collection name is "Employees" (capital E)
        const employeesSnapshot = await getDocs(collection(db, 'Employees'));
        
        console.log('Employees snapshot:', employeesSnapshot);
        console.log('Employees size:', employeesSnapshot.size);
        console.log('Employees docs:', employeesSnapshot.docs);
        
        employeesSnapshot.docs.forEach((doc, index) => {
            console.log(`Employee ${index}:`, doc.id, doc.data());
        });
        
        const totalEmployees = employeesSnapshot.size;
        const activeEmployees = employeesSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.active !== false;
        }).length;
        
        console.log('Total employees:', totalEmployees);
        console.log('Active employees:', activeEmployees);
        
        if (totalEmployeesEl) totalEmployeesEl.textContent = totalEmployees;
        if (activeEmployeesEl) activeEmployeesEl.textContent = activeEmployees;
        
        // Load today's attendance
        const today = getTodayDateString();
        console.log('Today date string:', today);
        
        // First, try to get all attendance records to see what we have
        const allAttendanceSnapshot = await getDocs(collection(db, 'Attendance'));
        console.log('All attendance records:', allAttendanceSnapshot.size);
        allAttendanceSnapshot.docs.forEach((doc, index) => {
            console.log(`Attendance ${index}:`, doc.id, doc.data());
        });
        
        // Get today's attendance
        const attendanceQuery = query(
            collection(db, 'Attendance'),
            where('date', '==', today)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        console.log('Today attendance snapshot:', attendanceSnapshot.size);
        attendanceSnapshot.docs.forEach((doc, index) => {
            console.log(`Today attendance ${index}:`, doc.id, doc.data());
        });
        
        const todayAttendanceCount = attendanceSnapshot.size;
        let lateCount = 0;
        
        attendanceSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.morningStatus === 'Late' || 
                data.afternoonStatus === 'Late' || 
                data.overtimeStatus === 'Late') {
                lateCount++;
            }
        });
        
        // Show today's count (will be 0 if no records for today, which is correct)
        if (todayAttendanceEl) todayAttendanceEl.textContent = todayAttendanceCount;
        if (lateTodayEl) lateTodayEl.textContent = lateCount;
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Show more detailed error message
        let errorMessage = 'Failed to load dashboard data';
        if (error.code === 'permission-denied') {
            errorMessage = 'Permission denied. Please check Firestore security rules allow authenticated users to read employees and Attendance collections.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firestore is unavailable. Please check your internet connection.';
        } else if (error.message) {
            errorMessage = `Error: ${error.message}`;
        }
        
        console.error('Full error:', error);
        alert(errorMessage + '\n\nCheck browser console for details.');
        
        // Set default values on error
        if (totalEmployeesEl) totalEmployeesEl.textContent = 'Error';
        if (activeEmployeesEl) activeEmployeesEl.textContent = 'Error';
        if (todayAttendanceEl) todayAttendanceEl.textContent = 'Error';
        if (lateTodayEl) lateTodayEl.textContent = 'Error';
    }
}
