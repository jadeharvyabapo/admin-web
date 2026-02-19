/**
 * Reports Module - DTR Download and Attendance Reports
 */
import { db } from './firebase-config.js';
import { collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { showNotification } from './utils.js';

let employeesData = [];

/**
 * Load employees for dropdowns
 */
async function loadEmployees() {
    try {
        const snapshot = await getDocs(collection(db, 'Employees'));
        employeesData = snapshot.docs.map(doc => ({
            id: doc.id,
            employeeId: doc.data().employeeId || doc.id,
            name: doc.data().name || doc.id,
            ...doc.data()
        }));
        
        // Populate DTR employee dropdown
        const dtrSelect = document.getElementById('dtrEmployeeSelect');
        if (dtrSelect) {
            dtrSelect.innerHTML = '<option value="">Select Employee</option>';
            employeesData.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.employeeId || emp.id} - ${emp.name || 'Unknown'}`;
                dtrSelect.appendChild(option);
            });
        }
        
        // Populate report employee dropdown
        const reportSelect = document.getElementById('reportEmployeeSelect');
        if (reportSelect) {
            reportSelect.innerHTML = '<option value="">Select Employee</option>';
            employeesData.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = `${emp.employeeId || emp.id} - ${emp.name || 'Unknown'}`;
                reportSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading employees:', error);
        showNotification('Failed to load employees', 'error');
    }
}

/**
 * Format timestamp to time string (12-hour, no AM/PM - matches Android DTR 24)
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Force PDF download via blob link (ensures file appears in Downloads)
 */
function downloadPdfBlob(pdfDoc, fileName) {
    const blob = pdfDoc.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Format date string
 */
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
}

/**
 * Get all dates in range
 */
function getDatesInRange(startDate, endDate) {
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

/**
 * Download DTR PDF for selected employee and date range
 */
async function downloadDTR() {
    const employeeId = document.getElementById('dtrEmployeeSelect').value;
    const startDate = document.getElementById('dtrStartDate').value;
    const endDate = document.getElementById('dtrEndDate').value;
    
    if (!employeeId || !startDate || !endDate) {
        showNotification('Please select employee and date range', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showNotification('Start date must be before end date', 'error');
        return;
    }
    
    try {
        const employee = employeesData.find(e => e.id === employeeId);
        if (!employee) {
            showNotification('Employee not found', 'error');
            return;
        }
        
        showNotification('Loading attendance data...', 'info');
        
        // For DTR 24 we use one month (same as user app). Use month of start date.
        const start = new Date(startDate + 'T12:00:00');
        const year = start.getFullYear();
        const month = start.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();
        const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        
        const dates = getDatesInRange(monthStart, monthEnd);
        const attendanceRecords = [];
        
        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];
            try {
                const snap = await getDocs(query(
                    collection(db, 'Attendance'),
                    where('employeeId', '==', employee.employeeId || employee.id),
                    where('date', '==', dateStr)
                ));
                
                if (!snap.empty) {
                    const data = snap.docs[0].data();
                    attendanceRecords.push({ date: dateStr, ...data });
                } else {
                    attendanceRecords.push({ date: dateStr, employeeId: employee.employeeId || employee.id });
                }
            } catch (err) {
                console.error(`Error fetching attendance for ${dateStr}:`, err);
            }
        }
        
        generateDTRPDF(employee, monthStart, monthEnd, attendanceRecords);
        
    } catch (error) {
        console.error('Error downloading DTR:', error);
        showNotification('Failed to download DTR: ' + error.message, 'error');
    }
}

/**
 * Generate DTR PDF - same output as Android DTR 24 (Civil Service Form No. 48)
 * One page, two forms side-by-side (original and copy). Per-month like the app.
 */
function generateDTRPDF(employee, startDate, endDate, records) {
    const { jsPDF } = window.jspdf;
    // A4 size to match Android: 595 x 842 pt
    const doc = new jsPDF('portrait', 'pt', 'a4');
    
    const PAGE_WIDTH = 595;
    const PAGE_HEIGHT = 842;
    const MARGIN = 28;
    const CENTER_GAP = 8;
    const HALF_PAGE_WIDTH = (PAGE_WIDTH - CENTER_GAP) / 2;
    
    const recordsByDate = {};
    records.forEach(rec => { recordsByDate[rec.date] = rec; });
    
    // Use first month in range for "For the month of" (same as user DTR)
    const monthYear = new Date(startDate + 'T12:00:00');
    const monthStr = monthYear.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    // Left form (original)
    drawDTRForm48(doc, employee, monthStr, startDate, endDate, recordsByDate, 0, HALF_PAGE_WIDTH, MARGIN);
    // Right form (copy)
    drawDTRForm48(doc, employee, monthStr, startDate, endDate, recordsByDate, HALF_PAGE_WIDTH + CENTER_GAP, HALF_PAGE_WIDTH, MARGIN);
    
    const safeName = (employee.name || employee.employeeId || 'Employee').replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `DTR_${safeName}_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.pdf`;
    
    downloadPdfBlob(doc, fileName);
    showNotification('DTR PDF downloaded successfully', 'success');
}

/**
 * Draw one Civil Service Form No. 48 (matches Android DtrPdfGenerator layout)
 */
function drawDTRForm48(doc, employee, monthStr, startDate, endDate, recordsByDate, xOffset, formWidth, MARGIN) {
    const COL_DAY = 24;
    const COL_TIME = 30;
    const COL_UND_HOURS = 28;
    const COL_UND_MINUTES = 30;
    const ROW_HEIGHT = 13;
    const HEADER_ROW_HEIGHT = 14;
    const TABLE_TOP_OFFSET = 72;
    
    let y = TABLE_TOP_OFFSET;
    const x = xOffset + MARGIN;
    const formCenterX = xOffset + formWidth / 2;
    const contentRight = xOffset + formWidth - MARGIN;
    
    // ----- Header (centered) -----
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Civil Service Form No. 48', formCenterX, y, { align: 'center' });
    y += 14;
    
    doc.setFontSize(14);
    doc.text('DAILY TIME RECORD', formCenterX, y, { align: 'center' });
    y += 16;
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text('-----o0o-----', formCenterX, y, { align: 'center' });
    y += 18;
    
    const userName = employee.name || employee.employeeId || 'N/A';
    doc.text(' ' + userName, formCenterX, y, { align: 'center' });
    y += 4;
    doc.line(xOffset + MARGIN, y, xOffset + formWidth - MARGIN, y);
    y += 14;
    doc.text('(Name)', formCenterX, y, { align: 'center' });
    y += 20;
    
    // For the month of / Regular days | Saturdays
    doc.setFont(undefined, 'normal');
    doc.text('For the month of: ' + monthStr, x, y);
    doc.text('Regular days', contentRight - 90, y);
    y += 12;
    doc.text('Official hours for arrival and departure', x, y);
    doc.text('Saturdays', contentRight - 90, y);
    y += 14;
    
    const x0 = x;
    const x1 = x0 + COL_DAY;
    const x2 = x1 + COL_TIME;
    const x3 = x2 + COL_TIME;
    const x4 = x3 + COL_TIME;
    const x5 = x4 + COL_TIME;
    const x6 = x5 + COL_UND_HOURS;
    const x7 = x6 + COL_UND_MINUTES;
    const tableLeft = x0;
    const tableRight = x7;
    const headerRow1Y = y;
    y += HEADER_ROW_HEIGHT;
    const headerRow2Y = y;
    y += HEADER_ROW_HEIGHT;
    const tableTopY = y;
    const tableBottomY = tableTopY + 31 * ROW_HEIGHT + ROW_HEIGHT;
    
    // Vertical lines
    [x0, x1, x2, x3, x4, x5, x6, x7].forEach(cx => {
        doc.line(cx, headerRow1Y, cx, tableBottomY);
    });
    // Horizontal lines
    let lineY = headerRow1Y;
    doc.line(tableLeft, lineY, tableRight, lineY);
    lineY = headerRow2Y;
    doc.line(tableLeft, lineY, tableRight, lineY);
    lineY = tableTopY;
    for (let row = 0; row <= 32; row++) {
        doc.line(tableLeft, lineY, tableRight, lineY);
        lineY += ROW_HEIGHT;
    }
    
    // Header row 1
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('Day', x0 + 3, headerRow1Y + HEADER_ROW_HEIGHT - 3);
    doc.setFont(undefined, 'normal');
    doc.text('A.M.', (x1 + x3) / 2, headerRow1Y + HEADER_ROW_HEIGHT - 3, { align: 'center' });
    doc.text('P.M.', (x3 + x5) / 2, headerRow1Y + HEADER_ROW_HEIGHT - 3, { align: 'center' });
    doc.text('Undertime', (x5 + x7) / 2, headerRow1Y + HEADER_ROW_HEIGHT - 3, { align: 'center' });
    
    const header2Baseline = headerRow2Y + HEADER_ROW_HEIGHT - 3;
    doc.text('Arrival', (x1 + x2) / 2, header2Baseline, { align: 'center' });
    doc.text('Depar-ture', (x2 + x3) / 2, header2Baseline, { align: 'center' });
    doc.text('Arrival', (x3 + x4) / 2, header2Baseline, { align: 'center' });
    doc.text('Depar-ture', (x4 + x5) / 2, header2Baseline, { align: 'center' });
    doc.text('Hours', (x5 + x6) / 2, header2Baseline, { align: 'center' });
    doc.text('Min-utes', (x6 + x7) / 2, header2Baseline, { align: 'center' });
    
    // Data rows: 31 days + Total (match Android)
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const year = start.getFullYear();
    const month = start.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let dataY = tableTopY;
    for (let day = 1; day <= 31; day++) {
        const cellY = dataY + ROW_HEIGHT - 3;
        if (day <= daysInMonth) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record = recordsByDate[dateStr];
            const amArr = record?.morningClockInTime ? formatTime(record.morningClockInTime) : '';
            const amDep = record?.morningClockOutTime ? formatTime(record.morningClockOutTime) : '';
            const pmArr = record?.afternoonClockInTime ? formatTime(record.afternoonClockInTime) : '';
            const pmDep = record?.afternoonClockOutTime ? formatTime(record.afternoonClockOutTime) : '';
            doc.text(day.toString(), x0 + 2, cellY);
            doc.text(amArr, (x1 + x2) / 2, cellY, { align: 'center' });
            doc.text(amDep, (x2 + x3) / 2, cellY, { align: 'center' });
            doc.text(pmArr, (x3 + x4) / 2, cellY, { align: 'center' });
            doc.text(pmDep, (x4 + x5) / 2, cellY, { align: 'center' });
            doc.text('', (x5 + x6) / 2, cellY, { align: 'center' });
            doc.text('', (x6 + x7) / 2, cellY, { align: 'center' });
        } else {
            doc.text(day.toString(), x0 + 2, cellY);
        }
        dataY += ROW_HEIGHT;
    }
    const totalY = dataY + ROW_HEIGHT - 3;
    doc.text('Total', x0 + 2, totalY);
    y = dataY + ROW_HEIGHT + 10;
    
    // Certification block
    doc.setFontSize(6);
    const certText = 'I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.';
    const certLines = wrapText(certText, 68);
    certLines.forEach(line => {
        doc.text(line, x, y);
        y += 8;
    });
    y += 16;
    doc.line(xOffset + MARGIN, y, xOffset + formWidth - MARGIN, y);
    y += 12;
    doc.text('VERIFIED as to the prescribed office hours:', x, y);
    y += 20;
    doc.line(xOffset + MARGIN, y, xOffset + formWidth - MARGIN, y);
    y += 12;
    doc.text('In Charge', formCenterX, y, { align: 'center' });
}

function wrapText(text, maxCharsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
        const next = current ? current + ' ' + word : word;
        if (next.length > maxCharsPerLine) {
            if (current) lines.push(current);
            current = word;
        } else {
            current = next;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/**
 * Generate attendance report (Absents, Late, Undertime)
 */
async function generateAttendanceReport() {
    const employeeId = document.getElementById('reportEmployeeSelect').value;
    const monthInput = document.getElementById('reportMonth').value;
    
    if (!employeeId || !monthInput) {
        showNotification('Please select employee and month', 'error');
        return;
    }
    
    try {
        const employee = employeesData.find(e => e.id === employeeId);
        if (!employee) {
            showNotification('Employee not found', 'error');
            return;
        }
        
        showNotification('Generating report...', 'info');
        
        // Parse month
        const [year, month] = monthInput.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`;
        
        // Fetch all attendance records for the month
        const dates = getDatesInRange(startDate, endDate);
        const attendanceRecords = [];
        
        for (const date of dates) {
            const dateStr = date.toISOString().split('T')[0];
            
            try {
                const doc = await getDocs(query(
                    collection(db, 'Attendance'),
                    where('employeeId', '==', employee.employeeId || employee.id),
                    where('date', '==', dateStr)
                ));
                
                if (!doc.empty) {
                    const data = doc.docs[0].data();
                    attendanceRecords.push({
                        date: dateStr,
                        ...data
                    });
                }
            } catch (err) {
                console.error(`Error fetching attendance for ${dateStr}:`, err);
            }
        }
        
        // Calculate statistics
        const stats = calculateAttendanceStats(dates.map(d => d.toISOString().split('T')[0]), attendanceRecords);
        
        // Generate PDF report
        generateReportPDF(employee, monthInput, stats, attendanceRecords);
        
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('Failed to generate report: ' + error.message, 'error');
    }
}

/**
 * Calculate attendance statistics
 */
function calculateAttendanceStats(allDates, records) {
    const recordsByDate = {};
    records.forEach(rec => {
        recordsByDate[rec.date] = rec;
    });
    
    let absents = 0;
    let lateCount = 0;
    let undertimeHours = 0;
    let undertimeMinutes = 0;
    
    allDates.forEach(dateStr => {
        const record = recordsByDate[dateStr];
        
        // Check if absent (no clock-in for any session)
        if (!record || (!record.morningClockInTime && !record.afternoonClockInTime && !record.overtimeClockInTime)) {
            absents++;
        } else {
            // Check for late
            if (record.morningStatus === 'Late' || record.afternoonStatus === 'Late' || record.overtimeStatus === 'Late') {
                lateCount++;
            }
            
            // Calculate undertime (simplified - assumes 8 hours workday)
            // Morning: 7:30-12:00 = 4.5 hours, Afternoon: 12:30-17:00 = 4.5 hours
            let totalMinutes = 0;
            
            if (record.morningClockInTime && record.morningClockOutTime) {
                const inTime = record.morningClockInTime.toDate ? record.morningClockInTime.toDate() : new Date(record.morningClockInTime);
                const outTime = record.morningClockOutTime.toDate ? record.morningClockOutTime.toDate() : new Date(record.morningClockOutTime);
                totalMinutes += (outTime - inTime) / (1000 * 60);
            }
            
            if (record.afternoonClockInTime && record.afternoonClockOutTime) {
                const inTime = record.afternoonClockInTime.toDate ? record.afternoonClockInTime.toDate() : new Date(record.afternoonClockInTime);
                const outTime = record.afternoonClockOutTime.toDate ? record.afternoonClockOutTime.toDate() : new Date(record.afternoonClockOutTime);
                totalMinutes += (outTime - inTime) / (1000 * 60);
            }
            
            // Expected: 9 hours = 540 minutes (4.5 + 4.5)
            const expectedMinutes = 540;
            if (totalMinutes < expectedMinutes) {
                const undertime = expectedMinutes - totalMinutes;
                undertimeHours += Math.floor(undertime / 60);
                undertimeMinutes += undertime % 60;
            }
        }
    });
    
    // Convert minutes to hours
    undertimeHours += Math.floor(undertimeMinutes / 60);
    undertimeMinutes = undertimeMinutes % 60;
    
    return {
        totalDays: allDates.length,
        absents,
        lateCount,
        undertimeHours,
        undertimeMinutes
    };
}

/**
 * Generate attendance report PDF
 */
function generateReportPDF(employee, month, stats, records) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'pt', 'letter');
    
    let y = 72;
    const x = 72;
    const pageWidth = 612;
    
    // Title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Attendance Report', pageWidth / 2, y, { align: 'center' });
    y += 30;
    
    // Employee info
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Employee: ${employee.name || employee.employeeId || 'N/A'}`, x, y);
    y += 20;
    doc.text(`Employee ID: ${employee.employeeId || employee.id || 'N/A'}`, x, y);
    y += 20;
    doc.text(`Month: ${month}`, x, y);
    y += 30;
    
    // Statistics
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Summary', x, y);
    y += 25;
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Total Working Days: ${stats.totalDays}`, x, y);
    y += 20;
    doc.text(`Absents: ${stats.absents}`, x, y);
    y += 20;
    doc.text(`Late Count: ${stats.lateCount}`, x, y);
    y += 20;
    doc.text(`Total Undertime: ${stats.undertimeHours} hours ${stats.undertimeMinutes} minutes`, x, y);
    y += 30;
    
    // Detailed records table
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Daily Records', x, y);
    y += 25;
    
    // Table header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('Date', x, y);
    doc.text('Morning', x + 80, y);
    doc.text('Afternoon', x + 180, y);
    doc.text('Status', x + 280, y);
    y += 15;
    doc.line(x, y, x + 350, y);
    y += 10;
    
    // Table rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    
    records.forEach(record => {
        if (y > 700) {
            doc.addPage();
            y = 72;
        }
        
        doc.text(formatDate(record.date), x, y);
        
        const morning = record.morningClockInTime && record.morningClockOutTime 
            ? `${formatTime(record.morningClockInTime)} - ${formatTime(record.morningClockOutTime)}`
            : '-';
        doc.text(morning, x + 80, y);
        
        const afternoon = record.afternoonClockInTime && record.afternoonClockOutTime
            ? `${formatTime(record.afternoonClockInTime)} - ${formatTime(record.afternoonClockOutTime)}`
            : '-';
        doc.text(afternoon, x + 180, y);
        
        let status = 'Present';
        if (record.morningStatus === 'Late' || record.afternoonStatus === 'Late') {
            status = 'Late';
        }
        doc.text(status, x + 280, y);
        
        y += 15;
    });
    
    const safeName = (employee.name || employee.employeeId || 'Employee').replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `AttendanceReport_${safeName}_${month.replace(/-/g, '_')}.pdf`;
    
    downloadPdfBlob(doc, fileName);
    showNotification('Report PDF generated successfully', 'success');
}

/**
 * Load reports page
 */
export function loadReports() {
    loadEmployees();
    
    // Set default dates if not already set
    const dtrStartDate = document.getElementById('dtrStartDate');
    const dtrEndDate = document.getElementById('dtrEndDate');
    const reportMonth = document.getElementById('reportMonth');
    
    if (dtrStartDate && !dtrStartDate.value) {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        dtrStartDate.value = firstDay.toISOString().split('T')[0];
        dtrEndDate.value = lastDay.toISOString().split('T')[0];
        reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('downloadDtrBtn')?.addEventListener('click', downloadDTR);
    document.getElementById('generateReportBtn')?.addEventListener('click', generateAttendanceReport);
});
