--
-- PostgreSQL database dump
--

\restrict WclDegJK6EQvfe7VucM3iuMVZ9XinadW9KrSdciJTMmQMCc81y2W75SWHFTktZm

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'admin',
    'manager',
    'team_lead',
    'employee'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: add_creator_as_owner(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_creator_as_owner() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_members (workgroup_id, user_id, role, joined_at)
    VALUES (NEW.id, NEW.created_by, 'owner', CURRENT_TIMESTAMP);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.add_creator_as_owner() OWNER TO postgres;

--
-- Name: create_default_channel(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.create_default_channel() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO workgroup_channels (workgroup_id, name, description, type, is_general, created_by)
    VALUES (NEW.id, 'General', 'General discussion for the team', 'standard', true, NEW.created_by);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.create_default_channel() OWNER TO postgres;

--
-- Name: log_stock_movement(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.log_stock_movement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        IF OLD.quantity != NEW.quantity THEN
          INSERT INTO stock_movements (
            org_id, product_id, warehouse_id, movement_type, quantity, reason, created_by
          ) VALUES (
            NEW.org_id, 
            NEW.product_id, 
            NEW.warehouse_id,
            CASE 
              WHEN NEW.quantity > OLD.quantity THEN 'stock_in'
              ELSE 'stock_out'
            END,
            ABS(NEW.quantity - OLD.quantity),
            'Stock updated',
            (SELECT id FROM users LIMIT 1)
          );
        END IF;
        RETURN NEW;
      END;
      $$;


ALTER FUNCTION public.log_stock_movement() OWNER TO postgres;

--
-- Name: prune_old_notifications(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.prune_old_notifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  DELETE FROM notifications
  WHERE target_user_id = NEW.target_user_id
    AND id NOT IN (
      SELECT id FROM notifications
      WHERE target_user_id = NEW.target_user_id
      ORDER BY created_at DESC
      LIMIT 200
    );
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.prune_old_notifications() OWNER TO postgres;

--
-- Name: purge_old_webhook_raw_logs(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.purge_old_webhook_raw_logs() RETURNS void
    LANGUAGE sql
    AS $$
  DELETE FROM instantly_webhook_raw_log WHERE received_at < now() - interval '7 days';
$$;


ALTER FUNCTION public.purge_old_webhook_raw_logs() OWNER TO postgres;

--
-- Name: update_car_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_car_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_car_updated_at() OWNER TO postgres;

--
-- Name: update_leave_remaining_days(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_leave_remaining_days() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.remaining_days = NEW.total_days - NEW.used_days;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_leave_remaining_days() OWNER TO postgres;

--
-- Name: update_stock_available_quantity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_stock_available_quantity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.available_quantity = NEW.quantity - NEW.reserved_quantity;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_stock_available_quantity() OWNER TO postgres;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

--
-- Name: update_workgroup_member_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_workgroup_member_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workgroups 
        SET member_count = member_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workgroup_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workgroups 
        SET member_count = member_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_workgroup_member_count() OWNER TO postgres;

--
-- Name: update_workgroup_message_count(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_workgroup_message_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE workgroups 
        SET message_count = message_count + 1,
            last_activity_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.workgroup_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE workgroups 
        SET message_count = message_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.workgroup_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION public.update_workgroup_message_count() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    type character varying(50) NOT NULL,
    subject character varying(255),
    description text,
    contact_id uuid,
    deal_id uuid,
    company_id uuid,
    assigned_to uuid,
    due_date timestamp without time zone,
    completed boolean DEFAULT false,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    owner_id uuid,
    lead_id uuid
);


ALTER TABLE public.activities OWNER TO postgres;

--
-- Name: attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    date date NOT NULL,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    status character varying(50) DEFAULT 'present'::character varying,
    hours_worked numeric(5,2),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    total_hours numeric(5,2),
    clock_in timestamp without time zone,
    clock_out timestamp without time zone,
    late_minutes integer DEFAULT 0,
    overtime_hours numeric(5,2) DEFAULT 0,
    location character varying(255),
    created_by uuid,
    updated_by uuid,
    break_duration integer DEFAULT 0,
    ip_address character varying(50),
    device_info text,
    user_id uuid,
    location_lat numeric,
    location_lng numeric,
    break_end timestamp without time zone,
    break_start timestamp without time zone,
    source_ip character varying(100),
    total_hours_worked numeric(5,2),
    extra_time numeric(5,2),
    less_time numeric(5,2),
    raw_device_log jsonb
);


ALTER TABLE public.attendance OWNER TO postgres;

--
-- Name: background_check_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_check_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    check_type_name character varying(100) NOT NULL,
    check_category character varying(50) NOT NULL,
    description text,
    is_mandatory boolean DEFAULT false,
    typical_duration_days integer DEFAULT 7,
    cost_estimate numeric(10,2),
    vendor_name character varying(255),
    is_active boolean DEFAULT true,
    organization_id uuid
);


ALTER TABLE public.background_check_types OWNER TO postgres;

--
-- Name: background_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.background_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    check_type_id uuid,
    check_reference_number character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(20) DEFAULT 'normal'::character varying,
    initiated_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expected_completion_date date,
    completed_date timestamp without time zone,
    result character varying(50),
    result_details text,
    verification_score integer,
    verified_by character varying(255),
    verification_method character varying(100),
    documents_verified text[],
    cost_incurred numeric(10,2),
    vendor_used character varying(255),
    vendor_reference character varying(100),
    initiated_by uuid,
    reviewed_by uuid,
    review_comments text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT background_checks_verification_score_check CHECK (((verification_score >= 0) AND (verification_score <= 100)))
);


ALTER TABLE public.background_checks OWNER TO postgres;

--
-- Name: TABLE background_checks; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.background_checks IS 'Background verification and compliance tracking';


--
-- Name: calendar_connections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_connections (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    org_id uuid,
    user_id uuid,
    provider character varying(50) NOT NULL,
    calendar_name character varying(255),
    external_calendar_id character varying(255),
    access_token text,
    refresh_token text,
    expires_at timestamp without time zone,
    is_primary boolean DEFAULT false,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.calendar_connections OWNER TO postgres;

--
-- Name: calendar_event_attendees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_event_attendees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_id uuid,
    user_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    email text,
    is_organizer boolean DEFAULT false,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.calendar_event_attendees OWNER TO postgres;

--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    location character varying(255),
    event_type character varying(50) DEFAULT 'meeting'::character varying,
    is_all_day boolean DEFAULT false,
    recurrence_rule character varying(255),
    reminder_minutes integer,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    color character varying(20),
    is_recurring boolean DEFAULT false,
    attendees jsonb DEFAULT '[]'::jsonb,
    attachments jsonb DEFAULT '[]'::jsonb,
    external_calendar_id character varying(255),
    external_provider character varying(50),
    deleted_at timestamp without time zone,
    category character varying(50) DEFAULT 'event'::character varying
);


ALTER TABLE public.calendar_events OWNER TO postgres;

--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    contact_id uuid,
    user_id uuid,
    call_type character varying(50) NOT NULL,
    direction character varying(50) NOT NULL,
    phone_number character varying(50) NOT NULL,
    duration integer DEFAULT 0,
    status character varying(50),
    recording_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    lead_id uuid,
    deal_id uuid,
    company_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    provider character varying(50) DEFAULT 'ringcentral'::character varying,
    rc_session_id character varying(255),
    rc_call_id character varying(255),
    call_result character varying(100),
    transcript text,
    ai_summary text,
    ai_recap text,
    from_name character varying(255),
    to_name character varying(255),
    from_number character varying(50),
    to_number character varying(50)
);


ALTER TABLE public.call_logs OWNER TO postgres;

--
-- Name: candidate_application_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_application_forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    requisition_id uuid,
    form_data jsonb NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    generated_by uuid,
    submitted_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.candidate_application_forms OWNER TO postgres;

--
-- Name: TABLE candidate_application_forms; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.candidate_application_forms IS 'Generated application forms for candidates';


--
-- Name: candidate_interviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    requisition_id uuid,
    interview_type character varying(50) NOT NULL,
    interview_date date,
    interview_time time without time zone,
    interviewer_id uuid,
    interviewer_name character varying(255),
    technical_skills text,
    communication text,
    problem_solving text,
    culture_fit text,
    overall_remarks text,
    recommendation character varying(50),
    status character varying(50) DEFAULT 'scheduled'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    final_result character varying(50),
    CONSTRAINT candidate_interviews_status_check CHECK (((status)::text = ANY ((ARRAY['scheduled'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[]))),
    CONSTRAINT final_result_check CHECK (((final_result IS NULL) OR ((final_result)::text = ANY ((ARRAY['selected'::character varying, 'rejected'::character varying])::text[]))))
);


ALTER TABLE public.candidate_interviews OWNER TO postgres;

--
-- Name: TABLE candidate_interviews; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.candidate_interviews IS 'Interview records and evaluations';


--
-- Name: COLUMN candidate_interviews.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidate_interviews.status IS 'Interview status: scheduled, in_progress, completed, cancelled';


--
-- Name: COLUMN candidate_interviews.final_result; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidate_interviews.final_result IS 'Final decision: selected or rejected (null if not yet decided)';


--
-- Name: candidate_rankings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_rankings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    requisition_id uuid,
    total_score numeric(8,2),
    rank_position integer,
    percentile numeric(5,2),
    technical_score numeric(8,2),
    behavioral_score numeric(8,2),
    experience_score numeric(8,2),
    education_score numeric(8,2),
    is_current boolean DEFAULT true,
    ranking_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    calculated_by uuid
);


ALTER TABLE public.candidate_rankings OWNER TO postgres;

--
-- Name: candidate_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    criteria_id uuid,
    interview_id uuid,
    raw_score integer,
    weighted_score numeric(8,2),
    comments text,
    scored_by uuid,
    scorer_name character varying(255),
    scorer_role character varying(100),
    scored_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT candidate_scores_raw_score_check CHECK (((raw_score >= 0) AND (raw_score <= 100)))
);


ALTER TABLE public.candidate_scores OWNER TO postgres;

--
-- Name: TABLE candidate_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.candidate_scores IS 'Multi-criteria candidate scoring system';


--
-- Name: candidate_timeline; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidate_timeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    activity_type character varying(100) NOT NULL,
    description text,
    performed_by uuid,
    performed_by_name character varying(255),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.candidate_timeline OWNER TO postgres;

--
-- Name: TABLE candidate_timeline; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.candidate_timeline IS 'Activity log for candidate journey';


--
-- Name: candidates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid,
    full_name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    alternate_phone character varying(50),
    cnic character varying(50),
    date_of_birth date,
    gender character varying(20),
    marital_status character varying(50),
    nationality character varying(100) DEFAULT 'Pakistani'::character varying,
    religion character varying(50),
    current_address text,
    permanent_address text,
    highest_qualification character varying(255),
    university character varying(255),
    graduation_year integer,
    cgpa character varying(20),
    total_experience character varying(100),
    current_company character varying(255),
    current_designation character varying(255),
    current_salary character varying(100),
    expected_salary character varying(100),
    notice_period character varying(100),
    applied_position character varying(255),
    grade character varying(50),
    department character varying(100),
    reference1_name character varying(255),
    reference1_contact character varying(100),
    reference1_relation character varying(100),
    reference2_name character varying(255),
    reference2_contact character varying(100),
    reference2_relation character varying(100),
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(100),
    emergency_contact_relation character varying(100),
    cv_url text,
    cv_filename character varying(255),
    form_token character varying(255),
    form_token_expires_at timestamp without time zone,
    father_name character varying(255),
    father_occupation character varying(255),
    mobile_no character varying(50),
    blood_group character varying(10),
    number_of_children integer DEFAULT 0,
    residence_type character varying(50),
    academic_records jsonb,
    work_experience jsonb,
    joining_availability character varying(255),
    status character varying(50) DEFAULT 'cv_received'::character varying,
    source character varying(100),
    skills text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    screening_notes text,
    screening_date timestamp without time zone,
    screened_by uuid,
    screened_by_name character varying(255),
    interview_date date,
    interview_time time without time zone,
    interview_location character varying(255),
    interview_type character varying(100),
    leadership_experience text,
    strategic_planning text,
    budget_management text,
    team_size_managed integer,
    project_management text,
    technical_skills text,
    certifications text,
    internship_experience text,
    academic_projects text,
    extracurricular text,
    form_status character varying(50) DEFAULT NULL::character varying,
    CONSTRAINT candidates_status_check CHECK (((status)::text = ANY ((ARRAY['cv_received'::character varying, 'screened_passed'::character varying, 'screened_failed'::character varying, 'shortlisted'::character varying, 'interview_scheduled'::character varying, 'interviewed'::character varying, 'final_round'::character varying, 'form_generated'::character varying, 'offer_pending'::character varying, 'offer_sent'::character varying, 'offer_accepted'::character varying, 'offer_rejected'::character varying, 'selected'::character varying, 'rejected'::character varying, 'hired'::character varying, 'onboarding'::character varying])::text[])))
);


ALTER TABLE public.candidates OWNER TO postgres;

--
-- Name: TABLE candidates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.candidates IS 'Candidate information and applications';


--
-- Name: COLUMN candidates.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.status IS 'Candidate status throughout recruitment lifecycle including offer management';


--
-- Name: COLUMN candidates.screening_notes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.screening_notes IS 'Notes from initial CV screening process';


--
-- Name: COLUMN candidates.screening_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.screening_date IS 'Date when screening was completed';


--
-- Name: COLUMN candidates.screened_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.screened_by IS 'User who performed the screening';


--
-- Name: COLUMN candidates.interview_date; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.interview_date IS 'Scheduled interview date';


--
-- Name: COLUMN candidates.interview_time; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.interview_time IS 'Scheduled interview time';


--
-- Name: COLUMN candidates.interview_location; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.interview_location IS 'Interview location or meeting link';


--
-- Name: COLUMN candidates.leadership_experience; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.leadership_experience IS 'Leadership experience for senior positions';


--
-- Name: COLUMN candidates.project_management; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.project_management IS 'Project management experience for mid-level positions';


--
-- Name: COLUMN candidates.academic_projects; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.candidates.academic_projects IS 'Academic projects for entry-level positions';


--
-- Name: car_activity_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_activity_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid,
    car_id uuid,
    activity_type character varying(100) NOT NULL,
    description text NOT NULL,
    changes jsonb,
    user_id uuid,
    user_name character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_activity_log OWNER TO postgres;

--
-- Name: TABLE car_activity_log; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_activity_log IS 'Activity tracking for audit trail';


--
-- Name: car_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    car_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    mime_type character varying(100),
    expiry_date date,
    notes text,
    uploaded_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_documents OWNER TO postgres;

--
-- Name: car_inquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_inquiries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    car_id uuid NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50),
    contact_id uuid,
    inquiry_type character varying(50) DEFAULT 'general'::character varying,
    message text,
    preferred_contact_method character varying(50),
    preferred_contact_time character varying(100),
    status character varying(50) DEFAULT 'new'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    assigned_to uuid,
    follow_up_date date,
    follow_up_notes text,
    source character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_inquiries OWNER TO postgres;

--
-- Name: TABLE car_inquiries; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_inquiries IS 'Customer inquiries about specific cars';


--
-- Name: car_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_inventory (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    stock_number character varying(100),
    vin character varying(17),
    make character varying(100) NOT NULL,
    model character varying(100) NOT NULL,
    year integer NOT NULL,
    trim_level character varying(100),
    body_type character varying(50),
    exterior_color character varying(50),
    interior_color character varying(50),
    transmission character varying(50),
    fuel_type character varying(50),
    engine_size character varying(50),
    cylinders integer,
    drivetrain character varying(50),
    condition character varying(50) DEFAULT 'used'::character varying,
    mileage integer DEFAULT 0,
    mileage_unit character varying(10) DEFAULT 'km'::character varying,
    purchase_price numeric(12,2),
    selling_price numeric(12,2) NOT NULL,
    msrp numeric(12,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'available'::character varying,
    availability_date date,
    sold_date date,
    reserved_by uuid,
    reserved_until timestamp without time zone,
    features jsonb DEFAULT '[]'::jsonb,
    standard_features text,
    optional_features text,
    doors integer,
    seats integer,
    mpg_city numeric(5,2),
    mpg_highway numeric(5,2),
    horsepower integer,
    torque integer,
    previous_owners integer DEFAULT 0,
    accident_history boolean DEFAULT false,
    service_history text,
    warranty_info text,
    registration_number character varying(100),
    registration_expiry date,
    insurance_expiry date,
    primary_image character varying(500),
    images jsonb DEFAULT '[]'::jsonb,
    video_url character varying(500),
    location character varying(255),
    warehouse_id uuid,
    description text,
    internal_notes text,
    tags character varying[] DEFAULT '{}'::character varying[],
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_inventory OWNER TO postgres;

--
-- Name: TABLE car_inventory; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_inventory IS 'Main car inventory with all vehicle details';


--
-- Name: car_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_sales (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    car_id uuid NOT NULL,
    sale_number character varying(100),
    sale_date date NOT NULL,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50),
    customer_address text,
    contact_id uuid,
    sale_price numeric(12,2) NOT NULL,
    down_payment numeric(12,2) DEFAULT 0,
    trade_in_value numeric(12,2) DEFAULT 0,
    trade_in_vehicle character varying(255),
    financing_amount numeric(12,2) DEFAULT 0,
    financing_term integer,
    interest_rate numeric(5,2),
    monthly_payment numeric(12,2),
    tax_amount numeric(12,2) DEFAULT 0,
    registration_fee numeric(12,2) DEFAULT 0,
    documentation_fee numeric(12,2) DEFAULT 0,
    other_fees numeric(12,2) DEFAULT 0,
    total_amount numeric(12,2) NOT NULL,
    payment_method character varying(50),
    payment_status character varying(50) DEFAULT 'pending'::character varying,
    amount_paid numeric(12,2) DEFAULT 0,
    balance_due numeric(12,2),
    delivery_date date,
    delivery_status character varying(50) DEFAULT 'pending'::character varying,
    sales_rep uuid,
    finance_manager uuid,
    contract_signed boolean DEFAULT false,
    contract_url character varying(500),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_sales OWNER TO postgres;

--
-- Name: TABLE car_sales; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_sales IS 'Completed car sales transactions';


--
-- Name: car_service_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_service_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    car_id uuid NOT NULL,
    service_date date NOT NULL,
    service_type character varying(100) NOT NULL,
    description text NOT NULL,
    mileage_at_service integer,
    cost numeric(10,2),
    service_provider character varying(255),
    invoice_number character varying(100),
    next_service_due date,
    next_service_mileage integer,
    performed_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_service_history OWNER TO postgres;

--
-- Name: TABLE car_service_history; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_service_history IS 'Service and maintenance history for each car';


--
-- Name: car_test_drives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_test_drives (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    car_id uuid NOT NULL,
    inquiry_id uuid,
    customer_name character varying(255) NOT NULL,
    customer_email character varying(255),
    customer_phone character varying(50) NOT NULL,
    customer_license character varying(100),
    contact_id uuid,
    scheduled_date date NOT NULL,
    scheduled_time time without time zone NOT NULL,
    duration_minutes integer DEFAULT 30,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    start_mileage integer,
    end_mileage integer,
    route_taken text,
    sales_rep uuid,
    notes text,
    customer_feedback text,
    interested_level character varying(50),
    follow_up_required boolean DEFAULT true,
    follow_up_date date,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.car_test_drives OWNER TO postgres;

--
-- Name: TABLE car_test_drives; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_test_drives IS 'Test drive bookings and history';


--
-- Name: car_workspace_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_workspace_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    permissions jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_workspace_members OWNER TO postgres;

--
-- Name: TABLE car_workspace_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_workspace_members IS 'Users assigned to specific workspaces';


--
-- Name: car_workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.car_workspaces (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    workspace_type character varying(50) DEFAULT 'dealership'::character varying,
    location character varying(255),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    phone character varying(50),
    email character varying(255),
    admin_id uuid,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.car_workspaces OWNER TO postgres;

--
-- Name: TABLE car_workspaces; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.car_workspaces IS 'Separate workspaces for different dealerships/branches';


--
-- Name: chat_mentions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.chat_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    message_id uuid NOT NULL,
    message_type character varying(50) NOT NULL,
    mentioned_user_id uuid NOT NULL,
    mentioned_by uuid NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.chat_mentions OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    industry character varying(100),
    website character varying(255),
    phone character varying(50),
    email character varying(255),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    employee_count integer,
    annual_revenue numeric(15,2),
    description text,
    logo_url character varying(500),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    revenue numeric(15,2),
    notes text,
    org_id uuid,
    owner_id uuid,
    linkedin_url character varying(255)
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: connected_drives; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connected_drives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    ownership character varying(50) NOT NULL,
    drive_type character varying(50) NOT NULL,
    display_name character varying(255) NOT NULL,
    network_path text,
    network_protocol character varying(50),
    connected_by uuid,
    settings jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    access_token text,
    refresh_token text,
    token_expires_at timestamp with time zone,
    status character varying(50) DEFAULT 'available'::character varying
);


ALTER TABLE public.connected_drives OWNER TO postgres;

--
-- Name: connected_mailboxes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.connected_mailboxes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    provider character varying(50) NOT NULL,
    email_address character varying(255) NOT NULL,
    display_name character varying(255),
    access_token text,
    refresh_token text,
    token_expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    sync_status character varying(50) DEFAULT 'pending'::character varying,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    imap_host character varying(255),
    imap_port integer,
    smtp_host character varying(255),
    smtp_port integer,
    imap_username character varying(255),
    smtp_username character varying(255),
    encrypted_password text
);


ALTER TABLE public.connected_mailboxes OWNER TO postgres;

--
-- Name: contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    job_title character varying(100),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    website character varying(255),
    source character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    tags text[],
    notes text,
    last_contacted timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    company_name character varying(255),
    linkedin_url character varying(255),
    twitter_url character varying(255),
    score integer DEFAULT 0,
    "position" character varying(255),
    contact_type character varying(50) DEFAULT 'contact'::character varying,
    messenger character varying(255),
    available_to_everyone boolean DEFAULT true,
    included_in_export boolean DEFAULT true,
    second_name character varying(255),
    salutation character varying(50),
    dob date,
    photo_url text,
    website_type character varying(50),
    messenger_type character varying(50),
    source_info text,
    is_public boolean DEFAULT true,
    include_in_export boolean DEFAULT true,
    responsible_id uuid,
    observers uuid[],
    org_id uuid,
    lifecycle_stage character varying(50),
    owner_id uuid,
    lead_source character varying(100),
    company_id uuid,
    user_id uuid
);


ALTER TABLE public.contacts OWNER TO postgres;

--
-- Name: crm_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    activity_type character varying(100),
    title character varying(255),
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.crm_activities OWNER TO postgres;

--
-- Name: COLUMN crm_activities.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.crm_activities.user_id IS 'NULL user_id indicates a System or Automated activity';


--
-- Name: crm_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    content text NOT NULL,
    is_edited boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_comments OWNER TO postgres;

--
-- Name: crm_custom_field_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_custom_field_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    key character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'string'::character varying,
    section_id character varying(100),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    after_field_id uuid
);


