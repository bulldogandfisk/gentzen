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
