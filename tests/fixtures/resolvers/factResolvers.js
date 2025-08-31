// Example fact resolvers for the travel scenario
export const travelFactResolvers = {
    // User preferences
    UserWantsEuropeanFlight: () => {
        return true; // Simulated: user has expressed interest
    },
    
    UserHasVisa: () => {
        return true; // Simulated: visa is valid
    },
    
    UserHasBudget: () => {
        return true; // Simulated: budget is available
    },
    
    UserHasOperaInterest: () => {
        return false; // Simulated: no opera interest
    },
    
    UserWantsCulturalActivities: () => {
        return true; // Simulated: interested in culture
    },
    
    TravelingWithDog: () => {
        return false; // Simulated: no pet travel
    },
    
    UserHasHotelRewards: () => {
        return true; // Simulated: has rewards membership
    },
    
    UserNeedsPool: () => {
        return true; // Simulated: prefers pool amenities
    },
    
    WantsLouvreVisit: () => {
        return true; // Simulated: wants to visit Louvre
    }
};

