/**
 * Attendance Monitoring Module
 */
import { db } from './firebase-config.js';
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getTodayDateString, formatTime, showNotification } from './utils.js';

/**
 * Load attendance data
 */
export async function loadAttendance() {
    try {
        // Set today's date as default
        const dateInput = document.getElementById('attendanceDate');
        if (dateInput && !dateInput.value) {
            dateInput.value = getTodayDateString();
        }
        
        // Load departments for filter - collection name is "Employees" (capital E)
        const employeesSnapshot = await getDocs(collection(db, 'Employees'));
        const departments = [...new Set(employeesSnapshot.docs
            .map(doc => doc.data().department)
            .filter(Boolean))];
        
        const deptFilter = document.getElementById('attendanceDepartmentFilter');
        if (deptFilter) {
            deptFilter.innerHTML = '<option value="">All Departments</option>';
            departments.forEach(dept => {
                const option = document.createElement('option');
                option.value = dept;
                option.textContent = dept;
                deptFilter.appendChild(option);
            });
        }
        
        await renderAttendance();
    } catch (error) {
        console.error('Error loading attendance:', error);
        showNotification('Failed to load attendance data', 'error');
    }
}

/**
 * Render attendance table
 */
async function renderAttendance() {
    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    
    const date = document.getElementById('attendanceDate')?.value || getTodayDateString();
    const deptFilter = document.getElementById('attendanceDepartmentFilter')?.value || '';
    const categoryFilter = document.getElementById('attendanceCategoryFilter')?.value || '';
    
    try {
        // First, get all attendance records to debug
        const allAttendanceSnapshot = await getDocs(collection(db, 'Attendance'));
        console.log('All attendance records:', allAttendanceSnapshot.size);
        allAttendanceSnapshot.docs.forEach((doc, index) => {
            console.log(`Attendance doc ${index}:`, {
                id: doc.id,
                data: doc.data()
            });
        });
        
        // Get attendance records for the selected date
        const attendanceQuery = query(
            collection(db, 'Attendance'),
            where('date', '==', date)
        );
        const attendanceSnapshot = await getDocs(attendanceQuery);
        
        console.log('Filtered attendance for date', date, ':', attendanceSnapshot.size);
        
        // Get employee data - collection name is "Employees" (capital E)
        const employeesSnapshot = await getDocs(collection(db, 'Employees'));
        console.log('Employees for attendance:', employeesSnapshot.size);
        const employeesMap = new Map();
        
        // Build comprehensive mapping
        employeesSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const docId = doc.id;
            const empIdField = data.employeeId;
            
            console.log('Employee mapping:', {
                docId: docId,
                employeeIdField: empIdField,
                name: data.name
            });
            
            // Map by document ID
            employeesMap.set(docId, data);
            
            // Map by employeeId field if it exists
            if (empIdField) {
                employeesMap.set(empIdField, data);
            }
            
            // Also try lowercase versions in case of case sensitivity issues
            if (empIdField) {
                employeesMap.set(empIdField.toLowerCase(), data);
                employeesMap.set(empIdField.toUpperCase(), data);
            }
            employeesMap.set(docId.toLowerCase(), data);
            employeesMap.set(docId.toUpperCase(), data);
        });
        
        let attendanceData = [];
        
        attendanceSnapshot.forEach(doc => {
            const attData = doc.data();
            const attEmployeeId = attData.employeeId;
            
            console.log('Processing attendance:', {
                docId: doc.id,
                employeeId: attEmployeeId,
                date: attData.date
            });
            
            // Try multiple ways to find the employee
            let emp = null;
            
            // 1. Try by employeeId field from attendance (exact match)
            if (attEmployeeId) {
                emp = employeesMap.get(attEmployeeId);
            }
            
            // 2. Try case-insensitive match
            if (!emp && attEmployeeId) {
                emp = employeesMap.get(attEmployeeId.toLowerCase()) || 
                      employeesMap.get(attEmployeeId.toUpperCase());
            }
            
            // 3. Try by document ID (maybe employeeId in attendance is the document ID)
            if (!emp && attEmployeeId) {
                emp = employeesSnapshot.docs.find(d => d.id === attEmployeeId)?.data();
            }
            
            // 4. If still not found, try to extract from attendance document ID (format: employeeId_date)
            if (!emp) {
                const docIdParts = doc.id.split('_');
                if (docIdParts.length > 0) {
                    const possibleEmpId = docIdParts[0];
                    emp = employeesMap.get(possibleEmpId);
                    if (!emp) {
                        emp = employeesMap.get(possibleEmpId.toLowerCase()) || 
                              employeesMap.get(possibleEmpId.toUpperCase());
                    }
                    if (!emp) {
                        emp = employeesSnapshot.docs.find(d => d.id === possibleEmpId)?.data();
                    }
                }
            }
            
            // 5. Last resort: search all employees by employeeId field
            if (!emp && attEmployeeId) {
                emp = employeesSnapshot.docs.find(d => {
                    const data = d.data();
                    return (data.employeeId === attEmployeeId) || 
                           (data.employeeId?.toLowerCase() === attEmployeeId.toLowerCase());
                })?.data();
            }
            
            console.log('Found employee:', emp ? { name: emp.name, docId: 'found' } : 'NOT FOUND');
            
            // Apply filters
            if (deptFilter && emp?.department !== deptFilter) return;
            if (categoryFilter && attData.category !== categoryFilter) return;
            
            // Get mode of instruction from attendance record, fallback to employee record
            const modeOfInstruction = attData.modeOfInstruction || emp?.modeOfInstruction || null;
            
            attendanceData.push({
                employeeId: attData.employeeId,
                name: emp?.name || '-',
                date: attData.date,
                modeOfInstruction: modeOfInstruction,
                morning: {
                    in: attData.morningClockInTime,
                    out: attData.morningClockOutTime,
                    status: attData.morningStatus
                },
                afternoon: {
                    in: attData.afternoonClockInTime,
                    out: attData.afternoonClockOutTime,
                    status: attData.afternoonStatus
                },
                overtime: {
                    in: attData.overtimeClockInTime,
                    out: attData.overtimeClockOutTime,
                    status: attData.overtimeStatus
                }
            });
        });
        
        tbody.innerHTML = '';
        
        if (attendanceData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No attendance records found</td></tr>';
            return;
        }
        
        attendanceData.forEach(att => {
            const row = document.createElement('tr');
            
            // Determine overall status
            let overallStatus = 'Present';
            let statusClass = 'status-on-time';
            
            if (!att.morning.in && !att.afternoon.in && !att.overtime.in) {
                overallStatus = 'Absent';
                statusClass = 'status-absent';
            } else if (att.morning.status === 'Late' || 
                      att.afternoon.status === 'Late' || 
                      att.overtime.status === 'Late') {
                overallStatus = 'Late';
                statusClass = 'status-late';
            }
            
            // Format mode of instruction display
            let modeDisplay = att.modeOfInstruction;
            if (!modeDisplay || modeDisplay === '-') {
                modeDisplay = '-';
            } else if (modeDisplay === 'FacetoFace') {
                modeDisplay = 'Face-to-Face';
            } else if (modeDisplay === 'Online') {
                modeDisplay = 'Work from Home';
            }
            
            // Format session times - show "-" if no data, otherwise show times
            const formatSessionTime = (inTime, outTime) => {
                if (!inTime && !outTime) return '-';
                const inStr = formatTime(inTime);
                const outStr = formatTime(outTime);
                return `${inStr} - ${outStr}`;
            };
            
            row.innerHTML = `
                <td>${att.employeeId}</td>
                <td>${att.name}</td>
                <td>${att.date}</td>
                <td>${modeDisplay}</td>
                <td>
                    ${formatSessionTime(att.morning.in, att.morning.out)}
                    ${att.morning.status ? `<br><span class="status-badge ${att.morning.status === 'Late' ? 'status-late' : 'status-on-time'}">${att.morning.status}</span>` : ''}
                </td>
                <td>
                    ${formatSessionTime(att.afternoon.in, att.afternoon.out)}
                    ${att.afternoon.status ? `<br><span class="status-badge ${att.afternoon.status === 'Late' ? 'status-late' : 'status-on-time'}">${att.afternoon.status}</span>` : ''}
                </td>
                <td>
                    ${formatSessionTime(att.overtime.in, att.overtime.out)}
                    ${att.overtime.status ? `<br><span class="status-badge ${att.overtime.status === 'Late' ? 'status-late' : 'status-on-time'}">${att.overtime.status}</span>` : ''}
                </td>
                <td>
                    <span class="status-badge ${statusClass}">${overallStatus}</span>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Error rendering attendance:', error);
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Error loading attendance data</td></tr>';
    }
}

// Filter handlers
document.getElementById('attendanceDate')?.addEventListener('change', renderAttendance);
document.getElementById('attendanceDepartmentFilter')?.addEventListener('change', renderAttendance);
document.getElementById('attendanceCategoryFilter')?.addEventListener('change', renderAttendance);
document.getElementById('refreshAttendanceBtn')?.addEventListener('click', renderAttendance);
