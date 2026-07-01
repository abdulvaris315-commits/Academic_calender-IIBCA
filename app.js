/* ==========================================================================
   Academic Schedule & Timetable - Core Application Logic (Dynamic Island Update)
   ========================================================================== */

// --------------------------------------------------------------------------
// 1. Core Data Structures & Period Configurations
// --------------------------------------------------------------------------

// Normal Day Periods Configuration
const PERIOD_TIMES = {
    // Monday to Thursday
    weekday: [
        { name: "Period 1", start: "09:45 AM", end: "10:35 AM", type: "class" },
        { name: "Period 2", start: "10:35 AM", end: "11:20 AM", type: "class" },
        { name: "Interval", start: "11:20 AM", end: "11:40 AM", type: "break" },
        { name: "Period 3", start: "11:40 AM", end: "12:25 PM", type: "class" },
        { name: "Period 4", start: "12:25 PM", end: "01:10 PM", type: "class" },
        { name: "Lunch Break", start: "01:10 PM", end: "02:10 PM", type: "break" },
        { name: "Period 5", start: "02:10 PM", end: "02:50 PM", type: "class" },
        { name: "Period 6", start: "02:50 PM", end: "03:30 PM", type: "class" }
    ],
    // Friday
    friday: [
        { name: "Period 1", start: "09:45 AM", end: "10:25 AM", type: "class" },
        { name: "Period 2", start: "10:25 AM", end: "11:05 AM", type: "class" },
        { name: "Interval", start: "11:05 AM", end: "11:25 AM", type: "break" },
        { name: "Period 3", start: "11:25 AM", end: "12:05 PM", type: "class" },
        { name: "Period 4", start: "12:05 PM", end: "12:45 PM", type: "class" },
        { name: "Lunch Break", start: "12:45 PM", end: "02:00 PM", type: "break" },
        { name: "Period 5", start: "02:00 PM", end: "02:50 PM", type: "class" },
        { name: "Period 6", start: "02:50 PM", end: "03:30 PM", type: "class" }
    ]
};

// Day Order Timetable Maps (5 rows from image map directly to Period 1, 2, 3, 4, 5)
// Period 6 is always LGMC Hour for all days
const TIMETABLE_MAP = {
    1: { // Day 1
        1: { subject: "Operational Research (OR)", faculty: "AA Aathira Ma'am" },
        2: { subject: "Language", faculty: "Arabic" },
        3: { subject: "Java Theory", faculty: "Anjali Kuruvila" },
        4: { subject: "Java Lab", faculty: "Muthukumar" },
        5: { subject: "3D Modeling", faculty: "Shanthi" },
        6: { subject: "LGMC Hour", faculty: "Class Tutor" }
    },
    2: { // Day 2
        1: { subject: "Java Theory", faculty: "Anjali Kuruvila" },
        2: { subject: "English", faculty: "Elakiya" },
        3: { subject: "3D Modeling", faculty: "Shanthi" },
        4: { subject: "Java Lab", faculty: "Muthukumar" },
        5: { subject: "Language", faculty: "Arabic" },
        6: { subject: "LGMC Hour", faculty: "Class Tutor" }
    },
    3: { // Day 3
        1: { subject: "Data Structure (DS)", faculty: "GA Ganga" },
        2: { subject: "3D Modeling", faculty: "Shanthi" },
        3: { subject: "Data Structure (DS)", faculty: "GA Ganga" },
        4: { subject: "Java Lab", faculty: "Muthukumar" },
        5: { subject: "Java Theory", faculty: "Anjali Kuruvila" },
        6: { subject: "LGMC Hour", faculty: "Class Tutor" }
    },
    4: { // Day 4
        1: { subject: "Operational Research (OR)", faculty: "AA Aathira Ma'am" },
        2: { subject: "Language", faculty: "Arabic" },
        3: { subject: "English", faculty: "Elakiya" },
        4: { subject: "Java Theory", faculty: "Anjali Kuruvila" },
        5: { subject: "Data Structure (DS)", faculty: "GA Ganga" },
        6: { subject: "LGMC Hour (Free)", faculty: "Class Tutor" }
    },
    5: { // Day 5
        1: { subject: "Data Structure (DS)", faculty: "GA Ganga" },
        2: { subject: "Operational Research (OR)", faculty: "AA Aathira Ma'am" },
        3: { subject: "3D Modeling", faculty: "Shanthi" },
        4: { subject: "English", faculty: "Elakiya" },
        5: { subject: "Java Lab (T)", faculty: "Muthukumar" },
        6: { subject: "LGMC Hour (Free)", faculty: "Class Tutor" }
    }
};

