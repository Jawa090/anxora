/**
 * Requisition Request Form Validation Utilities
 * Production-level validations for New Requisition Request form
 */

export interface RequisitionFormErrors {
    requestType?: string;
    department?: string;
    position?: string;
    numberOfPositions?: string;
    jobDescription?: string;
    requirements?: string;
    grade?: string;
    urgency?: string;
}

/**
 * Trim whitespace from string fields
 */
const trimString = (value: string): string => {
    return value ? value.trim() : '';
};

/**
 * Check if string is only whitespace
 */
const isWhitespaceOnly = (value: string): boolean => {
    return value.trim() === '';
};

/**
 * Validate request type selection
 */
const validateRequestType = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Request Type is required.';
    }

    const validTypes = ['single', 'team', 'other'];
    if (!validTypes.includes(value)) {
        return 'Please select a valid request type.';
    }

    return undefined;
};

/**
 * Validate department selection
 */
const validateDepartment = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Department is required.';
    }

    return undefined;
};

/**
 * Validate position/role (2-100 characters)
 */
const validatePosition = (value: string): string | undefined => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return 'Position/Role is required.';
    }

    if (isWhitespaceOnly(value)) {
        return 'Position/Role cannot contain only spaces.';
    }

    if (trimmed.length < 2) {
        return 'Position/Role must be at least 2 characters long.';
    }

    if (trimmed.length > 100) {
        return 'Position/Role cannot exceed 100 characters.';
    }

    return undefined;
};

/**
 * Validate number of positions (1-100, integer)
 */
const validateNumberOfPositions = (value: string | number): string | undefined => {
    if (value === '' || value === null || value === undefined) {
        return 'Number of Positions is required.';
    }

    const num = typeof value === 'string' ? parseInt(value) : value;

    if (isNaN(num)) {
        return 'Please enter a valid whole number.';
    }

    if (!Number.isInteger(num)) {
        return 'Number of Positions must be a whole number (no decimals).';
    }

    if (num < 1) {
        return 'Number of Positions must be greater than 0.';
    }

    if (num > 100) {
        return 'Number of Positions cannot exceed 100.';
    }

    return undefined;
};

/**
 * Validate job description (20-5000 characters)
 */
const validateJobDescription = (value: string): string | undefined => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return 'Job Description is required.';
    }

    if (isWhitespaceOnly(value)) {
        return 'Job Description cannot contain only spaces.';
    }

    if (trimmed.length < 20) {
        return 'Job Description must contain at least 20 characters.';
    }

    if (trimmed.length > 5000) {
        return 'Job Description cannot exceed 5000 characters.';
    }

    return undefined;
};

/**
 * Validate requirements & qualifications (10-3000 characters)
 */
const validateRequirements = (value: string): string | undefined => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return 'Requirements & Qualifications are required.';
    }

    if (isWhitespaceOnly(value)) {
        return 'Requirements & Qualifications cannot contain only spaces.';
    }

    if (trimmed.length < 10) {
        return 'Requirements & Qualifications must contain at least 10 characters.';
    }

    if (trimmed.length > 3000) {
        return 'Requirements & Qualifications cannot exceed 3000 characters.';
    }

    return undefined;
};

/**
 * Validate grade/level (optional, but must be valid if provided)
 */
const validateGrade = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const validGrades = ['GD1-3', 'GD4-6', 'GD7-9', 'GD10-12', 'GD13+'];
    if (!validGrades.includes(value)) {
        return 'Please select a valid grade level.';
    }

    return undefined;
};

/**
 * Validate urgency selection
 */
const validateUrgency = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Urgency is required.';
    }

    const validUrgencies = ['low', 'medium', 'high', 'urgent'];
    if (!validUrgencies.includes(value)) {
        return 'Please select a valid urgency level.';
    }

    return undefined;
};

/**
 * Main validation function
 * Validates all fields and returns error object
 */
export const validateRequisitionForm = (form: any): RequisitionFormErrors => {
    const errors: RequisitionFormErrors = {};

    // Required fields validation
    errors.requestType = validateRequestType(form.requestType);
    errors.department = validateDepartment(form.department);
    errors.position = validatePosition(form.position);
    errors.numberOfPositions = validateNumberOfPositions(form.numberOfPositions);
    errors.jobDescription = validateJobDescription(form.jobDescription);
    errors.requirements = validateRequirements(form.requirements);
    errors.urgency = validateUrgency(form.urgency);

    // Optional field validation
    errors.grade = validateGrade(form.grade);

    // Remove undefined errors
    Object.keys(errors).forEach(key => {
        if (errors[key as keyof RequisitionFormErrors] === undefined) {
            delete errors[key as keyof RequisitionFormErrors];
        }
    });

    return errors;
};

/**
 * Check if form has any errors
 */
export const hasFormErrors = (errors: RequisitionFormErrors): boolean => {
    return Object.keys(errors).length > 0;
};

/**
 * Get first error message for display
 */
export const getFirstErrorMessage = (errors: RequisitionFormErrors): string | null => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return null;

    const key = errorKeys[0] as keyof RequisitionFormErrors;
    return errors[key] || null;
};

/**
 * Trim form data before submission
 */
export const trimRequisitionFormData = (form: any) => {
    return {
        ...form,
        position: trimString(form.position),
        jobDescription: trimString(form.jobDescription),
        requirements: trimString(form.requirements),
        grade: form.grade ? trimString(form.grade) : ''
    };
};