ALTER TABLE public.crm_custom_field_templates OWNER TO postgres;

--
-- Name: crm_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.crm_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    provider character varying(50) DEFAULT 'local'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.crm_documents OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    contact_id uuid,
    company_id uuid,
    customer_type character varying(50) DEFAULT 'individual'::character varying,
    status character varying(50) DEFAULT 'active'::character varying,
    lifetime_value numeric(15,2) DEFAULT 0,
    total_purchases integer DEFAULT 0,
    first_purchase_date date,
    last_purchase_date date,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    industry character varying(100),
    converted_from_lead_id uuid,
    converted_from_deal_id uuid,
    org_id uuid,
    user_id uuid,
    name character varying(255),
    email character varying(255),
    phone character varying(50),
    tier character varying(50),
    total_revenue numeric(15,2) DEFAULT 0,
    tags jsonb DEFAULT '[]'::jsonb,
    lead_id uuid,
    deal_id uuid
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: deal_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    primary_contact boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.deal_contacts OWNER TO postgres;

--
-- Name: deal_signing_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deal_signing_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    deal_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    role character varying(100),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.deal_signing_parties OWNER TO postgres;

--
-- Name: deals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    title character varying(255) NOT NULL,
    description text,
    value numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    stage character varying(100) DEFAULT 'qualification'::character varying,
    probability integer DEFAULT 0,
    expected_close_date date,
    contact_id uuid,
    company_id uuid,
    assigned_to uuid,
    status character varying(50) DEFAULT 'open'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    source character varying(100),
    campaign_id uuid,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    org_id uuid,
    converted_from_lead_id uuid,
    converted_to_customer_id uuid,
    contact_name text,
    company_name text,
    phone text,
    email text,
    priority text DEFAULT 'medium'::text,
    designation text,
    website text,
    address text,
    company_phone text,
    company_email text,
    company_size text,
    agent_name text,
    decision_maker text,
    service_interested text,
    interaction_notes text,
    first_message text,
    last_touch timestamp with time zone,
    external_source_id text,
    workspace_id uuid,
    source_info text,
    phone_type text DEFAULT 'work'::text,
    email_type text DEFAULT 'work'::text,
    website_type text DEFAULT 'corporate'::text,
    customer_type text,
    last_contacted_date date,
    next_follow_up_date timestamp with time zone,
    responsible_person uuid,
    owner_id uuid,
    lost_reason text,
    won_at timestamp without time zone,
    lost_at timestamp without time zone,
    user_id uuid,
    linked_company_name character varying(255),
    linked_company_phone character varying(50),
    linked_company_email character varying(255),
    contact_first_name character varying(255),
    contact_last_name character varying(255),
    contact_email character varying(255),
    contact_phone character varying(50),
    tags text[],
    lead_id uuid,
    available_to_everyone boolean DEFAULT true,
    client_type text,
    project_type text,
    scope text,
    feedback text,
    feedback_details text,
    payment_method text,
    invoice_link text,
    qa_status text,
    quotation_received text,
    hours_of_work text,
    hourly_rate numeric(10,2),
    hourly_rate_currency text DEFAULT 'USD'::text,
    proposal_amount numeric(15,2),
    proposal_currency text DEFAULT 'USD'::text,
    invoice_amount numeric(15,2),
    invoice_currency text DEFAULT 'USD'::text,
    project_blueprints jsonb DEFAULT '[]'::jsonb,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    import_id uuid,
    created_by uuid,
    pipeline character varying(100),
    deadline date,
    campaign_name character varying(255),
    contact_person character varying(255),
    industry character varying(255)
);


ALTER TABLE public.deals OWNER TO postgres;

--
-- Name: COLUMN deals.description; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.description IS 'Detailed description of the deal';


--
-- Name: COLUMN deals.source; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.source IS 'Lead source: website, referral, linkedin, etc.';


--
-- Name: COLUMN deals.contact_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.contact_name IS 'Name of the primary contact person';


--
-- Name: COLUMN deals.company_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.company_name IS 'Name of the company';


--
-- Name: COLUMN deals.phone; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.phone IS 'Contact phone number';


--
-- Name: COLUMN deals.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.email IS 'Contact email address';


--
-- Name: COLUMN deals.priority; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.deals.priority IS 'Deal priority: low, medium, high, urgent';


--
-- Name: direct_messages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.direct_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    content_type character varying(50) DEFAULT 'text'::character varying,
    attachments jsonb DEFAULT '[]'::jsonb,
    reactions jsonb DEFAULT '{}'::jsonb,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    is_deleted boolean DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.direct_messages OWNER TO postgres;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'contract'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    content text,
    file_path character varying(500),
    file_name character varying(255),
    file_size bigint,
    mime_type character varying(100),
    signers jsonb DEFAULT '[]'::jsonb,
    company_id uuid,
    contact_id uuid,
    expiry_date timestamp without time zone,
    notes text,
    signed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: TABLE documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.documents IS 'Documents for signing and vault management';


--
-- Name: COLUMN documents.type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.type IS 'Document type: contract, nda, purchase_order, invoice, certificate';


--
-- Name: COLUMN documents.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.status IS 'Document status: draft, pending, signed, completed, cancelled';


--
-- Name: COLUMN documents.file_path; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.file_path IS 'Relative path to uploaded file';


--
-- Name: COLUMN documents.file_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.file_name IS 'Original filename';


--
-- Name: COLUMN documents.file_size; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.file_size IS 'File size in bytes';


--
-- Name: COLUMN documents.mime_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.mime_type IS 'MIME type of the uploaded file';


--
-- Name: COLUMN documents.signers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.signers IS 'Array of signer information (names, emails, status)';


--
-- Name: COLUMN documents.signed_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.documents.signed_at IS 'Timestamp when document was signed/completed';


--
-- Name: drive_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    file_id uuid,
    folder_id uuid,
    activity_type character varying(50) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_activities OWNER TO postgres;

--
-- Name: drive_file_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_file_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    file_id uuid,
    version_number integer NOT NULL,
    file_path character varying(1000),
    file_size bigint,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_file_versions OWNER TO postgres;

--
-- Name: drive_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_files (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(100),
    folder_path character varying(500) DEFAULT '/'::character varying,
    is_public boolean DEFAULT false,
    shared_with uuid[],
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    folder_id uuid,
    size bigint DEFAULT 0,
    mime_type character varying(255),
    is_folder boolean DEFAULT false,
    parent_id uuid,
    path character varying(1000),
    original_name character varying(500),
    file_path character varying(1000),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    version integer DEFAULT 1,
    is_starred boolean DEFAULT false,
    permissions jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.drive_files OWNER TO postgres;

--
-- Name: drive_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_folders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    name character varying(255) NOT NULL,
    parent_id uuid,
    path character varying(1000),
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    parent_folder_id uuid,
    color character varying(50) DEFAULT 'folder-blue'::character varying,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone
);


ALTER TABLE public.drive_folders OWNER TO postgres;

--
-- Name: drive_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drive_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    drive_id uuid,
    org_id uuid,
    user_id uuid,
    role uuid,
    access_level character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.drive_permissions OWNER TO postgres;

--
-- Name: email_crm_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_crm_links (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    email_id uuid,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    link_type character varying(50) DEFAULT 'converted'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_crm_links OWNER TO postgres;

--
-- Name: emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.emails (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    mailbox_id uuid,
    from_email character varying(255) NOT NULL,
    to_email character varying(255) NOT NULL,
    cc_email text,
    bcc_email text,
    subject character varying(500),
    body text,
    html_body text,
    snippet text,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    folder character varying(50) DEFAULT 'inbox'::character varying,
    thread_id character varying(255),
    message_id character varying(255),
    in_reply_to character varying(255),
    attachments jsonb DEFAULT '[]'::jsonb,
    received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    labels text[],
    has_attachments boolean DEFAULT false
);


ALTER TABLE public.emails OWNER TO postgres;

--
-- Name: employee_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    org_id uuid NOT NULL,
    document_type character varying(100) NOT NULL,
    document_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size integer,
    uploaded_by uuid NOT NULL,
    uploaded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    is_verified boolean DEFAULT false,
    verified_by uuid,
    verified_at timestamp with time zone
);


ALTER TABLE public.employee_documents OWNER TO postgres;

--
-- Name: TABLE employee_documents; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_documents IS 'Stores employee document uploads';


--
-- Name: employee_leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_leave_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    org_id uuid NOT NULL,
    year integer NOT NULL,
    total_allocated numeric(5,2) DEFAULT 0 NOT NULL,
    used numeric(5,2) DEFAULT 0 NOT NULL,
    pending numeric(5,2) DEFAULT 0 NOT NULL,
    available numeric(5,2) GENERATED ALWAYS AS (((total_allocated - used) - pending)) STORED,
    carried_forward numeric(5,2) DEFAULT 0,
    expires_on date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    remaining numeric(5,2) DEFAULT 0,
    last_monthly_reset date
);


ALTER TABLE public.employee_leave_balances OWNER TO postgres;

--
-- Name: TABLE employee_leave_balances; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.employee_leave_balances IS 'Employee leave balance tracking per year';


--
-- Name: employee_product_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_product_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    status character varying(50) DEFAULT 'assigned'::character varying,
    assigned_date date DEFAULT CURRENT_DATE,
    return_date date,
    condition_at_assignment character varying(100),
    condition_at_return character varying(100),
    notes text,
    assigned_by uuid,
    returned_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.employee_product_assignments OWNER TO postgres;

--
-- Name: employee_salaries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employee_salaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    basic_salary numeric(10,2) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.employee_salaries OWNER TO postgres;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    employee_code character varying(50),
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    date_of_birth date,
    gender character varying(20),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    department character varying(100),
    "position" character varying(100),
    employment_type character varying(50) DEFAULT 'full-time'::character varying,
    join_date date,
    termination_date date,
    salary numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    bank_account character varying(100),
    tax_id character varying(100),
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(50),
    status character varying(50) DEFAULT 'active'::character varying,
    profile_picture_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manager_id uuid,
    employee_id character varying(50),
    org_id uuid,
    name character varying(255),
    job_title character varying(255),
    hire_date date,
    created_by uuid,
    reporting_manager_id uuid,
    work_email character varying(255),
    probation_end_date date,
    contract_type character varying(50),
    blood_group character varying(10),
    marital_status character varying(20),
    nationality character varying(100),
    updated_by uuid,
    profile_picture character varying(500),
    emergency_contact_relationship character varying(100),
    secondary_phone character varying(50),
    official_email character varying(255),
    personal_email character varying(255),
    cnic character varying(50),
    cnic_picture text,
    religion character varying(50),
    probation_status character varying(50),
    commission_rate numeric(5,2),
    base_salary numeric(12,2),
    permanent_address text,
    current_address text,
    bank_name character varying(255),
    bank_account_number character varying(100),
    bank_account_title character varying(255),
    education_level character varying(100),
    university character varying(255),
    emergency_contact_relation character varying(100),
    degree character varying(255),
    graduation_year integer,
    previous_company character varying(255),
    previous_position character varying(255),
    years_of_experience integer,
    skills text[],
    certifications text[],
    languages text[]
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: entity_drive_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.entity_drive_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    drive_connection_id uuid,
    file_id character varying(255) NOT NULL,
    file_name character varying(255) NOT NULL,
    mime_type character varying(100),
    file_size bigint,
    web_view_link text,
    thumbnail_link text,
    folder_path text,
    linked_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.entity_drive_files OWNER TO postgres;

--
-- Name: fcm_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fcm_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token text NOT NULL,
    device_type character varying(20),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.fcm_tokens OWNER TO postgres;

--
-- Name: finance_accounting_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_accounting_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    fiscal_year_id uuid NOT NULL,
    month character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(50) DEFAULT 'open'::character varying
);


ALTER TABLE public.finance_accounting_periods OWNER TO postgres;

--
-- Name: finance_approval_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_approval_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    module character varying(100) NOT NULL,
    approval_level character varying(50) NOT NULL,
    approver_id uuid
);


ALTER TABLE public.finance_approval_rules OWNER TO postgres;

--
-- Name: finance_bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_bank_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    bank_name character varying(255) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_number character varying(100) NOT NULL,
    iban character varying(100),
    swift character varying(50),
    currency uuid,
    chart_of_account_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_bank_accounts OWNER TO postgres;

--
-- Name: finance_bank_reconciliations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_bank_reconciliations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    statement_date date DEFAULT CURRENT_DATE NOT NULL,
    statement_balance numeric(18,2) DEFAULT 0.00 NOT NULL,
    ledger_balance numeric(18,2) DEFAULT 0.00 NOT NULL,
    difference numeric(18,2) DEFAULT 0.00 NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    reconciled_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_bank_reconciliations OWNER TO postgres;

--
-- Name: finance_bank_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_bank_transfers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    from_bank_account_id uuid NOT NULL,
    to_bank_account_id uuid NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    transfer_date date DEFAULT CURRENT_DATE NOT NULL,
    reference character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_bank_transfers OWNER TO postgres;

--
-- Name: finance_budgets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_budgets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    department_id character varying(100) NOT NULL,
    project_id uuid,
    budget_amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    forecast_amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    fiscal_year character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_budgets OWNER TO postgres;

--
-- Name: finance_chart_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_chart_accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    account_code character varying(100) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    parent_account uuid,
    opening_balance numeric(18,2) DEFAULT 0.00,
    currency uuid,
    status character varying(50) DEFAULT 'active'::character varying
);


ALTER TABLE public.finance_chart_accounts OWNER TO postgres;

--
-- Name: finance_cost_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_cost_centers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    department_id character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL
);


ALTER TABLE public.finance_cost_centers OWNER TO postgres;

--
-- Name: finance_credit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_credit_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_credit_notes OWNER TO postgres;

--
-- Name: finance_currencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_currencies (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    currency_name character varying(100) NOT NULL,
    currency_code character varying(10) NOT NULL,
    symbol character varying(10)
);


ALTER TABLE public.finance_currencies OWNER TO postgres;

--
-- Name: finance_customer_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_customer_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    invoice_number character varying(100) NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    currency uuid,
    subtotal numeric(18,2) DEFAULT 0.00 NOT NULL,
    tax numeric(18,2) DEFAULT 0.00 NOT NULL,
    discount numeric(18,2) DEFAULT 0.00 NOT NULL,
    total numeric(18,2) DEFAULT 0.00 NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_customer_invoices OWNER TO postgres;

--
-- Name: finance_customer_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_customer_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method character varying(100) NOT NULL,
    bank_account uuid NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    reference character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_customer_payments OWNER TO postgres;

--
-- Name: finance_debit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_debit_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    note_date date DEFAULT CURRENT_DATE NOT NULL,
    reason text NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_debit_notes OWNER TO postgres;

--
-- Name: finance_exchange_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_exchange_rates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    from_currency uuid NOT NULL,
    to_currency uuid NOT NULL,
    rate numeric(18,6) NOT NULL,
    effective_date date NOT NULL
);


ALTER TABLE public.finance_exchange_rates OWNER TO postgres;

--
-- Name: finance_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    department_id character varying(100) NOT NULL,
    expense_type character varying(100) NOT NULL,
    currency uuid,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    approved_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_expenses OWNER TO postgres;

--
-- Name: finance_fiscal_years; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_fiscal_years (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    year_name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid
);


ALTER TABLE public.finance_fiscal_years OWNER TO postgres;

--
-- Name: finance_journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_journal_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    entry_number character varying(100) NOT NULL,
    entry_date date NOT NULL,
    description text,
    reference character varying(100),
    status character varying(50) DEFAULT 'draft'::character varying,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_journal_entries OWNER TO postgres;

--
-- Name: finance_journal_entry_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_journal_entry_lines (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    journal_entry_id uuid NOT NULL,
    account_id uuid NOT NULL,
    debit numeric(18,2) DEFAULT 0.00,
    credit numeric(18,2) DEFAULT 0.00,
    cost_center_id uuid,
    profit_center_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_journal_entry_lines OWNER TO postgres;

--
-- Name: finance_payment_terms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_payment_terms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    days integer DEFAULT 0 NOT NULL,
    description text
);


ALTER TABLE public.finance_payment_terms OWNER TO postgres;

--
-- Name: finance_profit_centers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_profit_centers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50) NOT NULL,
    manager_id uuid
);


ALTER TABLE public.finance_profit_centers OWNER TO postgres;

--
-- Name: finance_recurring_expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_recurring_expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    expense_type character varying(100) NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    currency uuid,
    frequency character varying(50) NOT NULL,
    next_due_date date DEFAULT CURRENT_DATE NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_recurring_expenses OWNER TO postgres;

--
-- Name: finance_vendor_bills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_vendor_bills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id uuid NOT NULL,
    purchase_order_id uuid,
    invoice_number character varying(100) NOT NULL,
    invoice_date date DEFAULT CURRENT_DATE NOT NULL,
    due_date date,
    currency uuid,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    organization_id uuid
);


ALTER TABLE public.finance_vendor_bills OWNER TO postgres;

--
-- Name: finance_vendor_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.finance_vendor_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    vendor_id uuid NOT NULL,
    vendor_bill_id uuid NOT NULL,
    payment_date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method character varying(100) NOT NULL,
    bank_account uuid NOT NULL,
    amount numeric(18,2) DEFAULT 0.00 NOT NULL,
    reference character varying(100),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.finance_vendor_payments OWNER TO postgres;

--
-- Name: hrms_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hrms_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    type character varying(50) DEFAULT 'info'::character varying NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notification_type character varying(100),
    user_id uuid,
    created_by uuid,
    priority character varying(50) DEFAULT 'normal'::character varying,
    action_url text,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.hrms_notifications OWNER TO postgres;

--
-- Name: instantly_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instantly_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    api_key_encrypted text,
    webhook_secret text,
    webhook_url text,
    registered_webhook_ids jsonb DEFAULT '[]'::jsonb,
    is_enabled boolean DEFAULT false,
    status text DEFAULT 'disconnected'::text,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    auto_add_leads boolean DEFAULT false
);


ALTER TABLE public.instantly_integrations OWNER TO postgres;

--
-- Name: instantly_unibox_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instantly_unibox_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    sender_email text,
    sender_name text,
    subject text,
    body_text text,
    phone text,
    lead_id uuid,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    received_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.instantly_unibox_events OWNER TO postgres;

--
-- Name: instantly_webhook_health; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instantly_webhook_health (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    webhook_url text NOT NULL,
    status text DEFAULT 'healthy'::text,
    total_received integer DEFAULT 0,
    total_processed integer DEFAULT 0,
    total_failed integer DEFAULT 0,
    last_received_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.instantly_webhook_health OWNER TO postgres;

--
-- Name: instantly_webhook_raw_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instantly_webhook_raw_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id text NOT NULL,
    headers jsonb,
    payload jsonb,
    status text,
    note text,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.instantly_webhook_raw_log OWNER TO postgres;

--
-- Name: instantly_webhook_registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.instantly_webhook_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    event_type text NOT NULL,
    webhook_id text NOT NULL,
    webhook_url text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.instantly_webhook_registrations OWNER TO postgres;

--
-- Name: interview_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.interview_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    interview_id uuid,
    candidate_id uuid,
    feedback_by uuid,
    feedback_by_name character varying(255),
    feedback_by_role character varying(100),
    rating integer,
    comments text,
    recommendation character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT interview_feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


ALTER TABLE public.interview_feedback OWNER TO postgres;

--
-- Name: TABLE interview_feedback; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.interview_feedback IS 'Collaborative feedback from multiple interviewers';


--
-- Name: invites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'employee'::text NOT NULL,
    phone text,
    "position" text,
    department text,
    module_permissions jsonb DEFAULT '{}'::jsonb,
    invite_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    invite_expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '24:00:00'::interval),
    organization_id uuid,
    created_by uuid
);


ALTER TABLE public.invites OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid,
    product_id uuid,
    description text NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    discount_percent numeric(5,2) DEFAULT 0,
    total_price numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    invoice_number character varying(100) NOT NULL,
    customer_id uuid,
    contact_id uuid,
    invoice_date date NOT NULL,
    due_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    paid_amount numeric(15,2) DEFAULT 0,
    balance_due numeric(15,2) DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    notes text,
    terms text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    payment_terms character varying(100),
    payment_method character varying(50),
    shipping_address text,
    shipping_cost numeric(15,2) DEFAULT 0,
    payment_status character varying(50),
    payment_date date
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: job_advertisements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_advertisements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    requirements text,
    benefits text,
    application_deadline date,
    status character varying(50) DEFAULT 'draft'::character varying,
    published_date timestamp without time zone,
    published_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.job_advertisements OWNER TO postgres;

--
-- Name: TABLE job_advertisements; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_advertisements IS 'Published job advertisements';


--
-- Name: job_offers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid,
    requisition_id uuid,
    offer_number character varying(50) NOT NULL,
    "position" character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    grade character varying(50),
    reporting_manager character varying(255),
    work_location character varying(255),
    employment_type character varying(50) DEFAULT 'full_time'::character varying,
    base_salary numeric(12,2) NOT NULL,
    currency character varying(10) DEFAULT 'PKR'::character varying,
    salary_frequency character varying(20) DEFAULT 'monthly'::character varying,
    bonus_percentage numeric(5,2),
    allowances jsonb,
    benefits text,
    start_date date NOT NULL,
    probation_period integer DEFAULT 90,
    notice_period integer DEFAULT 30,
    working_hours character varying(50) DEFAULT '9 AM - 6 PM'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    offer_sent_date timestamp without time zone,
    response_deadline date,
    accepted_date timestamp without time zone,
    rejected_date timestamp without time zone,
    rejection_reason text,
    created_by uuid,
    approved_by uuid,
    approved_date timestamp without time zone,
    special_conditions text,
    offer_letter_template text,
    offer_letter_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid
);


ALTER TABLE public.job_offers OWNER TO postgres;

--
-- Name: TABLE job_offers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_offers IS 'Comprehensive offer management with approval workflow';


--
-- Name: job_requisitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_requisitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id character varying(50) NOT NULL,
    "position" character varying(255) NOT NULL,
    department character varying(100) NOT NULL,
    number_of_positions integer DEFAULT 1 NOT NULL,
    job_description text NOT NULL,
    requirements text,
    request_type character varying(50) DEFAULT 'single'::character varying,
    urgency character varying(20) DEFAULT 'medium'::character varying,
    grade character varying(50),
    status character varying(50) DEFAULT 'pending_dept_head'::character varying,
    requested_by uuid,
    requested_by_name character varying(255),
    requested_by_email character varying(255),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid
);


ALTER TABLE public.job_requisitions OWNER TO postgres;

--
-- Name: TABLE job_requisitions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_requisitions IS 'Stores job requisition requests from departments';


--
-- Name: job_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.job_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    template_name character varying(255) NOT NULL,
    template_code character varying(50) NOT NULL,
    department character varying(100),
    position_level character varying(50),
    job_family character varying(100),
    grade character varying(50),
    job_title_template character varying(255),
    job_description_template text,
    key_responsibilities text,
    required_qualifications text,
    preferred_qualifications text,
    required_skills text[],
    preferred_skills text[],
    salary_range_min numeric(12,2),
    salary_range_max numeric(12,2),
    standard_benefits text,
    is_active boolean DEFAULT true,
    usage_count integer DEFAULT 0,
    created_by uuid,
    last_used_date timestamp without time zone,
    version character varying(10) DEFAULT '1.0'::character varying,
    parent_template_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid
);


