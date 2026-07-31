-- Create milestone_assignees table for many-to-many relationship
CREATE TABLE IF NOT EXISTS project_milestone_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(milestone_id, assigned_to)
);

-- Create index for faster queries
CREATE INDEX idx_milestone_assignees_milestone_id ON project_milestone_assignees(milestone_id);
CREATE INDEX idx_milestone_assignees_assigned_to ON project_milestone_assignees(assigned_to);
CREATE INDEX idx_milestone_assignees_org_id ON project_milestone_assignees(org_id);