// Academic bounds: June 2026 to November 2026
const ACADEMIC_LIMITS = {
    startYear: 2026,
    startMonth: 5, // June (0-indexed)
    endYear: 2026,
    endMonth: 10   // November (0-indexed)
};

// Global App State
let state = {
    currentDate: new Date(2026, 6, 1), // Default to today: July 1, 2026 (local time is 2026-07-01)
    viewDate: new Date(2026, 6, 1),    // Calendar current viewing month
    selectedDateStr: "",               // Current clicked date in DD-MM-YYYY format
    customLeaves: new Set(),           // Set of DD-MM-YYYY strings of unexpected holidays
    dayOrderMap: {},                   // Map of DD-MM-YYYY -> dayOrder (1-5)
    recalcTimer: null                  // Banner fadeout timer
};

// --------------------------------------------------------------------------
// 2. LocalStorage Persistence Layer
// --------------------------------------------------------------------------
function loadStateFromStorage() {
    try {
        const storedLeaves = localStorage.getItem("ncs_custom_leaves");
        if (storedLeaves) {
            state.customLeaves = new Set(JSON.parse(storedLeaves));
        }
    } catch (e) {
        console.error("Error loading localStorage state:", e);
    }
}

function saveLeavesToStorage() {
    try {
        localStorage.setItem("ncs_custom_leaves", JSON.stringify([...state.customLeaves]));
    } catch (e) {
        console.error("Error saving custom leaves to storage:", e);
    }
}

// --------------------------------------------------------------------------
// 3. Strict Sequential Day Order Calculator
// --------------------------------------------------------------------------

