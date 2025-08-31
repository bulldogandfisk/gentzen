export const timeBasedResolvers = {
    IsBusinessHours: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 9 && hour <= 17; // 9 AM to 5 PM.
    },
    
    IsWeekend: () => {
        const now = new Date();
        const day = now.getDay();
        return day === 0 || day === 6; // Sunday or Saturday.
    },
    
    IsHoliday: () => {
        return false;
    },
    
    IsAfterHours: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour < 9 || hour > 17;
    },
    
    IsEarlyMorning: () => {
        const now = new Date();
        const hour = now.getHours();
        return hour >= 5 && hour < 9;
    }
};
