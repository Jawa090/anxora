import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { validateApplicationForm, ValidationError, trimString, isEmpty } from '@/utils/formValidation';
import { FormFieldError } from '@/components/FormFieldError';

export default function PublicApplicationForm() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    fullName: '',
    fatherName: '',
    fatherOccupation: '',
    address: '',
    mobileNo: '',
    bloodGroup: '',
    religion: '',
    dateOfBirth: '',
    cnic: '',
    email: '',
    maritalStatus: '',
    numberOfChildren: '',
    residenceType: 'own',
    academicRecords: [
      { diploma: '', institution: '', from: '', to: '', division: '', majorSubjects: '' }
    ],
    workExperience: [
      { designation: '', companyName: '', from: '', to: '', salary: '', reasonForLeaving: '' }
    ],
    currentSalary: '',
    expectedSalary: '',
    joiningAvailability: '',
    declarationAccepted: false
  });

  /**
   * Get error message for a specific field
   */
  const getFieldError = (fieldName: string): string | undefined => {
    return validationErrors.find(e => e.field === fieldName)?.message;
  };

  /**
   * Handle field value change
   */
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    setTouched(prev => new Set(prev).add(fieldName));
  };

  /**
   * Mark field as touched on blur
   */
  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => new Set(prev).add(fieldName));
  };

  /**
   * Validate entire form
   */
  const validateFormData = (): boolean => {
    const formWithDeclaration = { ...formData, declarationAccepted };
    const result = validateApplicationForm(formWithDeclaration);
    setValidationErrors(result.errors);

    if (!result.isValid) {
      toast.error('Please fix all errors before submitting');
      // Scroll to first error
      setTimeout(() => {
        document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }

    return result.isValid;
  };

  useEffect(() => {
    fetchCandidateData();
  }, [token]);

  const fetchCandidateData = async () => {
    try {
      setLoading(true);
      console.log('=== Fetching candidate data ===');
      console.log('Token:', token);
      console.log('URL:', `/api/recruitment/candidates/public/form/${token}`);

      const response = await fetch(`/api/recruitment/candidates/public/form/${token}`);

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', response.headers);

      // Get response text first
      const responseText = await response.text();
      console.log('Response text:', responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('Failed to parse error response:', e);
          throw new Error('Server returned invalid response');
        }
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Invalid or expired form link');
      }

      // Parse JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse success response:', e);
        throw new Error('Server returned invalid response');
      }

      console.log('Candidate data received:', data);
      setCandidate(data);

      // Pre-fill form with existing data
      setFormData(prev => ({
        ...prev,
        fullName: data.fullName || '',
        email: data.email || '',
        mobileNo: data.phone || '',
        fatherName: data.fatherName || '',
        fatherOccupation: data.fatherOccupation || '',
        address: data.address || '',
        bloodGroup: data.bloodGroup || '',
        religion: data.religion || '',
        dateOfBirth: data.dateOfBirth || '',
        cnic: data.cnic || '',
        maritalStatus: data.maritalStatus || '',
        numberOfChildren: data.numberOfChildren || '',
        residenceType: data.residenceType || 'own',
        currentSalary: data.currentSalary || '',
        expectedSalary: data.expectedSalary || ''
      }));
    } catch (error: any) {
      console.error('Error fetching form:', error);
      toast.error(error.message || 'Failed to load form');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateFormData()) {
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(`/api/recruitment/candidates/public/form/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit form');
      }

      toast.success('Application form submitted successfully!');

      // Redirect to success page
      window.location.href = '/form-submitted';
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.error(error.message || 'Failed to submit form');
    } finally {
      setSubmitting(false);
    }
  };

  const addAcademicRecord = () => {
    setFormData(prev => ({
      ...prev,
      academicRecords: [
        ...prev.academicRecords,
        { diploma: '', institution: '', from: '', to: '', division: '', majorSubjects: '' }
      ]
    }));
  };

  const addWorkExperience = () => {
    setFormData(prev => ({
      ...prev,
      workExperience: [
        ...prev.workExperience,
        { designation: '', companyName: '', from: '', to: '', salary: '', reasonForLeaving: '' }
      ]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold text-destructive">Invalid or Expired Form Link</p>
            <p className="text-sm text-muted-foreground mt-2">
              Please contact HR department for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="max-w-4xl mx-auto px-4">
        <form onSubmit={handleSubmit}>
          <Card className="shadow-xl">
            <CardContent className="p-8">
              {/* Header */}
              <div className="text-center mb-8 border-b-4 border-primary pb-6">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-2xl">FC</span>
                  </div>
                </div>
                <h1 className="text-3xl font-bold text-primary mb-2">
                  FUSION CORTEX - Rush Group of Companies
                </h1>
                <h2 className="text-xl font-semibold text-foreground">EMPLOYMENT APPLICATION FORM</h2>
                <p className="text-sm text-muted-foreground mt-2">HR Department</p>
              </div>

              {/* Position Applied For */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Position Applied For:</Label>
                  <Input value={candidate.position || 'N/A'} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Name: <span className="text-red-600">*</span></Label>
                  <Input
                    value={formData.fullName}
                    onChange={(e) => handleFieldChange('fullName', e.target.value)}
                    onBlur={() => handleFieldBlur('fullName')}
                    className={getFieldError('fullName') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                    data-error={getFieldError('fullName') ? 'true' : undefined}
                  />
                  {getFieldError('fullName') && <FormFieldError error={getFieldError('fullName')} />}
                </div>
              </div>

              {/* Father's Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Father's Name:</Label>
                  <Input
                    value={formData.fatherName}
                    onChange={(e) => handleFieldChange('fatherName', e.target.value)}
                    onBlur={() => handleFieldBlur('fatherName')}
                    className={getFieldError('Father\'s Name') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('Father\'s Name') && <FormFieldError error={getFieldError('Father\'s Name')} />}
                </div>
                <div>
                  <Label>Father's Occupation:</Label>
                  <Input
                    value={formData.fatherOccupation}
                    onChange={(e) => handleFieldChange('fatherOccupation', e.target.value)}
                    onBlur={() => handleFieldBlur('fatherOccupation')}
                    className={getFieldError('Father\'s Occupation') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('Father\'s Occupation') && <FormFieldError error={getFieldError('Father\'s Occupation')} />}
                </div>
              </div>

              {/* Address */}
              <div className="mb-6">
                <Label>Address:</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  onBlur={() => handleFieldBlur('address')}
                  className={getFieldError('Address') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                />
                {getFieldError('Address') && <FormFieldError error={getFieldError('Address')} />}
              </div>

              {/* Blood Group, Religion, DOB */}
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <Label>Blood Group:</Label>
                  <Input
                    value={formData.bloodGroup}
                    onChange={(e) => handleFieldChange('bloodGroup', e.target.value)}
                    onBlur={() => handleFieldBlur('bloodGroup')}
                    placeholder="e.g., A+"
                    className={getFieldError('bloodGroup') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('bloodGroup') && <FormFieldError error={getFieldError('bloodGroup')} />}
                </div>
                <div>
                  <Label>Religion:</Label>
                  <Input
                    value={formData.religion}
                    onChange={(e) => handleFieldChange('religion', e.target.value)}
                    onBlur={() => handleFieldBlur('religion')}
                    className={getFieldError('Religion') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('Religion') && <FormFieldError error={getFieldError('Religion')} />}
                </div>
                <div>
                  <Label>Date of Birth:</Label>
                  <Input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleFieldChange('dateOfBirth', e.target.value)}
                    onBlur={() => handleFieldBlur('dateOfBirth')}
                    className={getFieldError('Date of Birth') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('Date of Birth') && <FormFieldError error={getFieldError('Date of Birth')} />}
                </div>
              </div>

              {/* CNIC */}
              <div className="mb-6">
                <Label>CNIC No:</Label>
                <Input
                  value={formData.cnic}
                  onChange={(e) => handleFieldChange('cnic', e.target.value)}
                  onBlur={() => handleFieldBlur('cnic')}
                  placeholder="xxxxx-xxxxxxx-x"
                  className={getFieldError('cnic') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                />
                {getFieldError('cnic') && <FormFieldError error={getFieldError('cnic')} />}
              </div>

              {/* Mobile No & Email */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Mobile No: <span className="text-red-600">*</span></Label>
                  <Input
                    value={formData.mobileNo}
                    onChange={(e) => handleFieldChange('mobileNo', e.target.value)}
                    onBlur={() => handleFieldBlur('mobileNo')}
                    className={getFieldError('mobileNo') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                    data-error={getFieldError('mobileNo') ? 'true' : undefined}
                  />
                  {getFieldError('mobileNo') && <FormFieldError error={getFieldError('mobileNo')} />}
                </div>
                <div>
                  <Label>E-mail Address: <span className="text-red-600">*</span></Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    onBlur={() => handleFieldBlur('email')}
                    className={getFieldError('email') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                    data-error={getFieldError('email') ? 'true' : undefined}
                  />
                  {getFieldError('email') && <FormFieldError error={getFieldError('email')} />}
                </div>
              </div>

              {/* Marital Status & Children */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Marital Status: <span className="text-red-600">*</span></Label>
                  <select
                    className={`w-full border rounded-md p-2 bg-background text-foreground ${getFieldError('maritalStatus') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : 'border-border'}`}
                    value={formData.maritalStatus}
                    onChange={(e) => handleFieldChange('maritalStatus', e.target.value)}
                    onBlur={() => handleFieldBlur('maritalStatus')}
                  >
                    <option value="">Select</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                  </select>
                  {getFieldError('maritalStatus') && <FormFieldError error={getFieldError('maritalStatus')} />}
                </div>
                <div>
                  <Label>No. of Children:</Label>
                  <Input
                    type="number"
                    value={formData.numberOfChildren}
                    onChange={(e) => handleFieldChange('numberOfChildren', e.target.value)}
                    onBlur={() => handleFieldBlur('numberOfChildren')}
                    className={getFieldError('Number of Children') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {getFieldError('Number of Children') && <FormFieldError error={getFieldError('Number of Children')} />}
                </div>
              </div>

              {/* Residence Type */}
              <div className="mb-6">
                <Label>Residence Type: <span className="text-red-600">*</span></Label>
                <div className={`flex gap-6 mt-2 p-3 rounded border ${getFieldError('residenceType') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : 'border-border'}`}>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="own"
                      checked={formData.residenceType === 'own'}
                      onChange={(e) => handleFieldChange('residenceType', e.target.value)}
                      onBlur={() => handleFieldBlur('residenceType')}
                    />
                    <span>Own</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="rented"
                      checked={formData.residenceType === 'rented'}
                      onChange={(e) => handleFieldChange('residenceType', e.target.value)}
                      onBlur={() => handleFieldBlur('residenceType')}
                    />
                    <span>Rented</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="residenceType"
                      value="parents"
                      checked={formData.residenceType === 'parents'}
                      onChange={(e) => handleFieldChange('residenceType', e.target.value)}
                      onBlur={() => handleFieldBlur('residenceType')}
                    />
                    <span>Parents</span>
                  </label>
                </div>
                {getFieldError('residenceType') && <FormFieldError error={getFieldError('residenceType')} />}
              </div>

              {/* Academic Records Table */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-lg font-semibold">Academic Record: <span className="text-red-600">*</span></Label>
                  <Button type="button" onClick={addAcademicRecord} size="sm" variant="outline">
                    + Add Row
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">(Please commence with the highest qualification)</p>
                {getFieldError('academicRecords') && <FormFieldError error={getFieldError('academicRecords')} />}

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="border border-border p-2 text-sm text-foreground">Sr</th>
                        <th className="border border-border p-2 text-sm text-foreground">Diploma/Degree/Projects</th>
                        <th className="border border-border p-2 text-sm text-foreground">Name of Institution</th>
                        <th className="border border-border p-2 text-sm text-foreground">From</th>
                        <th className="border border-border p-2 text-sm text-foreground">To</th>
                        <th className="border border-border p-2 text-sm text-foreground">Division</th>
                        <th className="border border-border p-2 text-sm text-foreground">Major Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.academicRecords.map((record, index) => {
                        const recordError = validationErrors.find(e => e.field.startsWith(`academicRecords[${index}]`));
                        return (
                          <tr key={index} className={recordError ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                            <td className="border border-border p-1 text-center text-foreground">{index + 1}</td>
                            <td className="border border-border p-1">
                              <Input
                                value={record.diploma}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].diploma = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                onBlur={() => handleFieldBlur(`academicRecords[${index}].diploma`)}
                                className={`border-0 ${getFieldError(`academicRecords[${index}].diploma`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`academicRecords[${index}].diploma`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`academicRecords[${index}].diploma`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                value={record.institution}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].institution = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                onBlur={() => handleFieldBlur(`academicRecords[${index}].institution`)}
                                className={`border-0 ${getFieldError(`academicRecords[${index}].institution`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`academicRecords[${index}].institution`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`academicRecords[${index}].institution`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                type="date"
                                value={record.from}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].from = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                onBlur={() => handleFieldBlur(`academicRecords[${index}].from`)}
                                className={`border-0 ${getFieldError(`academicRecords[${index}].from`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`academicRecords[${index}].from`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`academicRecords[${index}].from`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                type="date"
                                value={record.to}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].to = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                onBlur={() => handleFieldBlur(`academicRecords[${index}].to`)}
                                className={`border-0 ${getFieldError(`academicRecords[${index}].to`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`academicRecords[${index}].to`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`academicRecords[${index}].to`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                value={record.division}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].division = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                className="border-0"
                              />
                            </td>
                            <td className="border p-1">
                              <Input
                                value={record.majorSubjects}
                                onChange={(e) => {
                                  const newRecords = [...formData.academicRecords];
                                  newRecords[index].majorSubjects = e.target.value;
                                  setFormData({ ...formData, academicRecords: newRecords });
                                }}
                                className="border-0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Work Experience Table */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-lg font-semibold">Work Experience:</Label>
                  <Button type="button" onClick={addWorkExperience} size="sm" variant="outline">
                    + Add Row
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mb-3">(Please commence with current / last employment)</p>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-border">
                    <thead className="bg-muted">
                      <tr>
                        <th className="border border-border p-2 text-sm text-foreground">Sr</th>
                        <th className="border border-border p-2 text-sm text-foreground">Designation</th>
                        <th className="border border-border p-2 text-sm text-foreground">Company Name</th>
                        <th className="border border-border p-2 text-sm text-foreground">From</th>
                        <th className="border border-border p-2 text-sm text-foreground">To</th>
                        <th className="border border-border p-2 text-sm text-foreground">Salary</th>
                        <th className="border border-border p-2 text-sm text-foreground">Reason for leaving</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.workExperience.map((exp, index) => {
                        const recordError = validationErrors.find(e => e.field.startsWith(`workExperience[${index}]`));
                        return (
                          <tr key={index} className={recordError ? 'bg-red-50 dark:bg-red-950/10' : ''}>
                            <td className="border border-border p-1 text-center text-foreground">{index + 1}</td>
                            <td className="border border-border p-1">
                              <Input
                                value={exp.designation}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].designation = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                onBlur={() => handleFieldBlur(`workExperience[${index}].designation`)}
                                className={`border-0 ${getFieldError(`workExperience[${index}].designation`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`workExperience[${index}].designation`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`workExperience[${index}].designation`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                value={exp.companyName}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].companyName = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                onBlur={() => handleFieldBlur(`workExperience[${index}].companyName`)}
                                className={`border-0 ${getFieldError(`workExperience[${index}].companyName`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`workExperience[${index}].companyName`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`workExperience[${index}].companyName`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                type="date"
                                value={exp.from}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].from = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                onBlur={() => handleFieldBlur(`workExperience[${index}].from`)}
                                className={`border-0 ${getFieldError(`workExperience[${index}].from`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`workExperience[${index}].from`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`workExperience[${index}].from`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                type="date"
                                value={exp.to}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].to = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                onBlur={() => handleFieldBlur(`workExperience[${index}].to`)}
                                className={`border-0 ${getFieldError(`workExperience[${index}].to`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`workExperience[${index}].to`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`workExperience[${index}].to`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                type="number"
                                value={exp.salary}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].salary = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                onBlur={() => handleFieldBlur(`workExperience[${index}].salary`)}
                                className={`border-0 ${getFieldError(`workExperience[${index}].salary`) ? 'bg-red-200' : ''}`}
                              />
                              {getFieldError(`workExperience[${index}].salary`) && (
                                <div className="text-xs text-red-600 mt-1">{getFieldError(`workExperience[${index}].salary`)}</div>
                              )}
                            </td>
                            <td className="border p-1">
                              <Input
                                value={exp.reasonForLeaving}
                                onChange={(e) => {
                                  const newExp = [...formData.workExperience];
                                  newExp[index].reasonForLeaving = e.target.value;
                                  setFormData({ ...formData, workExperience: newExp });
                                }}
                                className="border-0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Salary Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <Label>Previous/current Salary: <span className="text-red-600">*</span></Label>
                  <Input
                    type="number"
                    value={formData.currentSalary}
                    onChange={(e) => handleFieldChange('currentSalary', e.target.value)}
                    onBlur={() => handleFieldBlur('currentSalary')}
                    placeholder="PKR"
                    className={getFieldError('currentSalary') || getFieldError('Previous/Current Salary') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {(getFieldError('currentSalary') || getFieldError('Previous/Current Salary')) && <FormFieldError error={getFieldError('currentSalary') || getFieldError('Previous/Current Salary')} />}
                </div>
                <div>
                  <Label>Expected Salary: <span className="text-red-600">*</span></Label>
                  <Input
                    type="number"
                    value={formData.expectedSalary}
                    onChange={(e) => handleFieldChange('expectedSalary', e.target.value)}
                    onBlur={() => handleFieldBlur('expectedSalary')}
                    placeholder="PKR"
                    className={getFieldError('expectedSalary') || getFieldError('Expected Salary') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}
                  />
                  {(getFieldError('expectedSalary') || getFieldError('Expected Salary')) && <FormFieldError error={getFieldError('expectedSalary') || getFieldError('Expected Salary')} />}
                </div>
              </div>

              {/* Joining Availability */}
              <div className="mb-6">
                <Label>If selected, how soon would you be able to join us? <span className="text-red-600">*</span></Label>
                <Input
                  value={formData.joiningAvailability}
                  onChange={(e) => handleFieldChange('joiningAvailability', e.target.value)}
                  onBlur={() => handleFieldBlur('joiningAvailability')}
                  placeholder="e.g., Immediately, 1 month notice, etc."
                  className={`mt-2 ${getFieldError('joiningAvailability') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : ''}`}
                />
                {getFieldError('joiningAvailability') && <FormFieldError error={getFieldError('joiningAvailability')} />}
              </div>

              {/* Declaration */}
              <div className="bg-muted p-4 rounded-lg mb-6">
                <h3 className="font-semibold mb-3 text-foreground">Declaration: <span className="text-red-600">*</span></h3>
                <p className="text-sm text-muted-foreground mb-4">
                  I hereby declare that information given in this application form are true to the best of my knowledge.
                </p>
                <label className={`flex items-center gap-2 p-3 rounded border cursor-pointer ${getFieldError('declaration') ? 'border-red-600 bg-red-50 dark:bg-red-950/10' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => {
                      setDeclarationAccepted(e.target.checked);
                      setTouched(prev => new Set(prev).add('declaration'));
                    }}
                    onBlur={() => handleFieldBlur('declaration')}
                  />
                  <span className="text-sm font-medium">I accept the declaration</span>
                </label>
                {getFieldError('declaration') && <FormFieldError error={getFieldError('declaration')} />}
              </div>

              {/* Submit Button */}
              <div className="flex justify-center">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitting || !declarationAccepted}
                  className="px-12"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
                <p className="font-semibold">Head Office: 5800 Balcones Drive, STE 100 Austin, TX 78731, USA</p>
                <p>Development Center: 37, H3 Block, Johar Town, Lahore, 54000, Pakistan</p>
                <p className="mt-2">☎ +1 830-965-8926</p>
                <p>🌐 www.fusioncortex.com</p>
                <p>✉ info@fusioncortex.com</p>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