// Helper to convert Date object to DD-MM-YYYY format
function formatDate(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

// Helper to check if a preloaded date from the PDF is marked as a holiday
function getPreloadedDay(dateStr) {
    if (typeof ACADEMIC_CALENDAR_PRELOAD === 'undefined') return null;
    return ACADEMIC_CALENDAR_PRELOAD.find(item => item.date === dateStr);
}

// Calculates Day Orders sequentially starting from Reopening: June 8, 2026 (Day Order 1)
function calculateAllDayOrders() {
    const startDate = new Date(2026, 5, 8); // June 8, 2026
    const endDate = new Date(2026, 10, 30);  // End of academic schedule: Nov 30, 2026
    
    let current = new Date(startDate);
    let dayOrderCounter = 1; // June 8, 2026 starts at Day Order 1
    
    const newMap = {};
    
    while (current <= endDate) {
        const dateStr = formatDate(current);
        const dayOfWeek = current.getDay(); // 0: Sunday, 6: Saturday
        
        let isHoliday = false;
        let event = "";
        
        // 1. Check preloaded PDF data
        const preloaded = getPreloadedDay(dateStr);
        if (preloaded) {
            isHoliday = preloaded.is_holiday;
            event = preloaded.event;
        } else {
            // 2. Extrapolate standard holidays
            if (dayOfWeek === 0) {
                isHoliday = true; // Sunday
            } else if (dayOfWeek === 6) {
                // Second and Fourth Saturdays are holidays in Nilgiri College
                const dom = current.getDate();
                const weekNum = Math.ceil(dom / 7);
                if (weekNum === 2 || weekNum === 4) {
                    isHoliday = true;
                    event = `${weekNum === 2 ? "2nd" : "4th"} Saturday Holiday`;
                }
            }
        }
        
        // 3. Check custom user marked leaves
        if (state.customLeaves.has(dateStr)) {
            isHoliday = true;
        }
        
        // 4. Assign Day Order
        if (isHoliday) {
            newMap[dateStr] = null;
            // Day order counter PAUSES (does not increment)
        } else {
            newMap[dateStr] = dayOrderCounter;
            // Day order counter INCREMENTS sequentially (1 -> 5 -> 1)
            dayOrderCounter = (dayOrderCounter % 5) + 1;
        }
        
        // Advance current day
        current.setDate(current.getDate() + 1);
    }
    
    state.dayOrderMap = newMap;
}

// Show banner indicating day order shifts
function triggerShiftBanner() {
    const banner = document.getElementById("dayorder-recalc-banner");
    if (!banner) return;
    
    banner.classList.remove("hidden");
    
    if (state.recalcTimer) {
        clearTimeout(state.recalcTimer);
    }
    
    state.recalcTimer = setTimeout(() => {
        banner.classList.add("hidden");
    }, 4000);
}

// --------------------------------------------------------------------------
// 4. Calendar UI Rendering & Formatting
// --------------------------------------------------------------------------

function renderCalendar() {
    const grid = document.getElementById("calendar-grid");
    const monthLabel = document.getElementById("month-year-label");
    const prevBtn = document.getElementById("prev-month-btn");
    const nextBtn = document.getElementById("next-month-btn");
    if (!grid || !monthLabel) return;
    
    const year = state.viewDate.getFullYear();
    const month = state.viewDate.getMonth();
    
    // Set Header Month-Year label
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    monthLabel.textContent = `${monthNames[month]} ${year}`;
    
    // Boundary button disablers
    if (prevBtn) {
        prevBtn.disabled = (year === ACADEMIC_LIMITS.startYear && month === ACADEMIC_LIMITS.startMonth);
    }
    if (nextBtn) {
        nextBtn.disabled = (year === ACADEMIC_LIMITS.endYear && month === ACADEMIC_LIMITS.endMonth);
    }
    
    // Clear grid
    grid.innerHTML = "";
    
    // First day of target month (0: Sun, 1: Mon, ... 6: Sat)
    const firstDayIndex = new Date(year, month, 1).getDay();
    // Adjust index to start week on Monday (0: Mon, 1: Tue ... 5: Sat, 6: Sun)
    const startOffset = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
    
    // Total days in current month
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Total cells in calendar grid: 6 rows of 7 days = 42 cells
    const totalCells = 42;
    
    for (let i = 0; i < totalCells; i++) {
        let cellDate = null;
        let isCurrentMonth = true;
        
        if (i < startOffset) {
            isCurrentMonth = false;
        } else if (i >= startOffset + totalDays) {
            isCurrentMonth = false;
        } else {
            const dayNum = i - startOffset + 1;
            cellDate = new Date(year, month, dayNum);
        }
        
        // Remove before/after months details (Make them clean empty layout cells)
        if (!isCurrentMonth) {
            const emptyCell = document.createElement("div");
            emptyCell.className = "empty-cell";
            grid.appendChild(emptyCell);
            continue;
        }
        
        const cell = document.createElement("div");
        cell.className = "day-cell";
        
        const dateStr = formatDate(cellDate);
        const dayOfWeek = cellDate.getDay(); // 0: Sun, 6: Sat
        
        // 1. Date Number label
        const numLabel = document.createElement("span");
        numLabel.className = "day-number";
        numLabel.textContent = cellDate.getDate();
        cell.appendChild(numLabel);
        
        // 2. Resolve Holiday Status
        let isHoliday = false;
        
        const preloaded = getPreloadedDay(dateStr);
        if (preloaded) {
            isHoliday = preloaded.is_holiday;
        } else {
            if (dayOfWeek === 0) {
                isHoliday = true;
            } else if (dayOfWeek === 6) {
                const dom = cellDate.getDate();
                const weekNum = Math.ceil(dom / 7);
                if (weekNum === 2 || weekNum === 4) {
                    isHoliday = true;
                }
            }
        }
        
        // Check custom marked leave
        const isCustomLeave = state.customLeaves.has(dateStr);
        if (isCustomLeave) {
            isHoliday = true;
            cell.classList.add("leave");
        }
        
        if (isHoliday) {
            cell.classList.add("holiday");
        }
        
        // 3. Highlight Today
        const todayStr = formatDate(state.currentDate);
        if (dateStr === todayStr) {
            cell.classList.add("today");
        }
        
        // 4. Resolve Day Order
        const dayOrder = state.dayOrderMap[dateStr];
        
        // Normal Mode - Render Day Order badge
        if (dayOrder && !isHoliday) {
            const orderBadge = document.createElement("span");
            orderBadge.className = "day-order-indicator";
            orderBadge.textContent = `D${dayOrder}`;
            cell.appendChild(orderBadge);
        }
        
        // 5. Dress Code Emojis (Wednesdays & Saturdays working days only)
        if (!isHoliday) {
            if (dayOfWeek === 3) { // Wednesday
                const emoji = document.createElement("span");
                emoji.className = "cell-attire-badge";
                emoji.textContent = "🧥";
                emoji.title = "Blazer Day";
                cell.appendChild(emoji);
            } else if (dayOfWeek === 6) { // Saturday
                const emoji = document.createElement("span");
                emoji.className = "cell-attire-badge";
                emoji.textContent = "👕👖";
                emoji.title = "Casual / Formal Attire Day";
                cell.appendChild(emoji);
            }
        }
        
        // Add click listener
        cell.addEventListener("click", () => {
            openTimetableModal(cellDate, dateStr);
        });
        
        grid.appendChild(cell);
    }
}

// --------------------------------------------------------------------------
// 5. Timetable Details Modal & Leave Toggle
// --------------------------------------------------------------------------

function openTimetableModal(dateObj, dateStr) {
    state.selectedDateStr = dateStr;
    
    const modal = document.getElementById("timetable-modal");
    const dateLabel = document.getElementById("modal-date-label");
    const dayOrderBadge = document.getElementById("modal-day-order-badge");
    const attireBadge = document.getElementById("modal-attire-badge");
    const leaveInput = document.getElementById("leave-toggle-input");
    const tableView = document.getElementById("timetable-view");
    
    if (!modal || !dateLabel || !dayOrderBadge || !attireBadge || !leaveInput || !tableView) return;
    
    // Formatting date label: e.g. "Wednesday, 01-Jul-2026"
    const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
    const dateFormatted = dateObj.toLocaleDateString('en-US', options);
    dateLabel.textContent = dateFormatted;
    
    // Update Leave toggle state
    leaveInput.checked = state.customLeaves.has(dateStr);
    
    // Resolve day order
    const dayOrder = state.dayOrderMap[dateStr];
    const dayOfWeek = dateObj.getDay();
    
    let isHoliday = false;
    let holidayName = "Holiday";
    
    const preloaded = getPreloadedDay(dateStr);
    if (preloaded) {
        isHoliday = preloaded.is_holiday;
        holidayName = preloaded.event || "Preloaded College Holiday";
    } else {
        if (dayOfWeek === 0) {
            isHoliday = true;
            holidayName = "Sunday";
        } else if (dayOfWeek === 6) {
            const dom = dateObj.getDate();
            const weekNum = Math.ceil(dom / 7);
            if (weekNum === 2 || weekNum === 4) {
                isHoliday = true;
                holidayName = `${weekNum === 2 ? "Second" : "Fourth"} Saturday Holiday`;
            }
        }
    }
    
    const isCustomLeave = state.customLeaves.has(dateStr);
    if (isCustomLeave) {
        isHoliday = true;
        holidayName = "Marked Holiday (Leave)";
    }
    
    // Render dress code attire badge
    attireBadge.classList.add("hidden");
    if (!isHoliday) {
        if (dayOfWeek === 3) {
            attireBadge.textContent = "🧥 Blazer Dress Code Required";
            attireBadge.classList.remove("hidden");
        } else if (dayOfWeek === 6) {
            attireBadge.textContent = "👕👖 Formal / Decent Attire Permitted";
            attireBadge.classList.remove("hidden");
        }
    }
    
    // Clear list
    tableView.innerHTML = "";
    
    if (isHoliday) {
        // Display Holiday Layout
        dayOrderBadge.textContent = "No Class";
        dayOrderBadge.className = "badge glass badge-holiday";
        
        const hItem = document.createElement("div");
        hItem.className = "timetable-item holiday-item";
        hItem.innerHTML = `
            <h3>${holidayName}</h3>
            <p>Classes paused for the day</p>
        `;
        tableView.appendChild(hItem);
    } else {
        // Class Schedule
        dayOrderBadge.className = "badge glass";
        dayOrderBadge.textContent = `Day Order ${dayOrder}`;
        
        // Choose periods schedule template
        const schedule = (dayOfWeek === 5) ? PERIOD_TIMES.friday : PERIOD_TIMES.weekday;
        const dayOrderTimetable = TIMETABLE_MAP[dayOrder];
        
        schedule.forEach(period => {
            const item = document.createElement("div");
            
            if (period.type === "break") {
                item.className = "timetable-item break-period";
                item.innerHTML = `
                    <div class="time-slot">
                        <span class="time-start">${period.start}</span>
                        <span class="time-end">${period.end}</span>
                    </div>
                    <div class="period-details">
                        <div class="subject-info">
                            <span class="subject-name">${period.name}</span>
                            <span class="faculty-name">Recess</span>
                        </div>
                        <span class="period-badge">REST</span>
                    </div>
                `;
            } else {
                item.className = "timetable-item";
                
                // Period name digits (e.g. "Period 1" -> 1)
                const pNum = parseInt(period.name.replace(/[^0-9]/g, ''));
                const classInfo = dayOrderTimetable[pNum] || { subject: "Free / Self Study", faculty: "Library" };
                
                item.innerHTML = `
                    <div class="time-slot">
                        <span class="time-start">${period.start}</span>
                        <span class="time-end">${period.end}</span>
                    </div>
                    <div class="period-details">
                        <div class="subject-info">
                            <span class="subject-name">${escapeHtml(classInfo.subject)}</span>
                            <span class="faculty-name">${escapeHtml(classInfo.faculty)}</span>
                        </div>
                        <span class="period-badge">${period.name}</span>
                    </div>
                `;
            }
            tableView.appendChild(item);
        });
    }
    
    // Open Modal
    modal.classList.add("active");
}

function closeTimetableModal() {
    const modal = document.getElementById("timetable-modal");
    if (modal) {
        modal.classList.remove("active");
    }
}

// --------------------------------------------------------------------------
// 6. Navigation & Gesture Event Listeners
// --------------------------------------------------------------------------

function changeMonth(delta) {
    const nextMonth = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + delta, 1);
    const nextYear = nextMonth.getFullYear();
    const nextMonthIndex = nextMonth.getMonth();
    
    // Restrict navigation strictly to academic months (June 2026 - Nov 2026)
    if (nextYear < ACADEMIC_LIMITS.startYear || (nextYear === ACADEMIC_LIMITS.startYear && nextMonthIndex < ACADEMIC_LIMITS.startMonth)) {
        return; // bound hit (too early)
    }
    if (nextYear > ACADEMIC_LIMITS.endYear || (nextYear === ACADEMIC_LIMITS.endYear && nextMonthIndex > ACADEMIC_LIMITS.endMonth)) {
        return; // bound hit (too late)
    }

    const grid = document.getElementById("calendar-grid");
    if (grid) {
        grid.style.transition = "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease";
        grid.style.opacity = "0";
        grid.style.transform = delta > 0 ? "translateX(-20px)" : "translateX(20px)";
    }
    
    setTimeout(() => {
        state.viewDate = nextMonth;
        renderCalendar();
        
        if (grid) {
            grid.style.transform = delta > 0 ? "translateX(20px)" : "translateX(-20px)";
            grid.offsetHeight; // Reflow
            grid.style.transform = "translateX(0)";
            grid.style.opacity = "1";
        }
    }, 150);
}

