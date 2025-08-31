export const travelFactResolvers = {
    UserWantsEuropeanFlight: () => false, // Different results than default
    UserHasVisa: () => false,
    UserHasBudget: () => true,
    UserHasOperaInterest: () => true, // Different from default
    UserWantsCulturalActivities: () => true,
    TravelingWithDog: () => true, // Different from default
    UserHasHotelRewards: () => false,
    UserNeedsPool: () => false,
    WantsLouvreVisit: () => false
};
