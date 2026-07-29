import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { TopBar } from '@/components/topbar'

export default function DashboardLayout() {
    return (
        <div className="flex h-screen bg-background">
            <AppSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