function jumpToToday() {
    state.viewDate = new Date(state.currentDate);
    renderCalendar();
}

// Swipe gestures using native touch events
function setupSwipeGestures() {
    const calendarWrapper = document.getElementById("calendar-wrapper");
    if (!calendarWrapper) return;
    
    let startX = 0;
    let startY = 0;
    let distMin = 50; // min swipe distance in px
    let maxVertOffset = 35; // avoid swipe trigger on scroll
    
    calendarWrapper.addEventListener("touchstart", (e) => {
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
    }, { passive: true });
    
    calendarWrapper.addEventListener("touchend", (e) => {
        if (e.changedTouches.length === 0) return;
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = Math.abs(touch.clientY - startY);
        
        // Horizontal swipe checks
        if (Math.abs(deltaX) >= distMin && deltaY <= maxVertOffset) {
            if (deltaX > 0) {
                // Swipe Right -> previous month
                changeMonth(-1);
            } else {
                // Swipe Left -> next month
                changeMonth(1);
            }
        }
    }, { passive: true });
}

// --------------------------------------------------------------------------
// 7. Dynamic Island Scheduler engine
// --------------------------------------------------------------------------

// Convert "HH:MM AM/PM" to minutes from midnight
function timeToMinutes(timeStr) {
    const match = timeStr.match(/^(\d{2}):(\d{2})\s+(AM|PM)$/i);
    if (!match) return 0;
    
    let hrs = parseInt(match[1]);
    const mins = parseInt(match[2]);
    const ampm = match[3].toUpperCase();
    
    if (ampm === "PM" && hrs !== 12) hrs += 12;
    if (ampm === "AM" && hrs === 12) hrs = 0;
    
    return hrs * 60 + mins;
}

