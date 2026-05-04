// ── Shared Clinic Data Store ──────────────────────────────────────
// Acts as a mock database via localStorage, supporting One-to-Many
// parent → children relationships across all admin modules.
//
// NITA — Nomor Induk Terapi Anak
// Format: YYMMDD + NNN (3-digit global sequence)
// Example: 260417001  →  year 26 | month 04 | day 17 | sequence 001
//
// Parent Login: username = NITA anak, password = parent.tempPassword

const STORE_KEY = 'clinicData';

// ── Cross-tab Sync ────────────────────────────────────────────────
// When another tab/port writes to localStorage (e.g. admin creates
// an announcement), re-dispatch the local clinicDataUpdated event
// so all components in THIS tab re-render with the latest data.
window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) {
        window.dispatchEvent(new CustomEvent('clinicDataUpdated'));
    }
});

function getDefaultData() {
    const today     = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
    const tomorrow  = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    return {
        parents: [
            {
                id: 'P-0001',
                name: 'Budi Santoso',
                phone: '08111000001',
                email: 'budi.santoso@email.com',
                address: 'Jl. Melati No. 5, Jakarta Selatan',
                status: 'active',
                children: ['260416001'],
                tempPassword: 'TheraCare@2024',
                createdAt: '2026-01-10T08:00:00Z',
            }
        ],
        children: [
            {
                id: '260416001',
                nita: '260416001',
                parentId: 'P-0001',
                firstName: 'Andi',
                lastName: 'Santoso',
                name: 'Andi Santoso',
                dob: '2019-02-15',
                gender: 'male',
                school: 'TK Bintang Harapan',
                diagnosis: 'ASD Level 1',
                program: 'Occupational Therapy',
                status: 'active',
                therapyPrograms: [
                    {
                        type: 'Occupational Therapy (OT)',
                        sessionsCompleted: 12,
                        totalSessions: 20,
                        goal: 'Fine motor skills improvement',
                        icon: 'extension',
                        colorClass: 'blue',
                        colorHex: '#3b82f6',
                    },
                    {
                        type: 'Speech-Language Pathology (SLP)',
                        sessionsCompleted: 8,
                        totalSessions: 12,
                        goal: 'Articulation and expressive language',
                        icon: 'record_voice_over',
                        colorClass: 'purple',
                        colorHex: '#a855f7',
                    },
                ],
                createdAt: '2026-01-10T08:00:00Z',
            }
        ],
        therapists: [
            { id: 'SARAH260411001', name: 'Dr. Sarah Wilson', phone: '08123456789', specialty: 'Occupational Therapist', status: 'active', tempPassword: 'Clinic@1234' }
        ],
        sessions: [
            {
                id: 'S-001',
                therapistId: 'SARAH260411001',
                childId: '260416001',
                date: twoDaysAgo,
                startTime: '09:00',
                duration: '60 mins',
                focus: 'Fine Motor Coordination',
                status: 'done',
                notes: 'Andi memberikan respons yang sangat baik terhadap aktivitas jepitan jari. Mampu menyelesaikan 4 dari 5 tugas dengan sedikit arahan. Progress sangat memuaskan minggu ini.',
            },
            {
                id: 'S-002',
                therapistId: 'SARAH260411001',
                childId: '260416001',
                date: yesterday,
                startTime: '10:00',
                duration: '60 mins',
                focus: 'Sensory Integration & Tactile Response',
                status: 'done',
                notes: 'Sesi sensori berjalan dengan baik. Andi mampu beradaptasi dengan berbagai tekstur. Perlu latihan lanjutan untuk respons vestibular.',
            },
            {
                id: 'S-003',
                therapistId: 'SARAH260411001',
                childId: '260416001',
                date: today,
                startTime: '10:00',
                duration: '60 mins',
                focus: 'Cognitive Skill Building',
                status: 'upcoming',
                notes: '',
            },
            {
                id: 'S-004',
                therapistId: 'SARAH260411001',
                childId: '260416001',
                date: tomorrow,
                startTime: '14:00',
                duration: '60 mins',
                focus: 'Motor Planning & Coordination',
                status: 'upcoming',
                notes: '',
            },
        ],
        rescheduleRequests: [],
        sessionRatings: [],
        reports: [],
        announcements: [],
        rooms: [
            { id: 'RM-001', name: 'Ruang OT 1', type: 'Occupational Therapy', capacity: 1, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-002', name: 'Ruang OT 2', type: 'Occupational Therapy', capacity: 1, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-003', name: 'Ruang ST A', type: 'Speech Therapy', capacity: 1, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-004', name: 'Ruang ST B', type: 'Speech Therapy', capacity: 1, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-005', name: 'Ruang Sensori', type: 'Sensory Integration', capacity: 2, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-006', name: 'Ruang ABA', type: 'ABA Therapy', capacity: 1, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-007', name: 'Ruang PT', type: 'Physical Therapy', capacity: 2, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
            { id: 'RM-008', name: 'Ruang Grup', type: 'Social Skills Group', capacity: 6, status: 'active', createdAt: '2026-01-10T08:00:00Z' },
        ],
        programs: [
            { id: 'PRG-OT', name: 'Occupational Therapy (OT)', code: 'OT', target: 'Fine Motor & Daily Living', duration: 60, goals: ['Hand-eye coordination', 'Sensory processing', 'Self-care routines'], createdAt: '2026-01-10T08:00:00Z' },
            { id: 'PRG-ST', name: 'Speech & Language Therapy (ST)', code: 'ST', target: 'Communication & Speech', duration: 45, goals: ['Articulation', 'Language expression', 'Social communication'], createdAt: '2026-01-10T08:00:00Z' },
            { id: 'PRG-ABA', name: 'Applied Behavior Analysis (ABA)', code: 'ABA', target: 'Behavioral & Social Skills', duration: 120, goals: ['Positive behavior reinforcement', 'Social interaction', 'Functional communication'], createdAt: '2026-01-10T08:00:00Z' },
            { id: 'PRG-PT', name: 'Physical Therapy (PT)', code: 'PT', target: 'Gross Motor & Mobility', duration: 60, goals: ['Balance and coordination', 'Strength and endurance', 'Posture control'], createdAt: '2026-01-10T08:00:00Z' },
            { id: 'PRG-SI', name: 'Sensory Integration (SI)', code: 'SI', target: 'Sensory Processing', duration: 45, goals: ['Vestibular input', 'Proprioceptive awareness', 'Tactile modulation'], createdAt: '2026-01-10T08:00:00Z' },
            { id: 'PRG-SSG', name: 'Social Skills Group (SSG)', code: 'SSG', target: 'Peer Interaction', duration: 90, goals: ['Turn-taking', 'Emotional regulation', 'Collaborative play'], createdAt: '2026-01-10T08:00:00Z' },
        ],
        notifications: [],
        lastParentId: 1,
        lastNITASequence: 1,
        lastNITSequence: 1,
        lastSessionId: 4,
        lastRoomId: 8,
        lastProgramId: 6,
        lastReportId: 0,
        clinicSettings: {
            adminWhatsApp: '6281234567890',
        },
    };
}

export function getStore() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return getDefaultData();
        
        const store = JSON.parse(raw);
        // Migration: Ensure new keys from getDefaultData are present
        const defaults = getDefaultData();
        let changed = false;

        // Ensure programs exist
        if (!store.programs || store.programs.length === 0) {
            store.programs = defaults.programs;
            changed = true;
        }

        // Ensure rooms exist
        if (!store.rooms || store.rooms.length === 0) {
            store.rooms = defaults.rooms;
            changed = true;
        }

        // Ensure program metadata
        if (store.lastProgramId === undefined) {
            store.lastProgramId = defaults.lastProgramId;
            changed = true;
        }

        // Ensure room metadata
        if (store.lastRoomId === undefined) {
            store.lastRoomId = defaults.lastRoomId;
            changed = true;
        }

        // Ensure clinic settings
        if (!store.clinicSettings) {
            store.clinicSettings = defaults.clinicSettings;
            changed = true;
        }

        // Fix stray data corruption (legacy)
        if (store.sessionRatings && !Array.isArray(store.sessionRatings)) {
            store.sessionRatings = [];
            changed = true;
        }
        if (!store.rescheduleRequests) {
            store.rescheduleRequests = [];
            changed = true;
        }
        if (!store.announcements) {
            store.announcements = [];
            changed = true;
        }
        if (!store.notifications) {
            store.notifications = [];
            changed = true;
        }
        if (!store.reports) {
            store.reports = [];
            changed = true;
        }
        if (store.lastReportId === undefined) {
            store.lastReportId = defaults.lastReportId;
            changed = true;
        }

        // Automate Archiving: Clean old logs > 90 days to prevent localStorage bloat
        if (store.sessions) {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];
            
            const initialCount = store.sessions.length;
            store.sessions = store.sessions.filter(s => {
                // Keep if it's upcoming or if it's relatively recent
                if (s.status === 'upcoming') return true;
                return s.date >= cutoffDate;
            });
            if (store.sessions.length !== initialCount) {
                changed = true;
            }
        }

        if (changed) saveStore(store);
        
        return store;
    } catch {
        return getDefaultData();
    }
}

