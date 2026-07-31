import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Users,
  Target,
  Calendar,
  Award,
  RefreshCw,
  Download,
  Filter,
  PieChart,
  LineChart,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { recruitmentApi } from '@/lib/api';

interface RecruitmentMetrics {
  timeToHire: {
    average: number;
    byDepartment: Array<{ department: string; avgDays: number }>;
    trend: Array<{ month: string; avgDays: number }>;
  };
  costPerHire: {
    average: number;
    byDepartment: Array<{ department: string; avgCost: number }>;
    breakdown: Array<{ category: string; amount: number; percentage: number }>;
  };
  sourceEffectiveness: Array<{
    source: string;
    applications: number;
    hires: number;
    conversionRate: number;
    costPerHire: number;
  }>;
  hiringFunnel: {
    applications: number;
    screeningPassed: number;
    interviewed: number;
    offered: number;
    hired: number;
  };
  departmentMetrics: Array<{
    department: string;
    openPositions: number;
    filled: number;
    fillRate: number;
    avgTimeToHire: number;
  }>;
  interviewerPerformance: Array<{
    interviewerName: string;
    interviewsConducted: number;
    avgScore: number;
    hiresFromInterviews: number;
    successRate: number;
  }>;
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<RecruitmentMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last_30_days');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch real analytics data from backend
      const data = await recruitmentApi.getRecruitmentAnalytics({
        dateRange,
        department: selectedDepartment
      });
      
      setMetrics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
      
      // Fallback to empty/default data on error
      setMetrics({
        timeToHire: {
          average: 0,
          byDepartment: [],
          trend: []
        },
        costPerHire: {
          average: 0,
          byDepartment: [],
          breakdown: []
        },
        sourceEffectiveness: [],
        hiringFunnel: {
          applications: 0,
          screeningPassed: 0,
          interviewed: 0,
          offered: 0,
          hired: 0
        },
        departmentMetrics: [],
        interviewerPerformance: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange, selectedDepartment]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12 text-muted-foreground">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recruitment Analytics</h1>
          <p className="text-muted-foreground">Track and analyze recruitment performance metrics</p>
        </div>
        <div className="flex gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="it">IT</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="time-to-hire">Time to Hire</TabsTrigger>
          <TabsTrigger value="cost">Cost Analysis</TabsTrigger>
          <TabsTrigger value="sources">Source Effectiveness</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Time to Hire</p>
                    <p className="text-2xl font-bold">{metrics.timeToHire.average} days</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Cost per Hire</p>
                    <p className="text-2xl font-bold">PKR {(metrics.costPerHire.average / 1000).toFixed(0)}K</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{metrics.hiringFunnel.applications}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Conversion Rate</p>
                    <p className="text-2xl font-bold">
                      {((metrics.hiringFunnel.hired / metrics.hiringFunnel.applications) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hiring Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Hiring Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Applications</span>
                    <span className="font-medium">{metrics.hiringFunnel.applications}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Screening Passed</span>
                    <span className="font-medium">{metrics.hiringFunnel.screeningPassed} ({((metrics.hiringFunnel.screeningPassed / metrics.hiringFunnel.applications) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(metrics.hiringFunnel.screeningPassed / metrics.hiringFunnel.applications) * 100}%` }}></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Interviewed</span>
                    <span className="font-medium">{metrics.hiringFunnel.interviewed} ({((metrics.hiringFunnel.interviewed / metrics.hiringFunnel.applications) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(metrics.hiringFunnel.interviewed / metrics.hiringFunnel.applications) * 100}%` }}></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Offered</span>
                    <span className="font-medium">{metrics.hiringFunnel.offered} ({((metrics.hiringFunnel.offered / metrics.hiringFunnel.applications) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-blue-600 h-3 rounded-full" style={{ width: `${(metrics.hiringFunnel.offered / metrics.hiringFunnel.applications) * 100}%` }}></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Hired</span>
                    <span className="font-medium">{metrics.hiringFunnel.hired} ({((metrics.hiringFunnel.hired / metrics.hiringFunnel.applications) * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div className="bg-green-600 h-3 rounded-full" style={{ width: `${(metrics.hiringFunnel.hired / metrics.hiringFunnel.applications) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Department Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.departmentMetrics.map((dept) => (
                  <div key={dept.department} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">{dept.department}</h4>
                      <Badge variant="outline">{dept.fillRate.toFixed(1)}% Fill Rate</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Open:</span>
                        <span className="ml-2 font-medium">{dept.openPositions}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Filled:</span>
                        <span className="ml-2 font-medium">{dept.filled}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Time:</span>
                        <span className="ml-2 font-medium">{dept.avgTimeToHire} days</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Time to Hire Tab */}
        <TabsContent value="time-to-hire" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Average Time to Hire: {metrics.timeToHire.average} days</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4">By Department</h4>
                  <div className="space-y-3">
                    {metrics.timeToHire.byDepartment.map((dept) => (
                      <div key={dept.department} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{dept.department}</span>
                          <span className="font-medium">{dept.avgDays} days</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(dept.avgDays / 30) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">Trend (Last 4 Months)</h4>
                  <div className="flex items-end justify-between h-48 border-b border-l pl-4 pb-4">
                    {metrics.timeToHire.trend.map((month) => (
                      <div key={month.month} className="flex flex-col items-center flex-1">
                        <div 
                          className="w-16 bg-blue-600 rounded-t"
                          style={{ height: `${(month.avgDays / 25) * 100}%` }}
                        ></div>
                        <span className="text-xs mt-2">{month.month}</span>
                        <span className="text-xs font-medium">{month.avgDays}d</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost Analysis Tab */}
        <TabsContent value="cost" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Average Cost per Hire: PKR {metrics.costPerHire.average.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-4">Cost Breakdown</h4>
                  <div className="space-y-3">
                    {metrics.costPerHire.breakdown.map((item) => (
                      <div key={item.category} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{item.category}</span>
                          <span className="font-medium">PKR {item.amount.toLocaleString()} ({item.percentage}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full" 
                            style={{ width: `${item.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-4">By Department</h4>
                  <div className="space-y-3">
                    {metrics.costPerHire.byDepartment.map((dept) => (
                      <div key={dept.department} className="flex justify-between items-center p-3 border rounded">
                        <span className="font-medium">{dept.department}</span>
                        <span className="text-lg font-bold">PKR {dept.avgCost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Source Effectiveness Tab */}
        <TabsContent value="sources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recruitment Source Effectiveness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.sourceEffectiveness.map((source) => (
                  <div key={source.source} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold">{source.source}</h4>
                      <Badge variant="outline">{source.conversionRate.toFixed(1)}% Conversion</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Applications:</span>
                        <p className="font-medium">{source.applications}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hires:</span>
                        <p className="font-medium">{source.hires}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Conversion:</span>
                        <p className="font-medium">{source.conversionRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Cost/Hire:</span>
                        <p className="font-medium">PKR {source.costPerHire.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interviewer Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.interviewerPerformance.map((interviewer) => (
                  <div key={interviewer.interviewerName} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold">{interviewer.interviewerName}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          <Star className="h-3 w-3 mr-1" />
                          {interviewer.avgScore.toFixed(1)}
                        </Badge>
                        <Badge variant="outline">{interviewer.successRate.toFixed(1)}% Success</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Interviews:</span>
                        <p className="font-medium">{interviewer.interviewsConducted}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Hires:</span>
                        <p className="font-medium">{interviewer.hiresFromInterviews}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Score:</span>
                        <p className="font-medium">{interviewer.avgScore.toFixed(1)}/10</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 