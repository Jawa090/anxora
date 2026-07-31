/**
 * Job Offer Form Validation Utilities
 * Production-level validations for Create Job Offer form
 */

export interface OfferFormErrors {
    candidateId?: string;
    requisitionId?: string;
    position?: string;
    department?: string;
    grade?: string;
    reportingManager?: string;
    workLocation?: string;
    employmentType?: string;
    baseSalary?: string;
    currency?: string;
    salaryFrequency?: string;
    bonusPercentage?: string;
    allowances?: string;
    benefits?: string;
    startDate?: string;
    responseDeadline?: string;
    probationPeriod?: string;
    noticePeriod?: string;
    workingHours?: string;
    specialConditions?: string;
    crossField?: string;
}

/**
 * Trim whitespace from string fields
 */
const trimString = (value: string): string => {
    return value ? value.trim() : '';
};

/**
 * Validate candidate selection
 */
const validateCandidateId = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Candidate is required.';
    }
    return undefined;
};

/**
 * Validate requisition selection
 */
const validateRequisitionId = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Requisition is required.';
    }
    return undefined;
};

/**
 * Validate position (2-100 characters)
 */
const validatePosition = (value: string): string | undefined => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return 'Position is required.';
    }

    if (trimmed.length < 2) {
        return 'Position must be at least 2 characters.';
    }

    if (trimmed.length > 100) {
        return 'Position cannot exceed 100 characters.';
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
 * Validate grade/level (max 20 characters)
 */
const validateGrade = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length > 20) {
        return 'Grade/Level cannot exceed 20 characters.';
    }

    return undefined;
};

/**
 * Validate reporting manager (2-100 characters)
 */
const validateReportingManager = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length < 2) {
        return 'Reporting Manager must be at least 2 characters.';
    }

    if (trimmed.length > 100) {
        return 'Reporting Manager cannot exceed 100 characters.';
    }

    return undefined;
};

/**
 * Validate work location (2-150 characters)
 */
const validateWorkLocation = (value: string): string | undefined => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return 'Work Location is required.';
    }

    if (trimmed.length < 2) {
        return 'Work Location must be at least 2 characters.';
    }

    if (trimmed.length > 150) {
        return 'Work Location cannot exceed 150 characters.';
    }

    return undefined;
};

/**
 * Validate employment type selection
 */
const validateEmploymentType = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Employment Type is required.';
    }

    const validTypes = ['full_time', 'part_time', 'contract', 'internship'];
    if (!validTypes.includes(value)) {
        return 'Please select a valid Employment Type.';
    }

    return undefined;
};

/**
 * Validate base salary (must be > 0)
 */
const validateBaseSalary = (value: string | number): string | undefined => {
    if (value === '' || value === null || value === undefined) {
        return 'Base Salary is required.';
    }

    const salary = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(salary)) {
        return 'Base Salary must be a valid number.';
    }

    if (salary <= 0) {
        return 'Base Salary must be greater than 0.';
    }

    return undefined;
};

/**
 * Validate currency selection
 */
const validateCurrency = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Please select a Currency.';
    }

    const validCurrencies = ['PKR', 'USD', 'EUR', 'GBP'];
    if (!validCurrencies.includes(value)) {
        return 'Please select a valid Currency.';
    }

    return undefined;
};

/**
 * Validate salary frequency selection
 */
const validateSalaryFrequency = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Please select a Salary Frequency.';
    }

    const validFrequencies = ['monthly', 'annually', 'hourly'];
    if (!validFrequencies.includes(value)) {
        return 'Please select a valid Salary Frequency.';
    }

    return undefined;
};

/**
 * Validate bonus percentage (0-100)
 */
const validateBonusPercentage = (value: string | number): string | undefined => {
    if (value === '' || value === null || value === undefined) {
        return undefined; // Optional field
    }

    const bonus = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(bonus)) {
        return 'Bonus Percentage must be a valid number.';
    }

    if (bonus < 0) {
        return 'Bonus Percentage cannot be negative.';
    }

    if (bonus > 100) {
        return 'Bonus Percentage must be between 0 and 100.';
    }

    return undefined;
};

/**
 * Validate allowances (valid JSON or text)
 */
const validateAllowances = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    // Check if it looks like JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            JSON.parse(trimmed);
            return undefined;
        } catch (e) {
            return 'Please enter valid JSON for Allowances. Example: {"transport": 5000, "medical": 3000}';
        }
    }

    // If not JSON, it's treated as text (allowed)
    return undefined;
};

/**
 * Validate benefits (max 1000 characters)
 */
const validateBenefits = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length > 1000) {
        return 'Benefits cannot exceed 1000 characters.';
    }

    return undefined;
};

/**
 * Validate start date
 */
const validateStartDate = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return 'Start Date is required.';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return 'Start Date must be a valid date.';
    }

    return undefined;
};

/**
 * Validate response deadline
 */
