import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText } from 'lucide-react';

interface SubmittedFormViewProps {
    candidate: any;
}

export function SubmittedFormView({ candidate }: SubmittedFormViewProps) {
    if (candidate?.form_status !== 'submitted') {
        return (
            <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No submitted form yet</p>
                <p className="text-sm">Form will appear here after candidate submits it.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                    <FileText className="h-3 w-3" />
                    Form Submitted
                </Badge>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    ✓ Candidate has submitted their application form.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label className="text-sm font-semibold">Full Name</Label>
                    <p className="text-foreground">{candidate?.full_name || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Email</Label>
                    <p className="text-foreground">{candidate?.email || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Mobile No</Label>
                    <p className="text-foreground">{candidate?.mobile_no || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Father's Name</Label>
                    <p className="text-foreground">{candidate?.father_name || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Date of Birth</Label>
                    <p className="text-foreground">
                        {candidate?.date_of_birth
                            ? new Date(candidate.date_of_birth).toLocaleDateString()
                            : 'N/A'}
                    </p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Blood Group</Label>
                    <p className="text-foreground">{candidate?.blood_group || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">CNIC</Label>
                    <p className="text-foreground">{candidate?.cnic || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Marital Status</Label>
                    <p className="text-foreground">{candidate?.marital_status || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Current Address</Label>
                    <p className="text-foreground">{candidate?.current_address || 'N/A'}</p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Current Salary</Label>
                    <p className="text-foreground">
                        {candidate?.current_salary ? `PKR ${candidate.current_salary}` : 'N/A'}
                    </p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Expected Salary</Label>
                    <p className="text-foreground">
                        {candidate?.expected_salary ? `PKR ${candidate.expected_salary}` : 'N/A'}
                    </p>
                </div>
                <div>
                    <Label className="text-sm font-semibold">Joining Availability</Label>
                    <p className="text-foreground">{candidate?.joining_availability || 'N/A'}</p>
                </div>
            </div>

            {candidate?.academic_records && candidate.academic_records.length > 0 && (
                <div>
                    <Label className="text-sm font-semibold mb-3 block">Academic Records</Label>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left">Degree</th>
                                    <th className="px-3 py-2 text-left">Institution</th>
                                    <th className="px-3 py-2 text-left">From</th>
                                    <th className="px-3 py-2 text-left">To</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidate.academic_records.map((record: any, idx: number) => (
                                    <tr key={idx} className="border-b">
                                        <td className="px-3 py-2">{record.degree || 'N/A'}</td>
                                        <td className="px-3 py-2">{record.institution || 'N/A'}</td>
                                        <td className="px-3 py-2">{record.from || 'N/A'}</td>
                                        <td className="px-3 py-2">{record.to || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {candidate?.work_experience && candidate.work_experience.length > 0 && (
                <div>
                    <Label className="text-sm font-semibold mb-3 block">Work Experience</Label>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted">
                                <tr>
                                    <th className="px-3 py-2 text-left">Company</th>
                                    <th className="px-3 py-2 text-left">Position</th>
                                    <th className="px-3 py-2 text-left">From</th>
                                    <th className="px-3 py-2 text-left">To</th>
                                </tr>
                            </thead>
                            <tbody>
                                {candidate.work_experience.map((exp: any, idx: number) => (
                                    <tr key={idx} className="border-b">
                                        <td className="px-3 py-2">{exp.company || 'N/A'}</td>
                                        <td className="px-3 py-2">{exp.position || 'N/A'}</td>
                                        <td className="px-3 py-2">{exp.from || 'N/A'}</td>
                                        <td className="px-3 py-2">{exp.to || 'N/A'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
