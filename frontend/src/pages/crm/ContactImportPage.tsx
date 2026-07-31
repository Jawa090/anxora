import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, ArrowRight, Users, Sparkles, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';

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

export default function ContactImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [detectedFields, setDetectedFields] = useState<DetectedFields | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const availableFields = [
    { value: 'first_name',    label: 'First Name' },
    { value: 'last_name',     label: 'Last Name' },
    { value: 'email',         label: 'Email Address' },
    { value: 'phone',         label: 'Phone Number' },
    { value: 'position',      label: 'Job Title / Position' },
    { value: 'company_name',  label: 'Company Name' },
    { value: 'contact_type',  label: 'Contact Type' },
    { value: 'source',        label: 'Source / Channel' },
    { value: 'notes',         label: 'Notes / Description' },
    { value: 'linkedin_url',  label: 'LinkedIn URL' },
    { value: 'website',       label: 'Website / URL' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const data = await api.post<DetectedFields>('/contact-import/detect-fields', formData);
      setDetectedFields(data);
      setFieldMapping(data.suggestedMappings || {});
      setStep('mapping');
    } catch (error: any) {
      toast.error(`Error: ${error?.message || 'Failed to process file'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!detectedFields) return;

    setLoading(true);
    setStep('importing');

    try {
      const data = await api.post<any>('/contact-import', {
        filePath: detectedFields.filePath,
        fieldMapping,
        skipDuplicates,
      });

      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setStep('complete');
    } catch (error: any) {
      toast.error('Failed to import contacts');
      setStep('mapping');
    } finally {
      setLoading(false);
    }
  };

  const stepClass = (active: boolean, done: boolean) =>
    `flex items-center ${done ? 'text-green-600 dark:text-green-500' : active ? 'text-primary' : 'text-muted-foreground'}`;
  const circleClass = (active: boolean, done: boolean) =>
    `w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${done ? 'bg-green-600 dark:bg-green-500 text-white' : active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`;

  return (
    <div className="max-w-4xl mx-auto p-6 text-foreground">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Import Contacts</h1>
            <p className="text-muted-foreground text-sm">Upload a CSV or Excel file to bulk-import contacts into your CRM</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-center gap-4">
        <div className={stepClass(step === 'upload', ['mapping','importing','complete'].includes(step))}>
          <div className={circleClass(step === 'upload', ['mapping','importing','complete'].includes(step))}>1</div>
          <span className="ml-2 font-medium">Upload File</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted/60" />
        <div className={stepClass(step === 'mapping' || step === 'importing', step === 'complete')}>
          <div className={circleClass(step === 'mapping' || step === 'importing', step === 'complete')}>2</div>
          <span className="ml-2 font-medium">Map Fields</span>
        </div>
        <ArrowRight className="h-4 w-4 text-muted/60" />
        <div className={stepClass(step === 'complete', false)}>
          <div className={circleClass(step === 'complete', false)}>3</div>
          <span className="ml-2 font-medium">Complete</span>
        </div>
      </div>

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-10">
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-dashed border-primary/20 hover:border-primary/50 rounded-2xl p-12 text-center bg-muted/20 transition-all group">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                <Upload className="h-10 w-10 text-primary" />
              </div>
              
              <h3 className="text-xl font-bold text-foreground mb-3">Upload your contact list</h3>
              <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                Select a spreadsheet containing your contacts. 
                We support CSV and all modern Excel formats.
              </p>

              <div className="flex justify-center gap-6 mb-8">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                    <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Excel</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                    <FileSpreadsheet className="h-6 w-6 text-blue-500" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">CSV</span>
                </div>
              </div>

              <label className="inline-flex items-center px-8 py-3 bg-primary text-primary-foreground rounded-xl cursor-pointer hover:bg-primary/90 transition-all shadow-lg active:scale-95 font-bold">
                <Upload className="mr-2 h-5 w-5" />
                Select File
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={loading}
                />
              </label>
              
              <div className="mt-8 flex items-center justify-center gap-6 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  Max 10MB
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  XLSX / XLS / CSV
                </span>
              </div>

              {loading && (
                <div className="mt-6 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <div className="h-1.5 w-48 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary animate-pulse w-full"></div>
                  </div>
                  <p className="text-xs text-primary font-bold tracking-tight">ANALYZING DATA...</p>
                </div>
              )}
            </div>

            <div className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/10">
              <div className="flex items-start justify-between gap-4">
                <div className="text-left">
                  <h4 className="font-bold text-foreground mb-2 flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Quick Tip
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    For the best experience, ensure your first row has headers like 
                    <span className="font-semibold text-foreground px-1">First Name</span>, 
                    <span className="font-semibold text-foreground px-1">Email</span>. 
                    We'll handle the rest!
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 hover:bg-muted border-border shadow-sm text-foreground"
                  onClick={() => {
                    const headers = availableFields.map(f => f.label).join(',');
                    const sampleRow = "John,Doe,john@example.com,+1234567890,Manager,Acme Inc,Customer,Organic,Notes here,https://linkedin.com/in/jdoe,https://acme.com";
                    const blob = new Blob([`${headers}\n${sampleRow}`], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `rush-crm-contacts-sample.csv`;
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
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-8">
          <h2 className="text-xl font-semibold text-foreground mb-1">Map Your Fields</h2>
          <p className="text-muted-foreground text-sm mb-6">
            Match your file columns to contact fields. We've pre-filled suggested mappings.
          </p>

          <div className="space-y-3 mb-6 max-h-[420px] overflow-y-auto pr-1">
            {detectedFields.headers.map((header) => (
              <div key={header} className="flex items-center gap-4 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-foreground truncate">{header}</p>
                  {detectedFields.sampleData[0]?.[header] && (
                    <p className="text-xs text-muted-foreground truncate">
                      e.g. {String(detectedFields.sampleData[0][header]).substring(0, 60)}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted/60 flex-shrink-0" />
                <div className="flex-1">
                  <select
                    value={fieldMapping[header] || ''}
                    onChange={(e) => setFieldMapping({ ...fieldMapping, [header]: e.target.value || null })}
                    className="w-full px-3 py-2 text-sm bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  >
                    <option value="">— Skip this column —</option>
                    {availableFields.map((field) => (
                      <option key={field.value} value={field.value}>{field.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 mb-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
              className="rounded border-border bg-background text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">Skip duplicate contacts (matched by email)</span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-5 py-2.5 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="flex-1 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
            >
              Import Contacts
            </button>
          </div>
        </div>
      )}

      {/* Step 2.5: Importing Loading State */}
      {step === 'importing' && (
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-20 flex flex-col items-center justify-center text-center">
          <div className="relative w-24 h-24 mb-8">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary animate-bounce" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3">Importing Contacts</h2>
          <p className="text-muted-foreground max-w-sm mb-8">
            We are currently processing your file and creating contacts in your database. 
            This usually takes a few moments...
          </p>
          
          <div className="w-full max-w-md h-2 bg-muted rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary animate-pulse w-full"></div>
          </div>
          
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Processing {detectedFields?.totalRows || ''} Contacts
          </div>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && importResult && (
        <div className="bg-card text-card-foreground rounded-2xl shadow-xl border border-border p-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">Import Complete!</h2>
            <p className="text-muted-foreground text-sm">Your contacts have been added to the CRM</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-5 bg-green-500/5 rounded-xl border border-green-500/20 text-center">
              <div className="text-3xl font-bold text-green-500">{importResult.successful}</div>
              <div className="text-sm text-muted-foreground mt-1">Imported</div>
            </div>
            <div className="p-5 bg-amber-500/5 rounded-xl border border-amber-500/20 text-center">
              <div className="text-3xl font-bold text-amber-500">{importResult.duplicates}</div>
              <div className="text-sm text-muted-foreground mt-1">Duplicates Skipped</div>
            </div>
            <div className="p-5 bg-red-500/5 rounded-xl border border-red-500/20 text-center">
              <div className="text-3xl font-bold text-red-500">{importResult.failed}</div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </div>
          </div>

          {importResult.errors?.length > 0 && (
            <div className="mb-8 p-4 bg-red-500/5 rounded-xl border border-red-500/20 text-left">
              <h3 className="font-semibold text-red-400 mb-2 text-sm">Import Errors</h3>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {importResult.errors.map((err: any, idx: number) => (
                  <p key={idx} className="text-xs text-red-400/90">Row {err.row}: {err.error}</p>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setFile(null); setDetectedFields(null); setImportResult(null); }}
              className="flex-1 px-5 py-2.5 border border-border bg-background text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              Import More
            </button>
            <button
              onClick={() => navigate('/crm/customers/contacts')}
              className="flex-1 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-all shadow-md active:scale-[0.98]"
            >
              View Contacts
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
