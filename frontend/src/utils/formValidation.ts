/**
 * Form Validation Utilities
 * Production-level validation for employment application forms
 */

export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

/**
 * Trim and validate that string is not empty
 */
export const trimString = (value: any): string => {
    return typeof value === 'string' ? value.trim() : '';
};

/**
 * Check if value is empty or only spaces
 */
export const isEmpty = (value: any): boolean => {
    return !value || trimString(value) === '';
};

/**
 * Validate name fields (2-100 chars, letters & spaces only)
 */
export const validateName = (value: any, fieldName: string = 'Name'): ValidationError | null => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return { field: fieldName, message: `${fieldName} is required` };
    }

    if (trimmed.length < 2) {
        return { field: fieldName, message: `${fieldName} must be at least 2 characters` };
    }

    if (trimmed.length > 100) {
        return { field: fieldName, message: `${fieldName} must not exceed 100 characters` };
    }

    if (!/^[a-zA-Z\s]+$/.test(trimmed)) {
        return { field: fieldName, message: `${fieldName} can only contain letters and spaces` };
    }

    return null;
};

/**
 * Validate phone number (10-15 digits)
 */
export const validatePhoneNumber = (value: any): ValidationError | null => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return { field: 'mobileNo', message: 'Mobile number is required' };
    }

    // Remove common phone separators
    const cleaned = trimmed.replace(/[\s\-\+\(\)]/g, '');

    if (!/^\d+$/.test(cleaned)) {
        return { field: 'mobileNo', message: 'Mobile number must contain only digits' };
    }

    if (cleaned.length < 10 || cleaned.length > 15) {
        return { field: 'mobileNo', message: 'Mobile number must be 10-15 digits' };
    }

    return null;
};

/**
 * Validate email format
 */
export const validateEmail = (value: any): ValidationError | null => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return { field: 'email', message: 'Email address is required' };
    }

    // Standard email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { field: 'email', message: 'Please enter a valid email address' };
    }

    if (trimmed.length > 254) {
        return { field: 'email', message: 'Email address is too long' };
    }

    return null;
};

/**
 * Validate blood group (A+, A-, B+, B-, AB+, AB-, O+, O-)
 */
export const validateBloodGroup = (value: any): ValidationError | null => {
    if (isEmpty(value)) {
        return null; // Optional field
    }

    const trimmed = trimString(value).toUpperCase();
    const validGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    if (!validGroups.includes(trimmed)) {
        return { field: 'bloodGroup', message: 'Blood group must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-' };
    }

    return null;
};

/**
 * Validate CNIC format (xxxxx-xxxxxxx-x)
 */
export const validateCNIC = (value: any): ValidationError | null => {
    if (isEmpty(value)) {
        return null; // Optional field
    }

    const trimmed = trimString(value);
    const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

    if (!cnicRegex.test(trimmed)) {
        return { field: 'cnic', message: 'CNIC must be in format: xxxxx-xxxxxxx-x' };
    }

    return null;
};

/**
 * Validate date is not in future
 */
export const validateDate = (value: any, fieldName: string = 'Date'): ValidationError | null => {
    if (isEmpty(value)) {
        return null; // Optional field
    }

    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(date.getTime())) {
        return { field: fieldName, message: `${fieldName} is invalid` };
    }

    if (date > today) {
        return { field: fieldName, message: `${fieldName} cannot be in the future` };
    }

    return null;
};

/**
 * Validate text field (max length, optional)
 */
export const validateTextField = (value: any, fieldName: string, maxLength: number = 255): ValidationError | null => {
    if (isEmpty(value)) {
        return null; // Optional field
    }

    const trimmed = trimString(value);

    if (trimmed.length > maxLength) {
        return { field: fieldName, message: `${fieldName} must not exceed ${maxLength} characters` };
    }

    return null;
};

/**
 * Validate joining availability (min 3-5 characters)
 */
export const validateJoiningAvailability = (value: any): ValidationError | null => {
    const trimmed = trimString(value);

    if (!trimmed) {
        return { field: 'joiningAvailability', message: 'Joining availability is required' };
    }

    if (trimmed.length < 3) {
        return { field: 'joiningAvailability', message: 'Please provide more details (at least 3 characters)' };
    }

    if (trimmed.length > 255) {
        return { field: 'joiningAvailability', message: 'Joining availability must not exceed 255 characters' };
    }

    return null;
};

