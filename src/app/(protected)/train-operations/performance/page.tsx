import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function TOPerformancePage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">TO Performance</h2>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Performance Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Performance metrics, trends, and analysis charts will be displayed here.</p>
                </CardContent>
            </Card>
        </div>
    )
}