function updateDynamicIsland() {
    const pill = document.getElementById("dynamic-island");
    const statusDot = document.getElementById("island-status-dot");
    const collText = document.getElementById("island-collapsed-text");
    
    const currSubjectLabel = document.getElementById("island-current-subject");
    const currTimeLabel = document.getElementById("island-current-time");
    const nextSubjectLabel = document.getElementById("island-next-subject");
    const timerLabel = document.getElementById("island-timer");
    
    if (!pill || !statusDot || !collText || !currSubjectLabel || !currTimeLabel || !nextSubjectLabel || !timerLabel) return;
    
    const now = new Date();
    
    // For local schedule alignment, read actual system time
    // Lock date to today's schedule calendar date if within bounds
    let scheduleDate = new Date(state.currentDate); // July 1, 2026
    
    // If system time falls in the academic calendar, align to system date, otherwise mock July 1, 2026 (Wednesday)
    const systemDateStr = formatDate(now);
    if (state.dayOrderMap[systemDateStr] !== undefined) {
        scheduleDate = now;
    }
    
    const dateStr = formatDate(scheduleDate);
    const dayOfWeek = scheduleDate.getDay(); // 0: Sun, 6: Sat
    
    // Check if it's a holiday (pause)
    let isHoliday = false;
    let holidayName = "Weekend / Holiday";
    
    const preloaded = getPreloadedDay(dateStr);
    if (preloaded) {
        isHoliday = preloaded.is_holiday;
        holidayName = preloaded.event || "College Holiday";
    } else {
        if (dayOfWeek === 0) {
            isHoliday = true;
        } else if (dayOfWeek === 6) {
            const dom = scheduleDate.getDate();
            const weekNum = Math.ceil(dom / 7);
            if (weekNum === 2 || weekNum === 4) {
                isHoliday = true;
            }
        }
    }
    
    if (state.customLeaves.has(dateStr)) {
        isHoliday = true;
        holidayName = "Unexpected Holiday (Leave)";
    }
    
    if (isHoliday) {
        // Holiday display
        statusDot.className = "island-status-dot red";
        collText.textContent = "No Classes Today";
        
        currSubjectLabel.textContent = holidayName;
        currTimeLabel.textContent = "All Day";
        nextSubjectLabel.textContent = "Classes resume next working day";
        timerLabel.textContent = "Enjoy your break!";
        return;
    }
    
    // Working day schedule lookup
    const dayOrder = state.dayOrderMap[dateStr];
    if (!dayOrder) {
        statusDot.className = "island-status-dot grey";
        collText.textContent = "Pre-academic Period";
        currSubjectLabel.textContent = "No Schedule Active";
        currTimeLabel.textContent = "--:--";
        nextSubjectLabel.textContent = "--";
        timerLabel.textContent = "Schedule begins June 8, 2026";
        return;
    }
    
    const schedule = (dayOfWeek === 5) ? PERIOD_TIMES.friday : PERIOD_TIMES.weekday;
    const dayOrderTimetable = TIMETABLE_MAP[dayOrder];
    
    // Get current minutes since midnight
    const currentMins = now.getHours() * 60 + now.getMinutes();
    
    // Find active period
    let activePeriod = null;
    let activeIndex = -1;
    
    for (let i = 0; i < schedule.length; i++) {
        const p = schedule[i];
        const startMins = timeToMinutes(p.start);
        const endMins = timeToMinutes(p.end);
        
        if (currentMins >= startMins && currentMins < endMins) {
            activePeriod = p;
            activeIndex = i;
            break;
        }
    }
    
    const firstPeriodStartMins = timeToMinutes(schedule[0].start); // 09:45 AM
    const lastPeriodEndMins = timeToMinutes(schedule[schedule.length - 1].end); // 03:30 PM
    
    if (currentMins < firstPeriodStartMins) {
        // BEFORE CLASSES START
        statusDot.className = "island-status-dot grey";
        
        const firstP = schedule[0];
        const pNum = parseInt(firstP.name.replace(/[^0-9]/g, ''));
        const classInfo = dayOrderTimetable[pNum] || { subject: "Free Period", faculty: "" };
        
        collText.textContent = `Starts at ${firstP.start}`;
        
        currSubjectLabel.textContent = "Morning Interval";
        currTimeLabel.textContent = `Until ${firstP.start}`;
        nextSubjectLabel.textContent = `${classInfo.subject} (${firstP.name})`;
        
        const minsLeft = firstPeriodStartMins - currentMins;
        timerLabel.textContent = `Classes start in ${minsLeft}m`;
        
    } else if (currentMins >= lastPeriodEndMins) {
        // AFTER CLASSES END
        statusDot.className = "island-status-dot grey";
        collText.textContent = "Classes Ended";
        
        currSubjectLabel.textContent = "College Closed";
        currTimeLabel.textContent = `Ended at ${schedule[schedule.length - 1].end}`;
        nextSubjectLabel.textContent = "Next classes: Tomorrow";
        timerLabel.textContent = "Have a good evening!";
        
    } else if (activePeriod) {
        // DURING CLASS HOURS (Period active)
        const endMins = timeToMinutes(activePeriod.end);
        const minsRemaining = endMins - currentMins;
        
        // Find next entry details
        let nextPInfo = "Self Study";
        if (activeIndex + 1 < schedule.length) {
            const nextP = schedule[activeIndex + 1];
            if (nextP.type === "break") {
                nextPInfo = nextP.name;
            } else {
                const nextPNum = parseInt(nextP.name.replace(/[^0-9]/g, ''));
                const nextClass = dayOrderTimetable[nextPNum] || { subject: "Free Period" };
                nextPInfo = `${nextClass.subject} (${nextP.name})`;
            }
        } else {
            nextPInfo = "End of classes";
        }
        
        if (activePeriod.type === "break") {
            // Recess / Lunch / Interval
            statusDot.className = "island-status-dot yellow";
            collText.textContent = `${activePeriod.name} Recess`;
            
            currSubjectLabel.textContent = activePeriod.name;
            currTimeLabel.textContent = `${activePeriod.start} - ${activePeriod.end}`;
            nextSubjectLabel.textContent = nextPInfo;
            timerLabel.textContent = `Recess ends in ${minsRemaining}m`;
        } else {
            // Active Class
            statusDot.className = "island-status-dot green";
            
            const pNum = parseInt(activePeriod.name.replace(/[^0-9]/g, ''));
            const classInfo = dayOrderTimetable[pNum] || { subject: "Free / Library", faculty: "" };
            
            collText.textContent = `${classInfo.subject}`;
            
            currSubjectLabel.textContent = classInfo.subject;
            currTimeLabel.textContent = `${activePeriod.start} - ${activePeriod.end}`;
            nextSubjectLabel.textContent = nextPInfo;
            timerLabel.textContent = `Period ends in ${minsRemaining}m`;
        }
    } else {
        // Catch-all fallbacks
        statusDot.className = "island-status-dot grey";
        collText.textContent = "Out of Session";
        currSubjectLabel.textContent = "Lunch / Interval gap";
        currTimeLabel.textContent = "--:--";
        nextSubjectLabel.textContent = "--";
        timerLabel.textContent = "In transition";
    }
}

