export const mockTravelResolvers = {
    UserWantsEuropeanFlight: () => true,
    UserHasVisa: () => true,
    UserHasBudget: () => true,
    UserHasOperaInterest: () => false,
    UserWantsCulturalActivities: () => true,
    TravelingWithDog: () => false,
    UserHasHotelRewards: () => true,
    UserNeedsPool: () => true,
    WantsLouvreVisit: () => true
};

export const mockSystemResolvers = {
    SystemHealthy: () => true,
    DatabaseConnected: () => true,
    BackupCompleted: () => true,
    SecurityScanPassed: () => true,
    DiskSpaceAvailable: () => true
};

export const mockBusinessResolvers = {
    CustomerIsVIP: () => true,
    OrderExceedsThreshold: () => true,
    InventoryAvailable: () => true,
    PaymentProcessed: () => true,
    ShippingAddressValid: () => true
};

export const mockTimeResolvers = {
    IsBusinessHours: () => true,
    IsWeekend: () => false,
    IsHoliday: () => false,
    IsAfterHours: () => false,
    IsEarlyMorning: () => false
};

export const allMockResolvers = {
    ...mockTravelResolvers,
    ...mockSystemResolvers,
    ...mockBusinessResolvers,
    ...mockTimeResolvers,
    ActionA: () => true,
    ActionB: () => true,
    ActionC: () => true,
    ActionD: () => true,
    ActionE: () => true
};

export function createMockResolver(returnValue) {
    return () => returnValue;
}

export function createConditionalMockResolver(condition) {
    return () => condition();
}

export function createFailingMockResolver(errorMessage = 'Mock resolver error') {
    return () => {
        throw new Error(errorMessage);
    };
}

export const travelFactResolvers = mockTravelResolvers;
export const systemMonitoringResolvers = mockSystemResolvers;
export const businessLogicResolvers = mockBusinessResolvers;
export const timeBasedResolvers = mockTimeResolvers;
