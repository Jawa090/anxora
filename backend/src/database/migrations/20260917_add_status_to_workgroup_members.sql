-- Add status and left_at to workgroup_members to allow users who left a group to keep chat history
ALTER TABLE public.workgroup_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE public.workgroup_members ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

-- Update member count trigger to only count active members
CREATE OR REPLACE FUNCTION public.update_workgroup_member_count()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF COALESCE(NEW.status, 'active') = 'active' THEN
            UPDATE workgroups SET member_count = member_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.workgroup_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF COALESCE(OLD.status, 'active') = 'active' AND COALESCE(NEW.status, 'active') != 'active' THEN
            UPDATE workgroups SET member_count = GREATEST(0, member_count - 1), updated_at = CURRENT_TIMESTAMP WHERE id = NEW.workgroup_id;
        ELSIF COALESCE(OLD.status, 'active') != 'active' AND COALESCE(NEW.status, 'active') = 'active' THEN
            UPDATE workgroups SET member_count = member_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = NEW.workgroup_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        IF COALESCE(OLD.status, 'active') = 'active' THEN
            UPDATE workgroups SET member_count = GREATEST(0, member_count - 1), updated_at = CURRENT_TIMESTAMP WHERE id = OLD.workgroup_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_workgroup_member_count ON public.workgroup_members;
CREATE TRIGGER trigger_update_workgroup_member_count 
AFTER INSERT OR UPDATE OR DELETE ON public.workgroup_members 
FOR EACH ROW EXECUTE FUNCTION public.update_workgroup_member_count();