/**
 * Validate numeric field (must be >= 0)
 */
export const validateNumericField = (value: any, fieldName: string, allowZero: boolean = false): ValidationError | null => {
    if (isEmpty(value)) {
        return null; // Optional field
    }

    const num = parseFloat(value);

    if (isNaN(num)) {
        return { field: fieldName, message: `${fieldName} must be a number` };
    }

    if (num < 0) {
        return { field: fieldName, message: `${fieldName} cannot be negative` };
    }

    if (!allowZero && num === 0) {
        return { field: fieldName, message: `${fieldName} must be greater than 0` };
    }

    return null;
};

/**
 * Validate date range (from <= to)
 */
export const validateDateRange = (
    fromDate: any,
    toDate: any,
    fieldPrefix: string = 'Date'
): ValidationError | null => {
    if (isEmpty(fromDate) || isEmpty(toDate)) {
        return null; // If either is empty, other validations will catch it
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return null; // Invalid dates will be caught separately
    }

    if (from > to) {
        return {
            field: `${fieldPrefix}Range`,
            message: `"From" date must be before or equal to "To" date`
        };
    }

    return null;
};

/**
 * Validate academic record row
 */
export const validateAcademicRecord = (record: any, index: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const prefix = `academicRecords[${index}]`;

    // Check if row is completely empty
    const isEmpty_row =
        isEmpty(record.diploma) &&
        isEmpty(record.institution) &&
        isEmpty(record.from) &&
        isEmpty(record.to);

    if (isEmpty_row) {
        return errors; // Empty rows are allowed (can be removed)
    }

    // If any field is filled, all required fields must be filled
    const hasAnyData = Object.values(record).some(v => !isEmpty(v));

    if (hasAnyData) {
        if (isEmpty(record.diploma)) {
            errors.push({ field: `${prefix}.diploma`, message: 'Degree/Diploma is required' });
        }
        if (isEmpty(record.institution)) {
            errors.push({ field: `${prefix}.institution`, message: 'Institution name is required' });
        }
        if (isEmpty(record.from)) {
            errors.push({ field: `${prefix}.from`, message: 'From date is required' });
        }
        if (isEmpty(record.to)) {
            errors.push({ field: `${prefix}.to`, message: 'To date is required' });
        }

        // Validate date range
        const dateRangeError = validateDateRange(record.from, record.to, 'Academic');
        if (dateRangeError) {
            errors.push(dateRangeError);
        }
    }

    return errors;
};

/**
 * Validate work experience row
 */
export const validateWorkExperienceRow = (record: any, index: number): ValidationError[] => {
    const errors: ValidationError[] = [];
    const prefix = `workExperience[${index}]`;

    // Check if row is completely empty
    const isEmpty_row =
        isEmpty(record.designation) &&
        isEmpty(record.companyName) &&
        isEmpty(record.from) &&
        isEmpty(record.to);

    if (isEmpty_row) {
        return errors; // Empty rows are allowed (can be removed)
    }

    // If any field is filled, all required fields must be filled
    const hasAnyData = Object.values(record).some(v => !isEmpty(v));

    if (hasAnyData) {
        if (isEmpty(record.designation)) {
            errors.push({ field: `${prefix}.designation`, message: 'Designation is required' });
        }
        if (isEmpty(record.companyName)) {
            errors.push({ field: `${prefix}.companyName`, message: 'Company name is required' });
        }
        if (isEmpty(record.from)) {
            errors.push({ field: `${prefix}.from`, message: 'From date is required' });
        }
        if (isEmpty(record.to)) {
            errors.push({ field: `${prefix}.to`, message: 'To date is required' });
        }

        // Validate salary if provided
        if (!isEmpty(record.salary)) {
            const salaryError = validateNumericField(record.salary, 'Salary', true);
            if (salaryError) {
                errors.push({ ...salaryError, field: `${prefix}.salary` });
            }
        }

        // Validate date range
        const dateRangeError = validateDateRange(record.from, record.to, 'Work Experience');
        if (dateRangeError) {
            errors.push(dateRangeError);
        }
    }

    return errors;
};

/**
 * Main form validation
 */
