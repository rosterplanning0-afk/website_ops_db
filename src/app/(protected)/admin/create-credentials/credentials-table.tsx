'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Lock, Unlock, Eye, EyeOff } from 'lucide-react'
import { getAllCredentials } from './actions'

export function CredentialsTable() {
    const [password, setPassword] = useState('')
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')
    const [credentials, setCredentials] = useState<any[]>([])
    const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({})

    async function handleAuthenticate(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setErrorMsg('')

        try {
            const res = await getAllCredentials(password)
            if (res.error) {
                setErrorMsg(res.error)
            } else if (res.data) {
                setCredentials(res.data)
                setIsAuthenticated(true)
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const togglePasswordVisibility = (id: string) => {
        setShowPasswordMap(prev => ({
            ...prev,
            [id]: !prev[id]
        }))
    }

    if (!isAuthenticated) {
        return (
            <Card className="mt-8 border-dashed border-2">
                <CardHeader className="bg-slate-50/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Lock className="h-5 w-5 text-slate-500" />
                        View Created Credentials
                    </CardTitle>
                    <CardDescription>
                        Enter the master password to view the list of all created credentials.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleAuthenticate} className="max-w-sm space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="masterPassword">Master Password</Label>
                            <Input 
                                id="masterPassword" 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password to unlock" 
                                required 
                            />
                        </div>
                        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Unlock Table'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="mt-8">
            <CardHeader className="bg-slate-50/50 flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Unlock className="h-5 w-5 text-green-600" />
                        Created Credentials List
                    </CardTitle>
                    <CardDescription>
                        List of all personnel credentials in the system.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsAuthenticated(false)}>
                    Lock
                </Button>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-100">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">Employee ID</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Role</th>
                                <th className="px-4 py-3">Username (Email)</th>
                                <th className="px-4 py-3 rounded-tr-lg">Password</th>
                            </tr>
                        </thead>
                        <tbody>
                            {credentials.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                        No credentials found.
                                    </td>
                                </tr>
                            ) : (
                                credentials.map((cred) => (
                                    <tr key={cred.id} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{cred.employee_id}</td>
                                        <td className="px-4 py-3">{cred.full_name}</td>
                                        <td className="px-4 py-3 capitalize">{cred.role?.replace('_', ' ')}</td>
                                        <td className="px-4 py-3 text-slate-600">{cred.email}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono bg-slate-100 px-2 py-1 rounded text-xs">
                                                    {showPasswordMap[cred.id] ? 'DBrrts@123' : '••••••••••'}
                                                </span>
                                                <button 
                                                    onClick={() => togglePasswordVisibility(cred.id)}
                                                    className="text-slate-400 hover:text-slate-600"
                                                    title="Toggle password visibility"
                                                >
                                                    {showPasswordMap[cred.id] ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-500 mt-4 italic">
                    Note: For security reasons, only the default temporary password can be shown. If users have changed their passwords, it will not be reflected here.
                </p>
            </CardContent>
        </Card>
    )
}
