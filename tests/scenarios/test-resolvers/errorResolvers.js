export const travelFactResolvers = {
    UserWantsEuropeanFlight: () => {
        throw new Error('Travel service unavailable');
    },
    UserHasVisa: () => {
        throw new Error('Visa check failed');
    },
    UserHasBudget: () => {
        throw new Error('Budget service timeout');
    },
    UserHasOperaInterest: () => false,
    UserWantsCulturalActivities: () => true,
    TravelingWithDog: () => false,
    UserHasHotelRewards: () => true,
    UserNeedsPool: () => true,
    WantsLouvreVisit: () => true
};

export const systemMonitoringResolvers = {
    SystemHealthy: () => {
        throw new Error('Health check service down');
    },
    DatabaseConnected: () => {
        throw new Error('Database connection failed');
    },
    BackupCompleted: () => true,
    SecurityScanPassed: () => true,
    DiskSpaceAvailable: () => true
};

export const businessLogicResolvers = {
    CustomerIsVIP: () => {
        throw new Error('Customer service API error');
    },
    OrderExceedsThreshold: () => {
        throw new Error('Order value calculation failed');
    },
    InventoryAvailable: () => true,
    PaymentProcessed: () => true,
    ShippingAddressValid: () => true
};

export const timeBasedResolvers = {
    IsBusinessHours: () => {
        throw new Error('Time service unavailable');
    },
    IsWeekend: () => false,
    IsHoliday: () => false,
    IsAfterHours: () => false,
    IsEarlyMorning: () => false
};
