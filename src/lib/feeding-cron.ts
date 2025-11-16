import cron from 'node-cron';

// Track which notifications have been sent today to avoid duplicates
const sentNotificationsToday = new Map<string, Set<string>>(); // userId -> Set of feeding record IDs

// Reset daily tracking (call this at midnight)
function resetDailyTracking() {
    sentNotificationsToday.clear();
}

// Check if we should reset (new day)
function checkAndResetDailyTracking() {
    const now = new Date();
    const lastReset = (global as any).lastFeedingReset || new Date(0);
    const daysDiff = Math.floor((now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 0) {
        resetDailyTracking();
        (global as any).lastFeedingReset = now;
    }
}

async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    const apiKey = process.env.SEMAPHORE_API_KEY;
    const senderName = process.env.SEMAPHORE_SENDER_NAME || 'SmartFish';

    if (!apiKey) {
        console.error('SEMAPHORE_API_KEY not configured');
        return false;
    }

    try {
        const formData = new URLSearchParams();
        formData.append('apikey', apiKey);
        formData.append('number', phoneNumber);
        formData.append('message', message);
        formData.append('sendername', senderName);

        const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';
        const smsResponse = await fetch(SEMAPHORE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
        });

        const smsData = await smsResponse.json();

        if (!smsResponse.ok) {
            console.error('Semaphore API error:', smsData);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error sending SMS:', error);
        return false;
    }
}

async function checkFeedingSchedule() {
    try {
        // Check and reset daily tracking if needed
        checkAndResetDailyTracking();

        // Get current time in HH:MM format
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMinute = now.getMinutes().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMinute}`;

        // Dynamic import to avoid issues during build
        const { prisma } = await import('@/lib/db');

        // Get all feeding records for today
        const feedingRecords = await prisma.feedingRecord.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        phoneNumber: true,
                        email: true,
                    },
                },
            },
        });

        let notificationsSent = 0;

        for (const record of feedingRecords) {
            // Check if feeding time matches current time (within 1 minute window)
            const recordTime = record.feedingTime.substring(0, 5); // Get HH:MM from HH:MM:SS or HH:MM

            if (recordTime === currentTime) {
                // Check if we already sent notification for this record today
                const userSentSet = sentNotificationsToday.get(record.userId.toString()) || new Set();
                const recordKey = `${record.id}-${currentTime}`;

                if (userSentSet.has(recordKey)) {
                    console.log(`Skipping duplicate notification for record ${record.id} at ${currentTime}`);
                    continue;
                }

                // Get user's phone number
                const phoneNumber = record.user.phoneNumber || process.env.DEFAULT_PHONE_NUMBER;

                if (!phoneNumber) {
                    console.error(`No phone number for user ${record.userId} (record ${record.id})`);
                    continue;
                }

                // Create SMS message
                const quantityText = record.quantity ? ` Quantity: ${record.quantity}.` : '';
                const notesText = record.notes ? ` Notes: ${record.notes}.` : '';
                const message = `SmartFishCare Reminder: Time to feed your ${record.fishSize} fish! Food: ${record.foodType}.${quantityText}${notesText} Scheduled time: ${currentTime}.`;

                // Send SMS
                const success = await sendSMS(phoneNumber, message);

                if (success) {
                    // Mark as sent
                    if (!sentNotificationsToday.has(record.userId.toString())) {
                        sentNotificationsToday.set(record.userId.toString(), new Set());
                    }
                    sentNotificationsToday.get(record.userId.toString())!.add(recordKey);

                    notificationsSent++;
                    console.log(`SMS sent successfully for feeding record ${record.id} at ${currentTime} to ${phoneNumber.substring(0, 4)}****`);
                } else {
                    console.error(`Failed to send SMS for record ${record.id}`);
                }
            }
        }

        if (notificationsSent > 0) {
            console.log(`[Feeding Schedule] ${notificationsSent} SMS notification(s) sent at ${currentTime}`);
        }
    } catch (error: any) {
        console.error('Feeding schedule check error:', error);
    }
}

let cronJob: ReturnType<typeof cron.schedule> | null = null;

export function startFeedingScheduleCron() {
    // Only start if not already started
    if (cronJob) {
        console.log('[Feeding Schedule] Cron job already running');
        return;
    }

    // Run every minute: * * * * *
    cronJob = cron.schedule('* * * * *', async () => {
        await checkFeedingSchedule();
    });

    console.log('[Feeding Schedule] Cron job started - checking every minute');

    // Also run at midnight to reset daily tracking
    cron.schedule('0 0 * * *', () => {
        resetDailyTracking();
        console.log('[Feeding Schedule] Daily tracking reset');
    });
}

export function stopFeedingScheduleCron() {
    if (cronJob) {
        cronJob.stop();
        cronJob = null;
        console.log('[Feeding Schedule] Cron job stopped');
    }
}

