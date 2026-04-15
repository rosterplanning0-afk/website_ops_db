'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Radio } from 'lucide-react'

export default function OCCInspectionPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">New OCC Inspection</h2>
            </div>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-slate-400">
                        <Radio className="h-5 w-5" /> OCC Inspection Form Skeleton
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-slate-50 text-slate-400">
                        <p className="text-lg font-medium">Coming Soon</p>
                        <p className="text-sm">The OCC specific inspection form is being developed.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
