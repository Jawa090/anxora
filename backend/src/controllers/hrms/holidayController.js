const holidayService = require('../../services/holidayService');

exports.getHolidays = async (req, res, next) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        // Nager API country code, default to PK. In a real app we could get this from org settings.
        const countryCode = req.query.country || 'PK'; 
        
        const holidays = await holidayService.getHolidays(year, countryCode);
        
        // Sort holidays by date
        if (Array.isArray(holidays)) {
            holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        res.json(holidays || []);
    } catch (err) {
        next(err);
    }
};