// --------------------------------------------------------------------------
// 8. Three.js Ambient Visual Background Animation
// --------------------------------------------------------------------------
let renderer, scene, camera;
let spheresGroup = [];
let waveLines = [];

function initBackgroundThreeJS() {
    const canvas = document.getElementById("bg-canvas");
    if (!canvas) return;
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    
    // Scene
    scene = new THREE.Scene();
    
    // Camera
    camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.z = 15;
    
    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);
    
    const dirLight1 = new THREE.DirectionalLight(0xa5b4fc, 0.9);
    dirLight1.position.set(5, 5, 2);
    scene.add(dirLight1);
    
    const dirLight2 = new THREE.DirectionalLight(0xe9d5ff, 0.7);
    dirLight2.position.set(-5, -5, 2);
    scene.add(dirLight2);
    
    // Create Glass Spheres Group
    const sphereCount = 6;
    
    for (let i = 0; i < sphereCount; i++) {
        const radius = Math.random() * 1.5 + 0.8;
        const geom = new THREE.SphereGeometry(radius, 32, 32);
        
        // Custom color overlays per sphere
        const colors = [0xa7f3d0, 0xa5b4fc, 0xfbcfe8, 0xfed7aa, 0xe9d5ff];
        const matColor = colors[Math.floor(Math.random() * colors.length)];
        
        const mat = new THREE.MeshStandardMaterial({
            color: matColor,
            roughness: 0.15,
            metalness: 0.1,
            transparent: true,
            opacity: 0.12
        });
        
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 10 - 2, // slightly center-bottom heavy
            (Math.random() - 0.5) * 6 - 2
        );
        
        // Random velocity mappings
        mesh.userData = {
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.008,
                (Math.random() - 0.5) * 0.008,
                (Math.random() - 0.5) * 0.005
            ),
            limits: { x: 8, y: 6, z: 2 }
        };
        
        scene.add(mesh);
        spheresGroup.push(mesh);
    }
    
    // Create slow wave lines at the bottom
    const lineCount = 3;
    const segmentCount = 100;
    const waveMatColors = [0x818cf8, 0xc084fc, 0xf472b6];
    
    for (let i = 0; i < lineCount; i++) {
        const points = [];
        for (let j = 0; j <= segmentCount; j++) {
            points.push(new THREE.Vector3(0, 0, 0));
        }
        
        const geom = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: waveMatColors[i],
            transparent: true,
            opacity: 0.09,
            linewidth: 1.5
        });
        
        const line = new THREE.Line(geom, mat);
        scene.add(line);
        
        waveLines.push({
            mesh: line,
            amplitude: 1.2 + i * 0.4,
            frequency: 0.15 + i * 0.05,
            speed: 0.006 + i * 0.002,
            phase: Math.random() * Math.PI,
            yOffset: -6 + i * 0.4 // Offset at bottom of viewport
        });
    }
    
    // Loop
    let lastTime = 0;
    const speedFactor = 0.75; // 0.75x low speed execution
    
    function animate(time) {
        requestAnimationFrame(animate);
        
        const delta = (time - lastTime) * speedFactor;
        lastTime = time;
        
        // Spheres float
        spheresGroup.forEach(sphere => {
            sphere.position.addScaledVector(sphere.userData.velocity, delta * 0.06);
            
            // Boundary bounce checks
            const limits = sphere.userData.limits;
            if (Math.abs(sphere.position.x) > limits.x) {
                sphere.userData.velocity.x *= -1;
                sphere.position.x = Math.sign(sphere.position.x) * limits.x;
            }
            if (Math.abs(sphere.position.y) > limits.y) {
                sphere.userData.velocity.y *= -1;
                sphere.position.y = Math.sign(sphere.position.y) * limits.y;
            }
            if (Math.abs(sphere.position.z) > limits.z) {
                sphere.userData.velocity.z *= -1;
                sphere.position.z = Math.sign(sphere.position.z) * limits.z;
            }
            
            // Slow rotation
            sphere.rotation.x += 0.0003 * delta;
            sphere.rotation.y += 0.0004 * delta;
        });
        
        // Dynamic Sine Waves ripples
        waveLines.forEach(wave => {
            wave.phase += wave.speed * delta * 0.06;
            
            const positions = wave.mesh.geometry.attributes.position.array;
            const segmentWidth = 24 / segmentCount; // wave stretches from X=-12 to X=12
            
            for (let j = 0; j <= segmentCount; j++) {
                const x = -12 + j * segmentWidth;
                // Ripple formula
                const y = Math.sin(x * wave.frequency + wave.phase) * wave.amplitude + wave.yOffset;
                const z = Math.cos(x * 0.1 + wave.phase) * 2; // Z depth
                
                const idx = j * 3;
                positions[idx] = x;
                positions[idx + 1] = y;
                positions[idx + 2] = z;
            }
            
            wave.mesh.geometry.attributes.position.needsUpdate = true;
        });
        
        renderer.render(scene, camera);
    }
    
    requestAnimationFrame(animate);
    
    // Window resize
    window.addEventListener("resize", () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    });
}

