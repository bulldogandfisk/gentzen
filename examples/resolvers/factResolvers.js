export const travelFactResolvers = {
    UserWantsEuropeanFlight: () => {
        return true;
    },
    
    UserHasVisa: () => {
        return true;
    },
    
    UserHasBudget: () => {
        return true;
    },
    
    UserHasOperaInterest: () => {
        return false;
    },
    
    UserWantsCulturalActivities: () => {
        return true;
    },
    
    TravelingWithDog: () => {
        return false;
    },
    
    UserHasHotelRewards: () => {
        return true;
    },
    
    UserNeedsPool: () => {
        return true;
    },
    
    WantsLouvreVisit: () => {
        return true;
    }
};

export function createFactResolver(name, checkFunction) {
    return {
        [name]: checkFunction
    };
}

export function combineResolvers(...resolverSets) {
    return Object.assign({}, ...resolverSets);
}
