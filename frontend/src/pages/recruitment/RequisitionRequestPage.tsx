import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';
import { DEPARTMENTS } from '@/lib/constants';
import {
  validateRequisitionForm,
  RequisitionFormErrors,
  trimRequisitionFormData
} from '@/lib/validation/requisitionValidation';

export default function RequisitionRequestPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<RequisitionFormErrors>({});
  const [formData, setFormData] = useState({
    department: '',
    position: '',
    numberOfPositions: 1,
    jobDescription: '',
    requirements: '',
    urgency: 'medium',
    requestType: 'single',
    grade: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const errors = validateRequisitionForm(formData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      // Scroll to top to show error banner
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    try {
      setLoading(true);

      // Trim form data before submission
      const trimmedForm = trimRequisitionFormData(formData);

      await recruitmentApi.createRequisition(trimmedForm);
      toast.success('Requisition request submitted successfully!');
      navigate('/recruitment/requisitions');
    } catch (error: any) {
      console.error('Error creating requisition:', error);
      toast.error(error.message || 'Failed to submit requisition request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">New Requisition Request</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Request Type */}
            <div className="space-y-2">
              <Label htmlFor="requestType">
                Request Type <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.requestType}
                onValueChange={(value) => {
                  setFormData({ ...formData, requestType: value });
                  if (formErrors.requestType) {
                    setFormErrors({ ...formErrors, requestType: undefined });
                  }
                }}
              >
                <SelectTrigger className={formErrors.requestType ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Please select a request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single Position</SelectItem>
                  <SelectItem value="team">Team/Multiple Positions</SelectItem>
                  <SelectItem value="other">Other Requirement</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.requestType && (
                <p className="text-xs text-red-600 mt-1">{formErrors.requestType}</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => {
                  setFormData({ ...formData, department: value });
                  if (formErrors.department) {
                    setFormErrors({ ...formErrors, department: undefined });
                  }
                }}
              >
                <SelectTrigger className={formErrors.department ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Please select a department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.department && (
                <p className="text-xs text-red-600 mt-1">{formErrors.department}</p>
              )}
            </div>

            {/* Position/Role */}
            <div className="space-y-2">
              <Label htmlFor="position">
                Position / Role <span className="text-red-600">*</span>
              </Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => {
                  setFormData({ ...formData, position: e.target.value });
                  if (formErrors.position) {
                    setFormErrors({ ...formErrors, position: undefined });
                  }
                }}
                placeholder="e.g., Senior Software Engineer (please fill this field)"
                className={formErrors.position ? 'border-red-500' : ''}
                required
              />
              {formErrors.position && (
                <p className="text-xs text-red-600 mt-1">{formErrors.position}</p>
              )}
            </div>

            {/* Number of Positions */}
            <div className="space-y-2">
              <Label htmlFor="numberOfPositions">
                Number of Positions <span className="text-red-600">*</span>
              </Label>
              <Input
                id="numberOfPositions"
                type="number"
                min="1"
                max="100"
                value={formData.numberOfPositions}
                onChange={(e) => {
                  setFormData({ ...formData, numberOfPositions: parseInt(e.target.value) });
                  if (formErrors.numberOfPositions) {
                    setFormErrors({ ...formErrors, numberOfPositions: undefined });
                  }
                }}
                className={formErrors.numberOfPositions ? 'border-red-500' : ''}
                required
              />
              {formErrors.numberOfPositions && (
                <p className="text-xs text-red-600 mt-1">{formErrors.numberOfPositions}</p>
              )}
            </div>

            {/* Job Description */}
            <div className="space-y-2">
              <Label htmlFor="jobDescription">
                Job Description (JD) <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="jobDescription"
                value={formData.jobDescription}
                onChange={(e) => {
                  setFormData({ ...formData, jobDescription: e.target.value });
                  if (formErrors.jobDescription) {
                    setFormErrors({ ...formErrors, jobDescription: undefined });
                  }
                }}
                placeholder="Please fill this field - Enter detailed job description, requirements, and qualifications... (minimum 20 characters)"
                rows={8}
                className={formErrors.jobDescription ? 'border-red-500' : ''}
                required
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Minimum 20 characters</span>
                <span className={`${formData.jobDescription.length > 5000 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {formData.jobDescription.length}/5000
                </span>
              </div>
              {formErrors.jobDescription && (
                <p className="text-xs text-red-600 mt-1">{formErrors.jobDescription}</p>
              )}
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="requirements">
                Requirements & Qualifications <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => {
                  setFormData({ ...formData, requirements: e.target.value });
                  if (formErrors.requirements) {
                    setFormErrors({ ...formErrors, requirements: undefined });
                  }
                }}
                placeholder="Please fill this field - Enter specific requirements, qualifications, and skills needed... (minimum 10 characters)"
                rows={4}
                className={formErrors.requirements ? 'border-red-500' : ''}
                required
              />
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Minimum 10 characters</span>
                <span className={`${formData.requirements.length > 3000 ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {formData.requirements.length}/3000
                </span>
              </div>
              {formErrors.requirements && (
                <p className="text-xs text-red-600 mt-1">{formErrors.requirements}</p>
              )}
            </div>

            {/* Grade */}
            <div className="space-y-2">
              <Label htmlFor="grade">Grade/Level</Label>
              <Select
                value={formData.grade}
                onValueChange={(value) => {
                  setFormData({ ...formData, grade: value });
                  if (formErrors.grade) {
                    setFormErrors({ ...formErrors, grade: undefined });
                  }
                }}
              >
                <SelectTrigger className={formErrors.grade ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select grade (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GD1-3">Junior (GD 1-3)</SelectItem>
                  <SelectItem value="GD4-6">Mid-Level (GD 4-6)</SelectItem>
                  <SelectItem value="GD7-9">Senior (GD 7-9)</SelectItem>
                  <SelectItem value="GD10-12">Lead (GD 10-12)</SelectItem>
                  <SelectItem value="GD13+">Manager (GD 13+)</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.grade && (
                <p className="text-xs text-red-600 mt-1">{formErrors.grade}</p>
              )}
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <Label htmlFor="urgency">
                Urgency <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => {
                  setFormData({ ...formData, urgency: value });
                  if (formErrors.urgency) {
                    setFormErrors({ ...formErrors, urgency: undefined });
                  }
                }}
              >
                <SelectTrigger className={formErrors.urgency ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Please select urgency level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {formErrors.urgency && (
                <p className="text-xs text-red-600 mt-1">{formErrors.urgency}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/recruitment/requisitions')}
                className="flex-1"
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
