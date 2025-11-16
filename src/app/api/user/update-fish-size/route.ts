import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUser();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { fishDetectionSize, fishSizeSettings } = body;

        // Validate fish detection size
        const validSizes = ['small', 'medium', 'large'];
        if (fishDetectionSize && !validSizes.includes(fishDetectionSize)) {
            return NextResponse.json(
                { success: false, error: 'Invalid fish detection size. Must be small, medium, or large.' },
                { status: 400 }
            );
        }

        // Validate fish size settings if provided (supports both old format and new range format)
        if (fishSizeSettings) {
            const requiredSizes = ['small', 'medium', 'large'];
            for (const size of requiredSizes) {
                if (!fishSizeSettings[size] || typeof fishSizeSettings[size] !== 'object') {
                    return NextResponse.json(
                        { success: false, error: `Missing or invalid settings for ${size} size.` },
                        { status: 400 }
                    );
                }

                const settings = fishSizeSettings[size];

                // Check if it's the new range format
                if (settings.minLength !== undefined && settings.maxLength !== undefined) {
                    // Range format validation
                    if (typeof settings.minLength !== 'number' || typeof settings.maxLength !== 'number' ||
                        typeof settings.minWidth !== 'number' || typeof settings.maxWidth !== 'number') {
                        return NextResponse.json(
                            { success: false, error: `Invalid range for ${size} size. All range values must be numbers.` },
                            { status: 400 }
                        );
                    }
                    if (settings.minLength <= 0 || settings.maxLength <= 0 || settings.minWidth <= 0 || settings.maxWidth <= 0) {
                        return NextResponse.json(
                            { success: false, error: `Range values for ${size} size must be greater than 0.` },
                            { status: 400 }
                        );
                    }
                    if (settings.minLength >= settings.maxLength) {
                        return NextResponse.json(
                            { success: false, error: `Invalid length range for ${size} size. Minimum must be less than maximum.` },
                            { status: 400 }
                        );
                    }
                    if (settings.minWidth >= settings.maxWidth) {
                        return NextResponse.json(
                            { success: false, error: `Invalid width range for ${size} size. Minimum must be less than maximum.` },
                            { status: 400 }
                        );
                    }
                    if (settings.maxLength > 100 || settings.maxWidth > 100) {
                        return NextResponse.json(
                            { success: false, error: `Range for ${size} size cannot exceed 100cm.` },
                            { status: 400 }
                        );
                    }
                } else if (settings.length !== undefined && settings.width !== undefined) {
                    // Old format validation (backward compatibility)
                    if (typeof settings.length !== 'number' || typeof settings.width !== 'number') {
                        return NextResponse.json(
                            { success: false, error: `Invalid dimensions for ${size} size. Length and width must be numbers.` },
                            { status: 400 }
                        );
                    }
                    if (settings.length <= 0 || settings.width <= 0) {
                        return NextResponse.json(
                            { success: false, error: `Dimensions for ${size} size must be greater than 0.` },
                            { status: 400 }
                        );
                    }
                    if (settings.length > 100 || settings.width > 100) {
                        return NextResponse.json(
                            { success: false, error: `Dimensions for ${size} size cannot exceed 100cm.` },
                            { status: 400 }
                        );
                    }
                } else {
                    return NextResponse.json(
                        { success: false, error: `Invalid format for ${size} size. Must provide either ranges (minLength, maxLength, minWidth, maxWidth) or dimensions (length, width).` },
                        { status: 400 }
                    );
                }
            }
        }

        // Update user
        const updateData: any = {};
        if (fishDetectionSize !== undefined) {
            updateData.fishDetectionSize = fishDetectionSize || null;
        }
        if (fishSizeSettings !== undefined) {
            updateData.fishSizeSettings = fishSizeSettings;
        }

        const updatedUser = await prisma.user.update({
            where: { id: user.userId },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                profileImage: true,
                phoneNumber: true,
                role: true,
                fishDetectionSize: true,
                fishSizeSettings: true,
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Fish detection size preference updated successfully',
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                email: updatedUser.email,
                profile_image: updatedUser.profileImage,
                phone_number: updatedUser.phoneNumber,
                role: updatedUser.role,
                fish_detection_size: updatedUser.fishDetectionSize,
                fish_size_settings: updatedUser.fishSizeSettings,
            },
        });
    } catch (error: any) {
        console.error('Update fish detection size error:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

