import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, XCircle, ArrowRight, Sparkles, Download, FileUp, Database } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { getCustomFieldTemplates } from '@/utils/crm/customFieldsRegistry';

interface FieldMapping {
  [csvField: string]: string | null;
}

interface DetectedFields {
  fileName: string;
  filePath: string;
  headers: string[];
  sampleData: any[];
  suggestedMappings: FieldMapping;
  totalRows: number;
}

export default function LeadImportPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const initialType = (searchParams.get('type') as 'lead' | 'deal') || 'lead';
  
  const [entityType, setEntityType] = useState<'lead' | 'deal'>(initialType);
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [detectedFields, setDetectedFields] = useState<DetectedFields | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [availableCustomFieldOptions, setAvailableCustomFieldOptions] = useState<{ value: string; label: string }[]>([]);

  const commonFields = [
    { value: 'title', label: entityType === 'deal' ? 'Deal Title' : 'Lead name' },
    { value: 'name', label: 'Full Name' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: entityType === 'deal' ? 'Email' : 'Personal E-mail' },
    { value: 'phone', label: entityType === 'deal' ? 'Phone' : 'Personal Number' },
    { value: 'company', label: 'Company name' },
    { value: 'companyEmail', label: 'Company Email' },
    { value: 'companyPhone', label: entityType === 'deal' ? 'Company Phone' : 'Company Phone Number' },
    { value: 'designation', label: 'Designation' },
    { value: 'jobTitle', label: 'Job Title' },
    { value: 'pipeline', label: 'Pipeline' },
    { value: 'stage', label: 'Stage' },
    { value: 'status', label: 'Status' },
    { value: 'source', label: 'Source' },
    { value: 'sourceInfo', label: 'Source Information' },
    { value: 'value', label: entityType === 'deal' ? 'Deal Value' : 'Estimated Opportunity Value' },
    { value: 'currency', label: 'Currency' },
    { value: 'website', label: 'Website' },
    { value: 'websiteType', label: 'Website Type' },
    { value: 'address', label: 'Address' },
    { value: 'city', label: 'City' },
    { value: 'state', label: 'State' },
    { value: 'zip', label: 'Zip/Postal Code' },
    { value: 'country', label: 'Country' },
    { value: 'notes', label: entityType === 'deal' ? 'Notes' : 'Additional Notes' },
    { value: 'agentName', label: entityType === 'deal' ? 'Sales Agent' : 'Agent Name' },
    { value: 'assignedTo', label: entityType === 'deal' ? 'Responsible Person' : 'Lead owner' },
    { value: 'serviceInterested', label: 'Service Interested' },
    { value: 'companySize', label: 'Company Size' },
    { value: 'industry', label: 'Industry' },
    { value: 'decisionMaker', label: entityType === 'deal' ? 'Decision Maker' : 'Decision Maker Identified' },
    { value: 'priority', label: 'Priority' },
    { value: 'tags', label: 'Tags (Comma separated)' },
    { value: 'expectedCloseDate', label: 'Expected Close Date' },
    { value: 'nextFollowUpDate', label: 'Next Follow-up Date' },
    { value: 'externalSourceId', label: 'External Source ID' },
    { value: 'createdAt', label: 'Created Date' },
  ];

  const leadOnlyFields = [
    { value: 'customerType', label: 'Customer Type' },
    { value: 'interactionNotes', label: 'All Interaction Notes With Dates' },
    { value: 'lastContactedDate', label: 'Last Contacted Date' },
    { value: 'responsiblePerson', label: 'Responsible Person' },
  ];

  const dealOnlyFields = [
    { value: 'contactName', label: 'Contact Name' },
    { value: 'description', label: 'Description' },
    { value: 'probability', label: 'Probability (%)' },
    { value: 'clientType', label: 'Client Type' },
    { value: 'projectType', label: 'Project Type' },
    { value: 'availableToEveryone', label: 'Available to everyone' },
    { value: 'quotationReceived', label: 'Quotation Received' },
    { value: 'paymentMethod', label: 'Payment Method' },
    { value: 'invoiceLink', label: 'Invoice Link' },
    { value: 'hourlyRate', label: 'Hourly Rate' },
    { value: 'hoursOfWork', label: 'Hours Of Work' },
    { value: 'proposalAmount', label: 'Proposal Amount' },
    { value: 'invoiceAmount', label: 'Invoice Amount' },
    { value: 'scope', label: 'Scope' },
    { value: 'projectBlueprints', label: 'Project Blueprints' },
    { value: 'qaStatus', label: 'QA Status' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'feedbackDetails', label: 'Project Feedback Details' },
  ];

  const availableFields = [
    ...commonFields,
    ...(entityType === 'lead' ? leadOnlyFields : dealOnlyFields),
  ];

  React.useEffect(() => {
    const loadCustomFields = async () => {
      // Get from server
      try {
        const templates = await api.get<any[]>(`/crm-custom-fields/templates/${entityType}`);
        const serverFields = templates.map(cf => ({
          value: `custom_${cf.key}`,
          label: cf.key
        }));

        // Get from local storage
        const localTemplates = getCustomFieldTemplates(entityType);
        const localFields = localTemplates.map(cf => ({
          value: `custom_${cf.key}`,
          label: cf.key
        }));

        // Merge and deduplicate by label
        const allFields = [...serverFields, ...localFields];
        const uniqueFields = Array.from(
          new Map(allFields.map(item => [item.label, item])).values()
        );

        setAvailableCustomFieldOptions(uniqueFields);
      } catch (error) {
        console.error('Failed to load custom fields for import mapping', error);
        // Fallback to local only
        const localTemplates = getCustomFieldTemplates(entityType);
        setAvailableCustomFieldOptions(localTemplates.map(cf => ({
          value: `custom_${cf.key}`,
          label: cf.key
        })));
      }
    };

    loadCustomFields();
  }, [entityType]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const data = await api.post<DetectedFields>('/lead-import/detect-fields', formData);
      
      console.log('Detected fields:', data); // Debug

      setDetectedFields(data);
      setFieldMapping(data.suggestedMappings || {});
      setStep('mapping');
    } catch (error: any) {
      console.error('Error detecting fields:', error);
      const errorMessage = error?.message || 'Failed to process file';
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!detectedFields) return;

    setLoading(true);
    setStep('importing');

    try {
      const data = await api.post<any>('/lead-import', {
        filePath: detectedFields.filePath,
        fieldMapping,
        workspaceId: workspaceId || null,
        skipDuplicates,
        entityType
      });

      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      setStep('complete');
    } catch (error: any) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Import {entityType === 'lead' ? 'Leads' : 'Deals'}</h1>
        <p className="text-muted-foreground">Upload CSV or Excel file to import {entityType === 'lead' ? 'leads' : 'deals'}</p>
      </div>

      <div className="mb-8 flex gap-4 p-1 bg-muted/50 rounded-lg w-fit mx-auto border shadow-sm">
        <button
          onClick={() => setEntityType('lead')}
          className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
            entityType === 'lead' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Import Leads
        </button>
        <button
          onClick={() => setEntityType('deal')}
          className={`px-6 py-2 rounded-md text-sm font-semibold transition-all ${
            entityType === 'deal' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          Import Deals
        </button>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center space-x-4">
        <div className={`flex items-center ${step === 'upload' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>1</div>
          <span className="ml-2 font-medium">Upload File</span>
        </div>
        <ArrowRight className="text-muted-foreground" />
        <div className={`flex items-center ${step === 'mapping' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'mapping' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>2</div>
          <span className="ml-2 font-medium">Map Fields</span>
        </div>
        <ArrowRight className="text-muted-foreground" />
        <div className={`flex items-center ${step === 'complete' ? 'text-green-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'complete' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
          }`}>3</div>
          <span className="ml-2 font-medium">Complete</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-card rounded-xl shadow-lg border p-10">
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-dashed border-primary/20 hover:border-primary/50 rounded-2xl p-12 text-center bg-muted/30 transition-all group">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-3">Upload your data file</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                Select a spreadsheet containing your {entityType === 'lead' ? 'leads' : 'deals'}. 
                We support both standard CSV and modern Excel formats.
              </p>

              <div className="flex justify-center gap-6 mb-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 rounded-lg flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">EXCEL</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-950/40 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-800">
                    <FileSpreadsheet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">CSV</span>
                </div>
              </div>

              <label className="inline-flex items-center px-8 py-3 bg-primary text-primary-foreground rounded-xl cursor-pointer hover:bg-primary/90 transition-all shadow-xl active:scale-95 font-bold">
                <Upload className="mr-2 h-5 w-5" />
                Browse Files
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
              
              <div className="mt-8 flex items-center justify-center gap-4 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  Max size: 10MB
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  UTF-8 Supported
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-emerald-500" />
                  XLSX, XLS, CSV
                </span>
              </div>

              {loading && step === 'upload' && (
                <div className="mt-12 flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileUp className="h-8 w-8 text-primary animate-pulse" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-xl font-semibold tracking-tight">Analyzing your file...</p>
                    <p className="text-muted-foreground">Preparing your data for field mapping and import.</p>
                  </div>
                  <div className="h-1.5 w-64 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-progress origin-left shadow-[0_0_10px_rgba(var(--primary),0.3)]"></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="font-bold text-foreground mb-2 flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Pro Tip: Quick Import
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Our smart mapper will automatically detect your columns. Ensure your first row contains headers like 
                    <span className="font-semibold text-foreground px-1">Name</span>, 
                    <span className="font-semibold text-foreground px-1">Email</span>, and 
                    <span className="font-semibold text-foreground px-1">Phone</span> for the best results.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 bg-background hover:bg-muted"
                  onClick={() => {
                    const headers = availableFields.map(f => f.label).join(',');
                    const sampleRow = "John Doe,john@example.com,+1234567890,Acme Corp,contact@acme.com,+10987654321,Sales Manager,Web Search,New,50000,https://acme.com,123 Business St,Interested in CRM,Jane Smith,CRM Setup,50,Yes,Met at conference,Software,USA,San Francisco,CA,94105,jdoe_twitter,High,\"tag1,tag2\",2024-12-31,2024-05-07";
                    const blob = new Blob([`${headers}\n${sampleRow}`], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rush-crm-${entityType}-sample.csv`;
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-2" />
                  Sample CSV
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Field Mapping */}
      {step === 'mapping' && detectedFields && (
        <div className="bg-card rounded-lg shadow border p-6">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Map Your Fields</h2>
          <p className="text-muted-foreground mb-4">
            Match your file columns to CRM fields. We've suggested mappings based on column names.
          </p>

          {entityType === 'lead' && (
            <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20 text-sm text-foreground">
              <span className="font-semibold flex items-center gap-2 mb-1">
                Auto-Assigning Stages
              </span>
              <span className="text-muted-foreground">
                To automatically assign leads to a specific stage, make sure the stage names in your file <span className="font-medium text-foreground">exactly match</span> the stage names currently in your CRM (case-insensitive).
              </span>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Import to Workspace (Optional)
            </label>
            <input
              type="text"
              placeholder="Leave empty for organization-wide"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
            />
          </div>

          <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
            {detectedFields.headers.map((header) => (
              <div key={header} className="flex items-center space-x-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {header}
                  </label>
                  {detectedFields.sampleData[0]?.[header] && (
                    <p className="text-xs text-muted-foreground">
                      Example: {String(detectedFields.sampleData[0][header]).substring(0, 50)}
                      {String(detectedFields.sampleData[0][header]).length > 50 ? '...' : ''}
                    </p>
                  )}
                </div>
                <ArrowRight className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                    <select
                    value={fieldMapping[header] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [header]: e.target.value || null })}
                    className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all bg-background text-foreground"
                  >
                    <option value="">Skip this field</option>
                    <optgroup label="Standard Fields">
                      {availableFields.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                    </optgroup>
                    {availableCustomFieldOptions.length > 0 && (
                      <optgroup label="Custom Fields">
                        {availableCustomFieldOptions.map((field) => (
                          <option key={field.value} value={field.value}>
                            {field.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-foreground">Skip duplicate leads (based on email)</span>
            </label>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.98] font-semibold"
            >
              {loading ? 'Importing...' : `Import ${entityType === 'lead' ? 'Leads' : 'Deals'}`}
            </button>
          </div>
        </div>
      )}

      {/* Step 2.5: Importing Loading State */}
      {step === 'importing' && (
        <div className="bg-card rounded-xl shadow-lg border p-20 flex flex-col items-center justify-center text-center">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary animate-bounce" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">Importing Your Data</h2>
          <p className="text-muted-foreground max-w-sm mb-8">
            We are currently processing your file and creating {entityType === 'lead' ? 'leads' : 'deals'}. 
            This usually takes a few seconds...
          </p>
          
          <div className="w-full max-w-md h-2 bg-muted rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary animate-progress origin-left"></div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Processing {detectedFields?.totalRows || ''} Rows
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-card rounded-lg shadow border p-8">
          <div className="text-center mb-6">
            <CheckCircle className="mx-auto h-16 w-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-semibold mb-4 text-foreground">Import Complete!</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-3xl font-bold text-green-600">{importResult.successful}</div>
              <div className="text-sm text-muted-foreground">Imported</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="text-3xl font-bold text-yellow-600">{importResult.duplicates}</div>
              <div className="text-sm text-muted-foreground">Duplicates Skipped</div>
            </div>
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-3xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
          </div>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-2 text-red-700 dark:text-red-400">Errors:</h3>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 max-h-40 overflow-y-auto border border-red-200 dark:border-red-800">
                {importResult.errors.map((err: any, idx: number) => (
                  <div key={idx} className="text-sm text-red-700 dark:text-red-400 mb-1">
                    Row {err.row}: {err.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult.successful > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3 text-foreground">Successfully Imported {entityType === 'lead' ? 'Leads' : 'Deals'}</h3>
              <div className="bg-muted/50 rounded-lg p-4 max-h-96 overflow-y-auto border">
                <div className="text-sm text-muted-foreground mb-2">
                  {importResult.successful} {entityType === 'lead' ? 'lead(s)' : 'deal(s)'} have been imported with all their information including:
                </div>
                <ul className="list-disc list-inside text-sm text-foreground space-y-1 ml-2">
                  <li>Contact Information (Name, Email, Phone)</li>
                  <li>Company Details</li>
                  <li>{entityType === 'lead' ? 'Lead' : 'Deal'} Status & Source</li>
                  <li>Custom Fields & Notes</li>
                  <li>All mapped data from your file</li>
                </ul>
                <div className="mt-4 p-3 bg-primary/10 rounded border border-primary/20">
                  <p className="text-sm text-primary font-medium">
                    💡 All imported {entityType === 'lead' ? 'leads' : 'deals'} are now available in your CRM with complete information. 
                    Click "View {entityType === 'lead' ? 'Leads' : 'Deals'}" below to see them.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            <button
              onClick={() => {
                setStep('upload');
                setFile(null);
                setDetectedFields(null);
                setImportResult(null);
              }}
              className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted text-foreground"
            >
              Import More
            </button>
            <button
              onClick={() => navigate(entityType === 'lead' ? '/crm/leads' : '/crm/deals')}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-md active:scale-[0.98] font-semibold"
            >
              View All {entityType === 'lead' ? 'Leads' : 'Deals'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