export function saveStore(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('clinicDataUpdated'));
}

export function generateTempPassword() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `Clinic@${num}`;
}

// ── Settings ───────────────────────────────────────────────────────

export function getClinicSettings() {
    return getStore().clinicSettings || { adminWhatsApp: '6281234567890' };
}

export function updateClinicSettings(updates) {
    const store = getStore();
    if (!store.clinicSettings) store.clinicSettings = { adminWhatsApp: '6281234567890' };
    Object.assign(store.clinicSettings, updates);
    saveStore(store);
}

/**
 * Generate NITA — Nomor Induk Terapi Anak
 * Mutates store.lastNITASequence (caller must saveStore after)
 * @param {object} store - mutable store reference
 * @returns {string} e.g. "260417001"
 */
export function generateNITA(store) {
    const now  = new Date();
    const yy   = String(now.getFullYear()).slice(-2);
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    store.lastNITASequence = (store.lastNITASequence || 0) + 1;
    const seq  = String(store.lastNITASequence).padStart(3, '0');
    return `${yy}${mm}${dd}${seq}`;
}

// ── Parent & Child Management ──────────────────────────────────────

export function findParentByPhone(phone) {
    const store = getStore();
    const normalized = (phone || '').replace(/\D/g, '');
    return store.parents.find(p => (p.phone || '').replace(/\D/g, '') === normalized) || null;
}

