'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ChangePasswordPage() {
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const passwordStrength = (pwd: string) => {
        let score = 0
        if (pwd.length >= 8) score++
        if (/[A-Z]/.test(pwd)) score++
        if (/[0-9]/.test(pwd)) score++
        if (/[^A-Za-z0-9]/.test(pwd)) score++
        return score
    }

    const strength = passwordStrength(newPassword)
    const strengthLabel = ['Weak', 'Fair', 'Good', 'Strong'][Math.min(strength - 1, 3)] || ''
    const strengthColor = ['bg-red-500', 'bg-amber-500', 'bg-blue-500', 'bg-green-500'][Math.min(strength - 1, 3)] || 'bg-slate-200'

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setSuccess(false)

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.')
            return
        }
        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters.')
            return
        }
        if (newPassword === currentPassword) {
            setError('New password must be different from the current password.')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const json = await res.json()
            if (res.ok) {
                setSuccess(true)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                setError(json.error || 'Failed to change password.')
            }
        } catch {
            setError('Network error. Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Change Password</h2>

            <Card className="max-w-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-red-600" /> Update Your Credentials
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="flex flex-col items-center py-8 gap-4">
                            <CheckCircle className="h-16 w-16 text-green-500" />
                            <p className="text-lg font-semibold text-green-700">Password updated successfully!</p>
                            <Button variant="outline" onClick={() => setSuccess(false)}>Change Again</Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Current Password */}
                            <div className="space-y-2">
                                <Label htmlFor="current-pwd">Current Password</Label>
                                <div className="relative">
                                    <Input
                                        id="current-pwd"
                                        type={showCurrent ? 'text' : 'password'}
                                        placeholder="Enter current password"
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                    />
                                    <button type="button" onClick={() => setShowCurrent(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* New Password */}
                            <div className="space-y-2">
                                <Label htmlFor="new-pwd">New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="new-pwd"
                                        type={showNew ? 'text' : 'password'}
                                        placeholder="Enter new password (min 8 chars)"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        required
                                    />
                                    <button type="button" onClick={() => setShowNew(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {/* Strength indicator */}
                                {newPassword && (
                                    <div className="space-y-1">
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-slate-200'}`} />
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-500">Strength: <span className="font-semibold">{strengthLabel}</span></p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password */}
                            <div className="space-y-2">
                                <Label htmlFor="confirm-pwd">Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm-pwd"
                                        type={showConfirm ? 'text' : 'password'}
                                        placeholder="Re-enter new password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        className={confirmPassword && confirmPassword !== newPassword ? 'border-red-400' : ''}
                                    />
                                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                {confirmPassword && confirmPassword !== newPassword && (
                                    <p className="text-xs text-red-500">Passwords do not match</p>
                                )}
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">{error}</div>
                            )}

                            <Button
                                type="submit"
                                disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                className="w-full bg-red-600 hover:bg-red-700"
                            >
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                {saving ? 'Updating...' : 'Update Password'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>

            {/* Password requirements */}
            <Card className="max-w-lg">
                <CardContent className="pt-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">Password Requirements:</p>
                    <ul className="text-xs text-slate-500 space-y-1">
                        <li className={`flex items-center gap-2 ${newPassword.length >= 8 ? 'text-green-600' : ''}`}>
                            <span className={`w-2 h-2 rounded-full ${newPassword.length >= 8 ? 'bg-green-500' : 'bg-slate-300'}`} />
                            Minimum 8 characters
                        </li>
                        <li className={`flex items-center gap-2 ${/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}`}>
                            <span className={`w-2 h-2 rounded-full ${/[A-Z]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-300'}`} />
                            At least one uppercase letter
                        </li>
                        <li className={`flex items-center gap-2 ${/[0-9]/.test(newPassword) ? 'text-green-600' : ''}`}>
                            <span className={`w-2 h-2 rounded-full ${/[0-9]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-300'}`} />
                            At least one number
                        </li>
                        <li className={`flex items-center gap-2 ${/[^A-Za-z0-9]/.test(newPassword) ? 'text-green-600' : ''}`}>
                            <span className={`w-2 h-2 rounded-full ${/[^A-Za-z0-9]/.test(newPassword) ? 'bg-green-500' : 'bg-slate-300'}`} />
                            At least one special character
                        </li>
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}
