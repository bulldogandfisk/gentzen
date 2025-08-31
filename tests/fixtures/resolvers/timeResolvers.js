export const timeBasedResolvers = {
    IsBusinessHours: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 9 && hour <= 17; // 9 AM to 5 PM
    },
    
    IsWeekend: () => {
        const now = new Date();
        const day = now.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
    },
    
    IsHoliday: () => {
        // In a real system, this would check against a holiday calendar
        return false; // Simplified: not a holiday
    },
    
    IsAfterHours: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour < 9 || hour > 17; // Before 9 AM or after 5 PM
    },
    
    IsEarlyMorning: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 5 && hour < 9; // 5 AM to 9 AM
    }
};
