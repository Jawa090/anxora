import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export default function FormSubmittedSuccess() {
  return (
    <div className="min-h-screen dark:bg-gray-900 flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full shadow-lg">
        <CardContent className="pt-12 pb-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
          </div>
          
          <h1 className="text-3xl dark:text-white font-bold text-gray-900 mb-4">
            Application Submitted Successfully!
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-white mb-6">
            Thank you for completing the application form.
          </p>
          
          <div className="bg-blue-50 dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-6">
            <p className="text-blue-800 dark:text-blue-200 font-medium mb-2">
              What happens next?
            </p>
            <ul className="text-left text-blue-700 space-y-2">
              <li>✓ Your application has been saved in our system</li>
              <li>✓ Our HR team will review your information</li>
              <li>✓ You will be contacted for the next steps</li>
            </ul>
          </div>
          
          <p className="text-sm text-gray-500">
            You can now close this window.
          </p>
          
          <div className="mt-8 pt-6 border-t">
            <p className="text-xs text-gray-400">
              © {new Date().getFullYear()} Fusion Cortex - Rush Group of Companies
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
