// Simple CV Parser - Extracts basic information from text
// Works with plain text extracted from PDF/DOCX

const extractEmail = (text) => {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
};

const extractPhone = (text) => {
  // Matches various phone formats: +92-300-1234567, 03001234567, +923001234567, etc.
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0].trim() : null;
};

const extractName = (text) => {
  // Try to extract name from first few lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);

  // Usually name is in first 3 lines
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();

    // Skip if line contains email or phone
    if (line.includes('@') || /\d{10}/.test(line)) continue;

    // Check if line looks like a name (2-4 words, each capitalized)
    const words = line.split(/\s+/);
    if (words.length >= 2 && words.length <= 4) {
      const isName = words.every(word =>
        word.length > 1 &&
        word[0] === word[0].toUpperCase() &&
        /^[a-zA-Z]+$/.test(word)
      );

      if (isName) {
        return line;
      }
    }
  }

  return null;
};

const extractSkills = (text) => {
  const commonSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
    'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel',
    'HTML', 'CSS', 'SASS', 'LESS', 'Bootstrap', 'Tailwind',
    'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Oracle', 'SQLite',
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitHub', 'GitLab',
    'REST API', 'GraphQL', 'Microservices', 'Agile', 'Scrum', 'JIRA',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch',
    'Excel', 'PowerPoint', 'Word', 'Photoshop', 'Illustrator', 'Figma', 'Sketch'
  ];

  const foundSkills = [];
  const lowerText = text.toLowerCase();

  commonSkills.forEach(skill => {
    const skillLower = skill.toLowerCase();
    // Check for whole word match
    const regex = new RegExp(`\\b${skillLower}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundSkills.push(skill);
    }
  });

  return foundSkills;
};

const extractExperience = (text) => {
  // Look for patterns like "5 years", "3+ years", "2-3 years"
  const expRegex = /(\d+)[\s]*(?:\+|-)?\s*(?:to\s+\d+\s+)?years?\s+(?:of\s+)?experience/gi;
  const matches = text.match(expRegex);

  if (matches && matches.length > 0) {
    const numbers = matches[0].match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0]);
    }
  }

  // Alternative: Look for "Experience: X years" format
  const altRegex = /experience[:\s]+(\d+)/gi;
  const altMatches = text.match(altRegex);
  if (altMatches && altMatches.length > 0) {
    const numbers = altMatches[0].match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0]);
    }
  }

  return null;
};

const extractEducation = (text) => {
  const educationKeywords = [
    'PhD', 'Ph.D', 'Doctorate',
    'Master', 'Masters', 'MS', 'M.S', 'MBA', 'M.B.A',
    'Bachelor', 'Bachelors', 'BS', 'B.S', 'BA', 'B.A', 'BE', 'B.E', 'BTech', 'B.Tech',
    'Diploma', 'Associate'
  ];

  const lowerText = text.toLowerCase();

  for (const keyword of educationKeywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    if (regex.test(lowerText)) {
      // Try to extract the full degree line
      const lines = text.split('\n');
      for (const line of lines) {
        if (new RegExp(keyword, 'i').test(line)) {
          return line.trim().substring(0, 100); // Limit length
        }
      }
      return keyword;
    }
  }

  return null;
};

const extractCurrentCompany = (text) => {
  // Look for patterns like "Currently working at", "Present at", etc.
  const companyRegex = /(?:currently|present|working)\s+(?:at|with|for)\s+([A-Z][a-zA-Z\s&.]+?)(?:\n|,|\.|\s{2,})/gi;
  const matches = text.match(companyRegex);

  if (matches && matches.length > 0) {
    const company = matches[0].replace(/(?:currently|present|working)\s+(?:at|with|for)\s+/gi, '').trim();
    return company.split(/\n|,|\./)[0].trim();
  }

  return null;
};

const extractExpectedSalary = (text) => {
  // Look for patterns like "Expected Salary: $50,000", "Salary Expectation: 50k", etc.
  const salaryRegex = /(?:expected|desired|salary\s+expectation)\s*[:\s]*\$?(?:PKR|Rs\.?)?[\s]*([0-9,]+(?:\.\d{2})?)\s*(?:K|k)?/gi;
  const matches = text.match(salaryRegex);

  if (matches && matches.length > 0) {
    // Extract just the number
    const numberMatch = matches[0].match(/([0-9,]+(?:\.\d{2})?)/);
    if (numberMatch) {
      return numberMatch[1];
    }
  }

  return null;
};

const extractNoticePeriod = (text) => {
  // Look for patterns like "Notice Period: 30 days", "Can join immediately", etc.
  const noticeRegex = /(?:notice\s+period|can\s+join)\s*[:\s]*(\d+)\s+(?:days?|weeks?|months?)?|(?:can\s+join\s+(?:immediately|in|after)\s+)?(\d+)\s+(?:days?|weeks?|months?)/gi;
  const matches = text.match(noticeRegex);

  if (matches && matches.length > 0) {
    const numberMatch = matches[0].match(/(\d+)/);
    if (numberMatch) {
      const days = parseInt(numberMatch[1]);
      if (matches[0].toLowerCase().includes('week')) return (days * 7).toString();
      if (matches[0].toLowerCase().includes('month')) return (days * 30).toString();
      return days.toString();
    }
  }

  // Check for "immediate" or "immediately"
  if (/immediate/i.test(text)) {
    return '0';
  }

  return null;
};

const extractDesignation = (text) => {
  // Look for "Current Position", "Designation", "Current Role", etc.
  const designationKeywords = [
    'Senior Developer', 'Junior Developer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
    'Manager', 'Senior Manager', 'Project Manager', 'Product Manager', 'Team Lead',
    'Engineer', 'Senior Engineer', 'Lead Engineer', 'Principal Engineer',
    'Analyst', 'Senior Analyst', 'Data Analyst', 'Business Analyst',
    'Architect', 'Solutions Architect', 'Enterprise Architect',
    'Administrator', 'Database Administrator', 'System Administrator'
  ];

  const lowerText = text.toLowerCase();

  for (const keyword of designationKeywords) {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    if (regex.test(lowerText)) {
      return keyword;
    }
  }

  return null;
};

const extractCurrentSalary = (text) => {
  // Look for "Current Salary: $50,000", "Current CTC: 50 LPA", etc.
  const salaryRegex = /(?:current|existing)\s+(?:salary|ctc|compensation)\s*[:\s]*\$?(?:PKR|Rs\.?|LPA)?[\s]*([0-9,]+(?:\.\d{2})?)/gi;
  const matches = text.match(salaryRegex);

  if (matches && matches.length > 0) {
    const numberMatch = matches[0].match(/([0-9,]+(?:\.\d{2})?)/);
    if (numberMatch) {
      return numberMatch[1];
    }
  }

  return null;
};

const parseCV = (text) => {
  if (!text || typeof text !== 'string') {
    return {
      fullName: null,
      email: null,
      phone: null,
      skills: [],
      totalExperience: null,
      highestQualification: null,
      currentCompany: null,
      currentDesignation: null,
      currentSalary: null,
      expectedSalary: null,
      noticePeriod: null
    };
  }

  return {
    fullName: extractName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    totalExperience: extractExperience(text),
    highestQualification: extractEducation(text),
    currentCompany: extractCurrentCompany(text),
    currentDesignation: extractDesignation(text),
    currentSalary: extractCurrentSalary(text),
    expectedSalary: extractExpectedSalary(text),
    noticePeriod: extractNoticePeriod(text)
  };
};

module.exports = {
  parseCV,
  extractEmail,
  extractPhone,
  extractName,
  extractSkills,
  extractExperience,
  extractEducation,
  extractCurrentCompany,
  extractCurrentDesignation: extractDesignation,
  extractCurrentSalary,
  extractExpectedSalary,
  extractNoticePeriod
};