// --------------------------------------------------------------------------
// 9. Initialisation & Page Setup hooks
// --------------------------------------------------------------------------

function setupEventListeners() {
    // Month Buttons
    document.getElementById("prev-month-btn").addEventListener("click", () => changeMonth(-1));
    document.getElementById("next-month-btn").addEventListener("click", () => changeMonth(1));
    
    // Today Button
    document.getElementById("today-btn").addEventListener("click", jumpToToday);
    
    // Modals Close binds
    document.getElementById("close-timetable-btn").addEventListener("click", closeTimetableModal);
    
    // Leave Toggle Input
    document.getElementById("leave-toggle-input").addEventListener("change", (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            state.customLeaves.add(state.selectedDateStr);
        } else {
            state.customLeaves.delete(state.selectedDateStr);
        }
        
        saveLeavesToStorage();
        calculateAllDayOrders();
        renderCalendar();
        triggerShiftBanner();
        updateDynamicIsland();
        
        // Re-trigger modal updates to match new state
        const parts = state.selectedDateStr.split('-');
        const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        openTimetableModal(dateObj, state.selectedDateStr);
    });
    
    // Click outside modal overlays to close
    document.querySelectorAll(".modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) {
                closeTimetableModal();
            }
        });
    });
}

// Escape HTML safety wrapper
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// App Entry point
window.addEventListener("DOMContentLoaded", () => {
    // Set static current date to July 1, 2026 for testing continuity
    state.currentDate = new Date(2026, 6, 1);
    state.viewDate = new Date(2026, 6, 1);
    
    // Load local storage states
    loadStateFromStorage();
    
    // Initialize Day Orders
    calculateAllDayOrders();
    renderCalendar();
    
    // Bind Handlers
    setupEventListeners();
    setupSwipeGestures();
    
    // Init Lucide
    lucide.createIcons();
    
    // Setup Three.js Visuals
    setTimeout(initBackgroundThreeJS, 100);
    
    // Set Dynamic Island interval updates (every second)
    updateDynamicIsland();
    setInterval(updateDynamicIsland, 1000);
});
