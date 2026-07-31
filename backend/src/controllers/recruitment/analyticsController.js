const db = require('../../config/database');

// =====================================================
// RECRUITMENT ANALYTICS
// =====================================================

// Get Comprehensive Recruitment Analytics
exports.getRecruitmentAnalytics = async (req, res) => {
  try {
    const organizationId = req.user.orgId;
    const { dateRange = 'last_30_days', department } = req.query;

    // Calculate date range
    let startDate = new Date();
    switch (dateRange) {
      case 'last_7_days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last_30_days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last_90_days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'last_year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const params = [organizationId, startDate];
    let departmentFilter = '';
    if (department && department !== 'all') {
      departmentFilter = ' AND jr.department = $3';
      params.push(department);
    }

    // 1. Time to Hire Metrics
    const timeToHireQuery = await db.query(`
      SELECT 
        AVG(EXTRACT(DAY FROM (c.updated_at - c.created_at))) as average_days,
        jr.department,
        EXTRACT(DAY FROM (c.updated_at - c.created_at)) as days_to_hire
      FROM candidates c
      JOIN job_requisitions jr ON c.requisition_id = jr.id
      WHERE c.organization_id = $1 
        AND c.status = 'selected'
        AND c.created_at >= $2
        ${departmentFilter}
      GROUP BY jr.department, c.id, c.updated_at, c.created_at
    `, params);

    // Calculate average and by department
    const avgTimeToHire = timeToHireQuery.rows.length > 0
      ? Math.round(timeToHireQuery.rows.reduce((sum, row) => sum + parseFloat(row.days_to_hire || 0), 0) / timeToHireQuery.rows.length)
      : 0;

    const timeByDept = {};
    timeToHireQuery.rows.forEach(row => {
      if (!timeByDept[row.department]) {
        timeByDept[row.department] = { total: 0, count: 0 };
      }
      timeByDept[row.department].total += parseFloat(row.days_to_hire || 0);
      timeByDept[row.department].count += 1;
    });

    const timeToHireByDepartment = Object.keys(timeByDept).map(dept => ({
      department: dept,
      avgDays: Math.round(timeByDept[dept].total / timeByDept[dept].count)
    }));

    // 2. Hiring Funnel
    const funnelQuery = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE c.status IN ('cv_received', 'shortlisted', 'interview_scheduled', 'interviewed', 'final_round', 'selected', 'rejected')) as applications,
        COUNT(*) FILTER (WHERE c.status IN ('shortlisted', 'interview_scheduled', 'interviewed', 'final_round', 'selected')) as screening_passed,
        COUNT(*) FILTER (WHERE c.status IN ('interviewed', 'final_round', 'selected')) as interviewed,
        COUNT(*) FILTER (WHERE c.status = 'selected') as hired
      FROM candidates c
      JOIN job_requisitions jr ON c.requisition_id = jr.id
      WHERE c.organization_id = $1 
        AND c.created_at >= $2
        ${departmentFilter}
    `, params);

    const funnel = funnelQuery.rows[0];
    const offersQuery = await db.query(`
      SELECT COUNT(*) as offered
      FROM job_offers jo
      JOIN candidates c ON jo.candidate_id = c.id
      WHERE jo.organization_id = $1 
        AND jo.created_at >= $2
        ${departmentFilter.replace('jr.department', 'jo.department')}
    `, params);

    // 3. Source Effectiveness
    const sourceQuery = await db.query(`
      SELECT 
        c.source,
        COUNT(*) as applications,
        COUNT(*) FILTER (WHERE c.status = 'selected') as hires
      FROM candidates c
      JOIN job_requisitions jr ON c.requisition_id = jr.id
      WHERE c.organization_id = $1 
        AND c.created_at >= $2
        AND c.source IS NOT NULL
        ${departmentFilter}
      GROUP BY c.source
      ORDER BY applications DESC
      LIMIT 10
    `, params);

    const sourceEffectiveness = sourceQuery.rows.map(row => ({
      source: row.source || 'Unknown',
      applications: parseInt(row.applications),
      hires: parseInt(row.hires),
      conversionRate: row.applications > 0 ? (parseInt(row.hires) / parseInt(row.applications)) * 100 : 0,
      costPerHire: 75000 // This would need actual cost tracking
    }));

    // 4. Department Metrics
    const deptQuery = await db.query(`
      SELECT 
        jr.department,
        COUNT(DISTINCT jr.id) as open_positions,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'selected') as filled,
        AVG(EXTRACT(DAY FROM (c.updated_at - c.created_at))) FILTER (WHERE c.status = 'selected') as avg_time_to_hire
      FROM job_requisitions jr
      LEFT JOIN candidates c ON jr.id = c.requisition_id
      WHERE jr.organization_id = $1 
        AND jr.created_at >= $2
        ${departmentFilter}
      GROUP BY jr.department
    `, params);

    const departmentMetrics = deptQuery.rows.map(row => ({
      department: row.department,
      openPositions: parseInt(row.open_positions),
      filled: parseInt(row.filled || 0),
      fillRate: row.open_positions > 0 ? (parseInt(row.filled || 0) / parseInt(row.open_positions)) * 100 : 0,
      avgTimeToHire: Math.round(parseFloat(row.avg_time_to_hire || 0))
    }));

    // 5. Interviewer Performance
    const interviewerQuery = await db.query(`
      SELECT 
        i.interviewer_name,
        COUNT(DISTINCT i.id) as interviews_conducted,
        AVG(cs.raw_score) as avg_score,
        COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'selected') as hires_from_interviews
      FROM candidate_interviews i
      LEFT JOIN candidate_scores cs ON i.id = cs.interview_id
      LEFT JOIN candidates c ON i.candidate_id = c.id
      LEFT JOIN job_requisitions jr ON c.requisition_id = jr.id
      WHERE c.organization_id = $1 
        AND i.interview_date >= $2
        ${departmentFilter}
      GROUP BY i.interviewer_name
      ORDER BY interviews_conducted DESC
      LIMIT 10
    `, params);

    const interviewerPerformance = interviewerQuery.rows.map(row => ({
      interviewerName: row.interviewer_name,
      interviewsConducted: parseInt(row.interviews_conducted),
      avgScore: parseFloat(row.avg_score || 0),
      hiresFromInterviews: parseInt(row.hires_from_interviews || 0),
      successRate: row.interviews_conducted > 0 
        ? (parseInt(row.hires_from_interviews || 0) / parseInt(row.interviews_conducted)) * 100 
        : 0
    }));

    // 6. Monthly Trend for Time to Hire (last 4 months)
    const trendParams = [organizationId];
    let trendDepartmentFilter = '';
    if (department && department !== 'all') {
      trendDepartmentFilter = ' AND jr.department = $2';
      trendParams.push(department);
    }
    
    const trendQuery = await db.query(`
      SELECT 
        TO_CHAR(c.created_at, 'Mon') as month,
        AVG(EXTRACT(DAY FROM (c.updated_at - c.created_at))) as avg_days
      FROM candidates c
      JOIN job_requisitions jr ON c.requisition_id = jr.id
      WHERE c.organization_id = $1 
        AND c.status = 'selected'
        AND c.created_at >= NOW() - INTERVAL '4 months'
        ${trendDepartmentFilter}
      GROUP BY TO_CHAR(c.created_at, 'Mon'), EXTRACT(MONTH FROM c.created_at)
      ORDER BY EXTRACT(MONTH FROM c.created_at) DESC
      LIMIT 4
    `, trendParams);

    const timeToHireTrend = trendQuery.rows.reverse().map(row => ({
      month: row.month,
      avgDays: Math.round(parseFloat(row.avg_days || 0))
    }));

    // Build response
    const analytics = {
      timeToHire: {
        average: avgTimeToHire,
        byDepartment: timeToHireByDepartment,
        trend: timeToHireTrend
      },
      costPerHire: {
        average: 85000, // This would need actual cost tracking
        byDepartment: departmentMetrics.map(d => ({
          department: d.department,
          avgCost: 85000 // This would need actual cost tracking
        })),
        breakdown: [
          { category: 'Job Advertising', amount: 15000, percentage: 18 },
          { category: 'Recruitment Agency', amount: 35000, percentage: 41 },
          { category: 'Internal HR Costs', amount: 20000, percentage: 24 },
          { category: 'Assessment Tools', amount: 10000, percentage: 12 },
          { category: 'Other', amount: 5000, percentage: 5 }
        ]
      },
      sourceEffectiveness,
      hiringFunnel: {
        applications: parseInt(funnel.applications || 0),
        screeningPassed: parseInt(funnel.screening_passed || 0),
        interviewed: parseInt(funnel.interviewed || 0),
        offered: parseInt(offersQuery.rows[0]?.offered || 0),
        hired: parseInt(funnel.hired || 0)
      },
      departmentMetrics,
      interviewerPerformance
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching recruitment analytics:', error);
    res.status(500).json({ error: 'Failed to fetch recruitment analytics' });
  }
};
