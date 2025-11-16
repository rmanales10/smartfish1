'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProfileImageUrl } from '@/lib/upload';

interface User {
    id: number;
    username: string;
    email: string;
    profile_image: string;
    phone_number?: string | null;
    role?: string;
    fish_detection_size?: string | null;
    fish_size_settings?: FishSizeSettings | null;
}

type FishSize = 'small' | 'medium' | 'large';

interface FishSizeRange {
    minLength: number; // in cm
    maxLength: number; // in cm
    minWidth: number; // in cm
    maxWidth: number; // in cm
}

interface FishSizeSettings {
    small: FishSizeRange;
    medium: FishSizeRange;
    large: FishSizeRange;
}

interface FishSizeOption {
    value: FishSize;
    label: string;
    dimensions: string;
    length: number; // in cm
    width: number; // in cm
}

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [editing, setEditing] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [newPhoneNumber, setNewPhoneNumber] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [profileFile, setProfileFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState(false);
    const [savingSize, setSavingSize] = useState(false);
    const [editingSizes, setEditingSizes] = useState(false);
    const [fishSizeSettings, setFishSizeSettings] = useState<FishSizeSettings>({
        small: { minLength: 13, maxLength: 15, minWidth: 10, maxWidth: 12 },
        medium: { minLength: 16, maxLength: 20, minWidth: 13, maxWidth: 16 },
        large: { minLength: 21, maxLength: 100, minWidth: 17, maxWidth: 100 },
    });

    const getFishSizeOptions = (): FishSizeOption[] => {
        return [
            {
                value: 'small',
                label: 'Small',
                dimensions: `${fishSizeSettings.small.minLength}-${fishSizeSettings.small.maxLength}cm × ${fishSizeSettings.small.minWidth}-${fishSizeSettings.small.maxWidth}cm`,
                length: fishSizeSettings.small.maxLength,
                width: fishSizeSettings.small.maxWidth
            },
            {
                value: 'medium',
                label: 'Medium',
                dimensions: `${fishSizeSettings.medium.minLength}-${fishSizeSettings.medium.maxLength}cm × ${fishSizeSettings.medium.minWidth}-${fishSizeSettings.medium.maxWidth}cm`,
                length: fishSizeSettings.medium.maxLength,
                width: fishSizeSettings.medium.maxWidth
            },
            {
                value: 'large',
                label: 'Large',
                dimensions: `${fishSizeSettings.large.minLength}-${fishSizeSettings.large.maxLength}cm × ${fishSizeSettings.large.minWidth}-${fishSizeSettings.large.maxWidth}cm`,
                length: fishSizeSettings.large.maxLength,
                width: fishSizeSettings.large.maxWidth
            },
        ];
    };

    useEffect(() => {
        fetch('/api/user/me', {
            credentials: 'include',
        })
            .then((res) => {
                if (res.status === 401 || res.status === 403) {
                    router.push('/');
                    return null;
                }
                return res.json();
            })
            .then((data) => {
                if (data && data.success) {
                    setUser(data.user);
                    setUsername(data.user.username);
                    setEmail(data.user.email);
                    setPhoneNumber(data.user.phone_number || '');
                    setNewPhoneNumber(data.user.phone_number || '');
                    // fishDetectionSize is no longer used - classification is automatic based on ranges

                    // Load custom fish size settings if available
                    if (data.user.fish_size_settings) {
                        // Handle both old format (length/width) and new format (ranges)
                        const settings = data.user.fish_size_settings as any;
                        const convertedSettings: FishSizeSettings = {
                            small: settings.small?.minLength !== undefined
                                ? settings.small
                                : { minLength: settings.small?.length || 13, maxLength: settings.small?.length || 15, minWidth: settings.small?.width || 10, maxWidth: settings.small?.width || 12 },
                            medium: settings.medium?.minLength !== undefined
                                ? settings.medium
                                : { minLength: settings.medium?.length || 16, maxLength: settings.medium?.length || 20, minWidth: settings.medium?.width || 13, maxWidth: settings.medium?.width || 16 },
                            large: settings.large?.minLength !== undefined
                                ? settings.large
                                : { minLength: settings.large?.length || 21, maxLength: settings.large?.length || 100, minWidth: settings.large?.width || 17, maxWidth: settings.large?.width || 100 },
                        };
                        setFishSizeSettings(convertedSettings);
                    }
                } else {
                    router.push('/');
                }
            })
            .catch(() => {
                router.push('/');
            })
            .finally(() => setLoading(false));
    }, [router]);

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const maxSize = 10 * 1024 * 1024; // 10MB
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];

            if (!allowedTypes.includes(file.type)) {
                setError('Only JPG, PNG, and GIF images are allowed.');
                return;
            }

            if (file.size > maxSize) {
                setError('Image size should be less than or equal to 10MB.');
                return;
            }

            setProfileFile(file);
            setError('');
            const reader = new FileReader();
            reader.onload = (e) => {
                setProfileImage(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Helper function to format Philippine phone numbers with +63 prefix
    const formatPhoneNumber = (value: string): string => {
        // Remove all non-digit characters except +
        let cleaned = value.replace(/[^\d+]/g, '');

        // If it starts with +, keep it
        if (cleaned.startsWith('+')) {
            // If it's already +63, return as is
            if (cleaned.startsWith('+63')) {
                return cleaned;
            }
            // If it starts with + but not +63, return as is (might be other country)
            return cleaned;
        }

        // If it starts with 0, remove it and add +63
        if (cleaned.startsWith('0')) {
            return '+63' + cleaned.substring(1);
        }

        // If it starts with 63, add +
        if (cleaned.startsWith('63')) {
            return '+' + cleaned;
        }

        // If it starts with 9 (Philippine mobile number pattern), add +63
        if (cleaned.startsWith('9') && cleaned.length >= 10) {
            return '+63' + cleaned;
        }

        // If it's just digits and looks like a Philippine number (10 digits starting with 9)
        if (/^9\d{9}$/.test(cleaned)) {
            return '+63' + cleaned;
        }

        // Otherwise, if it doesn't start with +, add +63 prefix
        if (cleaned.length > 0 && !cleaned.startsWith('+')) {
            // If it's a valid Philippine mobile number format (10 digits starting with 9)
            if (/^9\d{9}$/.test(cleaned)) {
                return '+63' + cleaned;
            }
        }

        return cleaned;
    };

    const handleSendOtp = async () => {
        let phoneToVerify = newPhoneNumber.trim();

        if (!phoneToVerify) {
            setError('Please enter a phone number');
            return;
        }

        // Auto-format Philippine phone numbers with +63 prefix
        phoneToVerify = formatPhoneNumber(phoneToVerify);

        // Validate phone number format
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneToVerify)) {
            setError('Invalid phone number format. Use international format (e.g., +639123456789)');
            return;
        }

        // Update the state with formatted number
        setNewPhoneNumber(phoneToVerify);

        // Check if phone number is the same as existing (no need to verify if unchanged)
        if (phoneToVerify === phoneNumber && phoneNumber) {
            setSuccess('Phone number unchanged. No verification needed.');
            return;
        }

        setSendingOtp(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/user/phone/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ phoneNumber: phoneToVerify }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('OTP sent successfully to your phone number!');
                setOtpSent(true);
            } else {
                // Check if it's the SMS service configuration error
                if (data.error && data.error.includes('SMS service not configured')) {
                    setError('SMS service is not configured. Please contact the administrator to set up SEMAPHORE_API_KEY in Vercel environment variables.');
                } else {
                    setError(data.error || 'Failed to send OTP');
                }
            }
        } catch (err) {
            console.error('Send OTP error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            setError('Please enter a valid 6-digit OTP');
            return;
        }

        setVerifying(true);
        setError('');
        setSuccess('');

        try {
            const response = await fetch('/api/user/phone/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    phoneNumber: newPhoneNumber.trim(),
                    otp: otp.trim(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Phone number verified successfully!');
                setPhoneNumber(newPhoneNumber.trim());
                setNewPhoneNumber('');
                setOtp('');
                setOtpSent(false);

                if (data.user) {
                    setUser({
                        ...data.user,
                        role: data.user.role || user?.role || 'user',
                    });
                }
            } else {
                setError(data.error || 'Invalid OTP code');
            }
        } catch (err) {
            console.error('Verify OTP error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setVerifying(false);
        }
    };

    const handleSave = async () => {
        if (!username || !email) {
            setError('Username and email are required');
            return;
        }

        // Validate username is not email
        if (username === email || username.includes('@')) {
            setError('Username cannot be an email address. Please use a different username.');
            return;
        }

        // If phone number changed but not verified, show error
        if (newPhoneNumber && newPhoneNumber.trim() && !otpSent && newPhoneNumber.trim() !== phoneNumber) {
            setError('Please verify your new phone number first by clicking "Send OTP"');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess('');

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('email', email);
            // Only update phone number if it was verified
            if (phoneNumber) {
                formData.append('phoneNumber', phoneNumber);
            }
            if (profileFile) {
                formData.append('profile', profileFile);
            }

            const response = await fetch('/api/user/update', {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Profile updated successfully!');
                setEditing(false);
                setProfileFile(null);
                setProfileImage(null);
                setNewPhoneNumber('');
                setOtpSent(false);
                setOtp('');

                if (data.user) {
                    setUser({
                        ...data.user,
                        role: data.user.role || user?.role || 'user',
                    });
                    setUsername(data.user.username);
                    setEmail(data.user.email);
                    setPhoneNumber(data.user.phone_number || '');
                    setNewPhoneNumber(data.user.phone_number || '');
                }

                // Reload page after 1 second to refresh user data
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                setError(data.error || 'Failed to update profile');
            }
        } catch (err) {
            console.error('Profile update error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setError('');
        setSuccess('');
        if (user) {
            setUsername(user.username);
            setEmail(user.email);
            setPhoneNumber(user.phone_number || '');
            setNewPhoneNumber(user.phone_number || '');
            setOtpSent(false);
            setOtp('');
            setProfileImage(null);
            setProfileFile(null);
        }
    };

    const handleSaveFishSize = async () => {
        setSavingSize(true);
        setError('');
        setSuccess('');

        // Validate ranges
        for (const [size, range] of Object.entries(fishSizeSettings)) {
            const r = range as FishSizeRange;
            if (r.minLength <= 0 || r.maxLength <= 0 || r.minWidth <= 0 || r.maxWidth <= 0) {
                setError(`Invalid range for ${size}. All values must be greater than 0.`);
                setSavingSize(false);
                return;
            }
            if (r.minLength >= r.maxLength) {
                setError(`Invalid length range for ${size}. Minimum length must be less than maximum length.`);
                setSavingSize(false);
                return;
            }
            if (r.minWidth >= r.maxWidth) {
                setError(`Invalid width range for ${size}. Minimum width must be less than maximum width.`);
                setSavingSize(false);
                return;
            }
            if (r.maxLength > 100 || r.maxWidth > 100) {
                setError(`Range for ${size} is too large. Maximum is 100cm.`);
                setSavingSize(false);
                return;
            }
        }

        try {
            const response = await fetch('/api/user/update-fish-size', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    fishSizeSettings
                }),
            });

            const data = await response.json();

            if (data.success) {
                setSuccess('Fish detection size settings saved successfully!');
                setEditingSizes(false);
                if (data.user) {
                    setUser({
                        ...data.user,
                        role: data.user.role || user?.role || 'user',
                    });
                }
            } else {
                setError(data.error || 'Failed to save fish detection size settings');
            }
        } catch (err) {
            console.error('Save fish size error:', err);
            setError('An error occurred. Please try again.');
        } finally {
            setSavingSize(false);
        }
    };

    const handleSizeRangeChange = (size: FishSize, field: 'minLength' | 'maxLength' | 'minWidth' | 'maxWidth', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) && value !== '') return;

        setFishSizeSettings(prev => ({
            ...prev,
            [size]: {
                ...prev[size],
                [field]: value === '' ? 0 : numValue
            }
        }));
    };

    const handleLogout = async () => {
        if (confirm('Are you sure you want to logout?')) {
            setLoading(true);
            try {
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                });
                router.push('/');
            } catch (error) {
                console.error('Logout error:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const getProfileImageSrc = () => {
        if (profileImage) return profileImage;
        return getProfileImageUrl(user?.profile_image);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="text-center">
                    <i className="fas fa-spinner fa-spin text-3xl text-[#7c5cff] mb-3"></i>
                    <p className="text-[#e6e9ef]">Loading settings...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl sm:text-3xl font-bold text-[#e6e9ef] flex items-center gap-2">
                            {editing ? (
                                <>
                                    <i className="fas fa-edit text-[#7c5cff]"></i>
                                    <span>Editing Profile</span>
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-cog text-[#7c5cff]"></i>
                                    <span>Settings</span>
                                </>
                            )}
                        </h1>
                        {editing && (
                            <span className="px-2.5 py-1 bg-[#7c5cff]/20 border border-[#7c5cff]/40 rounded-md text-xs text-[#7c5cff] font-semibold">
                                Edit Mode
                            </span>
                        )}
                    </div>
                    {!editing && (
                        <button
                            onClick={() => setEditing(true)}
                            className="px-4 py-2 rounded-lg border border-[#7c5cff]/35 bg-[#7c5cff]/20 text-sm text-[#7c5cff] font-semibold transition-all hover:bg-[#7c5cff]/30 hover:border-[#7c5cff]/50 hover:scale-105 flex items-center gap-2"
                            title="Edit Profile"
                        >
                            <i className="fas fa-edit"></i>
                            <span>Edit</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Success Message */}
            {success && (
                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-300">
                    <i className="fas fa-check-circle mr-2"></i>
                    {success}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300">
                    <i className="fas fa-exclamation-circle mr-2"></i>
                    {error}
                </div>
            )}

            {/* Profile Section */}
            <div className={`mb-6 rounded-xl border transition-all duration-300 ${editing
                ? 'border-[#7c5cff]/40 bg-gradient-to-b from-[#7c5cff]/10 to-white/4 shadow-[0_0_20px_rgba(124,92,255,0.15)]'
                : 'border-white/12 bg-gradient-to-b from-white/6 to-white/2'
                } p-5 sm:p-6`}>
                <div className="flex items-center justify-between mb-6">
                    <label className="font-semibold text-lg text-[#e6e9ef] flex items-center gap-2">
                        <i className="fas fa-user-circle text-[#7c5cff]"></i>
                        <span>Profile</span>
                    </label>
                </div>

                <div className="flex flex-col sm:flex-row items-start gap-5 sm:gap-5">
                    <div className="relative flex-shrink-0 self-center sm:self-start">
                        <div className={`relative w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] rounded-full overflow-hidden border-2 transition-all duration-300 ${editing
                            ? 'border-[#7c5cff]/50 shadow-[0_0_15px_rgba(124,92,255,0.3)]'
                            : 'border-white/20'
                            }`}>
                            <Image
                                src={getProfileImageSrc()}
                                alt="Profile Picture"
                                width={120}
                                height={120}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.src = '/frontend/img/default profile.png';
                                }}
                            />
                            {editing && (
                                <label
                                    htmlFor="profileInput"
                                    className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer group"
                                    title="Change Profile Picture"
                                >
                                    <div className="bg-[#7c5cff] w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-lg group-hover:scale-110 transition-transform">
                                        <i className="fas fa-camera text-white text-sm"></i>
                                    </div>
                                </label>
                            )}
                        </div>
                        {editing && (
                            <label
                                htmlFor="profileInput"
                                className="absolute -bottom-2 -right-2 bg-[#7c5cff] w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 border-[#0b1020] hover:bg-[#6b4ce6] transition-all shadow-lg hover:scale-110 z-10"
                                title="Change Profile Picture"
                            >
                                <i className="fas fa-camera text-white text-xs"></i>
                            </label>
                        )}
                        <input
                            type="file"
                            id="profileInput"
                            accept="image/*"
                            onChange={handleProfileChange}
                            className="hidden"
                            disabled={!editing}
                        />
                    </div>

                    <div className="flex flex-1 flex-col gap-4 w-full min-w-0">
                        {editing ? (
                            <>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="flex items-center gap-2 text-xs font-semibold text-[#a2a8b6] uppercase tracking-wide">
                                            <i className="fas fa-user text-[#7c5cff] text-xs"></i>
                                            <span>Username</span>
                                        </label>
                                        {username === email && username.includes('@') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    // Generate username from email (part before @)
                                                    const suggestedUsername = email.split('@')[0];
                                                    setUsername(suggestedUsername);
                                                    setError('');
                                                }}
                                                className="text-[10px] text-[#7c5cff] bg-[#7c5cff]/10 px-2 py-1 rounded border border-[#7c5cff]/20 hover:bg-[#7c5cff]/20 transition-all flex items-center gap-1"
                                            >
                                                <i className="fas fa-magic"></i>
                                                <span>Generate from email</span>
                                            </button>
                                        )}
                                    </div>
                                    {username === email && username.includes('@') && (
                                        <div className="mb-2 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                            <p className="text-xs text-yellow-300 flex items-center gap-2 mb-1">
                                                <i className="fas fa-exclamation-triangle"></i>
                                                <span className="font-semibold">Username cannot be an email address</span>
                                            </p>
                                            <p className="text-[10px] text-yellow-400/80">
                                                Please use a unique username (e.g., your name or a nickname). Click "Generate from email" to use the part before @.
                                            </p>
                                        </div>
                                    )}
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setUsername(value);
                                                // Clear error if username changes from email
                                                if (value !== email && error.includes('email')) {
                                                    setError('');
                                                }
                                            }}
                                            className={`w-full px-4 py-3 bg-white/5 border rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:ring-2 transition-all placeholder:text-[#666] hover:border-white/20 ${username === email && username.includes('@')
                                                ? 'border-yellow-500/40 focus:border-yellow-500 focus:ring-yellow-500/20'
                                                : 'border-white/15 focus:border-[#7c5cff] focus:ring-[#7c5cff]/20'
                                                }`}
                                            placeholder={username === email ? "Enter a unique username" : "Enter username (not email)"}
                                        />
                                        {username === email && username.includes('@') && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <i className="fas fa-exclamation-circle text-yellow-400 text-sm"></i>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-[#a2a8b6] mb-2 uppercase tracking-wide">
                                        <i className="fas fa-envelope text-[#7c5cff] text-xs"></i>
                                        <span>Email</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-2 focus:ring-[#7c5cff]/20 transition-all placeholder:text-[#666] hover:border-white/20"
                                        placeholder="Enter email"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="flex items-center gap-2 text-xs font-semibold text-[#a2a8b6] mb-2 uppercase tracking-wide">
                                        <i className="fas fa-phone text-[#7c5cff] text-xs"></i>
                                        <span>Phone Number</span>
                                        <span className="text-[#888] text-[10px] font-normal normal-case">(for SMS notifications)</span>
                                    </label>
                                    {!otpSent ? (
                                        <>
                                            <div className="flex flex-col gap-2">
                                                {phoneNumber && phoneNumber !== '+1234567890' && (
                                                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                        <p className="text-xs text-blue-300">
                                                            <i className="fas fa-check-circle mr-1"></i>
                                                            Current verified number: <span className="font-semibold">{phoneNumber}</span>
                                                        </p>
                                                    </div>
                                                )}
                                                <div className="flex gap-2">
                                                    <input
                                                        type="tel"
                                                        value={newPhoneNumber}
                                                        onChange={(e) => {
                                                            let value = e.target.value;

                                                            // Auto-format Philippine phone numbers as user types
                                                            // Only auto-format if it doesn't already start with + (international format)
                                                            if (value && !value.startsWith('+')) {
                                                                // If user is typing a Philippine number (starts with 0 or 9)
                                                                if (value.startsWith('0') || (value.match(/^\d+$/) && value.length <= 11 && value.startsWith('9'))) {
                                                                    // Remove leading 0 if present
                                                                    if (value.startsWith('0')) {
                                                                        value = '+63' + value.substring(1);
                                                                    } else if (value.startsWith('9')) {
                                                                        value = '+63' + value;
                                                                    } else if (value.startsWith('63')) {
                                                                        value = '+' + value;
                                                                    }
                                                                }
                                                            }

                                                            setNewPhoneNumber(value);
                                                            // Real-time validation feedback
                                                            if (value && value.trim()) {
                                                                const phoneRegex = /^\+[1-9]\d{1,14}$/;
                                                                if (!phoneRegex.test(value.trim())) {
                                                                    // Show inline error only if user has typed more than a few characters
                                                                    if (value.length > 3) {
                                                                        setError('Invalid format. Use international format (e.g., +639123456789)');
                                                                    }
                                                                } else {
                                                                    setError('');
                                                                }
                                                            } else {
                                                                setError('');
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            // Auto-format when user leaves the field
                                                            const value = e.target.value.trim();
                                                            if (value) {
                                                                const formatted = formatPhoneNumber(value);
                                                                if (formatted !== value) {
                                                                    setNewPhoneNumber(formatted);
                                                                }
                                                            }
                                                        }}
                                                        className="flex-1 px-4 py-3 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-2 focus:ring-[#7c5cff]/20 transition-all placeholder:text-[#666] hover:border-white/20"
                                                        placeholder={phoneNumber && phoneNumber !== '+1234567890' ? phoneNumber : "+639123456789 (or type 09123456789)"}
                                                        disabled={sendingOtp}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleSendOtp}
                                                        disabled={sendingOtp || !newPhoneNumber.trim() || newPhoneNumber.trim() === phoneNumber}
                                                        className="px-4 py-3 bg-[#7c5cff] text-white rounded-lg text-sm font-semibold hover:bg-[#6b4ce6] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[120px] shadow-lg hover:shadow-[#7c5cff]/30 flex items-center justify-center gap-2"
                                                        title={newPhoneNumber.trim() === phoneNumber ? "Phone number unchanged" : "Send verification code"}
                                                    >
                                                        {sendingOtp ? (
                                                            <>
                                                                <i className="fas fa-spinner fa-spin"></i>
                                                                <span className="hidden sm:inline">Sending...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fas fa-paper-plane"></i>
                                                                <span>Send OTP</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-[#888] mt-1.5 flex items-center gap-1.5">
                                                    <i className="fas fa-info-circle text-[#7c5cff]"></i>
                                                    <span>Use international format (e.g., +639123456789) or type Philippine number (09123456789). +63 prefix will be added automatically.</span>
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="mb-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                                <p className="text-xs text-blue-300 mb-2">
                                                    <i className="fas fa-info-circle mr-1"></i>
                                                    OTP sent to {newPhoneNumber || phoneNumber}
                                                </p>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                        className="flex-1 px-3 py-2 bg-white/4 border border-white/12 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-1 focus:ring-[#7c5cff]/20 text-center tracking-widest font-mono"
                                                        placeholder="000000"
                                                        maxLength={6}
                                                        disabled={verifying}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleVerifyOtp}
                                                        disabled={verifying || otp.length !== 6}
                                                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                    >
                                                        {verifying ? (
                                                            <i className="fas fa-spinner fa-spin"></i>
                                                        ) : (
                                                            'Verify'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOtpSent(false);
                                                    setOtp('');
                                                    setError('');
                                                }}
                                                className="text-xs text-[#888] hover:text-[#e6e9ef] transition-colors"
                                            >
                                                <i className="fas fa-arrow-left mr-1"></i>Change phone number
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-3 mt-6 pt-5 border-t border-white/10">
                                    <button
                                        onClick={handleSave}
                                        disabled={uploading}
                                        className="flex-1 px-5 py-3 bg-[#7c5cff] text-white rounded-lg text-sm font-semibold hover:bg-[#6b4ce6] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#7c5cff]/30 flex items-center justify-center gap-2"
                                    >
                                        {uploading ? (
                                            <>
                                                <i className="fas fa-spinner fa-spin"></i>
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fas fa-save"></i>
                                                <span>Save Changes</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        disabled={uploading}
                                        className="px-5 py-3 bg-white/5 border border-white/15 text-[#e6e9ef] rounded-lg text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <i className="fas fa-times"></i>
                                        <span>Cancel</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-user text-[#7c5cff] w-5"></i>
                                        <div>
                                            <p className="text-xs text-[#888] mb-0.5">Username</p>
                                            <p className="text-sm font-medium text-[#e6e9ef]">{user.username}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-envelope text-[#7c5cff] w-5"></i>
                                        <div>
                                            <p className="text-xs text-[#888] mb-0.5">Email</p>
                                            <p className="text-sm font-medium text-[#e6e9ef]">{user.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <i className="fas fa-phone text-[#7c5cff] w-5"></i>
                                        <div>
                                            <p className="text-xs text-[#888] mb-0.5">Phone Number</p>
                                            <p className="text-sm font-medium text-[#e6e9ef]">
                                                {user.phone_number && user.phone_number !== '+1234567890' ? (
                                                    <span className="flex items-center gap-2">
                                                        <span>{user.phone_number}</span>
                                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">
                                                            <i className="fas fa-check-circle mr-1"></i>Verified
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[#888]">Not set</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Fish Detection Size Settings Section */}
            <div className={`mb-6 rounded-xl border transition-all duration-300 border-white/12 bg-gradient-to-b from-white/6 to-white/2 p-5 sm:p-6`}>
                <div className="flex items-center justify-between mb-6">
                    <label className="font-semibold text-lg text-[#e6e9ef] flex items-center gap-2">
                        <i className="fas fa-ruler-combined text-[#7c5cff]"></i>
                        <span>Fish Detection Size Settings</span>
                    </label>
                    {!editingSizes && (
                        <button
                            onClick={() => setEditingSizes(true)}
                            className="px-4 py-2 rounded-lg border border-[#7c5cff]/35 bg-[#7c5cff]/20 text-sm text-[#7c5cff] font-semibold transition-all hover:bg-[#7c5cff]/30 hover:border-[#7c5cff]/50 hover:scale-105 flex items-center gap-2"
                            title="Edit Size Dimensions"
                        >
                            <i className="fas fa-edit"></i>
                            <span>Edit Dimensions</span>
                        </button>
                    )}
                </div>

                <div className="space-y-4">
                    <p className="text-sm text-[#a2a8b6] mb-4">
                        Configure the size ranges (length × width in cm) for each category. Fish will be automatically classified as Small, Medium, or Large based on these ranges.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {getFishSizeOptions().map((option) => (
                            <div
                                key={option.value}
                                className="relative p-4 rounded-lg border-2 border-white/15 bg-white/5 transition-all duration-300"
                            >
                                <div className="text-center">
                                    <div className="mb-2">
                                        <i className="fas fa-fish text-2xl text-[#7c5cff]"></i>
                                    </div>
                                    <h3 className="font-semibold text-base mb-3 text-[#e6e9ef]">
                                        {option.label}
                                    </h3>

                                    {editingSizes ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs text-[#888] mb-1 block">Length Range (cm)</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max="100"
                                                        step="0.1"
                                                        value={fishSizeSettings[option.value].minLength || ''}
                                                        onChange={(e) => handleSizeRangeChange(option.value, 'minLength', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-1 focus:ring-[#7c5cff]/20"
                                                        placeholder="Min"
                                                    />
                                                    <span className="text-[#888] text-xs">to</span>
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max="100"
                                                        step="0.1"
                                                        value={fishSizeSettings[option.value].maxLength || ''}
                                                        onChange={(e) => handleSizeRangeChange(option.value, 'maxLength', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-1 focus:ring-[#7c5cff]/20"
                                                        placeholder="Max"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs text-[#888] mb-1 block">Width Range (cm)</label>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max="100"
                                                        step="0.1"
                                                        value={fishSizeSettings[option.value].minWidth || ''}
                                                        onChange={(e) => handleSizeRangeChange(option.value, 'minWidth', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-1 focus:ring-[#7c5cff]/20"
                                                        placeholder="Min"
                                                    />
                                                    <span className="text-[#888] text-xs">to</span>
                                                    <input
                                                        type="number"
                                                        min="0.1"
                                                        max="100"
                                                        step="0.1"
                                                        value={fishSizeSettings[option.value].maxWidth || ''}
                                                        onChange={(e) => handleSizeRangeChange(option.value, 'maxWidth', e.target.value)}
                                                        className="flex-1 px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-[#e6e9ef] focus:outline-none focus:border-[#7c5cff] focus:ring-1 focus:ring-[#7c5cff]/20"
                                                        placeholder="Max"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-medium text-[#e6e9ef]">
                                                {option.dimensions}
                                            </p>
                                            <p className="text-xs text-[#888] mt-1">
                                                Length: {fishSizeSettings[option.value].minLength}-{fishSizeSettings[option.value].maxLength}cm
                                            </p>
                                            <p className="text-xs text-[#888]">
                                                Width: {fishSizeSettings[option.value].minWidth}-{fishSizeSettings[option.value].maxWidth}cm
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {editingSizes && (
                        <div className="flex gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={handleSaveFishSize}
                                disabled={savingSize}
                                className="flex-1 px-5 py-3 bg-[#7c5cff] text-white rounded-lg text-sm font-semibold hover:bg-[#6b4ce6] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-[#7c5cff]/30 flex items-center justify-center gap-2"
                            >
                                {savingSize ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i>
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-save"></i>
                                        <span>Save Settings</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setEditingSizes(false);
                                    // Reset to saved values
                                    if (user?.fish_size_settings) {
                                        setFishSizeSettings(user.fish_size_settings as FishSizeSettings);
                                    }
                                }}
                                disabled={savingSize}
                                className="px-5 py-3 bg-white/5 border border-white/15 text-[#e6e9ef] rounded-lg text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <i className="fas fa-times"></i>
                                <span>Cancel</span>
                            </button>
                        </div>
                    )}

                </div>
            </div>

            {/* Logout Section */}
            <div className="flex flex-col gap-3 pb-6">
                <button
                    className="logout-btn flex items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-gradient-to-b from-red-500/10 to-red-500/5 px-5 py-4 text-sm font-semibold text-red-400 transition-all hover:-translate-y-0.5 hover:border-red-500/50 hover:bg-gradient-to-b hover:from-red-500/20 hover:to-red-500/10 hover:shadow-[0_8px_20px_rgba(239,68,68,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={handleLogout}
                    disabled={loading}
                >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>{loading ? 'Logging out...' : 'Logout'}</span>
                </button>
            </div>
        </div>
    );
}

