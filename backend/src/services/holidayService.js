const axios = require('axios');

class HolidayService {
    constructor() {
        this.cache = new Map();
        // Clear cache every 24 hours
        setInterval(() => this.cache.clear(), 24 * 60 * 60 * 1000);
    }

    /**
     * Fetches public holidays for a given year and country (PK or US)
     * using Calendarific API (https://calendarific.com/)
     * @param {number} year 
     * @param {string} countryCode 'PK' or 'US'
     * @returns {Promise<Array>}
     */
    async getHolidays(year, countryCode = 'PK') {
        const cacheKey = `${year}-${countryCode}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const apiKey = process.env.CALENDARIFIC_API_KEY;
        if (!apiKey) {
            console.error('[HolidayService] CALENDARIFIC_API_KEY is not set');
            return [];
        }

        try {
            const response = await axios.get('https://calendarific.com/api/v2/holidays', {
                params: {
                    api_key: apiKey,
                    country: countryCode,
                    year: year,
                    type: 'national'
                },
                timeout: 10000
            });

            if (response.data?.meta?.code !== 200) {
                console.error(`[HolidayService] Calendarific API error:`, response.data?.meta?.code);
                return [];
            }

            const holidays = (response.data?.response?.holidays || [])
                .filter(h => h.date?.iso)
                .map(h => ({
                    date: h.date.iso,
                    name: h.name || 'Unknown Holiday',
                    localName: h.name || 'Unknown Holiday',
                    countryCode: countryCode,
                    fixed: h.type?.includes('National holiday') || false,
                    global: h.type?.includes('National holiday') || false,
                    description: h.description || '',
                    type: h.type || []
                }));

            this.cache.set(cacheKey, holidays);
            return holidays;
        } catch (error) {
            console.error(`[HolidayService] Error fetching holidays for ${countryCode} in ${year}:`, error.message);
            return [];
        }
    }

    /**
     * Checks if a given date is a public holiday
     * @param {Date|string} date 
     * @param {string} countryCode 
     * @returns {Promise<boolean>}
     */
    async isHoliday(date, countryCode = 'PK') {
        try {
            const d = new Date(date);
            const year = d.getFullYear();
            const dateStr = d.toISOString().split('T')[0];

            const holidays = await this.getHolidays(year, countryCode);
            if (!Array.isArray(holidays)) return false;

            return holidays.some(h => h.date === dateStr);
        } catch (error) {
            return false;
        }
    }
}

module.exports = new HolidayService();
