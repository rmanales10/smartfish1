# Feeding Schedule SMS Notifications

This feature automatically sends SMS notifications to users when it's time to feed their fish based on the feeding schedules they've set.

## Features

- ✅ Automatic SMS notifications at scheduled feeding times
- ✅ Prevents duplicate notifications (one per day per schedule)
- ✅ Uses user's phone number from profile or default from environment
- ✅ Includes feeding details (fish size, food type, quantity, notes)
- ✅ Cron job runs every minute to check for matching schedules
- ✅ Manual test button on feeding schedule page

## How It Works

1. **Schedule Creation**: Users create feeding schedules with:
   - Fish Size (Small, Medium, Large)
   - Food Type
   - Feeding Time (HH:MM format)
   - Quantity (optional)
   - Notes (optional)

2. **Automatic Checking**: A cron job runs every minute to check if any feeding schedules match the current time.

3. **SMS Notification**: When a match is found:
   - System checks if notification was already sent today (prevents duplicates)
   - Retrieves user's phone number from profile or uses default
   - Sends SMS with feeding reminder details
   - Marks notification as sent for today

## Setup Instructions

### 1. Environment Variables

Make sure these are configured in your `.env.local`:

```env
# Semaphore SMS API Configuration
SEMAPHORE_API_KEY=your_api_key_here
SEMAPHORE_SENDER_NAME=SmartFish
DEFAULT_PHONE_NUMBER=+1234567890
```

### 2. Platform-Specific Setup

#### For Windows Server (Automatic)

The cron job starts automatically when the Next.js server starts using `node-cron`. No additional configuration needed!

**Just start your server:**
```bash
npm run dev    # Development
npm start     # Production
```

You should see: `[Feeding Schedule] Cron job started - checking every minute`

**See [WINDOWS_SERVER_SETUP.md](./WINDOWS_SERVER_SETUP.md) for detailed Windows server instructions.**

#### For Vercel (Requires Pro Plan)

The `vercel.json` file is configured to run the cron job every minute:

```json
{
  "crons": [
    {
      "path": "/api/feeding/check-schedule",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note**: Vercel cron jobs require a Pro plan. For free tier, use Windows server setup instead.

### 3. User Phone Number

Users need to configure their phone number:
- Go to Settings page
- Add phone number in international format (e.g., +639123456789)
- Or set `DEFAULT_PHONE_NUMBER` in environment variables

## API Endpoint

### GET/POST `/api/feeding/check-schedule`

Checks current time against all feeding schedules and sends SMS notifications.

**Response:**
```json
{
  "success": true,
  "currentTime": "14:30",
  "notificationsSent": 2,
  "details": [
    {
      "recordId": 1,
      "userId": 1,
      "phoneNumber": "+639****7890",
      "time": "14:30",
      "message": "SmartFishCare Reminder: Time to feed..."
    }
  ],
  "errors": []
}
```

## SMS Message Format

Example SMS message:
```
SmartFishCare Reminder: Time to feed your Medium fish! Food: Pelits. Quantity: 1-cup. Notes: Feed slowly. Scheduled time: 14:30.
```

## Testing

### Manual Testing

1. Go to Feeding Schedule page
2. Click "Test SMS Schedule" button
3. This will check current time and send notifications if any schedules match

### Testing with Specific Time

1. Create a feeding schedule with current time (e.g., if it's 14:30, set schedule to 14:30)
2. Click "Test SMS Schedule" button
3. SMS should be sent immediately

## Duplicate Prevention

The system prevents duplicate notifications by:
- Tracking which notifications were sent today per user
- Using a key: `{recordId}-{time}` (e.g., "1-14:30")
- Resetting daily tracking at midnight

## Troubleshooting

### SMS Not Sending

1. **Check Phone Number**: Ensure user has phone number in profile or `DEFAULT_PHONE_NUMBER` is set
2. **Check API Key**: Verify `SEMAPHORE_API_KEY` is configured
3. **Check Time Format**: Feeding time should be in HH:MM format (e.g., "14:30")
4. **Check Cron Job**: Verify cron job is running (check Vercel logs)

### Notifications Sent Multiple Times

- System should prevent duplicates, but if issues occur:
  - Check server logs for duplicate detection
  - Verify cron job isn't running multiple times
  - Check if server restarted (resets in-memory tracking)

### Cron Job Not Running

**Vercel Free Tier**: Cron jobs require Pro plan. Alternatives:
- Use external cron service to ping `/api/feeding/check-schedule` every minute
- Use the "Test SMS Schedule" button manually
- Set up a separate server with cron job

**External Cron Service Setup**:
1. Sign up for a free cron service (e.g., cron-job.org)
2. Set URL: `https://your-domain.com/api/feeding/check-schedule`
3. Set schedule: Every minute (`* * * * *`)
4. Save and activate

## Code Structure

- **API Route**: `src/app/api/feeding/check-schedule/route.ts`
- **Frontend**: `src/app/dashboard/feeding/page.tsx`
- **Cron Config**: `vercel.json`
- **SMS Service**: Uses existing `/api/sms/send` endpoint

## Future Enhancements

- [ ] Add notification preferences (enable/disable SMS)
- [ ] Add email notifications as alternative
- [ ] Add push notifications
- [ ] Add notification history/logs
- [ ] Add timezone support
- [ ] Add recurring schedule options (daily, weekly, etc.)