export function findParentById(parentId) {
    const store = getStore();
    return (store.parents || []).find(p => p.id === parentId) || null;
}

/**
 * Find a child by their NITA number (used for parent login).
 * @param {string} nita
 * @returns {object|null}
 */
export function findChildByNITA(nita) {
    const store = getStore();
    return (store.children || []).find(c => c.nita === nita || c.id === nita) || null;
}

export function addParent(parentData) {
    const store = getStore();
    const existing = findParentByPhone(parentData.phone);
    if (existing) {
        return { parent: existing, isNew: false };
    }
    store.lastParentId = (store.lastParentId || 0) + 1;
    const parentId = `P-${String(store.lastParentId).padStart(4, '0')}`;
    const parent = {
        id: parentId,
        ...parentData,
        tempPassword: generateTempPassword(),
        status: 'active',
        children: [],
        createdAt: new Date().toISOString(),
    };
    store.parents.push(parent);
    saveStore(store);
    return { parent, isNew: true };
}

export function addChild(parentId, childData) {
    const store  = getStore();
    const nita   = generateNITA(store);  // mutates store.lastNITASequence
    const child  = {
        id:         nita,     // NITA as primary key
        nita:       nita,     // explicit field for display
        parentId,
        ...childData,
        name:       `${childData.firstName} ${childData.lastName}`,
        status:     'active',
        therapyPrograms: [],
        createdAt:  new Date().toISOString(),
    };
    store.children.push(child);
    const parent = store.parents.find(p => p.id === parentId);
    if (parent) parent.children = [...(parent.children || []), nita];
    saveStore(store);  // single save after both NITA increment + child push
    return child;
}

export function updateChild(childId, updates) {
    const store = getStore();
    const child = store.children.find(c => c.id === childId || c.nita === childId);
    if (!child) return null;
    
    // Process updates
    Object.assign(child, updates);
    if (updates.firstName || updates.lastName) {
        child.name = `${child.firstName || ''} ${child.lastName || ''}`.trim();
    }
    
    saveStore(store);
    return child;
}

export function getAllParents() {
    return getStore().parents;
}

export function getAllChildren() {
    return getStore().children;
}

/**
 * Get all children belonging to a parent.
 * @param {string} parentId
 * @returns {Array}
 */
export function getChildrenByParent(parentId) {
    const store = getStore();
    return (store.children || []).filter(c => c.parentId === parentId);
}

export function updateParentPassword(parentId) {
    const store  = getStore();
    const parent = store.parents.find(p => p.id === parentId);
    if (parent) {
        parent.tempPassword = generateTempPassword();
        saveStore(store);
        return parent.tempPassword;
    }
    return null;
}

export function updateParentStatus(parentId, status) {
    const store  = getStore();
    const parent = store.parents.find(p => p.id === parentId);
    if (parent) {
        parent.status = status;
        saveStore(store);
    }
}

// ── Therapist & Session Management ────────────────────────────────

export function generateNIT(store, therapistName = '') {
    const firstName = (therapistName || 'Terapis').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
    const now  = new Date();
    const yy   = String(now.getFullYear()).slice(-2);
    const mm   = String(now.getMonth() + 1).padStart(2, '0');
    const dd   = String(now.getDate()).padStart(2, '0');
    store.lastNITSequence = (store.lastNITSequence || 0) + 1;
    const seq  = String(store.lastNITSequence).padStart(3, '0');
    return `${firstName}${yy}${mm}${dd}${seq}`;
}

export function getAllTherapists() {
    return getStore().therapists || [];
}

export function addTherapist(therapistData) {
    const store = getStore();
    const nit = generateNIT(store, therapistData.name || '');
    const therapist = {
        id: nit,
        nit: nit,
        ...therapistData,
        tempPassword: generateTempPassword(),
        status: 'active',
        createdAt: new Date().toISOString()
    };
    if (!store.therapists) store.therapists = [];
    store.therapists.push(therapist);
    saveStore(store);
    return therapist;
}

export function updateTherapistPassword(therapistId) {
    const store  = getStore();
    const therapist = (store.therapists || []).find(t => t.id === therapistId);
    if (therapist) {
        therapist.tempPassword = generateTempPassword();
        saveStore(store);
        return therapist.tempPassword;
    }
    return null;
}

export function updateTherapistStatus(therapistId, status) {
    const store  = getStore();
    const therapist = (store.therapists || []).find(t => t.id === therapistId);
    if (therapist) {
        therapist.status = status;
        saveStore(store);
    }
}

