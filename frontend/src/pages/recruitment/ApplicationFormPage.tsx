import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Printer, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function ApplicationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock candidate data
  const candidate = {
    id: parseInt(id || '1'),
    name: 'Ahmed Ali',
    email: 'ahmed@example.com',
    phone: '+92-300-1234567',
    position: 'Senior Software Engineer'
  };

  const [formData, setFormData] = useState({
    // Personal Information
    fullName: candidate.name,
    fatherName: '',
    cnic: '',
    dateOfBirth: '',
    gender: '',
    maritalStatus: '',
    nationality: 'Pakistani',
    religion: '',
    
    // Contact Information
    email: candidate.email,
    phone: candidate.phone,
    alternatePhone: '',
    currentAddress: '',
    permanentAddress: '',
    
    // Education
    highestQualification: '',
    university: '',
    graduationYear: '',
    cgpa: '',
    
    // Experience
    totalExperience: '',
    currentCompany: '',
    currentDesignation: '',
    currentSalary: '',
    expectedSalary: '',
    noticePeriod: '',
    
    // Position Details
    appliedPosition: candidate.position,
    grade: '',
    department: '',
    
    // References
    reference1Name: '',
    reference1Contact: '',
    reference1Relation: '',
    reference2Name: '',
    reference2Contact: '',
    reference2Relation: '',
    
    // Additional
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // API call will be added here
      toast.success('Application form saved successfully!');
    } catch (error) {
      toast.error('Failed to save application form');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="no-print mb-4 flex justify-between items-center">
        <Button
          variant="ghost"
          onClick={() => navigate(`/recruitment/candidates/${id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidate
        </Button>
        <Button onClick={handlePrint} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print Form
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center border-b">
          <CardTitle className="text-2xl">Job Application Form</CardTitle>
          <p className="text-sm text-muted-foreground">Please fill in all required fields</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatherName">Father's Name *</Label>
                  <Input
                    id="fatherName"
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnic">CNIC *</Label>
                  <Input
                    id="cnic"
                    placeholder="12345-1234567-1"
                    value={formData.cnic}
                    onChange={(e) => setFormData({ ...formData, cnic: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maritalStatus">Marital Status *</Label>
                  <Select
                    value={formData.maritalStatus}
                    onValueChange={(value) => setFormData({ ...formData, maritalStatus: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Single</SelectItem>
                      <SelectItem value="married">Married</SelectItem>
                      <SelectItem value="divorced">Divorced</SelectItem>
                      <SelectItem value="widowed">Widowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality *</Label>
                  <Input
                    id="nationality"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="religion">Religion</Label>
                  <Input
                    id="religion"
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternatePhone">Alternate Phone</Label>
                  <Input
                    id="alternatePhone"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentAddress">Current Address *</Label>
                <Textarea
                  id="currentAddress"
                  value={formData.currentAddress}
                  onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })}
                  rows={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="permanentAddress">Permanent Address *</Label>
                <Textarea
                  id="permanentAddress"
                  value={formData.permanentAddress}
                  onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })}
                  rows={2}
                  required
                />
              </div>
            </div>

            {/* Education */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Education</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="highestQualification">Highest Qualification *</Label>
                  <Input
                    id="highestQualification"
                    value={formData.highestQualification}
                    onChange={(e) => setFormData({ ...formData, highestQualification: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="university">University/Institute *</Label>
                  <Input
                    id="university"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="graduationYear">Graduation Year *</Label>
                  <Input
                    id="graduationYear"
                    type="number"
                    value={formData.graduationYear}
                    onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cgpa">CGPA/Percentage *</Label>
                  <Input
                    id="cgpa"
                    value={formData.cgpa}
                    onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Experience & Position */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Experience & Position Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appliedPosition">Applied Position *</Label>
                  <Input
                    id="appliedPosition"
                    value={formData.appliedPosition}
                    onChange={(e) => setFormData({ ...formData, appliedPosition: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="grade">Grade/Level *</Label>
                  <Select
                    value={formData.grade}
                    onValueChange={(value) => setFormData({ ...formData, grade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior (GD 1-3)</SelectItem>
                      <SelectItem value="mid">Mid-Level (GD 4-6)</SelectItem>
                      <SelectItem value="senior">Senior (GD 7-9)</SelectItem>
                      <SelectItem value="lead">Lead (GD 10-12)</SelectItem>
                      <SelectItem value="manager">Manager (GD 13+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalExperience">Total Experience *</Label>
                  <Input
                    id="totalExperience"
                    placeholder="e.g., 5 years"
                    value={formData.totalExperience}
                    onChange={(e) => setFormData({ ...formData, totalExperience: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentCompany">Current Company</Label>
                  <Input
                    id="currentCompany"
                    value={formData.currentCompany}
                    onChange={(e) => setFormData({ ...formData, currentCompany: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentSalary">Current Salary</Label>
                  <Input
                    id="currentSalary"
                    placeholder="PKR"
                    value={formData.currentSalary}
                    onChange={(e) => setFormData({ ...formData, currentSalary: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedSalary">Expected Salary *</Label>
                  <Input
                    id="expectedSalary"
                    placeholder="PKR"
                    value={formData.expectedSalary}
                    onChange={(e) => setFormData({ ...formData, expectedSalary: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="noticePeriod">Notice Period *</Label>
                  <Input
                    id="noticePeriod"
                    placeholder="e.g., 1 month"
                    value={formData.noticePeriod}
                    onChange={(e) => setFormData({ ...formData, noticePeriod: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* References */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">References</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference1Name">Reference 1 Name *</Label>
                  <Input
                    id="reference1Name"
                    value={formData.reference1Name}
                    onChange={(e) => setFormData({ ...formData, reference1Name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference1Contact">Contact *</Label>
                  <Input
                    id="reference1Contact"
                    value={formData.reference1Contact}
                    onChange={(e) => setFormData({ ...formData, reference1Contact: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference1Relation">Relation *</Label>
                  <Input
                    id="reference1Relation"
                    value={formData.reference1Relation}
                    onChange={(e) => setFormData({ ...formData, reference1Relation: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reference2Name">Reference 2 Name</Label>
                  <Input
                    id="reference2Name"
                    value={formData.reference2Name}
                    onChange={(e) => setFormData({ ...formData, reference2Name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference2Contact">Contact</Label>
                  <Input
                    id="reference2Contact"
                    value={formData.reference2Contact}
                    onChange={(e) => setFormData({ ...formData, reference2Contact: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference2Relation">Relation</Label>
                  <Input
                    id="reference2Relation"
                    value={formData.reference2Relation}
                    onChange={(e) => setFormData({ ...formData, reference2Relation: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Name *</Label>
                  <Input
                    id="emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Phone *</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactRelation">Relation *</Label>
                  <Input
                    id="emergencyContactRelation"
                    value={formData.emergencyContactRelation}
                    onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 no-print">
              <Button type="submit" className="flex-1">
                <Save className="mr-2 h-4 w-4" />
                Save Application Form
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/recruitment/candidates/${id}`)}
                className="flex-1"
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
