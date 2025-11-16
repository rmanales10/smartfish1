# Windows Server Setup for Feeding Schedule SMS

This guide explains how to set up the feeding schedule SMS notifications on a Windows server.

## Overview

The SMS feeding schedule feature uses **node-cron** to automatically check feeding times and send SMS notifications. This works on Windows servers without requiring Vercel cron jobs.

## How It Works

1. **Automatic Startup**: When the Next.js server starts, it automatically initializes the cron job
2. **Every Minute Check**: The cron job runs every minute to check if any feeding schedules match the current time
3. **SMS Notification**: When a match is found, SMS is sent to the user's phone number
4. **Duplicate Prevention**: Prevents sending the same notification multiple times per day

## Setup Instructions

### 1. Install Dependencies

The `node-cron` package is already installed. If you need to reinstall:

```bash
npm install node-cron
```

### 2. Environment Variables

Make sure these are configured in your `.env.local`:

```env
# Semaphore SMS API Configuration
SEMAPHORE_API_KEY=your_api_key_here
SEMAPHORE_SENDER_NAME=SmartFish
DEFAULT_PHONE_NUMBER=+1234567890
```

### 3. Start the Server

The cron job starts automatically when you start the Next.js server:

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

You should see this message in the console:
```
[Feeding Schedule] Cron job started - checking every minute
```

### 4. Verify It's Working

- Check the console logs for cron job startup message
- Create a feeding schedule with current time
- Wait 1 minute and check if SMS is sent
- Or use the "Test SMS Schedule" button on the feeding page

## Files Involved

- **`src/lib/feeding-cron.ts`**: Cron job logic and SMS sending
- **`src/instrumentation.ts`**: Initializes cron job on server startup
- **`next.config.ts`**: Enables instrumentation hook
- **`src/app/api/feeding/check-schedule/route.ts`**: API endpoint for manual testing

## Timezone Configuration

The cron job uses `Asia/Manila` timezone by default. To change it, edit `src/lib/feeding-cron.ts`:

```typescript
cron.schedule('* * * * *', async () => {
    await checkFeedingSchedule();
}, {
    scheduled: true,
    timezone: 'America/New_York' // Change to your timezone
});
```

Common timezones:
- `Asia/Manila` (Philippines)
- `America/New_York` (US Eastern)
- `America/Los_Angeles` (US Pacific)
- `Europe/London` (UK)
- `Asia/Tokyo` (Japan)

## Windows Task Scheduler Alternative

If you prefer using Windows Task Scheduler instead of node-cron:

### Option 1: Create a PowerShell Script

Create `scripts/check-feeding-schedule.ps1`:

```powershell
$response = Invoke-WebRequest -Uri "http://localhost:3000/api/feeding/check-schedule" -Method GET
Write-Host $response.Content
```

### Option 2: Create a Batch File

Create `scripts/check-feeding-schedule.bat`:

```batch
@echo off
curl http://localhost:3000/api/feeding/check-schedule
```

### Option 3: Schedule in Windows Task Scheduler

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name: "Feeding Schedule Check"
4. Trigger: **Daily** or **When the computer starts**
5. Action: **Start a program**
6. Program: `powershell.exe`
7. Arguments: `-File "C:\path\to\your\project\scripts\check-feeding-schedule.ps1"`
8. For every minute, use **Repeat task every: 1 minute**

**Note**: This approach requires your Next.js server to be running and accessible at `http://localhost:3000`.

## Troubleshooting

### Cron Job Not Starting

1. **Check Console Logs**: Look for `[Feeding Schedule] Cron job started` message
2. **Check Next.js Version**: Requires Next.js 13+ for instrumentation hook
3. **Check Environment**: Make sure `NEXT_RUNTIME=nodejs` (should be automatic)

### SMS Not Sending

1. **Check Phone Number**: Ensure user has phone number in profile or `DEFAULT_PHONE_NUMBER` is set
2. **Check API Key**: Verify `SEMAPHORE_API_KEY` is configured
3. **Check Time Match**: Feeding time must match current time exactly (HH:MM format)
4. **Check Console Logs**: Look for error messages

### Server Restart Issues

- The cron job restarts automatically when the server restarts
- Daily tracking resets at midnight
- If server restarts, duplicate prevention resets (this is expected)

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "smartfish" -- start

# Save PM2 configuration
pm2 save

# Setup PM2 to start on Windows boot
pm2 startup
```

### Using Windows Service

You can use `node-windows` to create a Windows service:

```bash
npm install -g node-windows
```

Then create a service script (see PM2 or node-windows documentation).

## Monitoring

### Check Cron Job Status

The cron job logs to console:
- `[Feeding Schedule] Cron job started` - When initialized
- `[Feeding Schedule] X SMS notification(s) sent at HH:MM` - When notifications sent
- `[Feeding Schedule] Daily tracking reset` - At midnight

### Manual Testing

Use the "Test SMS Schedule" button on the feeding schedule page, or call:

```bash
curl http://localhost:3000/api/feeding/check-schedule
```

## Differences from Vercel

| Feature | Vercel | Windows Server |
|---------|--------|----------------|
| Cron Jobs | Vercel cron (requires Pro) | node-cron (free) |
| Setup | vercel.json | Automatic on startup |
| Cost | Pro plan required | Free |
| Control | Vercel dashboard | Server logs |

## Support

If you encounter issues:
1. Check console logs for error messages
2. Verify environment variables are set
3. Test SMS sending manually using the test button
4. Check that the Next.js server is running

