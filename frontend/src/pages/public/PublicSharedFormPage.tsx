import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { FILE_BASE_URL } from "@/lib/api";

export default function PublicSharedFormPage() {
  const { id } = useParams();
  const [formConfig, setFormConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`${FILE_BASE_URL}/public/marketing/forms/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Form not found or inactive");
        return res.json();
      })
      .then((data) => {
        setFormConfig(data.data);
        // Initialize fields
        const initial: Record<string, any> = {};
        if (Array.isArray(data.data.fields)) {
          data.data.fields.forEach((f: any) => {
            initial[f.name] = "";
          });
        }
        setFormData(initial);
      })
      .catch((err) => {
        toast.error(err.message || "Failed to load form");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${FILE_BASE_URL}/public/marketing/forms/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || "Submission failed");
      }

      setSubmitted(true);
      toast.success(responseData.message || "Form submitted successfully!");

      if (responseData.redirect_url) {
        setTimeout(() => {
          window.location.href = responseData.redirect_url;
        }, 2000);
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!formConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          <CardHeader>
            <CardTitle className="text-destructive">Form Unavailable</CardTitle>
            <CardDescription>
              This form could not be loaded. It might have been deleted, deactivated, or the link is incorrect.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full text-center p-6 border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <CardHeader className="space-y-2">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto animate-bounce" />
            <CardTitle className="text-emerald-500 font-bold">Thank You!</CardTitle>
            <CardDescription className="text-foreground pt-2">
              {formConfig.success_message || "Your response has been submitted successfully."}
            </CardDescription>
          </CardHeader>
          {formConfig.redirect_url && (
            <CardContent>
              <p className="text-xs text-muted-foreground">Redirecting you shortly...</p>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="max-w-md w-full shadow-xl border-t-4 border-t-primary">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">{formConfig.name}</CardTitle>
          {formConfig.description && (
            <CardDescription className="text-sm">{formConfig.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(Array.isArray(formConfig.fields) ? formConfig.fields : []).map((field: any, idx: number) => (
              <div key={idx} className="space-y-1.5">
                <Label className="capitalize text-xs font-semibold">
                  {field.label || field.name}{" "}
                  {field.required && <span className="text-destructive">*</span>}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    placeholder={`Enter ${field.label || field.name}...`}
                    required={field.required}
                    value={formData[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                  />
                ) : field.type === "select" ? (
                  <Select
                    required={field.required}
                    value={formData[field.name] || ""}
                    onValueChange={(v) => handleInputChange(field.name, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select option..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="option1">Option 1</SelectItem>
                      <SelectItem value="option2">Option 2</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={field.type || "text"}
                    placeholder={`Enter ${field.label || field.name}...`}
                    required={field.required}
                    value={formData[field.name] || ""}
                    onChange={(e) => handleInputChange(field.name, e.target.value)}
                  />
                )}
              </div>
            ))}
            <Button type="submit" className="w-full mt-4" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