ALTER TABLE public.job_templates OWNER TO postgres;

--
-- Name: TABLE job_templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.job_templates IS 'Standardized job description templates';


--
-- Name: lead_external_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_external_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    source_type character varying(50),
    api_key text,
    webhook_url text,
    config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workspace_id uuid
);


ALTER TABLE public.lead_external_sources OWNER TO postgres;

--
-- Name: lead_imports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    workspace_id uuid,
    imported_by uuid NOT NULL,
    source_type character varying(50),
    file_name character varying(255),
    file_path text,
    field_mapping jsonb,
    status character varying(50) DEFAULT 'processing'::character varying,
    total_rows integer DEFAULT 0,
    successful_imports integer DEFAULT 0,
    failed_imports integer DEFAULT 0,
    duplicate_skipped integer DEFAULT 0,
    error_log jsonb,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    entity_type character varying(50) DEFAULT 'lead'::character varying
);


ALTER TABLE public.lead_imports OWNER TO postgres;

--
-- Name: lead_workspace_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_workspace_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    granted_by uuid,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    access_level character varying(50) DEFAULT 'view'::character varying
);


ALTER TABLE public.lead_workspace_access OWNER TO postgres;

--
-- Name: lead_workspaces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lead_workspaces (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.lead_workspaces OWNER TO postgres;

--
-- Name: leads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    first_name character varying(100),
    last_name character varying(100),
    email character varying(255),
    phone character varying(50),
    company character varying(255),
    job_title character varying(100),
    source character varying(100),
    status character varying(50) DEFAULT 'new'::character varying,
    score integer DEFAULT 0,
    notes text,
    assigned_to uuid,
    converted_to_deal boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    workspace_id uuid,
    deal_id uuid,
    campaign_id uuid,
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    contact_id uuid,
    org_id uuid,
    converted_to_deal_id uuid,
    converted_at timestamp without time zone,
    external_source_id character varying(100),
    pipeline character varying(100),
    owner_id uuid,
    lead_source character varying(100),
    user_id uuid,
    company_id uuid,
    external_id character varying(255),
    name character varying(255),
    company_name character varying(255),
    company_email character varying(255),
    company_phone character varying(50),
    designation character varying(255),
    website character varying(255),
    address text,
    company_size character varying(50),
    agent_name character varying(255),
    decision_maker character varying(255),
    service_interested character varying(255),
    interaction_notes text,
    first_message text,
    last_touch timestamp with time zone,
    source_info jsonb,
    phone_type character varying(50),
    email_type character varying(50),
    website_type character varying(50),
    customer_type character varying(50),
    last_contacted_date timestamp with time zone,
    next_follow_up_date timestamp with time zone,
    responsible_person uuid,
    priority character varying(50),
    tags text[],
    expected_close_date date,
    description text,
    title character varying(255),
    stage character varying(100) DEFAULT 'new'::character varying,
    value numeric DEFAULT 0,
    currency character varying(10) DEFAULT 'USD'::character varying,
    import_id uuid,
    created_by uuid,
    updated_by uuid,
    is_converted boolean DEFAULT false,
    custom_fields jsonb DEFAULT '{}'::jsonb,
    campaign_name character varying(255),
    contact_person character varying(255),
    industry character varying(255),
    unibox_email_id uuid,
    instantly_email_id character varying(255)
);


ALTER TABLE public.leads OWNER TO postgres;

--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_balances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid,
    leave_type_id uuid,
    year integer NOT NULL,
    total_days numeric(5,2) DEFAULT 0,
    used_days numeric(5,2) DEFAULT 0,
    remaining_days numeric(5,2) DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_balances OWNER TO postgres;

--
-- Name: leave_request_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_request_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    leave_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    action character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.leave_request_comments OWNER TO postgres;

--
-- Name: TABLE leave_request_comments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_request_comments IS 'Comments and history for leave requests';


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    leave_type_id uuid NOT NULL,
    org_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    days_requested numeric(5,2) NOT NULL,
    half_day boolean DEFAULT false,
    reason text NOT NULL,
    attachment_path text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approver_id uuid,
    approved_at timestamp with time zone,
    rejection_reason text,
    emergency boolean DEFAULT false,
    contact_during_leave character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    approved_by uuid,
    attachments jsonb DEFAULT '[]'::jsonb,
    created_by uuid,
    updated_by uuid,
    half_day_period character varying(20),
    paid_status character varying(10) DEFAULT NULL::character varying,
    CONSTRAINT leave_requests_check CHECK ((end_date >= start_date)),
    CONSTRAINT leave_requests_days_requested_check CHECK ((days_requested > (0)::numeric)),
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text, ('cancelled'::character varying)::text])))
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: TABLE leave_requests; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_requests IS 'Leave requests with approval workflow';


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(20) NOT NULL,
    description text,
    color character varying(20) DEFAULT '#3B82F6'::character varying,
    days_allowed integer DEFAULT 0 NOT NULL,
    max_consecutive_days integer,
    min_days_notice integer DEFAULT 0,
    is_paid boolean DEFAULT true,
    requires_approval boolean DEFAULT true,
    can_carry_forward boolean DEFAULT false,
    max_carry_forward_days integer DEFAULT 0,
    expires_after_months integer,
    applicable_to character varying(20) DEFAULT 'all'::character varying,
    min_service_months integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid,
    days_per_year integer DEFAULT 0,
    org_id uuid,
    carry_forward boolean DEFAULT false,
    max_carry_forward integer DEFAULT 0,
    notice_days integer DEFAULT 0,
    created_by uuid,
    updated_by uuid,
    monthly_limit integer,
    resets_monthly boolean DEFAULT false
);


ALTER TABLE public.leave_types OWNER TO postgres;

--
-- Name: TABLE leave_types; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.leave_types IS 'Leave type definitions with policies and rules';


--
-- Name: marketing_ab_test_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_test_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    test_id uuid,
    variant_id uuid,
    contact_id uuid,
    opened boolean DEFAULT false,
    clicked boolean DEFAULT false,
    converted boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_ab_test_results OWNER TO postgres;

--
-- Name: marketing_ab_test_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_test_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    test_id uuid,
    variant_name character varying(100) NOT NULL,
    subject character varying(500),
    content text,
    design jsonb,
    sent_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    conversion_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_ab_test_variants OWNER TO postgres;

--
-- Name: marketing_ab_tests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_ab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    test_type character varying(50) DEFAULT 'subject_line'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    winner_criteria character varying(50) DEFAULT 'open_rate'::character varying,
    sample_size_percent integer DEFAULT 20,
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    winner_variant_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_ab_tests OWNER TO postgres;

--
-- Name: marketing_campaign_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    activity character varying(100) NOT NULL,
    description text,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_campaign_activities OWNER TO postgres;

--
-- Name: marketing_campaign_analytics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_analytics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    sent integer DEFAULT 0,
    delivered integer DEFAULT 0,
    opened integer DEFAULT 0,
    clicked integer DEFAULT 0,
    bounced integer DEFAULT 0,
    spam integer DEFAULT 0,
    unsubscribed integer DEFAULT 0,
    failed integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_campaign_analytics OWNER TO postgres;

--
-- Name: marketing_campaign_audiences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_audiences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    audience_type character varying(50),
    segment_id uuid,
    contact_id uuid,
    customer_id uuid,
    lead_id uuid,
    email character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketing_campaign_audiences_audience_type_check CHECK (((audience_type)::text = ANY ((ARRAY['Contact'::character varying, 'Lead'::character varying, 'Customer'::character varying, 'Manual Email'::character varying, 'Segment'::character varying])::text[])))
);


ALTER TABLE public.marketing_campaign_audiences OWNER TO postgres;

--
-- Name: marketing_campaign_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    campaign_id uuid,
    contact_id uuid,
    event_type character varying(50) NOT NULL,
    event_data jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    email character varying(255),
    opened_at timestamp without time zone,
    clicked_at timestamp without time zone
);


ALTER TABLE public.marketing_campaign_events OWNER TO postgres;

--
-- Name: marketing_campaign_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_recipients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    contact_id uuid,
    email character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    bounced_at timestamp with time zone,
    unsubscribed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketing_campaign_recipients_status_check CHECK (((status)::text = ANY ((ARRAY['Pending'::character varying, 'Queued'::character varying, 'Sending'::character varying, 'Delivered'::character varying, 'Opened'::character varying, 'Clicked'::character varying, 'Bounce'::character varying, 'Failed'::character varying, 'Unsubscribed'::character varying])::text[])))
);


ALTER TABLE public.marketing_campaign_recipients OWNER TO postgres;

--
-- Name: marketing_campaign_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaign_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    schedule_type character varying(50) DEFAULT 'once'::character varying,
    timezone character varying(50) DEFAULT 'UTC'::character varying,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    repeat_every character varying(50),
    next_run timestamp with time zone,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_campaign_schedules OWNER TO postgres;

--
-- Name: marketing_campaigns; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_campaigns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'email'::character varying,
    subject character varying(500),
    content text,
    list_id uuid,
    status character varying(50) DEFAULT 'draft'::character varying,
    scheduled_at timestamp without time zone,
    sent_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    campaign_type character varying(50) DEFAULT 'email'::character varying,
    channel character varying(50) DEFAULT 'email'::character varying,
    from_name character varying(255),
    from_email character varying(255),
    reply_to character varying(255),
    design jsonb,
    stats jsonb DEFAULT '{"sent": 0, "opened": 0, "bounced": 0, "clicked": 0, "delivered": 0, "unsubscribed": 0}'::jsonb,
    org_id uuid,
    segment_id uuid,
    sent_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    bounced_count integer DEFAULT 0,
    unsubscribed_count integer DEFAULT 0,
    template_id uuid
);


ALTER TABLE public.marketing_campaigns OWNER TO postgres;

--
-- Name: marketing_email_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    file_name character varying(255) NOT NULL,
    file_url text NOT NULL,
    file_size integer,
    mime_type character varying(100),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_attachments OWNER TO postgres;

--
-- Name: marketing_email_bounces; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_bounces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    bounce_type character varying(50),
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_bounces OWNER TO postgres;

--
-- Name: marketing_email_clicks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_clicks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    url text,
    ip_address character varying(50),
    device character varying(100),
    clicked_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_clicks OWNER TO postgres;

--
-- Name: marketing_email_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    provider character varying(100),
    message_id character varying(255),
    status character varying(50),
    response text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_logs OWNER TO postgres;

--
-- Name: marketing_email_opens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_opens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    ip_address character varying(50),
    country character varying(100),
    city character varying(100),
    device character varying(100),
    browser character varying(100),
    opened_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_opens OWNER TO postgres;

--
-- Name: marketing_email_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    recipient_id uuid,
    status character varying(50) DEFAULT 'Pending'::character varying NOT NULL,
    attempts integer DEFAULT 0,
    scheduled_at timestamp with time zone,
    processed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_queue OWNER TO postgres;

--
-- Name: marketing_email_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    provider character varying(50) DEFAULT 'SMTP'::character varying,
    host character varying(255),
    port integer,
    username character varying(255),
    password text,
    encryption character varying(20) DEFAULT 'TLS'::character varying,
    from_name character varying(255),
    from_email character varying(255),
    reply_to character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_settings OWNER TO postgres;

--
-- Name: marketing_email_unsubscribes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_email_unsubscribes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    contact_id uuid,
    email character varying(255) NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.marketing_email_unsubscribes OWNER TO postgres;

--
-- Name: marketing_form_submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_form_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    form_id uuid,
    contact_id uuid,
    data jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_form_submissions OWNER TO postgres;

--
-- Name: marketing_forms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_forms (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    list_id uuid,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    redirect_url character varying(500),
    thank_you_message text,
    submission_count integer DEFAULT 0,
    org_id uuid,
    success_message text,
    auto_add_to_list uuid
);


ALTER TABLE public.marketing_forms OWNER TO postgres;

--
-- Name: marketing_list_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_list_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    list_id uuid,
    contact_id uuid,
    status character varying(50) DEFAULT 'subscribed'::character varying,
    subscribed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_list_members OWNER TO postgres;

--
-- Name: marketing_lists; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_lists (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'static'::character varying,
    member_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    segment_rules jsonb,
    org_id uuid
);


ALTER TABLE public.marketing_lists OWNER TO postgres;

--
-- Name: marketing_scoring_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_scoring_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    contact_id uuid,
    rule_id uuid,
    score_change integer NOT NULL,
    reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_scoring_history OWNER TO postgres;

--
-- Name: marketing_scoring_rules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_scoring_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    rule_type character varying(50) NOT NULL,
    conditions jsonb NOT NULL,
    score_value integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_scoring_rules OWNER TO postgres;

--
-- Name: marketing_segments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_segments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    rules jsonb NOT NULL,
    contact_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.marketing_segments OWNER TO postgres;

--
-- Name: marketing_sequence_enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequence_enrollments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sequence_id uuid,
    contact_id uuid,
    current_step integer DEFAULT 0,
    status character varying(50) DEFAULT 'active'::character varying,
    enrolled_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    retry_count integer DEFAULT 0,
    next_retry_at timestamp without time zone
);


ALTER TABLE public.marketing_sequence_enrollments OWNER TO postgres;

--
-- Name: marketing_sequence_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequence_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sequence_id uuid,
    step_order integer NOT NULL,
    name character varying(255) NOT NULL,
    delay_days integer DEFAULT 0,
    delay_hours integer DEFAULT 0,
    email_subject character varying(500),
    email_content text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_sequence_steps OWNER TO postgres;

--
-- Name: marketing_sequences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_sequences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    trigger_type character varying(50) DEFAULT 'manual'::character varying,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    enrollment_count integer DEFAULT 0,
    org_id uuid,
    trigger_conditions jsonb DEFAULT '{}'::jsonb,
    steps jsonb DEFAULT '[]'::jsonb
);


ALTER TABLE public.marketing_sequences OWNER TO postgres;

--
-- Name: marketing_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    category character varying(100),
    subject character varying(500),
    content text,
    design jsonb,
    thumbnail_url character varying(500),
    is_public boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.marketing_templates OWNER TO postgres;

--
-- Name: marketing_webhook_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhook_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    webhook_id uuid,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    response_status integer,
    response_body text,
    attempt_count integer DEFAULT 1,
    success boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_webhook_logs OWNER TO postgres;

--
-- Name: marketing_webhook_queue; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhook_queue (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    webhook_id uuid,
    event_type character varying(50) NOT NULL,
    payload jsonb NOT NULL,
    attempts integer DEFAULT 0,
    next_retry_at timestamp without time zone,
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_webhook_queue OWNER TO postgres;

--
-- Name: marketing_webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.marketing_webhooks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    events text[] NOT NULL,
    secret_key character varying(255),
    is_active boolean DEFAULT true,
    retry_count integer DEFAULT 3,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.marketing_webhooks OWNER TO postgres;

--
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    executed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    subject character varying(500),
    body text,
    variables jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    user_id uuid,
    type character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    link character varying(500),
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    org_id uuid NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    target_user_id uuid NOT NULL,
    actor_user_id uuid,
    category character varying(40) DEFAULT 'general'::character varying NOT NULL,
    action_url character varying(500),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: offer_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.offer_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    offer_id uuid,
    step_number integer NOT NULL,
    approver_role character varying(100) NOT NULL,
    approver_id uuid,
    approver_name character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    comments text,
    action_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.offer_approvals OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    domain character varying(255),
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    logo_url character varying(500),
    attendance_machine_ip character varying(100),
    working_hours_per_day numeric(5,2) DEFAULT 9.00,
    break_time_hours numeric(5,2) DEFAULT 1.00,
    address text
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: payroll; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    employee_id uuid,
    period_start date NOT NULL,
    period_end date NOT NULL,
    basic_salary numeric(15,2) NOT NULL,
    allowances jsonb DEFAULT '{}'::jsonb,
    deductions jsonb DEFAULT '{}'::jsonb,
    gross_salary numeric(15,2) NOT NULL,
    net_salary numeric(15,2) NOT NULL,
    tax_amount numeric(15,2) DEFAULT 0,
    status character varying(50) DEFAULT 'draft'::character varying,
    paid_at timestamp without time zone,
    payment_method character varying(50),
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    payment_date date,
    bank_reference character varying(100),
    updated_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone
);


ALTER TABLE public.payroll OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: pipeline_stages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pipeline_stages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    pipeline character varying(100) DEFAULT 'default'::character varying,
    stage_key character varying(100) NOT NULL,
    stage_label character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    color character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    probability integer DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.pipeline_stages OWNER TO postgres;

--
-- Name: product_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    batch_number character varying(100) NOT NULL,
    expiration_date date,
    quantity integer DEFAULT 0,
    cost_per_unit numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    manufacturing_date date,
    expiry_date date,
    supplier_id uuid
);


ALTER TABLE public.product_batches OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    sku character varying(100),
    description text,
    category character varying(100),
    unit character varying(50) DEFAULT 'piece'::character varying,
    price numeric(15,2) DEFAULT 0,
    cost numeric(15,2) DEFAULT 0,
    tax_rate numeric(5,2) DEFAULT 0,
    barcode character varying(100),
    image_url character varying(500),
    is_active boolean DEFAULT true,
    min_stock_level integer DEFAULT 0,
    reorder_point integer,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    max_stock_level integer,
    valuation_method character varying(20) DEFAULT 'FIFO'::character varying,
    unit_price numeric(10,2) DEFAULT 0,
    cost_price numeric(10,2) DEFAULT 0,
    reorder_level integer DEFAULT 10,
    reorder_quantity integer DEFAULT 50,
    org_id uuid,
    initial_stock integer DEFAULT 0,
    supplier_id uuid,
    brand character varying(100),
    weight numeric(10,2),
    dimensions character varying(100),
    warranty_period integer,
    warranty_type character varying(50),
    tags text[],
    status character varying(50) DEFAULT 'active'::character varying
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    org_id uuid,
    full_name character varying(255),
    email character varying(255),
    avatar_url character varying(500),
    phone character varying(50),
    "position" character varying(100),
    department character varying(100),
    bio text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    job_title character varying(255),
    avatar character varying(500),
    location character varying(255),
    timezone character varying(100),
    language character varying(50)
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: project_activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    action character varying(100) NOT NULL,
    entity_type character varying(50),
    entity_id uuid,
    description text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    entity_name character varying(255)
);


ALTER TABLE public.project_activity_logs OWNER TO postgres;

--
-- Name: project_attachments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    task_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    file_name character varying(255) NOT NULL,
    file_path text NOT NULL,
    file_size bigint,
    file_type character varying(100),
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.project_attachments OWNER TO postgres;

--
-- Name: project_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    task_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    attachments jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.project_comments OWNER TO postgres;

--
-- Name: project_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_documents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_size integer,
    file_type character varying(100),
    uploaded_by uuid,
    uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_by uuid,
    updated_by uuid,
    version integer DEFAULT 1,
    is_archived boolean DEFAULT false
);


ALTER TABLE public.project_documents OWNER TO postgres;

--
-- Name: project_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_files (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    original_name character varying(255),
    file_path character varying(500),
    mime_type character varying(100),
    size_bytes bigint DEFAULT 0,
    folder character varying(100) DEFAULT 'General'::character varying,
    uploaded_by uuid,
    version character varying(20) DEFAULT 'v1.0'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.project_files OWNER TO postgres;

--
-- Name: project_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    invoice_number character varying(255) NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    issue_date date NOT NULL,
    due_date date,
    paid_date date,
    description text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT project_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'sent'::character varying, 'paid'::character varying, 'void'::character varying, 'overdue'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.project_invoices OWNER TO postgres;

--
-- Name: project_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    permissions jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.project_members OWNER TO postgres;

--
-- Name: project_milestone_assignees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_milestone_assignees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    milestone_id uuid NOT NULL,
    assigned_to uuid NOT NULL,
    assigned_by uuid NOT NULL,
    org_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.project_milestone_assignees OWNER TO postgres;

--
-- Name: project_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_milestones (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    name character varying(255) NOT NULL,
    description text,
    due_date date NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    progress integer DEFAULT 0,
    budget numeric,
    actual_cost numeric,
    color character varying(50),
    is_completed boolean DEFAULT false,
    created_by uuid,
    updated_by uuid,
    assigned_to uuid
);


ALTER TABLE public.project_milestones OWNER TO postgres;


CREATE TABLE public.independent_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    org_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    assigned_to uuid,
    due_date date,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_task_id uuid,
    start_date date,
    end_date date,
    estimated_hours numeric,
    actual_hours numeric,
    progress integer DEFAULT 0,
    tags text[],
    attachments jsonb,
    dependencies uuid[],
    watchers uuid[],
    completed_at timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(100),
    labels text[],
    updated_by uuid,
    is_starred boolean DEFAULT false,
    can_assign boolean DEFAULT false,
    delegated_by uuid,
    delay_reason text,
    timer_start_at timestamp with time zone,
    timer_user_id uuid
);

--
-- Name: project_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    user_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text,
    type character varying(50) DEFAULT 'info'::character varying,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    read_at timestamp without time zone,
    data jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT project_notifications_type_check CHECK (((type)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'success'::character varying, 'error'::character varying])::text[])))
);


ALTER TABLE public.project_notifications OWNER TO postgres;

--
-- Name: project_risks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_risks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    probability character varying(50) DEFAULT 'medium'::character varying,
    impact character varying(50) DEFAULT 'medium'::character varying,
    mitigation_plan text,
    status character varying(50) DEFAULT 'identified'::character varying,
    owner_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    severity character varying(50) DEFAULT 'medium'::character varying,
    category character varying(100),
    org_id uuid,
    created_by uuid,
    updated_by uuid,
    identified_date date,
    resolved_date date
);


ALTER TABLE public.project_risks OWNER TO postgres;

--
-- Name: project_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid NOT NULL,
    share_token character varying(255) NOT NULL,
    client_name character varying(255),
    client_email character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.project_shares OWNER TO postgres;

--
-- Name: TABLE project_shares; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.project_shares IS 'Stores shareable links for projects to share with external clients';


--
-- Name: project_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    assigned_to uuid,
    status character varying(50) DEFAULT 'todo'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    start_date date,
    due_date date,
    estimated_hours numeric(8,2),
    actual_hours numeric(8,2),
    progress integer DEFAULT 0,
    parent_task_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    milestone_id uuid,
    tags text[],
    watchers uuid[],
    dependencies uuid[],
    labels text[],
    updated_by uuid
);


ALTER TABLE public.project_tasks OWNER TO postgres;

--
-- Name: project_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    default_milestones jsonb DEFAULT '[]'::jsonb,
    default_tasks jsonb DEFAULT '[]'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.project_templates OWNER TO postgres;

--
-- Name: project_time_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.project_time_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    project_id uuid,
    task_id uuid,
    user_id uuid,
    description text,
    hours numeric(8,2) NOT NULL,
    date date NOT NULL,
    billable boolean DEFAULT true,
    hourly_rate numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_billable boolean DEFAULT true,
    total_amount numeric,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_by uuid,
    updated_by uuid
);


