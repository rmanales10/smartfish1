import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SEMAPHORE_API_URL = 'https://api.semaphore.co/api/v4/messages';

export async function POST(request: NextRequest) {
    try {
        const userId = await verifyAuth(request);
        if (!userId) {
            return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        let { message, phoneNumber } = body;

        // If phone number not provided, try to get from user profile
        if (!phoneNumber) {
            try {
                // Get user from database to fetch phone number
                const userData = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { phoneNumber: true },
                });

                if (userData?.phoneNumber) {
                    phoneNumber = userData.phoneNumber;
                } else {
                    // Fallback to environment variable
                    phoneNumber = process.env.DEFAULT_PHONE_NUMBER;

                    if (!phoneNumber) {
                        return NextResponse.json(
                            { success: false, message: 'Phone number required. Please configure phone number in your profile settings or provide it in the request.' },
                            { status: 400 }
                        );
                    }
                }
            } catch (error) {
                console.error('Error fetching user phone number:', error);
                // Fallback to environment variable
                phoneNumber = process.env.DEFAULT_PHONE_NUMBER;

                if (!phoneNumber) {
                    return NextResponse.json(
                        { success: false, message: 'Phone number required. Please configure phone number in your profile settings.' },
                        { status: 400 }
                    );
                }
            }
        }

        if (!message) {
            return NextResponse.json(
                { success: false, message: 'Missing required field: message' },
                { status: 400 }
            );
        }

        // No character limit - send full message as provided

        // Get Semaphore API key and sender name from environment
        const apiKey = process.env.SEMAPHORE_API_KEY;
        const senderName = process.env.SEMAPHORE_SENDER_NAME || 'SmartFish';

        if (!apiKey) {
            console.error('SEMAPHORE_API_KEY not configured');
            return NextResponse.json(
                { success: false, message: 'SMS service not configured' },
                { status: 500 }
            );
        }

        // Send SMS via Semaphore API
        const formData = new URLSearchParams();
        formData.append('apikey', apiKey);
        formData.append('number', phoneNumber);
        formData.append('message', message);
        formData.append('sendername', senderName);

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
            return NextResponse.json(
                { success: false, message: 'Failed to send SMS: ' + (smsData.message || 'Unknown error') },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'SMS sent successfully',
            data: {
                message: message,
                phoneNumber: phoneNumber,
            },
        });
    } catch (error: any) {
        console.error('SMS send error:', error);
        return NextResponse.json(
            { success: false, message: 'Error sending SMS: ' + error.message },
            { status: 500 }
        );
    }
}