export const validateApplicationForm = (formData: any): ValidationResult => {
    const errors: ValidationError[] = [];

    // Position Applied For - derived from candidate, so skip

    // Name - Required, 2-100 chars, letters & spaces only
    const nameError = validateName(formData.fullName, 'Name');
    if (nameError) errors.push(nameError);

    // Mobile No - Required, 10-15 digits
    const phoneError = validatePhoneNumber(formData.mobileNo);
    if (phoneError) errors.push(phoneError);

    // Email - Required, valid format
    const emailError = validateEmail(formData.email);
    if (emailError) errors.push(emailError);

    // Father's Name - Optional, letters & spaces only
    if (!isEmpty(formData.fatherName)) {
        const fatherError = validateName(formData.fatherName, "Father's Name");
        if (fatherError) errors.push(fatherError);
    }

    // Father's Occupation - Optional, max 100 chars
    const fatherOccError = validateTextField(formData.fatherOccupation, "Father's Occupation", 100);
    if (fatherOccError) errors.push(fatherOccError);

    // Address - Optional, max 255 chars
    const addressError = validateTextField(formData.address, 'Address', 255);
    if (addressError) errors.push(addressError);

    // Blood Group - Optional, valid values only
    const bloodError = validateBloodGroup(formData.bloodGroup);
    if (bloodError) errors.push(bloodError);

    // Religion - Optional, max 50 chars
    const religionError = validateTextField(formData.religion, 'Religion', 50);
    if (religionError) errors.push(religionError);

    // Date of Birth - Optional, cannot be future
    const dobError = validateDate(formData.dateOfBirth, 'Date of Birth');
    if (dobError) errors.push(dobError);

    // CNIC - Optional, valid format
    const cnicError = validateCNIC(formData.cnic);
    if (cnicError) errors.push(cnicError);

    // Marital Status - Required, must select value
    const trimmedStatus = trimString(formData.maritalStatus);
    if (!trimmedStatus) {
        errors.push({ field: 'maritalStatus', message: 'Marital status is required' });
    }

    // Number of Children - Optional, must be integer >= 0
    const childrenError = validateNumericField(formData.numberOfChildren, 'Number of Children', true);
    if (childrenError) errors.push(childrenError);

    // Residence Type - Required, must select value
    if (!formData.residenceType || !['own', 'rented', 'parents'].includes(formData.residenceType)) {
        errors.push({ field: 'residenceType', message: 'Residence type is required' });
    }

    // Academic Records - At least 1 non-empty row required
    const academicErrors: ValidationError[] = [];
    let hasValidAcademic = false;

    if (formData.academicRecords && formData.academicRecords.length > 0) {
        formData.academicRecords.forEach((record: any, index: number) => {
            const recordErrors = validateAcademicRecord(record, index);
            academicErrors.push(...recordErrors);
            if (recordErrors.length === 0 && !isEmpty(record.diploma)) {
                hasValidAcademic = true;
            }
        });
    }

    if (!hasValidAcademic) {
        errors.push({ field: 'academicRecords', message: 'At least one academic record is required' });
    }
    errors.push(...academicErrors);

    // Previous/Current Salary - Required, numeric >= 0
    const currentSalaryError = validateNumericField(formData.currentSalary, 'Previous/Current Salary', true);
    if (currentSalaryError) errors.push(currentSalaryError);

    // If no current salary provided, it's still required
    if (isEmpty(formData.currentSalary)) {
        errors.push({ field: 'currentSalary', message: 'Previous/Current salary is required' });
    }

    // Expected Salary - Required, numeric >= 0
    const expectedSalaryError = validateNumericField(formData.expectedSalary, 'Expected Salary', true);
    if (expectedSalaryError) errors.push(expectedSalaryError);

    // If no expected salary provided, it's still required
    if (isEmpty(formData.expectedSalary)) {
        errors.push({ field: 'expectedSalary', message: 'Expected salary is required' });
    }

    // Joining Availability - Required, min 3 chars
    const joiningError = validateJoiningAvailability(formData.joiningAvailability);
    if (joiningError) errors.push(joiningError);

    // Declaration - Must be accepted (will be added as checkbox in form)
    if (!formData.declarationAccepted) {
        errors.push({ field: 'declaration', message: 'You must accept the declaration to proceed' });
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};
