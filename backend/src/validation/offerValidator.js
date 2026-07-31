/**
 * Comprehensive validation utilities for Job Offers
 * Production-level validations for backend
 */

const Joi = require('joi');

/**
 * Trim whitespace from strings
 */
const trimString = (value) => {
  return typeof value === 'string' ? value.trim() : value;
};

/**
 * Check if string is only whitespace
 */
const isWhitespaceOnly = (value) => {
  return typeof value === 'string' && value.trim() === '';
};

/**
 * Validate required fields are not empty/whitespace
 */
const validateRequiredFields = (data) => {
  const requiredFields = [
    'candidateId',
    'requisitionId',
    'position',
    'department',
    'workLocation',
    'employmentType',
    'baseSalary',
    'currency',
    'salaryFrequency',
    'startDate'
  ];

  const errors = [];

  for (const field of requiredFields) {
    const value = data[field];
    
    if (value === undefined || value === null) {
      errors.push(`${field} is required`);
      continue;
    }

    if (isWhitespaceOnly(value)) {
      errors.push(`${field} cannot be empty or whitespace only`);
    }
  }

  return errors;
};

/**
 * Validate salary-related fields
 */
const validateSalaryFields = (data) => {
  const errors = [];

  // Base Salary validation
  if (data.baseSalary !== undefined && data.baseSalary !== null) {
    const salary = Number(data.baseSalary);
    if (isNaN(salary)) {
      errors.push('Base Salary must be a valid number');
    } else if (salary <= 0) {
      errors.push('Base Salary must be greater than 0');
    }
  }

  // Bonus Percentage validation
  if (data.bonusPercentage !== undefined && data.bonusPercentage !== null) {
    const bonus = Number(data.bonusPercentage);
    if (isNaN(bonus)) {
      errors.push('Bonus Percentage must be a valid number');
    } else if (bonus < 0) {
      errors.push('Bonus Percentage cannot be negative');
    } else if (bonus > 100) {
      errors.push('Bonus Percentage must be between 0 and 100');
    }
  }

  return errors;
};

/**
 * Validate date fields
 */
const validateDateFields = (data) => {
  const errors = [];

  if (data.startDate) {
    const date = new Date(data.startDate);
    if (isNaN(date.getTime())) {
      errors.push('Start Date must be a valid date');
    }
  }

  if (data.responseDeadline) {
    const date = new Date(data.responseDeadline);
    if (isNaN(date.getTime())) {
      errors.push('Response Deadline must be a valid date');
    }
  }

  // Cross-field: Response Deadline must be <= Start Date
  if (data.responseDeadline && data.startDate) {
    const deadline = new Date(data.responseDeadline);
    const startDate = new Date(data.startDate);
    
    deadline.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    
    if (deadline > startDate) {
      errors.push('Response Deadline cannot be after the Start Date');
    }
  }

  // Cross-field: Response Deadline must be today or later
  if (data.responseDeadline) {
    const deadline = new Date(data.responseDeadline);
    const today = new Date();
    
    deadline.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    if (deadline < today) {
      errors.push('Response Deadline cannot be in the past. Must be today or later');
    }
  }

  return errors;
};

/**
 * Validate period fields (months/days)
 */
const validatePeriodFields = (data) => {
  const errors = [];

  if (data.probationPeriod !== undefined && data.probationPeriod !== null) {
    const period = Number(data.probationPeriod);
    if (!Number.isInteger(period)) {
      errors.push('Probation Period must be a whole number');
    } else if (period < 0) {
      errors.push('Probation Period cannot be negative');
    } else if (period > 24) {
      errors.push('Probation Period cannot exceed 24 months');
    }
  }

  if (data.noticePeriod !== undefined && data.noticePeriod !== null) {
    const period = Number(data.noticePeriod);
    if (!Number.isInteger(period)) {
      errors.push('Notice Period must be a whole number');
    } else if (period < 0) {
      errors.push('Notice Period cannot be negative');
    } else if (period > 365) {
      errors.push('Notice Period cannot exceed 365 days');
    }
  }

  return errors;
};

/**
 * Validate string length fields
 */
const validateStringLengths = (data) => {
  const errors = [];

  const stringFields = {
    position: { min: 2, max: 100 },
    grade: { min: 0, max: 20 },
    reportingManager: { min: 2, max: 100 },
    workLocation: { min: 2, max: 150 },
    benefits: { min: 0, max: 1000 },
    workingHours: { min: 0, max: 100 },
    specialConditions: { min: 0, max: 1000 }
  };

  for (const [field, rules] of Object.entries(stringFields)) {
    const value = data[field];
    
    if (value !== undefined && value !== null && value !== '') {
      const trimmed = trimString(value);
      
      if (rules.min > 0 && trimmed.length < rules.min) {
        errors.push(`${field} must be at least ${rules.min} characters`);
      }
      
      if (trimmed.length > rules.max) {
        errors.push(`${field} cannot exceed ${rules.max} characters`);
      }
    }
  }

  return errors;
};

/**
 * Validate allowances JSON
 */
const validateAllowances = (data) => {
  const errors = [];

  if (data.allowances && typeof data.allowances === 'string') {
    const trimmed = trimString(data.allowances);
    
    if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        JSON.parse(trimmed);
      } catch (e) {
        errors.push('Allowances must be valid JSON format');
      }
    }
  }

  return errors;
};

/**
 * Comprehensive validation function
 */
const validateOffer = (data) => {
  const errors = [];

  // Collect all validation errors
  errors.push(...validateRequiredFields(data));
  errors.push(...validateSalaryFields(data));
  errors.push(...validateDateFields(data));
  errors.push(...validatePeriodFields(data));
  errors.push(...validateStringLengths(data));
  errors.push(...validateAllowances(data));

  return {
    isValid: errors.length === 0,
    errors: errors,
    errorCount: errors.length
  };
};

/**
 * Sanitize and normalize offer data
 */
const sanitizeOfferData = (data) => {
  return {
    ...data,
    position: trimString(data.position),
    grade: data.grade ? trimString(data.grade) : null,
    reportingManager: data.reportingManager ? trimString(data.reportingManager) : null,
    workLocation: trimString(data.workLocation),
    benefits: data.benefits ? trimString(data.benefits) : null,
    workingHours: data.workingHours ? trimString(data.workingHours) : null,
    specialConditions: data.specialConditions ? trimString(data.specialConditions) : null
  };
};

module.exports = {
  validateOffer,
  sanitizeOfferData,
  validateRequiredFields,
  validateSalaryFields,
  validateDateFields,
  validatePeriodFields,
  validateStringLengths,
  validateAllowances,
  trimString,
  isWhitespaceOnly
};
