import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PieChart, Download } from 'lucide-react'

export default function RoleSummaryReportPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Role / Section Instruction Summary</h2>
                <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" /> Export PDF</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" /> By Role</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-md text-slate-400">
                            Role-wise instruction chart placeholder
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>By Section</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[200px] flex items-center justify-center border-2 border-dashed rounded-md text-slate-400">
                            Section-wise instruction chart placeholder
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
