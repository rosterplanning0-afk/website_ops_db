'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'

export default function StationInspectionPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">New Station Inspection</h2>
            </div>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-400">
                        <Building2 className="h-5 w-5" /> Station Inspection Form Skeleton
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50 text-slate-400">
                        <p className="text-lg font-medium">Coming Soon</p>
                        <p className="text-sm">The Station Control specific inspection form is being developed.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
