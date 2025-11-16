export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run on server-side, not during build
        const { startFeedingScheduleCron } = await import('./lib/feeding-cron');
        startFeedingScheduleCron();
    }
}

