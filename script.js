class MedicineReminder {
    constructor() {
        this.reminders = this.loadReminders();
        this.currentFilter = 'all';
        this.editingId = null;
        this.notificationInterval = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.requestNotificationPermission();
        this.initializeTheme();
        this.renderReminders();
        this.updateTabCounts();
        this.startNotificationChecker();
    }

    setupEventListeners() {
        // Add reminder form
        document.getElementById('addReminderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addReminder();
        });

        // Edit reminder form
        document.getElementById('editReminderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateReminder();
        });

        // Filter tabs
        document.getElementById('filterTabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                this.setFilter(e.target.dataset.filter);
            }
        });

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Modal controls
        document.getElementById('modalClose').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('cancelEdit').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on backdrop click
        document.getElementById('editModal').addEventListener('click', (e) => {
            if (e.target.id === 'editModal') {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    }

    // Theme management
    initializeTheme() {
        const savedTheme = localStorage.getItem('medicine-reminder-theme') || 'light';
        const isDark = savedTheme === 'dark';
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        const toggleIcon = document.querySelector('.toggle-icon');
        toggleIcon.textContent = isDark ? '☀️' : '🌙';
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('medicine-reminder-theme', newTheme);
        
        const toggleIcon = document.querySelector('.toggle-icon');
        toggleIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    }

    // Notification permission
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.warn('Notification permission request failed:', error);
            }
        }
    }

    // Local storage management
    loadReminders() {
        const stored = localStorage.getItem('medicine-reminders');
        return stored ? JSON.parse(stored) : [];
    }

    saveReminders() {
        localStorage.setItem('medicine-reminders', JSON.stringify(this.reminders));
    }

    // Reminder management
    addReminder() {
        const form = document.getElementById('addReminderForm');
        const formData = new FormData(form);
        
        const reminder = {
            id: Date.now().toString(),
            medicineName: formData.get('medicineName').trim(),
            dosage: formData.get('dosage').trim(),
            time: formData.get('time'),
            frequency: formData.get('frequency'),
            status: 'upcoming',
            createdAt: new Date().toISOString(),
            lastTaken: null,
            nextDue: this.calculateNextDue(formData.get('time'), formData.get('frequency'))
        };

        this.reminders.push(reminder);
        this.saveReminders();
        this.renderReminders();
        this.updateTabCounts();
        
        form.reset();
        this.showSuccess('Reminder added successfully!');
    }

    updateReminder() {
        const form = document.getElementById('editReminderForm');
        const formData = new FormData(form);
        
        const reminderIndex = this.reminders.findIndex(r => r.id === this.editingId);
        if (reminderIndex === -1) return;

        const reminder = this.reminders[reminderIndex];
        reminder.medicineName = formData.get('medicineName').trim();
        reminder.dosage = formData.get('dosage').trim();
        reminder.time = formData.get('time');
        reminder.frequency = formData.get('frequency');
        reminder.nextDue = this.calculateNextDue(formData.get('time'), formData.get('frequency'));

        this.saveReminders();
        this.renderReminders();
        this.updateTabCounts();
        this.closeModal();
        this.showSuccess('Reminder updated successfully!');
    }

    deleteReminder(id) {
        if (confirm('Are you sure you want to delete this reminder?')) {
            this.reminders = this.reminders.filter(r => r.id !== id);
            this.saveReminders();
            this.renderReminders();
            this.updateTabCounts();
            this.showSuccess('Reminder deleted successfully!');
        }
    }

    markAsTaken(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (!reminder) return;

        reminder.status = 'taken';
        reminder.lastTaken = new Date().toISOString();
        
        // Calculate next due time for daily reminders
        if (reminder.frequency === 'daily') {
            reminder.nextDue = this.calculateNextDue(reminder.time, reminder.frequency);
            reminder.status = 'upcoming';
        }

        this.saveReminders();
        this.renderReminders();
        this.updateTabCounts();
        this.showSuccess(`${reminder.medicineName} marked as taken!`);
    }

    editReminder(id) {
        const reminder = this.reminders.find(r => r.id === id);
        if (!reminder) return;

        this.editingId = id;
        
        // Populate edit form
        document.getElementById('editMedicineName').value = reminder.medicineName;
        document.getElementById('editDosage').value = reminder.dosage;
        document.getElementById('editTime').value = reminder.time;
        document.getElementById('editFrequency').value = reminder.frequency;

        this.openModal();
    }

    // Modal management
    openModal() {
        const modal = document.getElementById('editModal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        const modal = document.getElementById('editModal');
        modal.classList.remove('show');
        document.body.style.overflow = '';
        this.editingId = null;
    }

    // Utility functions
    calculateNextDue(time, frequency) {
        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        
        let nextDue = new Date();
        nextDue.setHours(hours, minutes, 0, 0);

        // If time has passed today and it's not a once-only reminder
        if (nextDue <= now && frequency === 'daily') {
            nextDue.setDate(nextDue.getDate() + 1);
        }

        return nextDue.toISOString();
    }

    updateReminderStatuses() {
        const now = new Date();
        let updated = false;

        this.reminders.forEach(reminder => {
            if (reminder.status === 'upcoming' && reminder.nextDue) {
                const dueTime = new Date(reminder.nextDue);
                
                // Mark as missed if 15 minutes have passed since due time
                if (now > new Date(dueTime.getTime() + 15 * 60 * 1000)) {
                    if (reminder.frequency === 'once') {
                        reminder.status = 'missed';
                    } else if (reminder.frequency === 'daily') {
                        // Skip to next day for daily reminders
                        reminder.nextDue = this.calculateNextDue(reminder.time, reminder.frequency);
                    }
                    updated = true;
                }
            }
        });

        if (updated) {
            this.saveReminders();
            this.renderReminders();
            this.updateTabCounts();
        }
    }

    // Notification system
    startNotificationChecker() {
        // Check every minute
        this.notificationInterval = setInterval(() => {
            this.checkNotifications();
            this.updateReminderStatuses();
        }, 60000);

        // Check immediately
        this.checkNotifications();
        this.updateReminderStatuses();
    }

    checkNotifications() {
        const now = new Date();
        
        this.reminders.forEach(reminder => {
            if (reminder.status === 'upcoming' && reminder.nextDue) {
                const dueTime = new Date(reminder.nextDue);
                const timeDiff = dueTime.getTime() - now.getTime();
                
                // Trigger notification if within 1 minute of due time
                if (timeDiff <= 60000 && timeDiff > 0) {
                    this.sendNotification(reminder);
                }
            }
        });
    }

    sendNotification(reminder) {
        const title = 'Medicine Reminder';
        const body = `Time to take your ${reminder.medicineName} (${reminder.dosage})`;
        const options = {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            requireInteraction: true,
            actions: [
                { action: 'taken', title: 'Mark as Taken' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        };

        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                const notification = new Notification(title, options);
                
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };

                // Auto-close after 10 seconds
                setTimeout(() => {
                    notification.close();
                }, 10000);

            } catch (error) {
                console.warn('Failed to show notification:', error);
                this.fallbackAlert(reminder);
            }
        } else {
            this.fallbackAlert(reminder);
        }
    }

    fallbackAlert(reminder) {
        const message = `⏰ Medicine Reminder!\n\nTime to take your ${reminder.medicineName}\nDosage: ${reminder.dosage}`;
        alert(message);
    }

    // Filter management
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.renderReminders();
    }

    getFilteredReminders() {
        if (this.currentFilter === 'all') {
            return this.reminders;
        }
        return this.reminders.filter(reminder => reminder.status === this.currentFilter);
    }

    updateTabCounts() {
        const counts = {
            all: this.reminders.length,
            upcoming: this.reminders.filter(r => r.status === 'upcoming').length,
            taken: this.reminders.filter(r => r.status === 'taken').length,
            missed: this.reminders.filter(r => r.status === 'missed').length
        };

        Object.keys(counts).forEach(key => {
            const badge = document.getElementById(`${key}Count`);
            if (badge) {
                badge.textContent = counts[key];
            }
        });
    }

    // Rendering
    renderReminders() {
        const container = document.getElementById('remindersList');
        const emptyState = document.getElementById('emptyState');
        const filteredReminders = this.getFilteredReminders();

        if (filteredReminders.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            
            // Update empty state message based on filter
            const messages = {
                all: 'No reminders found. Add your first medicine reminder above!',
                upcoming: 'No upcoming reminders.',
                taken: 'No reminders marked as taken yet.',
                missed: 'No missed reminders.'
            };
            emptyState.querySelector('p').textContent = messages[this.currentFilter];
        } else {
            container.style.display = 'grid';
            emptyState.style.display = 'none';
            
            container.innerHTML = filteredReminders.map(reminder => this.renderReminderCard(reminder)).join('');
        }
    }

    renderReminderCard(reminder) {
        const nextDue = reminder.nextDue ? new Date(reminder.nextDue) : null;
        const formattedTime = this.formatTime(reminder.time);
        const statusClass = `status-${reminder.status}`;

        return `
            <div class="reminder-card fade-in" data-id="${reminder.id}">
                <div class="reminder-header">
                    <div class="reminder-info">
                        <h3>${reminder.medicineName}</h3>
                        <div class="reminder-dosage">${reminder.dosage}</div>
                    </div>
                    <div class="reminder-status ${statusClass}">${reminder.status}</div>
                </div>
                
                <div class="reminder-details">
                    <div class="reminder-detail">
                        <div class="reminder-detail-label">Time</div>
                        <div class="reminder-detail-value">${formattedTime}</div>
                    </div>
                    <div class="reminder-detail">
                        <div class="reminder-detail-label">Frequency</div>
                        <div class="reminder-detail-value">${reminder.frequency}</div>
                    </div>
                </div>
                
                ${nextDue && reminder.status === 'upcoming' ? `
                    <div style="margin-bottom: 16px; padding: 8px 12px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; text-align: center; color: var(--primary-color); font-size: 14px;">
                        Next due: ${this.formatDateTime(nextDue)}
                    </div>
                ` : ''}
                
                ${reminder.lastTaken ? `
                    <div style="margin-bottom: 16px; padding: 8px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; text-align: center; color: var(--success-color); font-size: 14px;">
                        Last taken: ${this.formatDateTime(new Date(reminder.lastTaken))}
                    </div>
                ` : ''}
                
                <div class="reminder-actions">
                    ${reminder.status === 'upcoming' ? `
                        <button class="btn btn-success btn-sm" onclick="app.markAsTaken('${reminder.id}')">
                            ✓ Mark as Taken
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="app.editReminder('${reminder.id}')">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="app.deleteReminder('${reminder.id}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `;
    }

    // Utility formatting functions
    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    }

    formatDateTime(date) {
        const options = {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        };
        return date.toLocaleDateString('en-US', options);
    }

    // Success message
    showSuccess(message) {
        // Simple success indication - could be enhanced with toast notifications
        console.log('Success:', message);
        
        // Flash the relevant tab badge to indicate change
        setTimeout(() => {
            this.updateTabCounts();
        }, 100);
    }

    // Cleanup
    destroy() {
        if (this.notificationInterval) {
            clearInterval(this.notificationInterval);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MedicineReminder();
});

// Handle service worker for notifications if supported
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
        console.log('Service worker registration failed:', err);
    });
}

// Handle page visibility change to update statuses when user returns
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.app) {
        window.app.checkNotifications();
        window.app.updateReminderStatuses();
    }
});