export function updateTherapistProfile(therapistId, updates) {
    const store = getStore();
    const therapist = (store.therapists || []).find(t => t.id === therapistId);
    if (therapist) {
        Object.assign(therapist, updates);
        saveStore(store);
        
        // Also update sessionStorage if this therapist is currently logged in
        try {
            const currentUserStr = sessionStorage.getItem('therapist_user');
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr);
                if (currentUser.id === therapistId) {
                    sessionStorage.setItem('therapist_user', JSON.stringify({ ...currentUser, ...updates }));
                }
            }
        } catch(e) {}
        
        return therapist;
    }
    return null;
}

export function addSession(sessionData) {
    const store = getStore();
    store.lastSessionId = (store.lastSessionId || 0) + 1;
    const sessionId = `S-${String(store.lastSessionId).padStart(3, '0')}`;
    const session = {
        id: sessionId,
        ...sessionData,
        status: 'upcoming', // upcoming, active, done
        notes: '',
        createdAt: new Date().toISOString()
    };
    if (!store.sessions) store.sessions = [];
    store.sessions.push(session);
    saveStore(store);

    // Auto-notify parent and therapist about new session
    if (sessionData.childId) {
        const child = (store.children || []).find(c => c.id === sessionData.childId);
        if (child && child.parentId) {
            notifyParentNewSession(child.parentId, child.name || 'Anak', sessionData.date || '', sessionData.startTime || '');
        }
    }
    if (sessionData.therapistId) {
        const child = (store.children || []).find(c => c.id === sessionData.childId);
        notifyTherapistNewSession(sessionData.therapistId, child?.name || 'Anak', sessionData.date || '', sessionData.startTime || '');
    }

    return session;
}

export function addBulkSessions(sessionsDataArray) {
    const store = getStore();
    if (!store.sessions) store.sessions = [];
    
    let lastId = store.lastSessionId || store.sessions.length;
    const addedSessions = [];
    
    sessionsDataArray.forEach((sessionData, i) => {
        lastId++;
        const sessionId = `S-BULK-${Date.now()}-${i}`;
        const session = {
            id: sessionId,
            ...sessionData,
            status: 'upcoming',
            notes: '',
            createdAt: new Date().toISOString()
        };
        store.sessions.push(session);
        addedSessions.push(session);
    });
    
    store.lastSessionId = lastId;
    saveStore(store);

    if (addedSessions.length > 0) {
        const sampleSession = addedSessions[0];
        // Send a single notification for bulk creation
        if (sampleSession.childId) {
            const child = (store.children || []).find(c => c.id === sampleSession.childId);
            if (child && child.parentId) {
                addNotification({
                    type: 'new_session',
                    icon: 'event_repeat',
                    title: 'Jadwal Massal Dibuat',
                    message: `${addedSessions.length} sesi terapi baru telah dijadwalkan untuk ${child.name || 'Anak'}.`,
                    targetRole: 'parent',
                    targetUserId: child.parentId,
                });
            }
            if (sampleSession.therapistId) {
                addNotification({
                    type: 'new_session',
                    icon: 'event_repeat',
                    title: 'Jadwal Massal Ditugaskan',
                    message: `Anda mendapat tugas ${addedSessions.length} sesi terapi baru untuk ${child?.name || 'Anak'}.`,
                    targetRole: 'therapist',
                    targetUserId: sampleSession.therapistId,
                });
            }
        }
    }

    return addedSessions;
}

export function getSessionsForTherapist(therapistNit, dateStr = null) {
    const store = getStore();
    let sessions = store.sessions || [];
    sessions = sessions.filter(s => s.therapistId === therapistNit);
    if (dateStr) {
        sessions = sessions.filter(s => s.date === dateStr);
    }

    // Enrich with child and parent data
    return sessions.map(session => {
        let child = null;
        let parent = null;
        if (session.childId) {
            child = (store.children || []).find(c => c.id === session.childId);
            if (child && child.parentId) {
                parent = (store.parents || []).find(p => p.id === child.parentId);
            }
        }
        return { ...session, child, parent };
    });
}

export function updateSessionStatus(sessionId, status) {
    const store = getStore();
    const session = (store.sessions || []).find(s => s.id === sessionId);
    if (session) {
        session.status = status;
        saveStore(store);
        return session;
    }
    return null;
}

export function getAllSessionsWithDetails() {
    const store = getStore();
    const sessions = store.sessions || [];
    return sessions.map(session => {
        let child = null;
        let parent = null;
        let therapist = null;
        if (session.childId) {
            child = (store.children || []).find(c => c.id === session.childId);
            if (child && child.parentId) {
                parent = (store.parents || []).find(p => p.id === child.parentId);
            }
        }
        if (session.therapistId) {
            therapist = (store.therapists || []).find(t => t.id === session.therapistId);
        }
        return { ...session, child, parent, therapist };
    });
}

/**
 * Get upcoming sessions for a specific child, sorted by date/time asc.
 * Includes enriched therapist info.
 * @param {string} childId - NITA
 * @returns {Array}
 */
