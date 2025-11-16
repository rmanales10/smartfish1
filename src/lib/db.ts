import { PrismaClient } from '@prisma/client';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/nextjs-best-practices
//
// Note: DATABASE_URL should use the non-pooling connection (port 5432) for migrations.
// Prisma Client manages its own connection pool, so this works well for both migrations and runtime.

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Supabase PostgreSQL Database Configuration
// - DATABASE_URL: Non-pooling connection (port 5432) - used for migrations and Prisma Studio
// - POSTGRES_PRISMA_URL: Pooling connection (port 6543) - available for runtime if needed
// 
// Prisma Client uses DATABASE_URL by default. For better performance in production,
// you can configure it to use POSTGRES_PRISMA_URL with connection pooling.
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });

// Handle Prisma Client disconnection on process exit
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

// Helper function to get database connection (for compatibility)
export async function getDbConnection() {
    return prisma;
}
