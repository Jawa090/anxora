import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Calendar, Palmtree, Flag } from "lucide-react";
import { api } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Holiday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
}

const countries = [
  { code: "PK", label: "Pakistan", flag: "🇵🇰" },
  { code: "US", label: "United States", flag: "🇺🇸" },
] as const;

export default function HolidaysPage() {
  const currentYear = new Date().getFullYear();
  const [country, setCountry] = useState<string>("PK");

  const { data: holidays = [], isLoading } = useQuery({
    queryKey: ["holidays", currentYear, country],
    queryFn: () => api.get<Holiday[]>(`/hrms/holidays?year=${currentYear}&country=${country}`),
  });

  const activeCountry = countries.find(c => c.code === country)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Public Holidays</h1>
          <p className="text-sm text-muted-foreground">
            Official public holidays for {currentYear}. The system automatically marks these days as off for all employees.
          </p>
        </div>
      </div>

      <Tabs value={country} onValueChange={setCountry} className="w-full">
        <TabsList className="bg-muted/50 p-1">
          {countries.map(c => (
            <TabsTrigger
              key={c.code}
              value={c.code}
              className="flex items-center gap-2 px-5 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <span className="text-lg">{c.flag}</span>
              <span className="font-medium">{c.label}</span>
              <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                {c.code}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Flag className="h-4 w-4" />
        <span>
          Showing <strong>{holidays.length}</strong> holidays for{" "}
          <strong>{activeCountry.flag} {activeCountry.label}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-20 text-center text-muted-foreground">
            Loading holidays...
          </div>
        ) : holidays.length === 0 ? (
          <div className="col-span-full py-20 text-center text-muted-foreground">
            No public holidays found for {activeCountry.label} this year.
          </div>
        ) : (
          holidays.map((holiday, i) => {
            const dateObj = parseISO(holiday.date);
            const isPast = dateObj < new Date(new Date().setHours(0, 0, 0, 0));

            return (
              <div
                key={i}
                className={`p-5 rounded-xl border flex flex-col gap-3 transition-all ${
                  isPast ? 'bg-muted/30 border-border/50 opacity-70' : 'bg-card border-border shadow-sm hover:shadow-md hover:border-primary/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-lg ${isPast ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                    <Palmtree className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground border rounded px-2 py-0.5">
                      {activeCountry.flag}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground border rounded px-2 py-0.5">
                      {format(dateObj, "EEEE")}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 mt-1">
                  <h3 className="font-semibold text-base leading-tight truncate" title={holiday.name}>
                    {holiday.name}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(dateObj, "MMMM d, yyyy")}
                  </p>
                </div>

                {isPast && (
                  <div className="mt-2 text-xs font-medium text-muted-foreground">
                    Passed
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