ALTER TABLE public.project_time_entries OWNER TO postgres;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    client_id uuid,
    start_date date,
    end_date date,
    budget numeric(15,2),
    currency character varying(10) DEFAULT 'USD'::character varying,
    status character varying(50) DEFAULT 'planning'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    progress integer DEFAULT 0,
    manager_id uuid,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    owner_id uuid,
    color character varying(20),
    client_name character varying(255),
    budget_spent numeric(15,2) DEFAULT 0,
    tags text[],
    attachments jsonb,
    team_members uuid[],
    is_archived boolean DEFAULT false,
    archived_at timestamp with time zone,
    completed_at timestamp with time zone,
    estimated_hours numeric,
    actual_hours numeric,
    updated_by uuid,
    can_assign boolean DEFAULT false,
    delegated_by uuid
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: COLUMN projects.delegated_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.projects.delegated_by IS 'The user who last delegated/re-assigned this project via delegation permission. Allows delegator to track and manage projects they forwarded.';


--
-- Name: public_holidays; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.public_holidays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    date date NOT NULL,
    is_optional boolean DEFAULT false,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.public_holidays OWNER TO postgres;

--
-- Name: TABLE public_holidays; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.public_holidays IS 'Organization public holidays';


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_order_id uuid,
    product_id uuid,
    quantity integer NOT NULL,
    unit_price numeric(15,2) NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0,
    total_price numeric(15,2),
    received_quantity integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    po_number character varying(100) NOT NULL,
    vendor_id uuid,
    warehouse_id uuid,
    order_date date DEFAULT CURRENT_DATE NOT NULL,
    expected_delivery_date date,
    status character varying(50) DEFAULT 'draft'::character varying,
    subtotal numeric(15,2) DEFAULT 0,
    tax_amount numeric(15,2) DEFAULT 0,
    total_amount numeric(15,2) DEFAULT 0,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    expected_delivery date,
    order_status character varying(50) DEFAULT 'pending'::character varying,
    delivery_address text,
    shipping_cost numeric(15,2) DEFAULT 0,
    discount_amount numeric(15,2) DEFAULT 0
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.push_subscriptions OWNER TO postgres;

--
-- Name: recruitment_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recruitment_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metric_type character varying(100) NOT NULL,
    metric_period character varying(50) NOT NULL,
    period_start_date date NOT NULL,
    period_end_date date NOT NULL,
    metric_value numeric(15,4),
    metric_unit character varying(50),
    department character varying(100),
    position_level character varying(50),
    requisition_id uuid,
    calculated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    calculated_by uuid,
    organization_id uuid
);


ALTER TABLE public.recruitment_metrics OWNER TO postgres;

--
-- Name: TABLE recruitment_metrics; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.recruitment_metrics IS 'Analytics and KPI tracking for recruitment process';


--
-- Name: recruitment_sources; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recruitment_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_name character varying(100) NOT NULL,
    source_type character varying(50) NOT NULL,
    source_url character varying(500),
    total_applications integer DEFAULT 0,
    qualified_applications integer DEFAULT 0,
    interviews_scheduled integer DEFAULT 0,
    offers_made integer DEFAULT 0,
    hires_made integer DEFAULT 0,
    cost_per_application numeric(10,2),
    cost_per_hire numeric(10,2),
    quality_score numeric(5,2),
    time_to_fill_avg numeric(8,2),
    is_active boolean DEFAULT true,
    organization_id uuid
);


ALTER TABLE public.recruitment_sources OWNER TO postgres;

--
-- Name: requisition_approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requisition_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requisition_id uuid,
    step_number integer NOT NULL,
    role character varying(100) NOT NULL,
    approver_id uuid,
    approver_name character varying(255),
    approver_email character varying(255),
    status character varying(50) DEFAULT 'not_started'::character varying,
    action character varying(50),
    comments text,
    action_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.requisition_approvals OWNER TO postgres;

--
-- Name: TABLE requisition_approvals; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.requisition_approvals IS 'Tracks approval workflow for requisitions';


--
-- Name: ringcentral_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ringcentral_tokens (
    id integer NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    token_type character varying(50) DEFAULT 'bearer'::character varying,
    expires_at timestamp with time zone,
    scope text,
    owner_id character varying(255),
    endpoint_id character varying(255),
    rc_extension_id character varying(255),
    rc_account_id character varying(255),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ringcentral_tokens OWNER TO postgres;

--
-- Name: ringcentral_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ringcentral_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ringcentral_tokens_id_seq OWNER TO postgres;

--
-- Name: ringcentral_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ringcentral_tokens_id_seq OWNED BY public.ringcentral_tokens.id;


--
-- Name: ringcentral_webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ringcentral_webhooks (
    id integer NOT NULL,
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    subscription_id character varying(255) NOT NULL,
    event_filters text[],
    status character varying(50) DEFAULT 'active'::character varying,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ringcentral_webhooks OWNER TO postgres;

--
-- Name: ringcentral_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ringcentral_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ringcentral_webhooks_id_seq OWNER TO postgres;

--
-- Name: ringcentral_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ringcentral_webhooks_id_seq OWNED BY public.ringcentral_webhooks.id;


--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(100) NOT NULL,
    description text,
    permissions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: salary_components; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_components (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    is_percentage boolean DEFAULT false,
    amount numeric(10,2) DEFAULT 0,
    percentage numeric(5,2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.salary_components OWNER TO postgres;

--
-- Name: salary_slip_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_slip_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    salary_slip_id uuid NOT NULL,
    component_name character varying(255) NOT NULL,
    component_type character varying(50) NOT NULL,
    amount numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.salary_slip_items OWNER TO postgres;

--
-- Name: salary_slips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_slips (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    month integer NOT NULL,
    year integer NOT NULL,
    basic_salary numeric(10,2) NOT NULL,
    total_earnings numeric(10,2) DEFAULT 0,
    total_deductions numeric(10,2) DEFAULT 0,
    net_salary numeric(10,2) NOT NULL,
    status character varying(50) DEFAULT 'draft'::character varying,
    generated_by uuid,
    generated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_date date,
    notes text,
    created_by uuid,
    sent_at timestamp with time zone
);


ALTER TABLE public.salary_slips OWNER TO postgres;

--
-- Name: scoring_criteria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scoring_criteria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    criteria_name character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    description text,
    max_score integer DEFAULT 100,
    weight_percentage numeric(5,2) DEFAULT 100.00,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid
);


ALTER TABLE public.scoring_criteria OWNER TO postgres;

--
-- Name: signing_parties; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.signing_parties (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    email character varying(255),
    phone character varying(50),
    role character varying(100),
    company character varying(255),
    status character varying(50) DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.signing_parties OWNER TO postgres;

--
-- Name: sms_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sms_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    user_id uuid,
    contact_id uuid,
    entity_type character varying(50),
    entity_id uuid,
    direction character varying(20) NOT NULL,
    phone_number character varying(50) NOT NULL,
    from_number character varying(50),
    to_number character varying(50),
    message_text text,
    provider character varying(50) DEFAULT 'ringcentral'::character varying,
    rc_message_id character varying(255),
    status character varying(50) DEFAULT 'sent'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.sms_logs OWNER TO postgres;

--
-- Name: stock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    product_id uuid,
    warehouse_id uuid,
    quantity integer DEFAULT 0,
    reserved_quantity integer DEFAULT 0,
    available_quantity integer DEFAULT 0,
    last_updated timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    min_stock_alert boolean DEFAULT false,
    reorder_level integer
);


ALTER TABLE public.stock OWNER TO postgres;

--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    product_id uuid NOT NULL,
    warehouse_id uuid NOT NULL,
    adjustment_type character varying(50) NOT NULL,
    quantity_before integer NOT NULL,
    quantity_adjusted integer NOT NULL,
    quantity_after integer NOT NULL,
    reason text,
    notes text,
    adjusted_by uuid,
    adjustment_date date DEFAULT CURRENT_DATE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stock_adjustments OWNER TO postgres;

--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    product_id uuid,
    warehouse_id uuid,
    movement_type character varying(50),
    quantity integer NOT NULL,
    reference_type character varying(50),
    reference_id uuid,
    notes text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    type character varying(50),
    reason text,
    reference character varying(255),
    batch_number character varying(100),
    expiry_date date
);


ALTER TABLE public.stock_movements OWNER TO postgres;

--
-- Name: talent_pool_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.talent_pool_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pool_id uuid,
    candidate_id uuid,
    added_date timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    added_by uuid,
    status character varying(50) DEFAULT 'active'::character varying,
    last_contacted date,
    contact_frequency character varying(50),
    notes text,
    pool_score numeric(8,2),
    availability_status character varying(50) DEFAULT 'available'::character varying
);


ALTER TABLE public.talent_pool_members OWNER TO postgres;

--
-- Name: talent_pools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.talent_pools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pool_name character varying(255) NOT NULL,
    description text,
    pool_type character varying(50) DEFAULT 'skill_based'::character varying,
    target_skills text[],
    target_departments text[],
    target_experience_min integer,
    target_experience_max integer,
    target_education_level character varying(100),
    created_by uuid,
    managed_by uuid,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id uuid
);


ALTER TABLE public.talent_pools OWNER TO postgres;

--
-- Name: TABLE talent_pools; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.talent_pools IS 'Talent pool management for future opportunities';


--
-- Name: task_viewers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.task_viewers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    added_at timestamp with time zone DEFAULT now(),
    can_assign boolean DEFAULT false
);


ALTER TABLE public.task_viewers OWNER TO postgres;

--
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    project_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    priority character varying(50) DEFAULT 'medium'::character varying,
    assigned_to uuid,
    due_date date,
    sort_order integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    parent_task_id uuid,
    milestone_id uuid,
    start_date date,
    end_date date,
    estimated_hours numeric,
    actual_hours numeric,
    progress integer DEFAULT 0,
    tags text[],
    attachments jsonb,
    dependencies uuid[],
    watchers uuid[],
    completed_at timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern character varying(100),
    labels text[],
    updated_by uuid,
    is_starred boolean DEFAULT false,
    can_assign boolean DEFAULT false,
    delegated_by uuid,
    delay_reason text,
    timer_start_at timestamp with time zone,
    timer_user_id uuid
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- Name: COLUMN tasks.delegated_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.tasks.delegated_by IS 'The user who last delegated/re-assigned this task via delegation permission. Allows delegator to track and manage tasks they forwarded.';


--
-- Name: telephony_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telephony_providers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    org_id uuid,
    name character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    is_enabled boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.telephony_providers OWNER TO postgres;

--
-- Name: unibox_campaign_folder_assignments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unibox_campaign_folder_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    folder_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    auto_convert_leads boolean DEFAULT false NOT NULL
);


ALTER TABLE public.unibox_campaign_folder_assignments OWNER TO postgres;

--
-- Name: unibox_campaign_folder_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unibox_campaign_folder_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    folder_id uuid NOT NULL,
    campaign_id character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.unibox_campaign_folder_items OWNER TO postgres;

--
-- Name: unibox_campaign_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unibox_campaign_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    is_default boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.unibox_campaign_folders OWNER TO postgres;

--
-- Name: unibox_emails; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.unibox_emails (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    external_id character varying(255),
    sender_email character varying(255) NOT NULL,
    sender_name character varying(255),
    recipient_email character varying(255),
    recipient_name character varying(255),
    subject text,
    body_text text,
    body_html text,
    status character varying(50) DEFAULT 'New'::character varying,
    priority character varying(50) DEFAULT 'Normal'::character varying,
    received_at timestamp with time zone,
    is_read boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    assigned_to uuid,
    converted_to_lead_id uuid,
    tags text[],
    attachments jsonb,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    body text,
    message_id character varying(255),
    in_reply_to character varying(255),
    interaction_notes text
);


ALTER TABLE public.unibox_emails OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    id uuid DEFAULT public.uuid_generate_v4(),
    role character varying(50) DEFAULT 'user'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    avatar_url character varying(500),
    phone character varying(50),
    "position" character varying(100),
    org_id uuid,
    department character varying(100),
    bio text,
    timezone character varying(100),
    languages text[],
    role public.user_role DEFAULT 'employee'::public.user_role,
    password_change_required boolean DEFAULT false,
    module_permissions jsonb DEFAULT '{}'::jsonb,
    invite_token text,
    invite_expires_at timestamp with time zone,
    last_seen_at timestamp with time zone,
    notification_settings jsonb DEFAULT '{"crm": true, "hrms": true, "tasks": true, "general": true, "recruitment": true, "collaboration": true}'::jsonb,
    has_unibox_access boolean DEFAULT false,
    attendance_machine_id character varying(100)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vendors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vendors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    contact_person character varying(255),
    email character varying(255),
    phone character varying(50),
    address text,
    city character varying(100),
    country character varying(100),
    payment_terms character varying(100),
    tax_id character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    business_type character varying(100),
    rating numeric(2,1) DEFAULT 4.0,
    created_by uuid,
    org_id uuid,
    website character varying(255),
    credit_limit numeric(15,2),
    credit_days integer,
    bank_name character varying(255),
    bank_account character varying(100)
);


ALTER TABLE public.vendors OWNER TO postgres;

--
-- Name: warehouses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.warehouses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    code character varying(50),
    address text,
    city character varying(100),
    state character varying(100),
    country character varying(100),
    postal_code character varying(20),
    manager_id uuid,
    capacity integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    manager_name character varying(255),
    phone character varying(50),
    email character varying(255),
    type character varying(50),
    operating_hours character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid
);


ALTER TABLE public.warehouses OWNER TO postgres;

--
-- Name: workflow_actions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workflow_id uuid,
    action_order integer NOT NULL,
    action_type character varying(100) NOT NULL,
    action_config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    condition_config jsonb,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    sort_order integer DEFAULT 0
);


ALTER TABLE public.workflow_actions OWNER TO postgres;

--
-- Name: workflow_execution_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_execution_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    execution_id uuid,
    action_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workflow_execution_steps OWNER TO postgres;

--
-- Name: workflow_executions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflow_executions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workflow_id uuid,
    status character varying(50) DEFAULT 'running'::character varying,
    trigger_data jsonb,
    result jsonb,
    error_message text,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    entity_id uuid,
    triggered_by uuid,
    entity_type character varying(50)
);


ALTER TABLE public.workflow_executions OWNER TO postgres;

--
-- Name: workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    organization_id uuid,
    name character varying(255) NOT NULL,
    description text,
    trigger_type character varying(100) NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    execution_count integer DEFAULT 0,
    last_executed_at timestamp without time zone,
    created_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    trigger_event character varying(100),
    conditions jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.workflows OWNER TO postgres;

--
-- Name: workgroup_activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid,
    activity_type character varying(100) NOT NULL,
    activity_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_activities OWNER TO postgres;

--
-- Name: TABLE workgroup_activities; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_activities IS 'Activity log for workgroups for audit and notifications';


--
-- Name: workgroup_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    type character varying(50) DEFAULT 'standard'::character varying,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_general boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    member_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    CONSTRAINT workgroup_channels_type_check CHECK (((type)::text = ANY (ARRAY[('standard'::character varying)::text, ('private'::character varying)::text, ('shared'::character varying)::text])))
);


ALTER TABLE public.workgroup_channels OWNER TO postgres;

--
-- Name: TABLE workgroup_channels; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_channels IS 'Channels within workgroups for organized discussions';


--
-- Name: workgroup_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    post_id uuid,
    name character varying(255) NOT NULL,
    original_name character varying(255) NOT NULL,
    file_type character varying(100),
    file_size bigint,
    mime_type character varying(255),
    file_path text NOT NULL,
    file_url text,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp with time zone,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_files OWNER TO postgres;

--
-- Name: TABLE workgroup_files; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_files IS 'Files shared within workgroups and channels';


--
-- Name: workgroup_meeting_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_meeting_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meeting_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'attendee'::character varying,
    joined_at timestamp with time zone,
    left_at timestamp with time zone,
    is_muted boolean DEFAULT false,
    is_video_on boolean DEFAULT true,
    is_screen_sharing boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_meeting_participants_role_check CHECK (((role)::text = ANY (ARRAY[('organizer'::character varying)::text, ('presenter'::character varying)::text, ('attendee'::character varying)::text])))
);


ALTER TABLE public.workgroup_meeting_participants OWNER TO postgres;

--
-- Name: workgroup_meetings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_meetings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    title character varying(255) NOT NULL,
    description text,
    meeting_type character varying(50) DEFAULT 'video'::character varying,
    status character varying(50) DEFAULT 'scheduled'::character varying,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    is_recurring boolean DEFAULT false,
    recurrence_pattern jsonb,
    max_participants integer DEFAULT 100,
    allow_recording boolean DEFAULT true,
    require_lobby boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT workgroup_meetings_meeting_type_check CHECK (((meeting_type)::text = ANY (ARRAY[('video'::character varying)::text, ('audio'::character varying)::text, ('screen_share'::character varying)::text]))),
    CONSTRAINT workgroup_meetings_status_check CHECK (((status)::text = ANY (ARRAY[('scheduled'::character varying)::text, ('active'::character varying)::text, ('ended'::character varying)::text, ('cancelled'::character varying)::text])))
);


ALTER TABLE public.workgroup_meetings OWNER TO postgres;

--
-- Name: TABLE workgroup_meetings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_meetings IS 'Scheduled and active meetings within workgroups';


--
-- Name: workgroup_members; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(50) DEFAULT 'member'::character varying,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    invited_by uuid,
    is_favorite boolean DEFAULT false,
    notification_settings jsonb DEFAULT '{"meetings": true, "mentions": true, "messages": true}'::jsonb,
    last_read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_starred boolean DEFAULT false,
    CONSTRAINT workgroup_members_role_check CHECK (((role)::text = ANY ((ARRAY['owner'::character varying, 'admin'::character varying, 'moderator'::character varying, 'member'::character varying, 'guest'::character varying])::text[])))
);


ALTER TABLE public.workgroup_members OWNER TO postgres;

--
-- Name: TABLE workgroup_members; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_members IS 'Members of workgroups with roles and permissions';


--
-- Name: COLUMN workgroup_members.is_starred; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.workgroup_members.is_starred IS 'Whether the user has starred/favorited this workgroup';


--
-- Name: workgroup_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    user_id uuid,
    type character varying(50),
    title character varying(255) NOT NULL,
    message text,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    org_id uuid,
    notification_type character varying(50),
    data jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.workgroup_notifications OWNER TO postgres;

--
-- Name: workgroup_post_reads; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_post_reads (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_post_reads OWNER TO postgres;

--
-- Name: workgroup_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    channel_id uuid,
    user_id uuid NOT NULL,
    parent_id uuid,
    content text NOT NULL,
    content_type character varying(50) DEFAULT 'text'::character varying,
    is_pinned boolean DEFAULT false,
    is_edited boolean DEFAULT false,
    is_deleted boolean DEFAULT false,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone,
    reactions jsonb DEFAULT '{}'::jsonb,
    mention_users uuid[] DEFAULT '{}'::uuid[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    attachments jsonb DEFAULT '[]'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    deleted_for_users uuid[] DEFAULT '{}'::uuid[],
    CONSTRAINT workgroup_posts_content_type_check CHECK (((content_type)::text = ANY ((ARRAY['text'::character varying, 'file'::character varying, 'image'::character varying, 'link'::character varying, 'code'::character varying, 'system'::character varying, 'call'::character varying])::text[])))
);


ALTER TABLE public.workgroup_posts OWNER TO postgres;

--
-- Name: TABLE workgroup_posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroup_posts IS 'Messages/posts within workgroups and channels';


--
-- Name: workgroups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    avatar_color character varying(50) DEFAULT 'bg-blue-500'::character varying,
    type character varying(50) DEFAULT 'team'::character varying,
    is_private boolean DEFAULT false,
    is_archived boolean DEFAULT false,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    allow_guest_access boolean DEFAULT false,
    allow_member_add_remove boolean DEFAULT true,
    allow_member_create_channels boolean DEFAULT true,
    notification_settings jsonb DEFAULT '{"meetings": true, "mentions": true, "messages": true}'::jsonb,
    member_count integer DEFAULT 0,
    message_count integer DEFAULT 0,
    last_activity_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true,
    settings jsonb DEFAULT '{}'::jsonb,
    cover_image character varying(500),
    is_broadcast boolean DEFAULT false,
    allow_threading boolean DEFAULT true,
    avatar_url text,
    CONSTRAINT workgroups_type_check CHECK (((type)::text = ANY (ARRAY[('team'::character varying)::text, ('project'::character varying)::text, ('private'::character varying)::text, ('department'::character varying)::text, ('broadcast'::character varying)::text])))
);


ALTER TABLE public.workgroups OWNER TO postgres;

--
-- Name: TABLE workgroups; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workgroups IS 'Microsoft Teams-style workgroups/teams for collaboration';


--
-- Name: workgroup_stats; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.workgroup_stats AS
 SELECT w.id,
    w.name,
    w.type,
    w.is_private,
    w.member_count,
    w.message_count,
    w.last_activity_at,
    count(DISTINCT wm.user_id) AS actual_member_count,
    count(DISTINCT wp.id) AS actual_message_count,
    max(wp.created_at) AS last_message_at
   FROM ((public.workgroups w
     LEFT JOIN public.workgroup_members wm ON ((w.id = wm.workgroup_id)))
     LEFT JOIN public.workgroup_posts wp ON ((w.id = wp.workgroup_id)))
  GROUP BY w.id, w.name, w.type, w.is_private, w.member_count, w.message_count, w.last_activity_at;


ALTER VIEW public.workgroup_stats OWNER TO postgres;