export function getUpcomingSessionsForChild(childId) {
    const store = getStore();
    const today = new Date().toISOString().split('T')[0];
    return (store.sessions || [])
        .filter(s => s.childId === childId && s.date >= today && s.status !== 'done')
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .map(session => {
            const therapist = (store.therapists || []).find(t => t.id === session.therapistId) || null;
            return { ...session, therapist };
        });
}

/**
 * Get completed sessions for a specific child, sorted by date desc (most recent first).
 * Includes enriched therapist info.
 * @param {string} childId - NITA
 * @returns {Array}
 */
export function getCompletedSessionsByChild(childId) {
    const store = getStore();
    return (store.sessions || [])
        .filter(s => s.childId === childId && s.status === 'done')
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
        .map(session => {
            const therapist = (store.therapists || []).find(t => t.id === session.therapistId) || null;
            return { ...session, therapist };
        });
}

/**
 * Get recent activity log for a therapist.
 * Includes done sessions + upcoming sessions as activity items.
 * @param {string} therapistNit
 * @param {number} limit
 * @returns {Array}
 */
export function getRecentActivityForTherapist(therapistNit, limit = 5) {
    const store = getStore();
    const today = new Date().toISOString().split('T')[0];
    const sessions = (store.sessions || [])
        .filter(s => s.therapistId === therapistNit)
        .map(session => {
            const child = (store.children || []).find(c => c.id === session.childId) || null;
            return { ...session, child };
        });

    const activities = [];

    // Done sessions → "Session completed with ChildName"
    sessions
        .filter(s => s.status === 'done')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .forEach(s => {
            const childName = s.child ? s.child.name : 'Unknown Child';
            activities.push({
                type: 'session_done',
                icon: 'task_alt',
                iconBg: 'bg-teal-50 dark:bg-teal-900/20',
                iconColor: 'text-teal-600 dark:text-teal-400',
                message: 'Session completed with',
                highlight: childName,
                time: s.date,
                focus: s.focus,
            });
        });

    // Upcoming sessions → "Upcoming: ChildName at time"
    sessions
        .filter(s => s.status === 'upcoming' && s.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        .slice(0, limit)
        .forEach(s => {
            const childName = s.child ? s.child.name : 'Unknown Child';
            activities.push({
                type: 'session_upcoming',
                icon: 'event_available',
                iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                iconColor: 'text-blue-500 dark:text-blue-400',
                message: 'Upcoming session:',
                highlight: childName,
                time: `${s.date} at ${s.startTime}`,
                focus: s.focus,
            });
        });

    // Sort: done first (most recent), then upcoming
    return activities.slice(0, limit);
}

export function saveSessionNote(sessionId, notes) {
    const store = getStore();
    const session = (store.sessions || []).find(s => s.id === sessionId);
    if (session) {
        session.notes = notes;
        saveStore(store);
    }
}

// ── Reschedule Requests ────────────────────────────────────────────

/**
 * Submit a reschedule request from parent.
 * @param {object} requestData - { parentId, childId, sessionId, reason, details, proposedSlots[] }
 * @returns {object} The saved request
 */
export function addRescheduleRequest(requestData) {
    const store = getStore();
    if (!store.rescheduleRequests) store.rescheduleRequests = [];
    const req = {
        id: `RR-${Date.now()}`,
        ...requestData,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };
    store.rescheduleRequests.push(req);
    saveStore(store);

    // Auto-notify admin about new reschedule request
    const child = (store.children || []).find(c => c.id === requestData.childId);
    const parent = (store.parents || []).find(p => p.id === requestData.parentId);
    notifyAdminNewReschedule(
        child?.name || 'Anak',
        parent?.name || 'Orang Tua'
    );

    return req;
}

/**
 * Get all reschedule requests, optionally filtered by parentId.
 * @param {string|null} parentId
 * @returns {Array}
 */
export function getRescheduleRequests(parentId = null) {
    const store = getStore();
    const reqs = store.rescheduleRequests || [];
    return parentId ? reqs.filter(r => r.parentId === parentId) : reqs;
}

/**
 * Get reschedule requests relevant to a therapist (by sessions assigned to them).
 * @param {string} therapistId
 * @returns {Array}
 */
export function getRescheduleRequestsForTherapist(therapistId) {
    const store = getStore();
    const reqs = store.rescheduleRequests || [];
    const therapistSessionIds = (store.sessions || [])
        .filter(s => s.therapistId === therapistId)
        .map(s => s.id);
    return reqs
        .filter(r => therapistSessionIds.includes(r.sessionId))
        .map(r => {
            const child = (store.children || []).find(c => c.id === r.childId) || null;
            const parent = (store.parents || []).find(p => p.id === r.parentId) || null;
            return { ...r, child, parent };
        });
}

/**
 * Update the status of a reschedule request. 
 * Can also automatically update the session slot if approved.
 * @param {string} requestId 
 * @param {string} status - 'approved', 'rejected', 'review'
 * @param {object} updates - optional new slot details { newDate, newStartTime, reviewNote }
 */
export function updateRescheduleRequest(requestId, status, updates = {}) {
    const store = getStore();
    const req = (store.rescheduleRequests || []).find(r => r.id === requestId);
    if (!req) return;

    req.status = status;
    req.resolvedAt = new Date().toISOString();
    
    if (updates.reviewNote) req.reviewNote = updates.reviewNote;
    if (updates.newDate) req.newDate = updates.newDate;
    if (updates.newStartTime) req.newStartTime = updates.newStartTime;

    // Resolve child/parent/therapist info for notifications
    const child = (store.children || []).find(c => c.id === req.childId);
    const session = (store.sessions || []).find(s => s.id === req.sessionId);
    const newDateDisplay = updates.newDate ? `${updates.newDate} ${updates.newStartTime || ''}`.trim() : '';

    // If approved, optionally apply the new slot to the session directly
    if (status === 'approved' && req.sessionId && updates.newDate) {
        if (session) {
            // Cancel original session
            session.status = 'cancelled';
            session.cancelReason = 'Rescheduled parent request';
            // Create new session slot
            const newSession = {
                ...session,
                id: `S-RESCHED-${Date.now()}`,
                date: updates.newDate,
                startTime: updates.newStartTime || session.startTime,
                status: 'upcoming'
            };
            store.sessions.push(newSession);
        }
    }

    saveStore(store);

    // Auto-notify parent about reschedule result
    if (status === 'approved' || status === 'rejected' || status === 'review') {
        notifyParentRescheduleResult(
            req.parentId,
            child?.name || 'Anak',
            status,
            newDateDisplay
        );
        // Also notify therapist if session exists
        if (session?.therapistId) {
            notifyTherapistReschedule(
                session.therapistId,
                child?.name || 'Anak',
                status,
                newDateDisplay
            );
        }
    }

    return req;
}

// ── Announcements ──────────────────────────────────────────────────

/**
 * Add a new announcement (Admin).
 * @param {object} data - { title, content, targetRoles[], createdBy }
 * @returns {object} The saved announcement
 */
export function addAnnouncement(data) {
    const store = getStore();
    if (!store.announcements) store.announcements = [];
    const ann = {
        id: `ANN-${Date.now()}`,
        ...data,
        isActive: true,
        createdAt: new Date().toISOString(),
    };
    store.announcements.unshift(ann);
    saveStore(store);

    // Auto-notify target roles about new announcement
    if (data.targetRoles && data.targetRoles.length > 0) {
        notifyAnnouncementCreated(data.title || 'Pengumuman Baru', data.targetRoles);
    }

    return ann;
}

/**
 * Update an existing announcement.
 * @param {string} id
 * @param {object} updates
 */
export function updateAnnouncement(id, updates) {
    const store = getStore();
    const ann = (store.announcements || []).find(a => a.id === id);
    if (ann) {
        Object.assign(ann, updates);
        saveStore(store);
    }
}

/**
 * Delete an announcement.
 * @param {string} id
 */
export function deleteAnnouncement(id) {
    const store = getStore();
    store.announcements = (store.announcements || []).filter(a => a.id !== id);
    saveStore(store);
}

/**
 * Get announcements for a specific role, sorted by newest first.
 * @param {string} role - 'parent' | 'therapist' | 'admin'
 * @returns {Array}
 */
export function getAnnouncements(role) {
    const store = getStore();
    return (store.announcements || [])
        .filter(a => a.isActive && (a.targetRoles || []).includes(role))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getAllAnnouncements() {
    const store = getStore();
    return (store.announcements || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ── Session Ratings ────────────────────────────────────────────────

/**
 * Add or update a parent rating for a session.
 * @param {string} sessionId
 * @param {string} childId
 * @param {string} parentId
 * @param {number} rating - 1 to 5
 * @param {string} comment - optional
 */
export function addSessionRating(sessionId, childId, parentId, rating, comment = '') {
    const store = getStore();
    if (!store.sessionRatings) store.sessionRatings = [];
    // Remove existing rating for this session if any
    store.sessionRatings = store.sessionRatings.filter(r => r.sessionId !== sessionId);
    store.sessionRatings.push({
        id: `RAT-${Date.now()}`,
        sessionId,
        childId,
        parentId,
        rating,
        comment,
        createdAt: new Date().toISOString(),
    });
    saveStore(store);
}

/**
 * Get the rating for a specific session.
 * @param {string} sessionId
 * @returns {object|null}
 */
export function getSessionRating(sessionId) {
    const store = getStore();
    return (store.sessionRatings || []).find(r => r.sessionId === sessionId) || null;
}

function getReportSortDate(report) {
    return report.date || report.dateTo || report.dateFrom || report.createdAt || '';
}

export function saveTherapistReport(reportData) {
    const store = getStore();
    if (!store.reports) store.reports = [];

    const now = new Date().toISOString();
    let report = null;

    if (reportData.id) {
        report = store.reports.find(r => r.id === reportData.id) || null;
    }

    if (!report && reportData.type === 'harian' && reportData.sessionId) {
        report = store.reports.find(r => r.type === 'harian' && r.sessionId === reportData.sessionId) || null;
    }

    if (report) {
        Object.assign(report, reportData, { updatedAt: now });
    } else {
        store.lastReportId = (store.lastReportId || 0) + 1;
        report = {
            id: `REP-${String(store.lastReportId).padStart(4, '0')}`,
            status: 'pending_review',
            createdAt: now,
            updatedAt: now,
            ...reportData,
        };
        store.reports.unshift(report);
    }

    if (report.type === 'harian' && report.sessionId) {
        const session = (store.sessions || []).find(s => s.id === report.sessionId);
        if (session) {
            session.notes = report.description || session.notes || '';
        }
    }

    saveStore(store);
    return report;
}

export function getReportsForTherapist(therapistId, type = null) {
    const store = getStore();
    return (store.reports || [])
        .filter(report => report.therapistId === therapistId)
        .filter(report => !type || report.type === type)
        .sort((a, b) => getReportSortDate(b).localeCompare(getReportSortDate(a)));
}

export function getReportsForChild(childId, type = null) {
    const store = getStore();
    return (store.reports || [])
        .filter(report => report.childId === childId)
        .filter(report => !type || report.type === type)
        .sort((a, b) => getReportSortDate(b).localeCompare(getReportSortDate(a)));
}

export function getSessionReport(sessionId) {
    const store = getStore();
    return (store.reports || []).find(report => report.type === 'harian' && report.sessionId === sessionId) || null;
}

// ── Rooms Management ────────────────────────────────────────────────

export function getAllRooms() {
    return getStore().rooms || [];
}

export function addRoom(roomData) {
    const store = getStore();
    if (!store.rooms) store.rooms = [];
    const room = {
        ...roomData,
        id: `RM-${Date.now()}`,
        createdAt: new Date().toISOString(),
    };
    store.rooms.push(room);
    saveStore(store);
    return room;
}

export function updateRoom(roomId, updates) {
    const store = getStore();
    const room = (store.rooms || []).find(r => r.id === roomId);
    if (room) {
        Object.assign(room, updates);
        saveStore(store);
    }
}

export function deleteRoom(roomId) {
    const store = getStore();
    if (store.rooms) {
        store.rooms = store.rooms.filter(r => r.id !== roomId);
        saveStore(store);
    }
}

// ── Programs Management ─────────────────────────────────────────────

export function getAllPrograms() {
    return getStore().programs || [];
}

export function addProgram(programData) {
    const store = getStore();
    if (!store.programs) store.programs = [];
    const program = {
        ...programData,
        id: `PRG-${Date.now()}`,
        createdAt: new Date().toISOString(),
    };
    store.programs.push(program);
    saveStore(store);
    return program;
}

export function updateProgram(programId, updates) {
    const store = getStore();
    const program = (store.programs || []).find(p => p.id === programId);
    if (program) {
        Object.assign(program, updates);
        saveStore(store);
    }
}

export function deleteProgram(programId) {
    const store = getStore();
    if (store.programs) {
        store.programs = store.programs.filter(p => p.id !== programId);
        saveStore(store);
    }
}

// ── Notification System ─────────────────────────────────────────────
// Cross-role notifications stored in the central store.
// Each notification: { id, type, icon, title, message, targetRole, targetUserId?, relatedId?, readBy[], createdAt }
// targetRole: 'admin' | 'parent' | 'therapist'
// readBy: array of user IDs who have read this notification

/**
 * Add a notification to the store.
 * @param {object} data - { type, icon, title, message, targetRole, targetUserId?, relatedId? }
 * @returns {object} The saved notification
 */
export function addNotification(data) {
    const store = getStore();
    if (!store.notifications) store.notifications = [];
    const notif = {
        id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        ...data,
        readBy: [],
        createdAt: new Date().toISOString(),
    };
    store.notifications.unshift(notif);
    // Keep max 200 notifications to prevent bloat
    if (store.notifications.length > 200) {
        store.notifications = store.notifications.slice(0, 200);
    }
    saveStore(store);
    return notif;
}

/**
 * Get notifications for a specific role, optionally filtered by userId.
 * Sorted by newest first.
 * @param {string} role - 'admin' | 'parent' | 'therapist'
 * @param {string|null} userId - optional user ID for targeted notifications
 * @returns {Array}
 */
export function getNotificationsForRole(role, userId = null) {
    const store = getStore();
    return (store.notifications || [])
        .filter(n => {
            if (n.targetRole !== role) return false;
            // If notification targets a specific user, check userId
            if (n.targetUserId && userId && n.targetUserId !== userId) return false;
            return true;
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get unread notification count for a role/user.
 * @param {string} role
 * @param {string} userId - The user's ID to check readBy against
 * @returns {number}
 */
export function getUnreadNotificationCount(role, userId) {
    const notifs = getNotificationsForRole(role, userId);
    return notifs.filter(n => !(n.readBy || []).includes(userId)).length;
}

/**
 * Mark a single notification as read by a user.
 * @param {string} notifId
 * @param {string} userId
 */
export function markNotificationRead(notifId, userId) {
    const store = getStore();
    const notif = (store.notifications || []).find(n => n.id === notifId);
    if (notif) {
        if (!notif.readBy) notif.readBy = [];
        if (!notif.readBy.includes(userId)) {
            notif.readBy.push(userId);
            saveStore(store);
        }
    }
}

/**
 * Mark ALL notifications as read for a role/user.
 * @param {string} role
 * @param {string} userId
 */
export function markAllNotificationsRead(role, userId) {
    const store = getStore();
    let changed = false;
    (store.notifications || []).forEach(n => {
        if (n.targetRole !== role) return;
        if (n.targetUserId && n.targetUserId !== userId) return;
        if (!n.readBy) n.readBy = [];
        if (!n.readBy.includes(userId)) {
            n.readBy.push(userId);
            changed = true;
        }
    });
    if (changed) saveStore(store);
}

// ── Auto-Notification Helpers ─────────────────────────────────────

/**
 * Notify admin when a parent submits a reschedule request.
 */
export function notifyAdminNewReschedule(childName, parentName) {
    addNotification({
        type: 'reschedule_request',
        icon: 'swap_horiz',
        title: 'Permintaan Reschedule Baru',
        message: `${parentName} mengajukan reschedule untuk sesi ${childName}. Silakan review di halaman Permintaan Masuk.`,
        targetRole: 'admin',
    });
}

/**
 * Notify parent when admin approves/rejects their reschedule.
 */
export function notifyParentRescheduleResult(parentId, childName, status, newDate = '') {
    const statusText = status === 'approved' ? 'disetujui ✓' : status === 'rejected' ? 'ditolak ✗' : 'sedang direview';
    const dateInfo = status === 'approved' && newDate ? ` Jadwal baru: ${newDate}.` : '';
    addNotification({
        type: 'reschedule_result',
        icon: status === 'approved' ? 'event_available' : status === 'rejected' ? 'event_busy' : 'pending_actions',
        title: `Reschedule ${status === 'approved' ? 'Disetujui' : status === 'rejected' ? 'Ditolak' : 'Direview'}`,
        message: `Permintaan reschedule untuk ${childName} telah ${statusText}.${dateInfo}`,
        targetRole: 'parent',
        targetUserId: parentId,
    });
}

/**
 * Notify therapist when a reschedule affects their schedule.
 */
export function notifyTherapistReschedule(therapistId, childName, status, newDate = '') {
    const statusText = status === 'approved' ? 'disetujui' : 'ditolak';
    addNotification({
        type: 'schedule_change',
        icon: 'event_repeat',
        title: 'Perubahan Jadwal Pasien',
        message: `Reschedule sesi ${childName} telah ${statusText}.${newDate ? ` Jadwal baru: ${newDate}.` : ''}`,
        targetRole: 'therapist',
        targetUserId: therapistId,
    });
}

/**
 * Notify target roles when admin creates an announcement.
 */
export function notifyAnnouncementCreated(title, targetRoles) {
    (targetRoles || []).forEach(role => {
        addNotification({
            type: 'announcement',
            icon: 'campaign',
            title: 'Pengumuman Baru',
            message: title,
            targetRole: role,
        });
    });
}

/**
 * Notify parent when a new session is scheduled for their child.
 */
export function notifyParentNewSession(parentId, childName, date, time) {
    addNotification({
        type: 'new_session',
        icon: 'event_available',
        title: 'Sesi Baru Dijadwalkan',
        message: `Sesi terapi untuk ${childName} dijadwalkan pada ${date} pukul ${time}.`,
        targetRole: 'parent',
        targetUserId: parentId,
    });
}

/**
 * Notify therapist when a new session is assigned to them.
 */
export function notifyTherapistNewSession(therapistId, childName, date, time) {
    addNotification({
        type: 'new_session',
        icon: 'calendar_add_on',
        title: 'Sesi Baru Ditugaskan',
        message: `Anda ditugaskan untuk sesi ${childName} pada ${date} pukul ${time}.`,
        targetRole: 'therapist',
        targetUserId: therapistId,
    });
}

/**
 * Notify admin when a new child is registered.
 */
export function notifyAdminNewChild(childName, parentName) {
    addNotification({
        type: 'new_child',
        icon: 'person_add',
        title: 'Anak Baru Terdaftar',
        message: `${childName} (orangtua: ${parentName}) telah terdaftar di sistem.`,
        targetRole: 'admin',
    });
}

/**
 * Notify parent when admin completes a session (report ready).
 */
export function notifyParentSessionCompleted(parentId, childName, focus) {
    addNotification({
        type: 'session_completed',
        icon: 'task_alt',
        title: 'Sesi Terapi Selesai',
        message: `Sesi "${focus}" untuk ${childName} telah selesai. Lihat laporan di halaman Daftar Laporan.`,
        targetRole: 'parent',
        targetUserId: parentId,
    });
}
