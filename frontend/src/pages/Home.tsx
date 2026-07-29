import { Page } from '@/components/page'

export default function Home() {
    return (
        <Page title="Dashboard" description="Welcome to Anxora OS">
            <div className="space-y-4">
                <h1 className="text-3xl font-bold">Welcome to Anxora OS</h1>
                <p className="text-muted-foreground">
                    Your unified enterprise workspace for CRM, HR, Finance, and more.
                </p>
            </div>
        </Page>
    )
}
