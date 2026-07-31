-- =====================================================
-- Migration: Simplify Requisition Approval Workflow
-- Date: 2026-07-01
-- Description:
--   Removes "Department Head" and "Higher Authority" approval steps
--   from the requisition workflow. Now only HR Manager approval is required.
--   Also fixes existing records to match the new flow.
-- =====================================================

DO $$
BEGIN

  -- 1. Remove "Higher Authority" and "Department Head" approval steps from existing records
  DELETE FROM public.requisition_approvals
  WHERE role IN ('Department Head', 'Higher Authority');

  -- 2. For requisitions that still have HR Manager step at step_number = 3,
  --    renumber it to step_number = 2
  UPDATE public.requisition_approvals
  SET step_number = 2
  WHERE role = 'HR Manager' AND step_number = 3;

  -- 3. Set HR Manager step to 'pending' if the corresponding requisition
  --    was in 'pending_dept_head' (transition them to pending_hr)
  UPDATE public.requisition_approvals ra
  SET status = 'pending', action = 'pending_review'
  WHERE ra.role = 'HR Manager'
    AND ra.status = 'not_started'
    AND EXISTS (
      SELECT 1 FROM public.job_requisitions jr
      WHERE jr.id = ra.requisition_id
        AND jr.status IN ('pending_dept_head', 'pending_management')
    );

  -- 4. Fix job_requisitions statuses:
  --    pending_dept_head  → pending_hr
  --    pending_management → pending_hr
  UPDATE public.job_requisitions
  SET status = 'pending_hr', updated_at = NOW()
  WHERE status IN ('pending_dept_head', 'pending_management');

  RAISE NOTICE 'Migration 20260701_simplify_requisition_approval_workflow completed successfully.';

END $$;