const validateResponseDeadline = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return 'Response Deadline must be a valid date.';
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);

    if (date < today) {
        return 'Response Deadline cannot be in the past. Must be today or later.';
    }

    return undefined;
};

/**
 * Validate probation period (0-24 months)
 */
const validateProbationPeriod = (value: string | number): string | undefined => {
    if (value === '' || value === null || value === undefined) {
        return undefined; // Optional field
    }

    const period = typeof value === 'string' ? parseInt(value) : value;

    if (isNaN(period)) {
        return 'Probation Period must be a valid number.';
    }

    if (period < 0) {
        return 'Probation Period cannot be negative.';
    }

    if (period > 24) {
        return 'Probation Period cannot exceed 24 months.';
    }

    return undefined;
};

/**
 * Validate notice period (0-365 days)
 */
const validateNoticePeriod = (value: string | number): string | undefined => {
    if (value === '' || value === null || value === undefined) {
        return undefined; // Optional field
    }

    const period = typeof value === 'string' ? parseInt(value) : value;

    if (isNaN(period)) {
        return 'Notice Period must be a valid number.';
    }

    if (period < 0) {
        return 'Notice Period cannot be negative.';
    }

    if (period > 365) {
        return 'Notice Period cannot exceed 365 days.';
    }

    return undefined;
};

/**
 * Validate working hours (max 100 characters)
 */
const validateWorkingHours = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length > 100) {
        return 'Working Hours cannot exceed 100 characters.';
    }

    return undefined;
};

/**
 * Validate special conditions (max 1000 characters)
 */
const validateSpecialConditions = (value: string): string | undefined => {
    if (!value || value.trim() === '') {
        return undefined; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length > 1000) {
        return 'Special Conditions cannot exceed 1000 characters.';
    }

    return undefined;
};

/**
 * Cross-field validations
 */
const validateCrossFields = (form: any): string | undefined => {
    // Response Deadline must be less than or equal to Start Date
    if (form.responseDeadline && form.startDate) {
        const deadlineDate = new Date(form.responseDeadline);
        const startDate = new Date(form.startDate);

        deadlineDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);

        if (deadlineDate > startDate) {
            return 'Response Deadline cannot be after the Start Date.';
        }
    }

    return undefined;
};

/**
 * Main validation function
 * Validates all fields and returns error object
 */
export const validateOfferForm = (form: any): OfferFormErrors => {
    const errors: OfferFormErrors = {};

    // Required fields
    errors.candidateId = validateCandidateId(form.candidateId);
    errors.requisitionId = validateRequisitionId(form.requisitionId);
    errors.position = validatePosition(form.position);
    errors.department = validateDepartment(form.department);
    errors.workLocation = validateWorkLocation(form.workLocation);
    errors.employmentType = validateEmploymentType(form.employmentType);

    // Compensation fields
    errors.baseSalary = validateBaseSalary(form.baseSalary);
    errors.currency = validateCurrency(form.currency);
    errors.salaryFrequency = validateSalaryFrequency(form.salaryFrequency);

    // Employment terms
    errors.startDate = validateStartDate(form.startDate);

    // Optional fields
    errors.grade = validateGrade(form.grade);
    errors.reportingManager = validateReportingManager(form.reportingManager);
    errors.bonusPercentage = validateBonusPercentage(form.bonusPercentage);
    errors.allowances = validateAllowances(form.allowances);
    errors.benefits = validateBenefits(form.benefits);
    errors.responseDeadline = validateResponseDeadline(form.responseDeadline);
    errors.probationPeriod = validateProbationPeriod(form.probationPeriod);
    errors.noticePeriod = validateNoticePeriod(form.noticePeriod);
    errors.workingHours = validateWorkingHours(form.workingHours);
    errors.specialConditions = validateSpecialConditions(form.specialConditions);

    // Cross-field validations
    errors.crossField = validateCrossFields(form);

    // Remove undefined errors
    Object.keys(errors).forEach(key => {
        if (errors[key as keyof OfferFormErrors] === undefined) {
            delete errors[key as keyof OfferFormErrors];
        }
    });

    return errors;
};

/**
 * Check if form has any errors
 */
export const hasFormErrors = (errors: OfferFormErrors): boolean => {
    return Object.keys(errors).length > 0;
};

/**
 * Get first error message for display
 */
export const getFirstErrorMessage = (errors: OfferFormErrors): string | null => {
    const errorKeys = Object.keys(errors);
    if (errorKeys.length === 0) return null;

    const key = errorKeys[0] as keyof OfferFormErrors;
    return errors[key] || null;
};

/**
 * Trim form data before submission
 */
export const trimOfferFormData = (form: any) => {
    return {
        ...form,
        position: trimString(form.position),
        grade: trimString(form.grade),
        reportingManager: trimString(form.reportingManager),
        workLocation: trimString(form.workLocation),
        benefits: trimString(form.benefits),
        workingHours: trimString(form.workingHours),
        specialConditions: trimString(form.specialConditions),
        allowances: trimString(form.allowances)
    };
};