--
-- Name: workgroup_wiki; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_wiki (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    workgroup_id uuid,
    title character varying(255) NOT NULL,
    content text,
    parent_id uuid,
    created_by uuid,
    updated_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_wiki OWNER TO postgres;

--
-- Name: workgroup_wiki_pages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workgroup_wiki_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workgroup_id uuid NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    slug character varying(255) NOT NULL,
    is_published boolean DEFAULT true,
    is_deleted boolean DEFAULT false,
    created_by uuid NOT NULL,
    last_modified_by uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.workgroup_wiki_pages OWNER TO postgres;

--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: ringcentral_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ringcentral_tokens ALTER COLUMN id SET DEFAULT nextval('public.ringcentral_tokens_id_seq'::regclass);


--
-- Name: ringcentral_webhooks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ringcentral_webhooks ALTER COLUMN id SET DEFAULT nextval('public.ringcentral_webhooks_id_seq'::regclass);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: attendance attendance_employee_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_date_key UNIQUE (employee_id, date);


--
-- Name: attendance attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_pkey PRIMARY KEY (id);


--
-- Name: background_check_types background_check_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_check_types
    ADD CONSTRAINT background_check_types_pkey PRIMARY KEY (id);


--
-- Name: background_checks background_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_checks
    ADD CONSTRAINT background_checks_pkey PRIMARY KEY (id);


--
-- Name: calendar_connections calendar_connections_unique_user_provider; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_connections
    ADD CONSTRAINT calendar_connections_unique_user_provider UNIQUE (org_id, user_id, provider);


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_user_id_key UNIQUE (event_id, user_id);


--
-- Name: calendar_event_attendees calendar_event_attendees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_external_id_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_external_id_unique UNIQUE (external_calendar_id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_pkey PRIMARY KEY (id);


--
-- Name: candidate_application_forms candidate_application_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_application_forms
    ADD CONSTRAINT candidate_application_forms_pkey PRIMARY KEY (id);


--
-- Name: candidate_interviews candidate_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_interviews
    ADD CONSTRAINT candidate_interviews_pkey PRIMARY KEY (id);


--
-- Name: candidate_rankings candidate_rankings_candidate_id_requisition_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_candidate_id_requisition_id_key UNIQUE (candidate_id, requisition_id);


--
-- Name: candidate_rankings candidate_rankings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_pkey PRIMARY KEY (id);


--
-- Name: candidate_rankings candidate_rankings_unique_constraint; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_unique_constraint UNIQUE (candidate_id, requisition_id);


--
-- Name: CONSTRAINT candidate_rankings_unique_constraint ON candidate_rankings; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT candidate_rankings_unique_constraint ON public.candidate_rankings IS 'Ensures one ranking per candidate per requisition';


--
-- Name: candidate_scores candidate_scores_candidate_id_criteria_id_scored_by_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_candidate_id_criteria_id_scored_by_key UNIQUE (candidate_id, criteria_id, scored_by);


--
-- Name: candidate_scores candidate_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_pkey PRIMARY KEY (id);


--
-- Name: candidate_scores candidate_scores_unique_constraint; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_unique_constraint UNIQUE (candidate_id, criteria_id, scored_by);


--
-- Name: CONSTRAINT candidate_scores_unique_constraint ON candidate_scores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON CONSTRAINT candidate_scores_unique_constraint ON public.candidate_scores IS 'Ensures one score per candidate per criteria per scorer';


--
-- Name: candidate_timeline candidate_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_timeline
    ADD CONSTRAINT candidate_timeline_pkey PRIMARY KEY (id);


--
-- Name: candidates candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_pkey PRIMARY KEY (id);


--
-- Name: car_activity_log car_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_activity_log
    ADD CONSTRAINT car_activity_log_pkey PRIMARY KEY (id);


--
-- Name: car_documents car_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_documents
    ADD CONSTRAINT car_documents_pkey PRIMARY KEY (id);


--
-- Name: car_inquiries car_inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inquiries
    ADD CONSTRAINT car_inquiries_pkey PRIMARY KEY (id);


--
-- Name: car_inventory car_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inventory
    ADD CONSTRAINT car_inventory_pkey PRIMARY KEY (id);


--
-- Name: car_inventory car_inventory_stock_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inventory
    ADD CONSTRAINT car_inventory_stock_number_key UNIQUE (stock_number);


--
-- Name: car_inventory car_inventory_vin_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inventory
    ADD CONSTRAINT car_inventory_vin_key UNIQUE (vin);


--
-- Name: car_sales car_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_sales
    ADD CONSTRAINT car_sales_pkey PRIMARY KEY (id);


--
-- Name: car_sales car_sales_sale_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_sales
    ADD CONSTRAINT car_sales_sale_number_key UNIQUE (sale_number);


--
-- Name: car_service_history car_service_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_service_history
    ADD CONSTRAINT car_service_history_pkey PRIMARY KEY (id);


--
-- Name: car_test_drives car_test_drives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_test_drives
    ADD CONSTRAINT car_test_drives_pkey PRIMARY KEY (id);


--
-- Name: car_workspace_members car_workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_workspace_members
    ADD CONSTRAINT car_workspace_members_pkey PRIMARY KEY (id);


--
-- Name: car_workspace_members car_workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_workspace_members
    ADD CONSTRAINT car_workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: car_workspaces car_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_workspaces
    ADD CONSTRAINT car_workspaces_pkey PRIMARY KEY (id);


--
-- Name: chat_mentions chat_mentions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mentions
    ADD CONSTRAINT chat_mentions_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: connected_drives connected_drives_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_pkey PRIMARY KEY (id);


--
-- Name: connected_mailboxes connected_mailboxes_org_id_user_id_email_address_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_user_id_email_address_key UNIQUE (org_id, user_id, email_address);


--
-- Name: connected_mailboxes connected_mailboxes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: crm_activities crm_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_activities
    ADD CONSTRAINT crm_activities_pkey PRIMARY KEY (id);


--
-- Name: crm_comments crm_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_comments
    ADD CONSTRAINT crm_comments_pkey PRIMARY KEY (id);


--
-- Name: crm_custom_field_templates crm_custom_field_templates_org_id_entity_type_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_custom_field_templates
    ADD CONSTRAINT crm_custom_field_templates_org_id_entity_type_key_key UNIQUE (org_id, entity_type, key);


--
-- Name: crm_custom_field_templates crm_custom_field_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_custom_field_templates
    ADD CONSTRAINT crm_custom_field_templates_pkey PRIMARY KEY (id);


--
-- Name: crm_documents crm_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.crm_documents
    ADD CONSTRAINT crm_documents_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deal_contacts deal_contacts_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_contacts deal_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_pkey PRIMARY KEY (id);


--
-- Name: deal_signing_parties deal_signing_parties_org_id_deal_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_deal_id_contact_id_key UNIQUE (org_id, deal_id, contact_id);


--
-- Name: deal_signing_parties deal_signing_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: direct_messages direct_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT direct_messages_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: drive_activities drive_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_pkey PRIMARY KEY (id);


--
-- Name: drive_file_versions drive_file_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_pkey PRIMARY KEY (id);


--
-- Name: drive_files drive_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_pkey PRIMARY KEY (id);


--
-- Name: drive_folders drive_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_pkey PRIMARY KEY (id);


--
-- Name: drive_permissions drive_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_pkey PRIMARY KEY (id);


--
-- Name: email_crm_links email_crm_links_email_id_entity_type_entity_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_crm_links
    ADD CONSTRAINT email_crm_links_email_id_entity_type_entity_id_key UNIQUE (email_id, entity_type, entity_id);


--
-- Name: email_crm_links email_crm_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_crm_links
    ADD CONSTRAINT email_crm_links_pkey PRIMARY KEY (id);


--
-- Name: emails emails_message_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_message_id_key UNIQUE (message_id);


--
-- Name: emails emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_pkey PRIMARY KEY (id);


--
-- Name: employee_documents employee_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: employee_leave_balances employee_leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_pkey PRIMARY KEY (id);


--
-- Name: employee_product_assignments employee_product_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_product_assignments
    ADD CONSTRAINT employee_product_assignments_pkey PRIMARY KEY (id);


--
-- Name: employee_salaries employee_salaries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_salaries
    ADD CONSTRAINT employee_salaries_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_employee_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_code_key UNIQUE (employee_code);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: entity_drive_files entity_drive_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_pkey PRIMARY KEY (id);


--
-- Name: fcm_tokens fcm_tokens_user_id_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_token_key UNIQUE (user_id, token);


--
-- Name: finance_accounting_periods finance_accounting_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_accounting_periods
    ADD CONSTRAINT finance_accounting_periods_pkey PRIMARY KEY (id);


--
-- Name: finance_approval_rules finance_approval_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_approval_rules
    ADD CONSTRAINT finance_approval_rules_pkey PRIMARY KEY (id);


--
-- Name: finance_bank_accounts finance_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: finance_bank_transfers finance_bank_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_transfers
    ADD CONSTRAINT finance_bank_transfers_pkey PRIMARY KEY (id);


--
-- Name: finance_budgets finance_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_pkey PRIMARY KEY (id);


--
-- Name: finance_chart_accounts finance_chart_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_chart_accounts
    ADD CONSTRAINT finance_chart_accounts_pkey PRIMARY KEY (id);


--
-- Name: finance_cost_centers finance_cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_cost_centers
    ADD CONSTRAINT finance_cost_centers_pkey PRIMARY KEY (id);


--
-- Name: finance_credit_notes finance_credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_credit_notes
    ADD CONSTRAINT finance_credit_notes_pkey PRIMARY KEY (id);


--
-- Name: finance_currencies finance_currencies_currency_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_currencies
    ADD CONSTRAINT finance_currencies_currency_code_key UNIQUE (currency_code);


--
-- Name: finance_currencies finance_currencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_currencies
    ADD CONSTRAINT finance_currencies_pkey PRIMARY KEY (id);


--
-- Name: finance_customer_invoices finance_customer_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: finance_customer_invoices finance_customer_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_pkey PRIMARY KEY (id);


--
-- Name: finance_customer_payments finance_customer_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_payments
    ADD CONSTRAINT finance_customer_payments_pkey PRIMARY KEY (id);


--
-- Name: finance_debit_notes finance_debit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_debit_notes
    ADD CONSTRAINT finance_debit_notes_pkey PRIMARY KEY (id);


--
-- Name: finance_exchange_rates finance_exchange_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_exchange_rates
    ADD CONSTRAINT finance_exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: finance_expenses finance_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_pkey PRIMARY KEY (id);


--
-- Name: finance_fiscal_years finance_fiscal_years_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_fiscal_years
    ADD CONSTRAINT finance_fiscal_years_pkey PRIMARY KEY (id);


--
-- Name: finance_journal_entries finance_journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entries
    ADD CONSTRAINT finance_journal_entries_pkey PRIMARY KEY (id);


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_pkey PRIMARY KEY (id);


--
-- Name: finance_payment_terms finance_payment_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_payment_terms
    ADD CONSTRAINT finance_payment_terms_pkey PRIMARY KEY (id);


--
-- Name: finance_profit_centers finance_profit_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_profit_centers
    ADD CONSTRAINT finance_profit_centers_pkey PRIMARY KEY (id);


--
-- Name: finance_recurring_expenses finance_recurring_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_recurring_expenses
    ADD CONSTRAINT finance_recurring_expenses_pkey PRIMARY KEY (id);


--
-- Name: finance_vendor_bills finance_vendor_bills_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_invoice_number_key UNIQUE (invoice_number);


--
-- Name: finance_vendor_bills finance_vendor_bills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_pkey PRIMARY KEY (id);


--
-- Name: finance_vendor_payments finance_vendor_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_payments
    ADD CONSTRAINT finance_vendor_payments_pkey PRIMARY KEY (id);


--
-- Name: hrms_notifications hrms_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_pkey PRIMARY KEY (id);


--
-- Name: instantly_integrations instantly_integrations_org_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_integrations
    ADD CONSTRAINT instantly_integrations_org_id_key UNIQUE (org_id);


--
-- Name: instantly_integrations instantly_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_integrations
    ADD CONSTRAINT instantly_integrations_pkey PRIMARY KEY (id);


--
-- Name: instantly_unibox_events instantly_unibox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_unibox_events
    ADD CONSTRAINT instantly_unibox_events_pkey PRIMARY KEY (id);


--
-- Name: instantly_webhook_health instantly_webhook_health_org_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_health
    ADD CONSTRAINT instantly_webhook_health_org_id_key UNIQUE (org_id);


--
-- Name: instantly_webhook_health instantly_webhook_health_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_health
    ADD CONSTRAINT instantly_webhook_health_pkey PRIMARY KEY (id);


--
-- Name: instantly_webhook_raw_log instantly_webhook_raw_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_raw_log
    ADD CONSTRAINT instantly_webhook_raw_log_pkey PRIMARY KEY (id);


--
-- Name: instantly_webhook_registrations instantly_webhook_registrations_org_id_event_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_registrations
    ADD CONSTRAINT instantly_webhook_registrations_org_id_event_type_key UNIQUE (org_id, event_type);


--
-- Name: instantly_webhook_registrations instantly_webhook_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_registrations
    ADD CONSTRAINT instantly_webhook_registrations_pkey PRIMARY KEY (id);


--
-- Name: interview_feedback interview_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_pkey PRIMARY KEY (id);


--
-- Name: invites invites_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_invite_token_key UNIQUE (invite_token);


--
-- Name: invites invites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invites
    ADD CONSTRAINT invites_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_advertisements job_advertisements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_advertisements
    ADD CONSTRAINT job_advertisements_pkey PRIMARY KEY (id);


--
-- Name: job_offers job_offers_offer_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_offer_number_key UNIQUE (offer_number);


--
-- Name: job_offers job_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_pkey PRIMARY KEY (id);


--
-- Name: job_requisitions job_requisitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_requisitions
    ADD CONSTRAINT job_requisitions_pkey PRIMARY KEY (id);


--
-- Name: job_requisitions job_requisitions_requisition_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_requisitions
    ADD CONSTRAINT job_requisitions_requisition_id_key UNIQUE (requisition_id);


--
-- Name: job_templates job_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_templates
    ADD CONSTRAINT job_templates_pkey PRIMARY KEY (id);


--
-- Name: job_templates job_templates_template_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_templates
    ADD CONSTRAINT job_templates_template_code_key UNIQUE (template_code);


--
-- Name: lead_external_sources lead_external_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_pkey PRIMARY KEY (id);


--
-- Name: lead_imports lead_imports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_imports
    ADD CONSTRAINT lead_imports_pkey PRIMARY KEY (id);


--
-- Name: lead_workspace_access lead_workspace_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_pkey PRIMARY KEY (id);


--
-- Name: lead_workspaces lead_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: leave_balances leave_balances_employee_id_leave_type_id_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_leave_type_id_year_key UNIQUE (employee_id, leave_type_id, year);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_request_comments leave_request_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_results marketing_ab_test_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_pkey PRIMARY KEY (id);


--
-- Name: marketing_ab_tests marketing_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_activities marketing_campaign_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_activities
    ADD CONSTRAINT marketing_campaign_activities_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_analytics marketing_campaign_analytics_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_analytics
    ADD CONSTRAINT marketing_campaign_analytics_campaign_id_key UNIQUE (campaign_id);


--
-- Name: marketing_campaign_analytics marketing_campaign_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_analytics
    ADD CONSTRAINT marketing_campaign_analytics_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_audiences marketing_campaign_audiences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_audiences
    ADD CONSTRAINT marketing_campaign_audiences_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_events marketing_campaign_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaign_schedules marketing_campaign_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_schedules
    ADD CONSTRAINT marketing_campaign_schedules_pkey PRIMARY KEY (id);


--
-- Name: marketing_campaigns marketing_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_attachments marketing_email_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_attachments
    ADD CONSTRAINT marketing_email_attachments_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_bounces marketing_email_bounces_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_bounces
    ADD CONSTRAINT marketing_email_bounces_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_clicks marketing_email_clicks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_clicks
    ADD CONSTRAINT marketing_email_clicks_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_logs marketing_email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_logs
    ADD CONSTRAINT marketing_email_logs_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_opens marketing_email_opens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_opens
    ADD CONSTRAINT marketing_email_opens_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_queue marketing_email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_queue
    ADD CONSTRAINT marketing_email_queue_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_settings marketing_email_settings_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_settings
    ADD CONSTRAINT marketing_email_settings_organization_id_key UNIQUE (organization_id);


--
-- Name: marketing_email_settings marketing_email_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_settings
    ADD CONSTRAINT marketing_email_settings_pkey PRIMARY KEY (id);


--
-- Name: marketing_email_unsubscribes marketing_email_unsubscribes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_unsubscribes
    ADD CONSTRAINT marketing_email_unsubscribes_pkey PRIMARY KEY (id);


--
-- Name: marketing_form_submissions marketing_form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_pkey PRIMARY KEY (id);


--
-- Name: marketing_forms marketing_forms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_pkey PRIMARY KEY (id);


--
-- Name: marketing_list_members marketing_list_members_list_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_contact_id_key UNIQUE (list_id, contact_id);


--
-- Name: marketing_list_members marketing_list_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_pkey PRIMARY KEY (id);


--
-- Name: marketing_lists marketing_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_history marketing_scoring_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_pkey PRIMARY KEY (id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_pkey PRIMARY KEY (id);


--
-- Name: marketing_segments marketing_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_contact_id_key UNIQUE (sequence_id, contact_id);


--
-- Name: marketing_sequence_steps marketing_sequence_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_pkey PRIMARY KEY (id);


--
-- Name: marketing_sequences marketing_sequences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_pkey PRIMARY KEY (id);


--
-- Name: marketing_templates marketing_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_logs marketing_webhook_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhook_queue marketing_webhook_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_pkey PRIMARY KEY (id);


--
-- Name: marketing_webhooks marketing_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_filename_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_filename_key UNIQUE (filename);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offer_approvals offer_approvals_offer_id_step_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offer_approvals
    ADD CONSTRAINT offer_approvals_offer_id_step_number_key UNIQUE (offer_id, step_number);


--
-- Name: offer_approvals offer_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offer_approvals
    ADD CONSTRAINT offer_approvals_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_key UNIQUE (user_id);


--
-- Name: payroll payroll_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: pipeline_stages pipeline_stages_org_id_pipeline_stage_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_org_id_pipeline_stage_key_key UNIQUE (org_id, pipeline, stage_key);


--
-- Name: pipeline_stages pipeline_stages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pipeline_stages
    ADD CONSTRAINT pipeline_stages_pkey PRIMARY KEY (id);


--
-- Name: product_batches product_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_activity_logs project_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_activity_logs
    ADD CONSTRAINT project_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: project_attachments project_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_attachments
    ADD CONSTRAINT project_attachments_pkey PRIMARY KEY (id);


--
-- Name: project_comments project_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_comments
    ADD CONSTRAINT project_comments_pkey PRIMARY KEY (id);


--
-- Name: project_documents project_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_pkey PRIMARY KEY (id);


--
-- Name: project_files project_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_files
    ADD CONSTRAINT project_files_pkey PRIMARY KEY (id);


--
-- Name: project_invoices project_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_invoices
    ADD CONSTRAINT project_invoices_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_milestone_assignees project_milestone_assignees_milestone_id_assigned_to_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_milestone_id_assigned_to_key UNIQUE (milestone_id, assigned_to);


--
-- Name: project_milestone_assignees project_milestone_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_pkey PRIMARY KEY (id);


--
-- Name: project_milestones project_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_pkey PRIMARY KEY (id);


--
-- Name: project_notifications project_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_pkey PRIMARY KEY (id);


--
-- Name: project_risks project_risks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_pkey PRIMARY KEY (id);


--
-- Name: project_shares project_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_pkey PRIMARY KEY (id);


--
-- Name: project_shares project_shares_share_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_share_token_key UNIQUE (share_token);


--
-- Name: project_tasks project_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_pkey PRIMARY KEY (id);


--
-- Name: project_templates project_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_pkey PRIMARY KEY (id);


--
-- Name: project_time_entries project_time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_org_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_org_id_date_key UNIQUE (org_id, date);


--
-- Name: public_holidays public_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: recruitment_metrics recruitment_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_metrics
    ADD CONSTRAINT recruitment_metrics_pkey PRIMARY KEY (id);


--
-- Name: recruitment_sources recruitment_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_sources
    ADD CONSTRAINT recruitment_sources_pkey PRIMARY KEY (id);


--
-- Name: requisition_approvals requisition_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requisition_approvals
    ADD CONSTRAINT requisition_approvals_pkey PRIMARY KEY (id);


--
-- Name: requisition_approvals requisition_approvals_requisition_id_step_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requisition_approvals
    ADD CONSTRAINT requisition_approvals_requisition_id_step_number_key UNIQUE (requisition_id, step_number);


--
-- Name: ringcentral_tokens ringcentral_tokens_org_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ringcentral_tokens
    ADD CONSTRAINT ringcentral_tokens_org_id_user_id_key UNIQUE (org_id, user_id);


--
-- Name: ringcentral_tokens ringcentral_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ringcentral_tokens
    ADD CONSTRAINT ringcentral_tokens_pkey PRIMARY KEY (id);


--
-- Name: ringcentral_webhooks ringcentral_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ringcentral_webhooks
    ADD CONSTRAINT ringcentral_webhooks_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salary_components salary_components_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_components
    ADD CONSTRAINT salary_components_pkey PRIMARY KEY (id);


--
-- Name: salary_slip_items salary_slip_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slip_items
    ADD CONSTRAINT salary_slip_items_pkey PRIMARY KEY (id);


--
-- Name: salary_slips salary_slips_org_id_employee_id_month_year_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_org_id_employee_id_month_year_key UNIQUE (org_id, employee_id, month, year);


--
-- Name: salary_slips salary_slips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_slips
    ADD CONSTRAINT salary_slips_pkey PRIMARY KEY (id);


--
-- Name: scoring_criteria scoring_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_pkey PRIMARY KEY (id);


--
-- Name: signing_parties signing_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_pkey PRIMARY KEY (id);


--
-- Name: sms_logs sms_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: stock stock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_pkey PRIMARY KEY (id);


--
-- Name: stock stock_product_id_warehouse_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_warehouse_id_key UNIQUE (product_id, warehouse_id);


--
-- Name: talent_pool_members talent_pool_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pool_members
    ADD CONSTRAINT talent_pool_members_pkey PRIMARY KEY (id);


--
-- Name: talent_pool_members talent_pool_members_pool_id_candidate_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pool_members
    ADD CONSTRAINT talent_pool_members_pool_id_candidate_id_key UNIQUE (pool_id, candidate_id);


--
-- Name: talent_pools talent_pools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pools
    ADD CONSTRAINT talent_pools_pkey PRIMARY KEY (id);


--
-- Name: task_viewers task_viewers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_viewers
    ADD CONSTRAINT task_viewers_pkey PRIMARY KEY (id);


--
-- Name: task_viewers task_viewers_task_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_viewers
    ADD CONSTRAINT task_viewers_task_id_user_id_key UNIQUE (task_id, user_id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: telephony_providers telephony_providers_org_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telephony_providers
    ADD CONSTRAINT telephony_providers_org_id_name_key UNIQUE (org_id, name);


--
-- Name: telephony_providers telephony_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telephony_providers
    ADD CONSTRAINT telephony_providers_pkey PRIMARY KEY (id);


--
-- Name: unibox_campaign_folder_assignments unibox_campaign_folder_assignments_folder_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_assignments
    ADD CONSTRAINT unibox_campaign_folder_assignments_folder_id_user_id_key UNIQUE (folder_id, user_id);


--
-- Name: unibox_campaign_folder_assignments unibox_campaign_folder_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_assignments
    ADD CONSTRAINT unibox_campaign_folder_assignments_pkey PRIMARY KEY (id);


--
-- Name: unibox_campaign_folder_items unibox_campaign_folder_items_org_id_campaign_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_items
    ADD CONSTRAINT unibox_campaign_folder_items_org_id_campaign_id_key UNIQUE (org_id, campaign_id);


--
-- Name: unibox_campaign_folder_items unibox_campaign_folder_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_items
    ADD CONSTRAINT unibox_campaign_folder_items_pkey PRIMARY KEY (id);


--
-- Name: unibox_campaign_folders unibox_campaign_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folders
    ADD CONSTRAINT unibox_campaign_folders_pkey PRIMARY KEY (id);


--
-- Name: unibox_emails unibox_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_emails
    ADD CONSTRAINT unibox_emails_pkey PRIMARY KEY (id);


--
-- Name: finance_chart_accounts unique_account_code_org; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_chart_accounts
    ADD CONSTRAINT unique_account_code_org UNIQUE (organization_id, account_code);


--
-- Name: finance_cost_centers unique_cost_code_org; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_cost_centers
    ADD CONSTRAINT unique_cost_code_org UNIQUE (organization_id, code);


--
-- Name: finance_profit_centers unique_profit_code_org; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_profit_centers
    ADD CONSTRAINT unique_profit_code_org UNIQUE (organization_id, code);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_invite_token_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_invite_token_key UNIQUE (invite_token);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendors vendors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);


--
-- Name: warehouses warehouses_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_code_key UNIQUE (code);


--
-- Name: warehouses warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_pkey PRIMARY KEY (id);


--
-- Name: workflow_actions workflow_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_actions
    ADD CONSTRAINT workflow_actions_pkey PRIMARY KEY (id);


--
-- Name: workflow_execution_steps workflow_execution_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_pkey PRIMARY KEY (id);


--
-- Name: workflow_executions workflow_executions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_pkey PRIMARY KEY (id);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: workgroup_activities workgroup_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_pkey PRIMARY KEY (id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_name_key UNIQUE (workgroup_id, name);


--
-- Name: workgroup_files workgroup_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_user_id_key UNIQUE (meeting_id, user_id);


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_pkey PRIMARY KEY (id);


--
-- Name: workgroup_meetings workgroup_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_pkey PRIMARY KEY (id);


--
-- Name: workgroup_members workgroup_members_workgroup_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_user_id_key UNIQUE (workgroup_id, user_id);


--
-- Name: workgroup_notifications workgroup_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_pkey PRIMARY KEY (id);


--
-- Name: workgroup_post_reads workgroup_post_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_post_reads
    ADD CONSTRAINT workgroup_post_reads_pkey PRIMARY KEY (post_id, user_id);


--
-- Name: workgroup_posts workgroup_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_pkey PRIMARY KEY (id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_slug_key UNIQUE (workgroup_id, slug);


--
-- Name: workgroup_wiki workgroup_wiki_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_pkey PRIMARY KEY (id);


--
-- Name: workgroups workgroups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_pkey PRIMARY KEY (id);


--
-- Name: idx_activities_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_contact ON public.activities USING btree (contact_id);


--
-- Name: idx_activities_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activities_organization ON public.activities USING btree (organization_id);


--
-- Name: idx_approvals_requisition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approvals_requisition ON public.requisition_approvals USING btree (requisition_id);


--
-- Name: idx_attendance_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_employee ON public.attendance USING btree (employee_id);


--
-- Name: idx_attendance_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_attendance_status ON public.attendance USING btree (status);


--
-- Name: idx_background_checks_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_checks_candidate ON public.background_checks USING btree (candidate_id);


--
-- Name: idx_background_checks_completion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_checks_completion ON public.background_checks USING btree (expected_completion_date);


--
-- Name: idx_background_checks_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_background_checks_status ON public.background_checks USING btree (status);


--
-- Name: idx_calendar_connections_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calendar_connections_org ON public.calendar_connections USING btree (org_id);


--
-- Name: idx_calendar_connections_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calendar_connections_user ON public.calendar_connections USING btree (user_id);


--
-- Name: idx_calendar_events_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calendar_events_org ON public.calendar_events USING btree (org_id);


--
-- Name: idx_calendar_events_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_calendar_events_time ON public.calendar_events USING btree (start_time, end_time);


--
-- Name: idx_call_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_entity ON public.call_logs USING btree (entity_type, entity_id);


--
-- Name: idx_call_logs_org_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_org_date ON public.call_logs USING btree (org_id, created_at DESC);


--
-- Name: idx_call_logs_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_provider ON public.call_logs USING btree (provider);


--
-- Name: idx_call_logs_rc_session; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_rc_session ON public.call_logs USING btree (rc_session_id);


--
-- Name: idx_candidate_rankings_requisition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_rankings_requisition ON public.candidate_rankings USING btree (requisition_id);


--
-- Name: idx_candidate_rankings_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_rankings_score ON public.candidate_rankings USING btree (total_score DESC);


--
-- Name: idx_candidate_rankings_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_rankings_unique ON public.candidate_rankings USING btree (candidate_id, requisition_id);


--
-- Name: idx_candidate_scores_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_scores_candidate ON public.candidate_scores USING btree (candidate_id);


--
-- Name: idx_candidate_scores_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidate_scores_unique ON public.candidate_scores USING btree (candidate_id, criteria_id, scored_by);


--
-- Name: idx_candidates_form_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_form_status ON public.candidates USING btree (form_status);


--
-- Name: idx_candidates_form_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_form_token ON public.candidates USING btree (form_token);


--
-- Name: idx_candidates_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_org ON public.candidates USING btree (organization_id);


--
-- Name: idx_candidates_requisition; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_requisition ON public.candidates USING btree (requisition_id);


--
-- Name: idx_candidates_screening_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_screening_date ON public.candidates USING btree (screening_date);


--
-- Name: idx_candidates_screening_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_screening_status ON public.candidates USING btree (status) WHERE ((status)::text = ANY ((ARRAY['screened_passed'::character varying, 'screened_failed'::character varying])::text[]));


--
-- Name: idx_candidates_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_candidates_status ON public.candidates USING btree (status);


--
-- Name: idx_car_activity_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_activity_car ON public.car_activity_log USING btree (car_id);


--
-- Name: idx_car_activity_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_activity_date ON public.car_activity_log USING btree (created_at);


--
-- Name: idx_car_activity_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_activity_type ON public.car_activity_log USING btree (activity_type);


--
-- Name: idx_car_activity_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_activity_workspace ON public.car_activity_log USING btree (workspace_id);


--
-- Name: idx_car_documents_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_documents_car ON public.car_documents USING btree (car_id);


--
-- Name: idx_car_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_documents_type ON public.car_documents USING btree (document_type);


--
-- Name: idx_car_inquiries_assigned; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inquiries_assigned ON public.car_inquiries USING btree (assigned_to);


--
-- Name: idx_car_inquiries_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inquiries_car ON public.car_inquiries USING btree (car_id);


--
-- Name: idx_car_inquiries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inquiries_status ON public.car_inquiries USING btree (status);


--
-- Name: idx_car_inquiries_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inquiries_workspace ON public.car_inquiries USING btree (workspace_id);


--
-- Name: idx_car_inventory_make_model; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_make_model ON public.car_inventory USING btree (make, model);


--
-- Name: idx_car_inventory_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_org ON public.car_inventory USING btree (org_id);


--
-- Name: idx_car_inventory_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_status ON public.car_inventory USING btree (status);


--
-- Name: idx_car_inventory_stock; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_stock ON public.car_inventory USING btree (stock_number);


--
-- Name: idx_car_inventory_vin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_vin ON public.car_inventory USING btree (vin);


--
-- Name: idx_car_inventory_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_workspace ON public.car_inventory USING btree (workspace_id);


--
-- Name: idx_car_inventory_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_inventory_year ON public.car_inventory USING btree (year);


--
-- Name: idx_car_sales_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_sales_car ON public.car_sales USING btree (car_id);


--
-- Name: idx_car_sales_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_sales_date ON public.car_sales USING btree (sale_date);


--
-- Name: idx_car_sales_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_sales_status ON public.car_sales USING btree (payment_status);


--
-- Name: idx_car_sales_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_sales_workspace ON public.car_sales USING btree (workspace_id);


--
-- Name: idx_car_service_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_service_car ON public.car_service_history USING btree (car_id);


--
-- Name: idx_car_service_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_service_date ON public.car_service_history USING btree (service_date);


--
-- Name: idx_car_test_drives_car; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_test_drives_car ON public.car_test_drives USING btree (car_id);


--
-- Name: idx_car_test_drives_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_test_drives_date ON public.car_test_drives USING btree (scheduled_date);


--
-- Name: idx_car_test_drives_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_test_drives_status ON public.car_test_drives USING btree (status);


--
-- Name: idx_car_test_drives_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_test_drives_workspace ON public.car_test_drives USING btree (workspace_id);


--
-- Name: idx_car_workspace_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_workspace_members_user ON public.car_workspace_members USING btree (user_id);


--
-- Name: idx_car_workspace_members_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_workspace_members_workspace ON public.car_workspace_members USING btree (workspace_id);


--
-- Name: idx_car_workspaces_admin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_workspaces_admin ON public.car_workspaces USING btree (admin_id);


--
-- Name: idx_car_workspaces_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_car_workspaces_org ON public.car_workspaces USING btree (org_id);


--
-- Name: idx_companies_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_companies_organization ON public.companies USING btree (organization_id);


--
-- Name: idx_connected_drives_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_connected_drives_org ON public.connected_drives USING btree (org_id);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (email);


--
-- Name: idx_contacts_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_contacts_organization ON public.contacts USING btree (organization_id);


--
-- Name: idx_crm_activities_entity_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_activities_entity_lookup ON public.crm_activities USING btree (entity_type, entity_id);


--
-- Name: idx_crm_activities_org_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_activities_org_created ON public.crm_activities USING btree (org_id, created_at DESC);


--
-- Name: idx_crm_activities_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_activities_user_id ON public.crm_activities USING btree (user_id);


--
-- Name: idx_crm_comments_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_comments_entity ON public.crm_comments USING btree (entity_type, entity_id);


--
-- Name: idx_crm_comments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_comments_org ON public.crm_comments USING btree (org_id);


--
-- Name: idx_crm_documents_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_documents_entity ON public.crm_documents USING btree (entity_type, entity_id);


--
-- Name: idx_crm_documents_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_crm_documents_org ON public.crm_documents USING btree (org_id);


--
-- Name: idx_customers_converted_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_converted_deal ON public.customers USING btree (converted_from_deal_id);


--
-- Name: idx_customers_converted_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_converted_lead ON public.customers USING btree (converted_from_lead_id);


--
-- Name: idx_deal_contacts_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_contact ON public.deal_contacts USING btree (contact_id);


--
-- Name: idx_deal_contacts_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_deal ON public.deal_contacts USING btree (deal_id);


--
-- Name: idx_deal_contacts_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_contacts_org ON public.deal_contacts USING btree (org_id);


--
-- Name: idx_deal_signing_parties_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_contact ON public.deal_signing_parties USING btree (contact_id);


--
-- Name: idx_deal_signing_parties_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_deal ON public.deal_signing_parties USING btree (deal_id);


--
-- Name: idx_deal_signing_parties_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deal_signing_parties_org ON public.deal_signing_parties USING btree (org_id);


--
-- Name: idx_deals_agent_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_agent_name ON public.deals USING btree (agent_name);


--
-- Name: idx_deals_company_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_company_name ON public.deals USING btree (company_name);


--
-- Name: idx_deals_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_contact ON public.deals USING btree (contact_id);


--
-- Name: idx_deals_contact_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_contact_name ON public.deals USING btree (contact_name);


--
-- Name: idx_deals_converted_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_converted_customer ON public.deals USING btree (converted_to_customer_id);


--
-- Name: idx_deals_converted_lead; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_converted_lead ON public.deals USING btree (converted_from_lead_id);


--
-- Name: idx_deals_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_email ON public.deals USING btree (email);


--
-- Name: idx_deals_external_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_external_source ON public.deals USING btree (external_source_id);


--
-- Name: idx_deals_lead_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_lead_id ON public.deals USING btree (lead_id);


--
-- Name: idx_deals_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_organization ON public.deals USING btree (organization_id);


--
-- Name: idx_deals_priority; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_priority ON public.deals USING btree (priority);


--
-- Name: idx_deals_service_interested; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_service_interested ON public.deals USING btree (service_interested);


--
-- Name: idx_deals_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_source ON public.deals USING btree (source);


--
-- Name: idx_deals_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deals_workspace_id ON public.deals USING btree (workspace_id);


--
-- Name: idx_dm_org_users; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dm_org_users ON public.direct_messages USING btree (org_id, sender_id, receiver_id);


--
-- Name: idx_dm_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_dm_parent ON public.direct_messages USING btree (parent_id);


--
-- Name: idx_documents_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_company_id ON public.documents USING btree (company_id);


--
-- Name: idx_documents_contact_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_contact_id ON public.documents USING btree (contact_id);


--
-- Name: idx_documents_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_created_at ON public.documents USING btree (created_at DESC);


--
-- Name: idx_documents_file_path; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_file_path ON public.documents USING btree (file_path);


--
-- Name: idx_documents_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_org_id ON public.documents USING btree (org_id);


--
-- Name: idx_documents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_status ON public.documents USING btree (status);


--
-- Name: idx_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_type ON public.documents USING btree (type);


--
-- Name: idx_documents_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_documents_user_id ON public.documents USING btree (user_id);


--
-- Name: idx_drive_permissions_drive; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_drive_permissions_drive ON public.drive_permissions USING btree (drive_id);


--
-- Name: idx_email_crm_links_email_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_crm_links_email_id ON public.email_crm_links USING btree (email_id);


--
-- Name: idx_email_crm_links_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_email_crm_links_entity ON public.email_crm_links USING btree (entity_type, entity_id);


--
-- Name: idx_emails_mailbox_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_emails_mailbox_id ON public.emails USING btree (mailbox_id);


--
-- Name: idx_employee_documents_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_employee ON public.employee_documents USING btree (employee_id);


--
-- Name: idx_employee_documents_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_org ON public.employee_documents USING btree (org_id);


--
-- Name: idx_employee_documents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_documents_type ON public.employee_documents USING btree (document_type);


--
-- Name: idx_employee_salaries_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employee_salaries_employee ON public.employee_salaries USING btree (employee_id);


--
-- Name: idx_employees_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_organization ON public.employees USING btree (organization_id);


--
-- Name: idx_entity_drive_files_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_entity_drive_files_entity ON public.entity_drive_files USING btree (entity_type, entity_id);


--
-- Name: idx_epa_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_employee_id ON public.employee_product_assignments USING btree (employee_id);


--
-- Name: idx_epa_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_org_id ON public.employee_product_assignments USING btree (org_id);


--
-- Name: idx_epa_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_product_id ON public.employee_product_assignments USING btree (product_id);


--
-- Name: idx_epa_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_epa_status ON public.employee_product_assignments USING btree (status);


--
-- Name: idx_fcm_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fcm_tokens_user_id ON public.fcm_tokens USING btree (user_id);


--
-- Name: idx_finance_credit_notes_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_credit_notes_invoice ON public.finance_credit_notes USING btree (invoice_id);


--
-- Name: idx_finance_customer_invoices_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_customer_invoices_customer ON public.finance_customer_invoices USING btree (customer_id);


--
-- Name: idx_finance_customer_invoices_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_customer_invoices_org ON public.finance_customer_invoices USING btree (organization_id);


--
-- Name: idx_finance_customer_invoices_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_customer_invoices_status ON public.finance_customer_invoices USING btree (status);


--
-- Name: idx_finance_customer_payments_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_customer_payments_customer ON public.finance_customer_payments USING btree (customer_id);


--
-- Name: idx_finance_customer_payments_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_customer_payments_invoice ON public.finance_customer_payments USING btree (invoice_id);


--
-- Name: idx_finance_debit_notes_invoice; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_finance_debit_notes_invoice ON public.finance_debit_notes USING btree (invoice_id);


--
-- Name: idx_holidays_org_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_holidays_org_date ON public.public_holidays USING btree (org_id, date);


--
-- Name: idx_instantly_events_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instantly_events_org ON public.instantly_unibox_events USING btree (org_id);


--
-- Name: idx_instantly_events_processed; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instantly_events_processed ON public.instantly_unibox_events USING btree (processed);


--
-- Name: idx_instantly_events_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_instantly_events_sender ON public.instantly_unibox_events USING btree (sender_email);


--
-- Name: idx_interviews_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interviews_candidate ON public.candidate_interviews USING btree (candidate_id);


--
-- Name: idx_interviews_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_interviews_date ON public.candidate_interviews USING btree (interview_date);


--
-- Name: idx_invites_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_invites_email ON public.invites USING btree (email);


--
-- Name: idx_invites_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invites_expires_at ON public.invites USING btree (expires_at);


--
-- Name: idx_invites_invite_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invites_invite_expires_at ON public.invites USING btree (invite_expires_at);


--
-- Name: idx_invites_invite_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invites_invite_token ON public.invites USING btree (invite_token);


--
-- Name: idx_invites_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_invites_organization ON public.invites USING btree (organization_id);


--
-- Name: idx_iwrl_org_received; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_iwrl_org_received ON public.instantly_webhook_raw_log USING btree (org_id, received_at DESC);


--
-- Name: idx_job_offers_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_offers_candidate ON public.job_offers USING btree (candidate_id);


--
-- Name: idx_job_offers_created_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_offers_created_date ON public.job_offers USING btree (created_at DESC);


--
-- Name: idx_job_offers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_job_offers_status ON public.job_offers USING btree (status);


--
-- Name: idx_lead_imports_imported_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_imported_by ON public.lead_imports USING btree (imported_by);


--
-- Name: idx_lead_imports_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_org_id ON public.lead_imports USING btree (org_id);


--
-- Name: idx_lead_imports_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_status ON public.lead_imports USING btree (status);


--
-- Name: idx_lead_imports_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_lead_imports_workspace_id ON public.lead_imports USING btree (workspace_id);


--
-- Name: idx_leads_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_assigned_to ON public.leads USING btree (assigned_to);


--
-- Name: idx_leads_converted_deal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_converted_deal ON public.leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_converted_to_deal_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_converted_to_deal_id ON public.leads USING btree (converted_to_deal_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_import_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_import_id ON public.leads USING btree (import_id);


--
-- Name: idx_leads_org_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_org_status ON public.leads USING btree (org_id, status);


--
-- Name: idx_leads_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_organization ON public.leads USING btree (organization_id);


--
-- Name: idx_leads_workspace; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_workspace ON public.leads USING btree (workspace_id);


--
-- Name: idx_leads_workspace_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leads_workspace_id ON public.leads USING btree (workspace_id);


--
-- Name: idx_leave_balances_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_employee ON public.employee_leave_balances USING btree (employee_id);


--
-- Name: idx_leave_balances_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_org ON public.employee_leave_balances USING btree (org_id);


--
-- Name: idx_leave_balances_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_balances_year ON public.employee_leave_balances USING btree (year);


--
-- Name: idx_leave_comments_request; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_comments_request ON public.leave_request_comments USING btree (leave_request_id);


--
-- Name: idx_leave_requests_dates; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_dates ON public.leave_requests USING btree (start_date, end_date);


--
-- Name: idx_leave_requests_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_employee ON public.leave_requests USING btree (employee_id);


--
-- Name: idx_leave_requests_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_org ON public.leave_requests USING btree (org_id);


--
-- Name: idx_leave_requests_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_leave_requests_status ON public.leave_requests USING btree (status);


--
-- Name: idx_mailboxes_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mailboxes_is_active ON public.connected_mailboxes USING btree (is_active);


--
-- Name: idx_marketing_campaign_activities_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaign_activities_campaign ON public.marketing_campaign_activities USING btree (campaign_id);


--
-- Name: idx_marketing_campaign_audiences_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaign_audiences_campaign ON public.marketing_campaign_audiences USING btree (campaign_id);


--
-- Name: idx_marketing_campaign_recipients_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaign_recipients_campaign ON public.marketing_campaign_recipients USING btree (campaign_id);


--
-- Name: idx_marketing_campaign_recipients_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaign_recipients_email ON public.marketing_campaign_recipients USING btree (email);


--
-- Name: idx_marketing_campaign_schedules_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaign_schedules_campaign ON public.marketing_campaign_schedules USING btree (campaign_id);


--
-- Name: idx_marketing_campaigns_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_campaigns_org ON public.marketing_campaigns USING btree (organization_id);


--
-- Name: idx_marketing_email_attachments_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_attachments_campaign ON public.marketing_email_attachments USING btree (campaign_id);


--
-- Name: idx_marketing_email_clicks_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_clicks_campaign ON public.marketing_email_clicks USING btree (campaign_id);


--
-- Name: idx_marketing_email_logs_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_logs_campaign ON public.marketing_email_logs USING btree (campaign_id);


--
-- Name: idx_marketing_email_opens_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_opens_campaign ON public.marketing_email_opens USING btree (campaign_id);


--
-- Name: idx_marketing_email_queue_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_queue_campaign ON public.marketing_email_queue USING btree (campaign_id);


--
-- Name: idx_marketing_email_queue_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_queue_status ON public.marketing_email_queue USING btree (status);


--
-- Name: idx_marketing_email_settings_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_settings_org ON public.marketing_email_settings USING btree (organization_id);


--
-- Name: idx_marketing_email_unsubscribes_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_email_unsubscribes_email ON public.marketing_email_unsubscribes USING btree (email);


--
-- Name: idx_marketing_events_campaign; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_events_campaign ON public.marketing_campaign_events USING btree (campaign_id);


--
-- Name: idx_marketing_events_contact; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_events_contact ON public.marketing_campaign_events USING btree (contact_id);


--
-- Name: idx_marketing_lists_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_marketing_lists_org ON public.marketing_lists USING btree (organization_id);


--
-- Name: idx_mentions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mentions_user ON public.chat_mentions USING btree (mentioned_user_id, is_read);


--
-- Name: idx_milestone_assignees_assigned_to; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestone_assignees_assigned_to ON public.project_milestone_assignees USING btree (assigned_to);


--
-- Name: idx_milestone_assignees_milestone_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestone_assignees_milestone_id ON public.project_milestone_assignees USING btree (milestone_id);


--
-- Name: idx_milestone_assignees_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_milestone_assignees_org_id ON public.project_milestone_assignees USING btree (org_id);


--
-- Name: idx_notifications_user_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_org ON public.notifications USING btree (target_user_id, org_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (target_user_id, org_id, is_read, created_at DESC);


--
-- Name: idx_password_reset_tokens_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens USING btree (token);


--
-- Name: idx_password_reset_tokens_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_tokens_user_id ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_pipeline_stages_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pipeline_stages_org ON public.pipeline_stages USING btree (org_id);


--
-- Name: idx_product_batches_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_batches_org ON public.product_batches USING btree (org_id);


--
-- Name: idx_product_batches_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_product_batches_product ON public.product_batches USING btree (product_id);


--
-- Name: idx_products_barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_barcode ON public.products USING btree (barcode);


--
-- Name: idx_products_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_organization ON public.products USING btree (organization_id);


--
-- Name: idx_products_reorder_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_reorder_level ON public.products USING btree (reorder_level);


--
-- Name: idx_project_activity_logs_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_activity_logs_project ON public.project_activity_logs USING btree (project_id);


--
-- Name: idx_project_attachments_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_attachments_project ON public.project_attachments USING btree (project_id);


--
-- Name: idx_project_comments_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_comments_project ON public.project_comments USING btree (project_id);


--
-- Name: idx_project_comments_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_comments_task ON public.project_comments USING btree (task_id);


--
-- Name: idx_project_invoices_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_invoices_org_id ON public.project_invoices USING btree (org_id);


--
-- Name: idx_project_invoices_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_invoices_project_id ON public.project_invoices USING btree (project_id);


--
-- Name: idx_project_members_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_members_project ON public.project_members USING btree (project_id);


--
-- Name: idx_project_members_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_members_user ON public.project_members USING btree (user_id);


--
-- Name: idx_project_notifications_user_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_notifications_user_project ON public.project_notifications USING btree (user_id, project_id);


--
-- Name: idx_project_shares_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_shares_org_id ON public.project_shares USING btree (org_id);


--
-- Name: idx_project_shares_project_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_shares_project_id ON public.project_shares USING btree (project_id);


--
-- Name: idx_project_shares_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_shares_token ON public.project_shares USING btree (share_token);


--
-- Name: idx_project_tasks_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_tasks_parent ON public.project_tasks USING btree (parent_task_id);


--
-- Name: idx_project_templates_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_templates_org_id ON public.project_templates USING btree (org_id);


--
-- Name: idx_project_templates_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_project_templates_organization_id ON public.project_templates USING btree (organization_id);


--
-- Name: idx_projects_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_organization ON public.projects USING btree (organization_id);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_recruitment_metrics_type_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recruitment_metrics_type_period ON public.recruitment_metrics USING btree (metric_type, period_start_date);


--
-- Name: idx_recruitment_sources_effectiveness; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_recruitment_sources_effectiveness ON public.recruitment_sources USING btree (quality_score DESC);


--
-- Name: idx_requisitions_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requisitions_created ON public.job_requisitions USING btree (created_at DESC);


--
-- Name: idx_requisitions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requisitions_org ON public.job_requisitions USING btree (organization_id);


--
-- Name: idx_requisitions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requisitions_status ON public.job_requisitions USING btree (status);


--
-- Name: idx_salary_components_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_components_org ON public.salary_components USING btree (org_id);


--
-- Name: idx_salary_slips_employee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_slips_employee ON public.salary_slips USING btree (employee_id);


--
-- Name: idx_salary_slips_month_year; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_slips_month_year ON public.salary_slips USING btree (month, year);


--
-- Name: idx_sms_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_logs_entity ON public.sms_logs USING btree (entity_type, entity_id);


--
-- Name: idx_sms_logs_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_logs_org ON public.sms_logs USING btree (org_id, created_at DESC);


--
-- Name: idx_sms_logs_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sms_logs_phone ON public.sms_logs USING btree (phone_number);


--
-- Name: idx_stock_adjustments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_adjustments_org ON public.stock_adjustments USING btree (org_id);


--
-- Name: idx_stock_adjustments_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_adjustments_product ON public.stock_adjustments USING btree (product_id);


--
-- Name: idx_stock_product; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_product ON public.stock USING btree (product_id);


--
-- Name: idx_talent_pool_members_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_talent_pool_members_candidate ON public.talent_pool_members USING btree (candidate_id);


--
-- Name: idx_talent_pool_members_pool; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_talent_pool_members_pool ON public.talent_pool_members USING btree (pool_id);


--
-- Name: idx_talent_pool_members_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_talent_pool_members_status ON public.talent_pool_members USING btree (status);


--
-- Name: idx_task_viewers_task; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_viewers_task ON public.task_viewers USING btree (task_id);


--
-- Name: idx_task_viewers_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_task_viewers_user ON public.task_viewers USING btree (user_id);


--
-- Name: idx_tasks_milestone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_milestone ON public.tasks USING btree (milestone_id);


--
-- Name: idx_tasks_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tasks_parent ON public.tasks USING btree (parent_task_id);


--
-- Name: idx_telephony_providers_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telephony_providers_org ON public.telephony_providers USING btree (org_id);


--
-- Name: idx_timeline_candidate; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_timeline_candidate ON public.candidate_timeline USING btree (candidate_id);


--
-- Name: idx_unibox_campaign_folder_items_folder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_campaign_folder_items_folder ON public.unibox_campaign_folder_items USING btree (folder_id);


--
-- Name: idx_unibox_campaign_folder_items_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_campaign_folder_items_org ON public.unibox_campaign_folder_items USING btree (org_id);


--
-- Name: idx_unibox_campaign_folders_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_campaign_folders_org ON public.unibox_campaign_folders USING btree (org_id);


--
-- Name: idx_unibox_emails_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_org ON public.unibox_emails USING btree (org_id);


--
-- Name: idx_unibox_emails_sender; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_sender ON public.unibox_emails USING btree (sender_email);


--
-- Name: idx_unibox_emails_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_emails_status ON public.unibox_emails USING btree (status);


--
-- Name: idx_unibox_folder_assignments_folder; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_folder_assignments_folder ON public.unibox_campaign_folder_assignments USING btree (folder_id);


--
-- Name: idx_unibox_folder_assignments_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_folder_assignments_org ON public.unibox_campaign_folder_assignments USING btree (org_id);


--
-- Name: idx_unibox_folder_assignments_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unibox_folder_assignments_user ON public.unibox_campaign_folder_assignments USING btree (user_id);


--
-- Name: idx_users_attendance_machine_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_attendance_machine_id ON public.users USING btree (attendance_machine_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_last_seen_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_last_seen_at ON public.users USING btree (last_seen_at);


--
-- Name: idx_users_organization; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization ON public.users USING btree (organization_id);


--
-- Name: idx_vendors_business_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_vendors_business_type ON public.vendors USING btree (business_type);


--
-- Name: idx_workgroup_activities_workgroup_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_activities_workgroup_created ON public.workgroup_activities USING btree (workgroup_id, created_at DESC);


--
-- Name: idx_workgroup_channels_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_channels_type ON public.workgroup_channels USING btree (type);


--
-- Name: idx_workgroup_channels_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_channels_workgroup_id ON public.workgroup_channels USING btree (workgroup_id);


--
-- Name: idx_workgroup_files_channel_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_channel_id ON public.workgroup_files USING btree (channel_id);


--
-- Name: idx_workgroup_files_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_created_at ON public.workgroup_files USING btree (created_at DESC);


--
-- Name: idx_workgroup_files_uploaded_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_uploaded_by ON public.workgroup_files USING btree (uploaded_by);


--
-- Name: idx_workgroup_files_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_files_workgroup_id ON public.workgroup_files USING btree (workgroup_id);


--
-- Name: idx_workgroup_meetings_scheduled_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_scheduled_start ON public.workgroup_meetings USING btree (scheduled_start);


--
-- Name: idx_workgroup_meetings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_status ON public.workgroup_meetings USING btree (status);


--
-- Name: idx_workgroup_meetings_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_meetings_workgroup_id ON public.workgroup_meetings USING btree (workgroup_id);


--
-- Name: idx_workgroup_members_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_role ON public.workgroup_members USING btree (role);


--
-- Name: idx_workgroup_members_starred; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_starred ON public.workgroup_members USING btree (user_id, is_starred) WHERE (is_starred = true);


--
-- Name: idx_workgroup_members_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_user_id ON public.workgroup_members USING btree (user_id);


--
-- Name: idx_workgroup_members_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_members_workgroup_id ON public.workgroup_members USING btree (workgroup_id);


--
-- Name: idx_workgroup_notifications_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_created_at ON public.workgroup_notifications USING btree (created_at DESC);


--
-- Name: idx_workgroup_notifications_is_read; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_is_read ON public.workgroup_notifications USING btree (is_read);


--
-- Name: idx_workgroup_notifications_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_user_id ON public.workgroup_notifications USING btree (user_id);


--
-- Name: idx_workgroup_notifications_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_notifications_workgroup_id ON public.workgroup_notifications USING btree (workgroup_id);


--
-- Name: idx_workgroup_post_reads_post_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_post_reads_post_id ON public.workgroup_post_reads USING btree (post_id);


--
-- Name: idx_workgroup_posts_channel_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_channel_id ON public.workgroup_posts USING btree (channel_id);


--
-- Name: idx_workgroup_posts_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_created_at ON public.workgroup_posts USING btree (created_at DESC);


--
-- Name: idx_workgroup_posts_parent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_parent ON public.workgroup_posts USING btree (parent_id);


--
-- Name: idx_workgroup_posts_parent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_parent_id ON public.workgroup_posts USING btree (parent_id);


--
-- Name: idx_workgroup_posts_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_posts_workgroup_id ON public.workgroup_posts USING btree (workgroup_id);


--
-- Name: idx_workgroup_wiki_pages_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_wiki_pages_slug ON public.workgroup_wiki_pages USING btree (workgroup_id, slug);


--
-- Name: idx_workgroup_wiki_pages_workgroup_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroup_wiki_pages_workgroup_id ON public.workgroup_wiki_pages USING btree (workgroup_id);


--
-- Name: idx_workgroups_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_created_at ON public.workgroups USING btree (created_at DESC);


--
-- Name: idx_workgroups_org_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_org_id ON public.workgroups USING btree (org_id);


--
-- Name: idx_workgroups_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workgroups_type ON public.workgroups USING btree (type);


--
-- Name: car_inquiries car_inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER car_inquiries_updated_at BEFORE UPDATE ON public.car_inquiries FOR EACH ROW EXECUTE FUNCTION public.update_car_updated_at();


--
-- Name: car_inventory car_inventory_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER car_inventory_updated_at BEFORE UPDATE ON public.car_inventory FOR EACH ROW EXECUTE FUNCTION public.update_car_updated_at();


--
-- Name: car_sales car_sales_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER car_sales_updated_at BEFORE UPDATE ON public.car_sales FOR EACH ROW EXECUTE FUNCTION public.update_car_updated_at();


--
-- Name: car_test_drives car_test_drives_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER car_test_drives_updated_at BEFORE UPDATE ON public.car_test_drives FOR EACH ROW EXECUTE FUNCTION public.update_car_updated_at();


--
-- Name: car_workspaces car_workspaces_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER car_workspaces_updated_at BEFORE UPDATE ON public.car_workspaces FOR EACH ROW EXECUTE FUNCTION public.update_car_updated_at();


--
-- Name: notifications trg_prune_notifications; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_prune_notifications AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.prune_old_notifications();


--
-- Name: workgroups trigger_add_creator_as_owner; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_add_creator_as_owner AFTER INSERT ON public.workgroups FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();


--
-- Name: workgroups trigger_create_default_channel; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_create_default_channel AFTER INSERT ON public.workgroups FOR EACH ROW EXECUTE FUNCTION public.create_default_channel();


--
-- Name: stock trigger_log_stock_movement; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_log_stock_movement AFTER UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.log_stock_movement();


--
-- Name: leave_balances trigger_update_leave_balance; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_leave_balance BEFORE INSERT OR UPDATE ON public.leave_balances FOR EACH ROW EXECUTE FUNCTION public.update_leave_remaining_days();


--
-- Name: stock trigger_update_stock_available; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_stock_available BEFORE INSERT OR UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION public.update_stock_available_quantity();


--
-- Name: workgroup_members trigger_update_workgroup_member_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_workgroup_member_count AFTER INSERT OR DELETE ON public.workgroup_members FOR EACH ROW EXECUTE FUNCTION public.update_workgroup_member_count();


--
-- Name: workgroup_posts trigger_update_workgroup_message_count; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_update_workgroup_message_count AFTER INSERT OR DELETE ON public.workgroup_posts FOR EACH ROW EXECUTE FUNCTION public.update_workgroup_message_count();


--
-- Name: activities update_activities_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: attendance update_attendance_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: calendar_events update_calendar_events_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: companies update_companies_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: deals update_deals_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: drive_files update_drive_files_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_drive_files_updated_at BEFORE UPDATE ON public.drive_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: employees update_employees_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: leads update_leads_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_campaigns update_marketing_campaigns_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_campaigns_updated_at BEFORE UPDATE ON public.marketing_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_forms update_marketing_forms_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_forms_updated_at BEFORE UPDATE ON public.marketing_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_lists update_marketing_lists_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_lists_updated_at BEFORE UPDATE ON public.marketing_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_segments update_marketing_segments_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_segments_updated_at BEFORE UPDATE ON public.marketing_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_sequences update_marketing_sequences_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_sequences_updated_at BEFORE UPDATE ON public.marketing_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: marketing_templates update_marketing_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_marketing_templates_updated_at BEFORE UPDATE ON public.marketing_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notification_templates update_notification_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_notification_templates_updated_at BEFORE UPDATE ON public.notification_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: payroll update_payroll_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: products update_products_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_invoices update_project_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_invoices_updated_at BEFORE UPDATE ON public.project_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_risks update_project_risks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_risks_updated_at BEFORE UPDATE ON public.project_risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_tasks update_project_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: project_templates update_project_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_project_templates_updated_at BEFORE UPDATE ON public.project_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: purchase_orders update_purchase_orders_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vendors update_vendors_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: warehouses update_warehouses_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workflows update_workflows_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: workgroup_wiki update_workgroup_wiki_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_workgroup_wiki_updated_at BEFORE UPDATE ON public.workgroup_wiki FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activities activities_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: activities activities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: activities activities_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: activities activities_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id);


--
-- Name: activities activities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id);


--
-- Name: activities activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: activities activities_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: attendance attendance_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: attendance attendance_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: attendance attendance_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance
    ADD CONSTRAINT attendance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: background_check_types background_check_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_check_types
    ADD CONSTRAINT background_check_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: background_checks background_checks_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_checks
    ADD CONSTRAINT background_checks_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: background_checks background_checks_check_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_checks
    ADD CONSTRAINT background_checks_check_type_id_fkey FOREIGN KEY (check_type_id) REFERENCES public.background_check_types(id);


--
-- Name: background_checks background_checks_initiated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_checks
    ADD CONSTRAINT background_checks_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES public.users(id);


--
-- Name: background_checks background_checks_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.background_checks
    ADD CONSTRAINT background_checks_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: calendar_event_attendees calendar_event_attendees_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.calendar_events(id) ON DELETE CASCADE;


--
-- Name: calendar_event_attendees calendar_event_attendees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_event_attendees
    ADD CONSTRAINT calendar_event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: calendar_events calendar_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: call_logs call_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: candidate_application_forms candidate_application_forms_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_application_forms
    ADD CONSTRAINT candidate_application_forms_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: candidate_application_forms candidate_application_forms_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_application_forms
    ADD CONSTRAINT candidate_application_forms_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);


--
-- Name: candidate_application_forms candidate_application_forms_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_application_forms
    ADD CONSTRAINT candidate_application_forms_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: candidate_interviews candidate_interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_interviews
    ADD CONSTRAINT candidate_interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: candidate_interviews candidate_interviews_interviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_interviews
    ADD CONSTRAINT candidate_interviews_interviewer_id_fkey FOREIGN KEY (interviewer_id) REFERENCES public.users(id);


--
-- Name: candidate_interviews candidate_interviews_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_interviews
    ADD CONSTRAINT candidate_interviews_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: candidate_rankings candidate_rankings_calculated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id);


--
-- Name: candidate_rankings candidate_rankings_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: candidate_rankings candidate_rankings_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_rankings
    ADD CONSTRAINT candidate_rankings_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: candidate_scores candidate_scores_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: candidate_scores candidate_scores_criteria_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_criteria_id_fkey FOREIGN KEY (criteria_id) REFERENCES public.scoring_criteria(id);


--
-- Name: candidate_scores candidate_scores_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.candidate_interviews(id);


--
-- Name: candidate_scores candidate_scores_scored_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_scores
    ADD CONSTRAINT candidate_scores_scored_by_fkey FOREIGN KEY (scored_by) REFERENCES public.users(id);


--
-- Name: candidate_timeline candidate_timeline_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_timeline
    ADD CONSTRAINT candidate_timeline_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: candidate_timeline candidate_timeline_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidate_timeline
    ADD CONSTRAINT candidate_timeline_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.users(id);


--
-- Name: candidates candidates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: candidates candidates_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: candidates candidates_screened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.candidates
    ADD CONSTRAINT candidates_screened_by_fkey FOREIGN KEY (screened_by) REFERENCES public.users(id);


--
-- Name: car_activity_log car_activity_log_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_activity_log
    ADD CONSTRAINT car_activity_log_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE CASCADE;


--
-- Name: car_activity_log car_activity_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_activity_log
    ADD CONSTRAINT car_activity_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: car_documents car_documents_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_documents
    ADD CONSTRAINT car_documents_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE CASCADE;


--
-- Name: car_inquiries car_inquiries_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inquiries
    ADD CONSTRAINT car_inquiries_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE CASCADE;


--
-- Name: car_inquiries car_inquiries_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inquiries
    ADD CONSTRAINT car_inquiries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: car_inventory car_inventory_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_inventory
    ADD CONSTRAINT car_inventory_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: car_sales car_sales_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_sales
    ADD CONSTRAINT car_sales_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE RESTRICT;


--
-- Name: car_sales car_sales_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_sales
    ADD CONSTRAINT car_sales_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: car_service_history car_service_history_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_service_history
    ADD CONSTRAINT car_service_history_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE CASCADE;


--
-- Name: car_test_drives car_test_drives_car_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_test_drives
    ADD CONSTRAINT car_test_drives_car_id_fkey FOREIGN KEY (car_id) REFERENCES public.car_inventory(id) ON DELETE CASCADE;


--
-- Name: car_test_drives car_test_drives_inquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_test_drives
    ADD CONSTRAINT car_test_drives_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.car_inquiries(id) ON DELETE SET NULL;


--
-- Name: car_test_drives car_test_drives_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_test_drives
    ADD CONSTRAINT car_test_drives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: car_workspace_members car_workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.car_workspace_members
    ADD CONSTRAINT car_workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.car_workspaces(id) ON DELETE CASCADE;


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: companies companies_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: companies companies_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: connected_drives connected_drives_connected_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_connected_by_fkey FOREIGN KEY (connected_by) REFERENCES public.users(id);


--
-- Name: connected_drives connected_drives_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_drives
    ADD CONSTRAINT connected_drives_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: connected_mailboxes connected_mailboxes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.connected_mailboxes
    ADD CONSTRAINT connected_mailboxes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: contacts contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: contacts contacts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: contacts contacts_responsible_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_responsible_id_fkey FOREIGN KEY (responsible_id) REFERENCES public.users(id);


--
-- Name: customers customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: customers customers_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: customers customers_converted_from_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_converted_from_deal_id_fkey FOREIGN KEY (converted_from_deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: customers customers_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: customers customers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: customers customers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_contacts deal_contacts_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_contacts
    ADD CONSTRAINT deal_contacts_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_signing_parties deal_signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deal_signing_parties
    ADD CONSTRAINT deal_signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: deals deals_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: deals deals_converted_from_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_converted_from_lead_id_fkey FOREIGN KEY (converted_from_lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: deals deals_converted_to_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_converted_to_customer_id_fkey FOREIGN KEY (converted_to_customer_id) REFERENCES public.customers(id);


--
-- Name: deals deals_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: deals deals_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: deals deals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: deals deals_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: deals deals_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workgroups(id) ON DELETE SET NULL;


--
-- Name: drive_activities drive_activities_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_activities drive_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_activities
    ADD CONSTRAINT drive_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: drive_file_versions drive_file_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_file_versions drive_file_versions_file_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_file_versions
    ADD CONSTRAINT drive_file_versions_file_id_fkey FOREIGN KEY (file_id) REFERENCES public.drive_files(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_files drive_files_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.drive_folders(id);


--
-- Name: drive_files drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_files drive_files_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.drive_files(id);


--
-- Name: drive_files drive_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_files
    ADD CONSTRAINT drive_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: drive_folders drive_folders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: drive_folders drive_folders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_parent_folder_id_fkey FOREIGN KEY (parent_folder_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_folders drive_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_folders
    ADD CONSTRAINT drive_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.drive_folders(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_drive_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_drive_id_fkey FOREIGN KEY (drive_id) REFERENCES public.connected_drives(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: drive_permissions drive_permissions_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_role_fkey FOREIGN KEY (role) REFERENCES public.roles(id);


--
-- Name: drive_permissions drive_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drive_permissions
    ADD CONSTRAINT drive_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: email_crm_links email_crm_links_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_crm_links
    ADD CONSTRAINT email_crm_links_email_id_fkey FOREIGN KEY (email_id) REFERENCES public.emails(id) ON DELETE CASCADE;


--
-- Name: email_crm_links email_crm_links_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_crm_links
    ADD CONSTRAINT email_crm_links_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_mailbox_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_mailbox_id_fkey FOREIGN KEY (mailbox_id) REFERENCES public.connected_mailboxes(id) ON DELETE CASCADE;


--
-- Name: emails emails_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: emails emails_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.emails
    ADD CONSTRAINT emails_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employee_documents employee_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_documents
    ADD CONSTRAINT employee_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: employee_leave_balances employee_leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id) ON DELETE CASCADE;


--
-- Name: employee_leave_balances employee_leave_balances_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employee_leave_balances
    ADD CONSTRAINT employee_leave_balances_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: employees employees_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employees(id);


--
-- Name: employees employees_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: employees employees_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: employees employees_reporting_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_reporting_manager_id_fkey FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id);


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: entity_drive_files entity_drive_files_linked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES public.users(id);


--
-- Name: entity_drive_files entity_drive_files_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.entity_drive_files
    ADD CONSTRAINT entity_drive_files_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: fcm_tokens fcm_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fcm_tokens
    ADD CONSTRAINT fcm_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: finance_accounting_periods finance_accounting_periods_fiscal_year_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_accounting_periods
    ADD CONSTRAINT finance_accounting_periods_fiscal_year_id_fkey FOREIGN KEY (fiscal_year_id) REFERENCES public.finance_fiscal_years(id) ON DELETE CASCADE;


--
-- Name: finance_approval_rules finance_approval_rules_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_approval_rules
    ADD CONSTRAINT finance_approval_rules_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: finance_approval_rules finance_approval_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_approval_rules
    ADD CONSTRAINT finance_approval_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_bank_accounts finance_bank_accounts_chart_of_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_chart_of_account_id_fkey FOREIGN KEY (chart_of_account_id) REFERENCES public.finance_chart_accounts(id) ON DELETE SET NULL;


--
-- Name: finance_bank_accounts finance_bank_accounts_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_bank_accounts finance_bank_accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_accounts
    ADD CONSTRAINT finance_bank_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_bank_reconciliations finance_bank_reconciliations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_reconciliations
    ADD CONSTRAINT finance_bank_reconciliations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_bank_transfers finance_bank_transfers_from_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_transfers
    ADD CONSTRAINT finance_bank_transfers_from_bank_account_id_fkey FOREIGN KEY (from_bank_account_id) REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_bank_transfers finance_bank_transfers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_transfers
    ADD CONSTRAINT finance_bank_transfers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_bank_transfers finance_bank_transfers_to_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_bank_transfers
    ADD CONSTRAINT finance_bank_transfers_to_bank_account_id_fkey FOREIGN KEY (to_bank_account_id) REFERENCES public.finance_bank_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_budgets finance_budgets_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_budgets finance_budgets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_budgets
    ADD CONSTRAINT finance_budgets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: finance_chart_accounts finance_chart_accounts_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_chart_accounts
    ADD CONSTRAINT finance_chart_accounts_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_chart_accounts finance_chart_accounts_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_chart_accounts
    ADD CONSTRAINT finance_chart_accounts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_chart_accounts finance_chart_accounts_parent_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_chart_accounts
    ADD CONSTRAINT finance_chart_accounts_parent_account_fkey FOREIGN KEY (parent_account) REFERENCES public.finance_chart_accounts(id) ON DELETE SET NULL;


--
-- Name: finance_cost_centers finance_cost_centers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_cost_centers
    ADD CONSTRAINT finance_cost_centers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_credit_notes finance_credit_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_credit_notes
    ADD CONSTRAINT finance_credit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_credit_notes finance_credit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_credit_notes
    ADD CONSTRAINT finance_credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_customer_invoices(id) ON DELETE CASCADE;


--
-- Name: finance_credit_notes finance_credit_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_credit_notes
    ADD CONSTRAINT finance_credit_notes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_customer_invoices finance_customer_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_customer_invoices finance_customer_invoices_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_customer_invoices finance_customer_invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: finance_customer_invoices finance_customer_invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_invoices
    ADD CONSTRAINT finance_customer_invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_customer_payments finance_customer_payments_bank_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_payments
    ADD CONSTRAINT finance_customer_payments_bank_account_fkey FOREIGN KEY (bank_account) REFERENCES public.finance_chart_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_customer_payments finance_customer_payments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_payments
    ADD CONSTRAINT finance_customer_payments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: finance_customer_payments finance_customer_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_customer_payments
    ADD CONSTRAINT finance_customer_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_customer_invoices(id) ON DELETE CASCADE;


--
-- Name: finance_debit_notes finance_debit_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_debit_notes
    ADD CONSTRAINT finance_debit_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_debit_notes finance_debit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_debit_notes
    ADD CONSTRAINT finance_debit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.finance_customer_invoices(id) ON DELETE CASCADE;


--
-- Name: finance_debit_notes finance_debit_notes_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_debit_notes
    ADD CONSTRAINT finance_debit_notes_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_exchange_rates finance_exchange_rates_from_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_exchange_rates
    ADD CONSTRAINT finance_exchange_rates_from_currency_fkey FOREIGN KEY (from_currency) REFERENCES public.finance_currencies(id) ON DELETE CASCADE;


--
-- Name: finance_exchange_rates finance_exchange_rates_to_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_exchange_rates
    ADD CONSTRAINT finance_exchange_rates_to_currency_fkey FOREIGN KEY (to_currency) REFERENCES public.finance_currencies(id) ON DELETE CASCADE;


--
-- Name: finance_expenses finance_expenses_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_expenses finance_expenses_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_expenses finance_expenses_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: finance_expenses finance_expenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_expenses
    ADD CONSTRAINT finance_expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_fiscal_years finance_fiscal_years_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_fiscal_years
    ADD CONSTRAINT finance_fiscal_years_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_fiscal_years finance_fiscal_years_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_fiscal_years
    ADD CONSTRAINT finance_fiscal_years_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_journal_entries finance_journal_entries_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entries
    ADD CONSTRAINT finance_journal_entries_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_journal_entries finance_journal_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entries
    ADD CONSTRAINT finance_journal_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.finance_chart_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.finance_cost_centers(id) ON DELETE SET NULL;


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_journal_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_journal_entry_id_fkey FOREIGN KEY (journal_entry_id) REFERENCES public.finance_journal_entries(id) ON DELETE CASCADE;


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_journal_entry_lines finance_journal_entry_lines_profit_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_journal_entry_lines
    ADD CONSTRAINT finance_journal_entry_lines_profit_center_id_fkey FOREIGN KEY (profit_center_id) REFERENCES public.finance_profit_centers(id) ON DELETE SET NULL;


--
-- Name: finance_profit_centers finance_profit_centers_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_profit_centers
    ADD CONSTRAINT finance_profit_centers_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: finance_profit_centers finance_profit_centers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_profit_centers
    ADD CONSTRAINT finance_profit_centers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_recurring_expenses finance_recurring_expenses_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_recurring_expenses
    ADD CONSTRAINT finance_recurring_expenses_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_recurring_expenses finance_recurring_expenses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_recurring_expenses
    ADD CONSTRAINT finance_recurring_expenses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_vendor_bills finance_vendor_bills_currency_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_currency_fkey FOREIGN KEY (currency) REFERENCES public.finance_currencies(id) ON DELETE SET NULL;


--
-- Name: finance_vendor_bills finance_vendor_bills_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: finance_vendor_bills finance_vendor_bills_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: finance_vendor_bills finance_vendor_bills_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_bills
    ADD CONSTRAINT finance_vendor_bills_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: finance_vendor_payments finance_vendor_payments_bank_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_payments
    ADD CONSTRAINT finance_vendor_payments_bank_account_fkey FOREIGN KEY (bank_account) REFERENCES public.finance_chart_accounts(id) ON DELETE CASCADE;


--
-- Name: finance_vendor_payments finance_vendor_payments_vendor_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_payments
    ADD CONSTRAINT finance_vendor_payments_vendor_bill_id_fkey FOREIGN KEY (vendor_bill_id) REFERENCES public.finance_vendor_bills(id) ON DELETE CASCADE;


--
-- Name: finance_vendor_payments finance_vendor_payments_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.finance_vendor_payments
    ADD CONSTRAINT finance_vendor_payments_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: direct_messages fk_dm_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT fk_dm_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: direct_messages fk_dm_parent; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT fk_dm_parent FOREIGN KEY (parent_id) REFERENCES public.direct_messages(id) ON DELETE SET NULL;


--
-- Name: direct_messages fk_dm_receiver; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT fk_dm_receiver FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: direct_messages fk_dm_sender; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.direct_messages
    ADD CONSTRAINT fk_dm_sender FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: documents fk_documents_company; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: documents fk_documents_contact; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_contact FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: documents fk_documents_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: documents fk_documents_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_mentions fk_mention_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mentions
    ADD CONSTRAINT fk_mention_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: chat_mentions fk_mention_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.chat_mentions
    ADD CONSTRAINT fk_mention_user FOREIGN KEY (mentioned_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_shares fk_project_shares_org; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT fk_project_shares_org FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_shares fk_project_shares_project; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT fk_project_shares_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_product; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT fk_stock_product FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock fk_stock_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT fk_stock_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: hrms_notifications hrms_notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hrms_notifications
    ADD CONSTRAINT hrms_notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instantly_integrations instantly_integrations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_integrations
    ADD CONSTRAINT instantly_integrations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instantly_unibox_events instantly_unibox_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_unibox_events
    ADD CONSTRAINT instantly_unibox_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;


--
-- Name: instantly_unibox_events instantly_unibox_events_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_unibox_events
    ADD CONSTRAINT instantly_unibox_events_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instantly_webhook_health instantly_webhook_health_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_health
    ADD CONSTRAINT instantly_webhook_health_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: instantly_webhook_registrations instantly_webhook_registrations_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.instantly_webhook_registrations
    ADD CONSTRAINT instantly_webhook_registrations_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: interview_feedback interview_feedback_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id);


--
-- Name: interview_feedback interview_feedback_feedback_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_feedback_by_fkey FOREIGN KEY (feedback_by) REFERENCES public.users(id);


--
-- Name: interview_feedback interview_feedback_interview_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.interview_feedback
    ADD CONSTRAINT interview_feedback_interview_id_fkey FOREIGN KEY (interview_id) REFERENCES public.candidate_interviews(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoice_items invoice_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: invoices invoices_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: invoices invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: job_advertisements job_advertisements_published_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_advertisements
    ADD CONSTRAINT job_advertisements_published_by_fkey FOREIGN KEY (published_by) REFERENCES public.users(id);


--
-- Name: job_advertisements job_advertisements_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_advertisements
    ADD CONSTRAINT job_advertisements_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id) ON DELETE CASCADE;


--
-- Name: job_offers job_offers_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: job_offers job_offers_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: job_offers job_offers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: job_offers job_offers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: job_offers job_offers_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_offers
    ADD CONSTRAINT job_offers_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: job_requisitions job_requisitions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_requisitions
    ADD CONSTRAINT job_requisitions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: job_requisitions job_requisitions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_requisitions
    ADD CONSTRAINT job_requisitions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.users(id);


--
-- Name: job_templates job_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_templates
    ADD CONSTRAINT job_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: job_templates job_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_templates
    ADD CONSTRAINT job_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: job_templates job_templates_parent_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.job_templates
    ADD CONSTRAINT job_templates_parent_template_id_fkey FOREIGN KEY (parent_template_id) REFERENCES public.job_templates(id);


--
-- Name: lead_external_sources lead_external_sources_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_external_sources lead_external_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_external_sources
    ADD CONSTRAINT lead_external_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.users(id);


--
-- Name: lead_workspace_access lead_workspace_access_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: lead_workspace_access lead_workspace_access_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspace_access
    ADD CONSTRAINT lead_workspace_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lead_workspaces lead_workspaces_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: lead_workspaces lead_workspaces_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lead_workspaces
    ADD CONSTRAINT lead_workspaces_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: leads leads_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: leads leads_converted_to_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_to_deal_id_fkey FOREIGN KEY (converted_to_deal_id) REFERENCES public.deals(id);


--
-- Name: leads leads_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: leads leads_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leads leads_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: leads leads_unibox_email_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_unibox_email_id_fkey FOREIGN KEY (unibox_email_id) REFERENCES public.unibox_emails(id) ON DELETE SET NULL;


--
-- Name: leave_balances leave_balances_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_leave_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_leave_request_id_fkey FOREIGN KEY (leave_request_id) REFERENCES public.leave_requests(id) ON DELETE CASCADE;


--
-- Name: leave_request_comments leave_request_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_request_comments
    ADD CONSTRAINT leave_request_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: leave_requests leave_requests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: leave_types leave_types_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_results marketing_ab_test_results_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_results
    ADD CONSTRAINT marketing_ab_test_results_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.marketing_ab_test_variants(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_test_variants marketing_ab_test_variants_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_test_variants
    ADD CONSTRAINT marketing_ab_test_variants_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.marketing_ab_tests(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_ab_tests marketing_ab_tests_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_ab_tests marketing_ab_tests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_ab_tests
    ADD CONSTRAINT marketing_ab_tests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_activities marketing_campaign_activities_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_activities
    ADD CONSTRAINT marketing_campaign_activities_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_analytics marketing_campaign_analytics_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_analytics
    ADD CONSTRAINT marketing_campaign_analytics_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_events marketing_campaign_events_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_events
    ADD CONSTRAINT marketing_campaign_events_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_recipients marketing_campaign_recipients_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_recipients
    ADD CONSTRAINT marketing_campaign_recipients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaign_schedules marketing_campaign_schedules_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaign_schedules
    ADD CONSTRAINT marketing_campaign_schedules_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_campaigns marketing_campaigns_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_campaigns marketing_campaigns_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_campaigns
    ADD CONSTRAINT marketing_campaigns_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_email_attachments marketing_email_attachments_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_attachments
    ADD CONSTRAINT marketing_email_attachments_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_bounces marketing_email_bounces_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_bounces
    ADD CONSTRAINT marketing_email_bounces_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_bounces marketing_email_bounces_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_bounces
    ADD CONSTRAINT marketing_email_bounces_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: marketing_email_clicks marketing_email_clicks_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_clicks
    ADD CONSTRAINT marketing_email_clicks_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_clicks marketing_email_clicks_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_clicks
    ADD CONSTRAINT marketing_email_clicks_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: marketing_email_logs marketing_email_logs_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_logs
    ADD CONSTRAINT marketing_email_logs_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_logs marketing_email_logs_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_logs
    ADD CONSTRAINT marketing_email_logs_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: marketing_email_opens marketing_email_opens_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_opens
    ADD CONSTRAINT marketing_email_opens_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_opens marketing_email_opens_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_opens
    ADD CONSTRAINT marketing_email_opens_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: marketing_email_queue marketing_email_queue_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_queue
    ADD CONSTRAINT marketing_email_queue_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE;


--
-- Name: marketing_email_queue marketing_email_queue_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_email_queue
    ADD CONSTRAINT marketing_email_queue_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES public.marketing_campaign_recipients(id) ON DELETE CASCADE;


--
-- Name: marketing_form_submissions marketing_form_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: marketing_form_submissions marketing_form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_form_submissions
    ADD CONSTRAINT marketing_form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.marketing_forms(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_forms marketing_forms_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.marketing_lists(id);


--
-- Name: marketing_forms marketing_forms_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_forms marketing_forms_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_forms
    ADD CONSTRAINT marketing_forms_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.marketing_lists(id) ON DELETE CASCADE;


--
-- Name: marketing_list_members marketing_list_members_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_list_members
    ADD CONSTRAINT marketing_list_members_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: marketing_lists marketing_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_lists marketing_lists_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_lists marketing_lists_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_lists
    ADD CONSTRAINT marketing_lists_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_history marketing_scoring_history_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_history
    ADD CONSTRAINT marketing_scoring_history_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.marketing_scoring_rules(id);


--
-- Name: marketing_scoring_rules marketing_scoring_rules_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_scoring_rules marketing_scoring_rules_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_scoring_rules
    ADD CONSTRAINT marketing_scoring_rules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_segments marketing_segments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_segments marketing_segments_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_segments
    ADD CONSTRAINT marketing_segments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_enrollments marketing_sequence_enrollments_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_enrollments
    ADD CONSTRAINT marketing_sequence_enrollments_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequence_steps marketing_sequence_steps_sequence_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequence_steps
    ADD CONSTRAINT marketing_sequence_steps_sequence_id_fkey FOREIGN KEY (sequence_id) REFERENCES public.marketing_sequences(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_sequences marketing_sequences_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_sequences marketing_sequences_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_sequences
    ADD CONSTRAINT marketing_sequences_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_templates marketing_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_templates marketing_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_templates
    ADD CONSTRAINT marketing_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_logs marketing_webhook_logs_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_logs
    ADD CONSTRAINT marketing_webhook_logs_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhook_queue marketing_webhook_queue_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhook_queue
    ADD CONSTRAINT marketing_webhook_queue_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.marketing_webhooks(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: marketing_webhooks marketing_webhooks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: marketing_webhooks marketing_webhooks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.marketing_webhooks
    ADD CONSTRAINT marketing_webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notification_templates notification_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: offer_approvals offer_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offer_approvals
    ADD CONSTRAINT offer_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: offer_approvals offer_approvals_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.offer_approvals
    ADD CONSTRAINT offer_approvals_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.job_offers(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: payroll payroll_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: payroll payroll_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll
    ADD CONSTRAINT payroll_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_batches product_batches_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_batches
    ADD CONSTRAINT product_batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.vendors(id);


--
-- Name: products products_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: products products_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: products products_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.vendors(id);


--
-- Name: profiles profiles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_documents project_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_documents
    ADD CONSTRAINT project_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: project_invoices project_invoices_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_invoices
    ADD CONSTRAINT project_invoices_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_invoices project_invoices_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_invoices
    ADD CONSTRAINT project_invoices_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: project_invoices project_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_invoices
    ADD CONSTRAINT project_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_milestone_assignees project_milestone_assignees_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_milestone_assignees project_milestone_assignees_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_milestone_assignees project_milestone_assignees_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.project_milestones(id) ON DELETE CASCADE;


--
-- Name: project_milestone_assignees project_milestone_assignees_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestone_assignees
    ADD CONSTRAINT project_milestone_assignees_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_milestones project_milestones_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_milestones project_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_milestones
    ADD CONSTRAINT project_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_notifications project_notifications_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_notifications project_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_notifications
    ADD CONSTRAINT project_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: project_risks project_risks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: project_risks project_risks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_risks
    ADD CONSTRAINT project_risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_shares project_shares_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_shares project_shares_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_shares
    ADD CONSTRAINT project_shares_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: project_tasks project_tasks_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_tasks project_tasks_parent_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_parent_task_id_fkey FOREIGN KEY (parent_task_id) REFERENCES public.project_tasks(id);


--
-- Name: project_tasks project_tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_tasks
    ADD CONSTRAINT project_tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_templates project_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: project_templates project_templates_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_templates project_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_time_entries project_time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.project_tasks(id);


--
-- Name: project_time_entries project_time_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.project_time_entries
    ADD CONSTRAINT project_time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.customers(id);


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: projects projects_delegated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_delegated_by_fkey FOREIGN KEY (delegated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: projects projects_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: projects projects_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: public_holidays public_holidays_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: purchase_orders purchase_orders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_vendor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_vendor_id_fkey FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: recruitment_metrics recruitment_metrics_calculated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_metrics
    ADD CONSTRAINT recruitment_metrics_calculated_by_fkey FOREIGN KEY (calculated_by) REFERENCES public.users(id);


--
-- Name: recruitment_metrics recruitment_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_metrics
    ADD CONSTRAINT recruitment_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: recruitment_metrics recruitment_metrics_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_metrics
    ADD CONSTRAINT recruitment_metrics_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id);


--
-- Name: recruitment_sources recruitment_sources_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recruitment_sources
    ADD CONSTRAINT recruitment_sources_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: requisition_approvals requisition_approvals_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requisition_approvals
    ADD CONSTRAINT requisition_approvals_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: requisition_approvals requisition_approvals_requisition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requisition_approvals
    ADD CONSTRAINT requisition_approvals_requisition_id_fkey FOREIGN KEY (requisition_id) REFERENCES public.job_requisitions(id) ON DELETE CASCADE;


--
-- Name: roles roles_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: roles roles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: scoring_criteria scoring_criteria_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: scoring_criteria scoring_criteria_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scoring_criteria
    ADD CONSTRAINT scoring_criteria_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: signing_parties signing_parties_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: signing_parties signing_parties_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.signing_parties
    ADD CONSTRAINT signing_parties_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sms_logs sms_logs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);


--
-- Name: sms_logs sms_logs_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: sms_logs sms_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sms_logs
    ADD CONSTRAINT sms_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock stock_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: stock_movements stock_movements_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock_movements stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: stock stock_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: stock stock_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: stock stock_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock
    ADD CONSTRAINT stock_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;


--
-- Name: talent_pool_members talent_pool_members_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pool_members
    ADD CONSTRAINT talent_pool_members_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: talent_pool_members talent_pool_members_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pool_members
    ADD CONSTRAINT talent_pool_members_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(id) ON DELETE CASCADE;


--
-- Name: talent_pool_members talent_pool_members_pool_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pool_members
    ADD CONSTRAINT talent_pool_members_pool_id_fkey FOREIGN KEY (pool_id) REFERENCES public.talent_pools(id) ON DELETE CASCADE;


--
-- Name: talent_pools talent_pools_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pools
    ADD CONSTRAINT talent_pools_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: talent_pools talent_pools_managed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pools
    ADD CONSTRAINT talent_pools_managed_by_fkey FOREIGN KEY (managed_by) REFERENCES public.users(id);


--
-- Name: talent_pools talent_pools_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.talent_pools
    ADD CONSTRAINT talent_pools_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: task_viewers task_viewers_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.task_viewers
    ADD CONSTRAINT task_viewers_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_delegated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_delegated_by_fkey FOREIGN KEY (delegated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: telephony_providers telephony_providers_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telephony_providers
    ADD CONSTRAINT telephony_providers_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folder_assignments unibox_campaign_folder_assignments_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_assignments
    ADD CONSTRAINT unibox_campaign_folder_assignments_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.unibox_campaign_folders(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folder_assignments unibox_campaign_folder_assignments_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_assignments
    ADD CONSTRAINT unibox_campaign_folder_assignments_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folder_assignments unibox_campaign_folder_assignments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_assignments
    ADD CONSTRAINT unibox_campaign_folder_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folder_items unibox_campaign_folder_items_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_items
    ADD CONSTRAINT unibox_campaign_folder_items_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.unibox_campaign_folders(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folder_items unibox_campaign_folder_items_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folder_items
    ADD CONSTRAINT unibox_campaign_folder_items_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: unibox_campaign_folders unibox_campaign_folders_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.unibox_campaign_folders
    ADD CONSTRAINT unibox_campaign_folders_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: vendors vendors_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: vendors vendors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vendors
    ADD CONSTRAINT vendors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.users(id);


--
-- Name: warehouses warehouses_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: warehouses warehouses_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.warehouses
    ADD CONSTRAINT warehouses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_actions workflow_actions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_actions
    ADD CONSTRAINT workflow_actions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_action_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_action_id_fkey FOREIGN KEY (action_id) REFERENCES public.workflow_actions(id) ON DELETE CASCADE;


--
-- Name: workflow_execution_steps workflow_execution_steps_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_execution_steps
    ADD CONSTRAINT workflow_execution_steps_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.workflow_executions(id) ON DELETE CASCADE;


--
-- Name: workflow_executions workflow_executions_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflow_executions
    ADD CONSTRAINT workflow_executions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workflows workflows_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_activities workgroup_activities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workgroup_activities workgroup_activities_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_activities
    ADD CONSTRAINT workgroup_activities_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_channels workgroup_channels_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_channels workgroup_channels_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_channels
    ADD CONSTRAINT workgroup_channels_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_files workgroup_files_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.workgroup_posts(id) ON DELETE SET NULL;


--
-- Name: workgroup_files workgroup_files_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.users(id);


--
-- Name: workgroup_files workgroup_files_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_files
    ADD CONSTRAINT workgroup_files_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_meeting_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.workgroup_meetings(id) ON DELETE CASCADE;


--
-- Name: workgroup_meeting_participants workgroup_meeting_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meeting_participants
    ADD CONSTRAINT workgroup_meeting_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_meetings workgroup_meetings_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE SET NULL;


--
-- Name: workgroup_meetings workgroup_meetings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_meetings workgroup_meetings_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_meetings
    ADD CONSTRAINT workgroup_meetings_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: workgroup_members workgroup_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_members workgroup_members_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_members
    ADD CONSTRAINT workgroup_members_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_notifications workgroup_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_notifications
    ADD CONSTRAINT workgroup_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_post_reads workgroup_post_reads_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_post_reads
    ADD CONSTRAINT workgroup_post_reads_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.workgroup_posts(id) ON DELETE CASCADE;


--
-- Name: workgroup_post_reads workgroup_post_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_post_reads
    ADD CONSTRAINT workgroup_post_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_channel_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_channel_id_fkey FOREIGN KEY (channel_id) REFERENCES public.workgroup_channels(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.workgroup_posts(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_posts workgroup_posts_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_posts
    ADD CONSTRAINT workgroup_posts_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_last_modified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_last_modified_by_fkey FOREIGN KEY (last_modified_by) REFERENCES public.users(id);


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki_pages workgroup_wiki_pages_workgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki_pages
    ADD CONSTRAINT workgroup_wiki_pages_workgroup_id_fkey FOREIGN KEY (workgroup_id) REFERENCES public.workgroups(id) ON DELETE CASCADE;


--
-- Name: workgroup_wiki workgroup_wiki_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.workgroup_wiki(id);


--
-- Name: workgroup_wiki workgroup_wiki_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroup_wiki
    ADD CONSTRAINT workgroup_wiki_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: workgroups workgroups_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: workgroups workgroups_org_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workgroups
    ADD CONSTRAINT workgroups_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict WclDegJK6EQvfe7VucM3iuMVZ9XinadW9KrSdciJTMmQMCc81y2W75SWHFTktZm

